import type { Color } from "@/lib/catalog";

export type MetaDriveIssue = {
  source: string;
  message: string;
};

export type MetaProduct = {
  sourceLines: number[];
  sourceNames: string[];
  name: string;
  description: string;
  priceMad: number | null;
  available: boolean | null;
  sourceUrl: string;
  slug: string;
  feedItemId: string;
  feedAttributes: Record<string, string>;
  conflictingSourceRows: boolean;
  sourceIssues: string[];
};

export type DriveProductFolder = {
  name: string;
  images: string[];
  variants: Array<{ name: string; images: string[] }>;
  duplicateFolders: number;
};

export type MetaDriveImage = {
  url: string;
  name: string;
  colorId: string | null;
  variantName?: string;
};

export type CsvRecord = Record<string, string>;

function readCsv(text: string) {
  const rows: Array<{ line: number; values: string[] }> = [];
  let values: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        cell += "\n";
        line += 1;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && !cell.trim()) {
      cell = "";
      quoted = true;
    } else if (character === ",") {
      values.push(cell);
      cell = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      values.push(cell);
      if (values.some((value) => value.trim())) rows.push({ line: rowLine, values });
      values = [];
      cell = "";
      line += 1;
      rowLine = line;
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error(`Unclosed quoted CSV field near line ${rowLine}.`);
  values.push(cell);
  if (values.some((value) => value.trim())) rows.push({ line: rowLine, values });
  return rows;
}

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function slugForProduct(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return `${normalized || "product"}-${stableHash(normalizeText(name))}`;
}

function parsePrice(value: string) {
  const normalized = value.trim().replace(/[٠-٩]/g, (digit) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
  );
  if (!/^\d+(?:\.0+)?$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isInteger(price) && price >= 10 && price <= 300 ? price : null;
}

function parseAvailability(value: string) {
  const normalized = normalizeText(value).replace(/[_-]/g, " ");
  if (["in stock", "available", "true", "1"].includes(normalized)) return true;
  if (["out of stock", "unavailable", "false", "0"].includes(normalized)) return false;
  return null;
}

function normalizeHeaders(value: string) {
  return value.trim().toLocaleLowerCase().replace(/^\uFEFF/, "").replace(/\s+/g, "_");
}

function skippedMetaImage(value: string) {
  try {
    const url = new URL(value);
    return /(^|\.)fbcdn\.net$/i.test(url.hostname) ||
      /(^|\.)facebook\.com$/i.test(url.hostname) ||
      (url.searchParams.has("oh") && url.searchParams.has("oe"));
  } catch {
    return false;
  }
}

export function parseMetaCsv(text: string) {
  const rows = readCsv(text);
  const headerRow = rows.find(({ values }) => {
    const headers = values.map(normalizeHeaders);
    return headers.includes("name") && headers.includes("price");
  });
  if (!headerRow) throw new Error("CSV must include at least the name and price columns.");

  const headers = headerRow.values.map(normalizeHeaders);
  const indexOf = (name: string) => headers.indexOf(name);
  const nameColumn = indexOf("name");
  const priceColumn = indexOf("price");
  const availabilityColumn = indexOf("availability");
  const urlColumn = indexOf("url");
  const descriptionColumn = indexOf("description");
  const itemIdColumn = ["feed_item_id", "id", "content_id", "sku"]
    .map(indexOf)
    .find((index) => index >= 0) ?? -1;
  const mediaColumns = headers.flatMap((header, index) =>
    header.includes("image") ? [index] : [],
  );
  const grouped = new Map<string, MetaProduct>();
  const issues: MetaDriveIssue[] = [];

  for (const row of rows.slice(rows.indexOf(headerRow) + 1)) {
    if (row.values.length !== headers.length) {
      issues.push({ source: `CSV row ${row.line}`, message: "Malformed column count." });
      continue;
    }
    const name = row.values[nameColumn]?.trim() ?? "";
    const sourceLabel = `CSV row ${row.line}`;
    const sourceIssues: string[] = [];
    if (!name) sourceIssues.push("Product name is missing.");

    const priceMad = parsePrice(row.values[priceColumn] ?? "");
    if (priceMad === null) sourceIssues.push("Price must be a whole MAD amount from 10 to 300.");

    const available = availabilityColumn < 0
      ? true
      : parseAvailability(row.values[availabilityColumn] ?? "");
    if (available === null) sourceIssues.push("Availability is not a recognized in-stock/out-of-stock value.");

    const extraAttributes: Record<string, string> = {};
    headers.forEach((header, index) => {
      const value = row.values[index]?.trim() ?? "";
      if (!value || [
        nameColumn, priceColumn, availabilityColumn, urlColumn, descriptionColumn, itemIdColumn,
      ].includes(index)) return;
      if (mediaColumns.includes(index)) {
        if (skippedMetaImage(value)) {
          issues.push({ source: sourceLabel, message: `Skipped temporary Meta image URL in ${header}.` });
        }
        return;
      }
      extraAttributes[header || `column_${index + 1}`] = value;
    });

    const safeName = name || `CSV row ${row.line}`;
    const slug = slugForProduct(safeName);
    const key = normalizeText(safeName);
    const description = descriptionColumn >= 0 ? row.values[descriptionColumn].trim() : "";
    const sourceUrl = urlColumn >= 0 ? row.values[urlColumn].trim() : "";
    const sourceItemId = itemIdColumn >= 0 ? row.values[itemIdColumn].trim() : "";
    const feedAttributes = {
      ...(sourceUrl ? { source_url: sourceUrl } : {}),
      ...extraAttributes,
    };
    const existing = grouped.get(key);
    if (existing) {
      const differs = existing.priceMad !== priceMad ||
        existing.available !== available ||
        existing.description !== description;
      existing.conflictingSourceRows ||= existing.feedItemId !== (sourceItemId || slug);
      existing.sourceLines.push(row.line);
      existing.sourceNames.push(safeName);
      existing.conflictingSourceRows ||= differs;
      existing.sourceIssues.push(...sourceIssues);
      existing.feedAttributes = { ...existing.feedAttributes, ...extraAttributes };
      continue;
    }

    grouped.set(key, {
      sourceLines: [row.line],
      sourceNames: [safeName],
      name: safeName,
      description,
      priceMad,
      available,
      sourceUrl,
      slug,
      feedItemId: sourceItemId || slug,
      feedAttributes,
      conflictingSourceRows: false,
      sourceIssues,
    });
  }

  const products = Array.from(grouped.values());
  const slugOwners = new Map<string, MetaProduct>();
  const feedIdOwners = new Map<string, MetaProduct>();
  for (const product of products) {
    const previous = slugOwners.get(product.slug);
    if (previous && previous !== product) {
      product.sourceIssues.push(`Generated slug collision with "${previous.name}". Choose a unique slug.`);
      previous.sourceIssues.push(`Generated slug collision with "${product.name}". Choose a unique slug.`);
    } else {
      slugOwners.set(product.slug, product);
    }
    const previousFeedId = feedIdOwners.get(product.feedItemId);
    if (previousFeedId && previousFeedId !== product) {
      product.sourceIssues.push(`Duplicate feed_item_id "${product.feedItemId}". Edit it to a unique value.`);
      previousFeedId.sourceIssues.push(`Duplicate feed_item_id "${product.feedItemId}". Edit it to a unique value.`);
    } else {
      feedIdOwners.set(product.feedItemId, product);
    }
  }
  return { products, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function isOriginalFolder(name: string) {
  return ["اصلية", "أصلية", "original", "originals", "product images", "صور"].includes(normalizeText(name));
}

function colorForFolder(name: string, colors: Color[]) {
  const target = normalizeText(name).replace(/[\s_-]/g, "");
  return colors.find((color) => [
    color.id,
    ...Object.values(color.label),
    ...color.aliases,
  ].some((alias) => normalizeText(alias).replace(/[\s_-]/g, "") === target))?.id ?? "";
}

export function parseDriveJson(text: string) {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || !Array.isArray(parsed.global)) {
    throw new Error('Drive JSON must contain a "global" array.');
  }

  const byName = new Map<string, DriveProductFolder>();
  for (const globalItem of parsed.global) {
    if (!isRecord(globalItem) || !isRecord(globalItem.folder) || !Array.isArray(globalItem.folder.folders)) {
      throw new Error('Each Drive "global" entry must contain folder.folders[].');
    }
    for (const rawFolder of globalItem.folder.folders) {
      if (!isRecord(rawFolder) || typeof rawFolder.name !== "string" || !rawFolder.name.trim()) continue;
      const folderName = rawFolder.name.trim();
      const key = normalizeText(folderName);
      let product = byName.get(key);
      if (!product) {
        product = { name: folderName, images: [], variants: [], duplicateFolders: 0 };
        byName.set(key, product);
      }
      product.duplicateFolders += 1;
      product.images.push(...stringArray(rawFolder.images));
      const subfolders = Array.isArray(rawFolder.folders) ? rawFolder.folders : [];
      for (const rawVariant of subfolders) {
        if (!isRecord(rawVariant) || typeof rawVariant.name !== "string" || !rawVariant.name.trim()) continue;
        const variantName = rawVariant.name.trim();
        const variantKey = normalizeText(variantName);
        let variant = product.variants.find((candidate) => normalizeText(candidate.name) === variantKey);
        if (!variant) {
          variant = { name: variantName, images: [] };
          product.variants.push(variant);
        }
        variant.images.push(...stringArray(rawVariant.images));
      }
    }
  }

  return Array.from(byName.values()).map((product) => ({
    ...product,
    images: Array.from(new Set(product.images)),
    variants: product.variants.map((variant) => ({
      ...variant,
      images: Array.from(new Set(variant.images)),
    })),
  }));
}

export function inferColorMapping(folderName: string, colors: Color[]) {
  if (isOriginalFolder(folderName)) return "__product__";
  return colorForFolder(folderName, colors);
}

export function normalizeImageLink(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (skippedMetaImage(url.toString())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Keep this namespace stable so repeated imports produce the same IDs.
const UUID_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

export async function uuidV5(name: string) {
  const namespaceBytes = UUID_NAMESPACE.replace(/-/g, "").match(/.{2}/g);
  if (!namespaceBytes || !globalThis.crypto?.subtle) {
    throw new Error("This browser does not support deterministic UUID generation.");
  }
  const namespace = new Uint8Array(namespaceBytes.map((byte) => Number.parseInt(byte, 16)));
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(namespace.length + nameBytes.length);
  input.set(namespace);
  input.set(nameBytes, namespace.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = Array.from(hash.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function makeCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
