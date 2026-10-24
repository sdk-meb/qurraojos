import type { Locale } from "@/lib/locale";
import { normalizeImageUrl } from "@/lib/image-url";

type CsvRow = { line: number; values: string[] };
export type ProductCsvIssueReason =
  | "malformed"
  | "missingName"
  | "missingRequiredField"
  | "invalidPrice"
  | "invalidAvailability"
  | "invalidQuantity"
  | "invalidCategory"
  | "invalidUrl"
  | "duplicate";
export type ProductCsvIssue = { line: number; reason: ProductCsvIssueReason };
export type ProductCsvRecord = {
  slug: string;
  category_id: string;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  price_mad: number;
  available: boolean;
  feed_item_id?: string;
  brand?: string;
  condition?: string;
  product_url?: string;
  image_url?: string | null;
  image_urls?: string[];
  regular_price_mad?: number | null;
  sale_price_mad?: number | null;
  quantity_to_sell_on_facebook?: number | null;
  feed_attributes?: Record<string, string>;
};

function readCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && input[index + 1] === "\n") index += 1;
        cell += "\n";
        line += 1;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      if (cell.trim()) {
        cell += character;
      } else {
        cell = "";
        quoted = true;
      }
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push({ line: rowLine, values: row });
      row = [];
      cell = "";
      line += 1;
      rowLine = line;
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error(`Unclosed quoted field starting near line ${rowLine}.`);
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push({ line: rowLine, values: row });
  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function toAsciiDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/٫/g, ".");
}

function parseMadPrice(value: string) {
  const normalized = toAsciiDigits(value.trim());
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?\s*MAD$/i);
  if (!match || (match[2] && Number(match[2]) !== 0)) return null;
  const amount = Number(match[1]);
  return Number.isInteger(amount) && amount >= 10 && amount <= 300 ? amount : null;
}

function parseUrl(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function slugify(value: string) {
  const readable = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return `${readable || "product"}-${(hash >>> 0).toString(36)}`;
}

export function parseProductCsv(text: string, fallbackCategory: string) {
  const rows = readCsv(text);
  const headerIndex = rows.findIndex(({ values }) => {
    const headers = values.map(normalizeHeader);
    return (headers.includes("title") || headers.includes("name")) && headers.includes("price");
  });
  if (headerIndex < 0) throw new Error("Expected title/name and price columns.");

  const headers = rows[headerIndex].values.map(normalizeHeader);
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const titleColumn = column("title", "name");
  const descriptionColumn = column("description");
  const availabilityColumn = column("availability", "status");
  const priceColumn = column("price");
  const salePriceColumn = column("sale_price");
  const categoryColumn = column("category", "category_id");
  const itemIdColumn = column("id", "content_id", "sku");
  const conditionColumn = column("condition");
  const brandColumn = column("brand");
  const productUrlColumn = column("link", "product_url");
  const imageUrlColumn = column("image_link", "image_url");
  const additionalImageColumn = column("additional_image_link", "additional_image_url");
  const imageUrlsColumn = column("image_urls");
  const quantityColumn = column("quantity_to_sell_on_facebook", "quantity");
  const dataRows = rows.slice(headerIndex + 1);
  const records: ProductCsvRecord[] = [];
  const issues: ProductCsvIssue[] = [];
  const seenSlugs = new Set<string>();
  const categoryIds = new Set(["birth-gifts", "child-rearing", "children-clothing", "baby-supplies"]);

  for (const sourceRow of dataRows) {
    let values = sourceRow.values;
    if (
      values.length === headers.length + 1 &&
      (!values[0].trim() || /^[a-zA-Z0-9_-]{1,100}$/.test(values[0].trim()))
    ) {
      values = values.slice(1);
    }
    if (values.length !== headers.length) {
      issues.push({ line: sourceRow.line, reason: "malformed" });
      continue;
    }

    const title = values[titleColumn]?.trim() ?? "";
    if (!title) {
      issues.push({ line: sourceRow.line, reason: "missingName" });
      continue;
    }
    const requiredColumns = [
      descriptionColumn,
      availabilityColumn,
      conditionColumn,
      brandColumn,
      productUrlColumn,
      imageUrlColumn,
      itemIdColumn,
    ].filter((index) => index >= 0);
    if (requiredColumns.some((index) => !values[index]?.trim())) {
      issues.push({ line: sourceRow.line, reason: "missingRequiredField" });
      continue;
    }

    const rawPrice = values[salePriceColumn]?.trim() ? values[salePriceColumn] : values[priceColumn];
    const regularPriceMad = values[priceColumn]?.trim() ? parseMadPrice(values[priceColumn]) : null;
    const salePriceMad = salePriceColumn >= 0 && values[salePriceColumn].trim()
      ? parseMadPrice(values[salePriceColumn])
      : null;
    const priceMad = parseMadPrice(rawPrice);
    if (priceMad === null) {
      issues.push({ line: sourceRow.line, reason: "invalidPrice" });
      continue;
    }
    if (
      (values[priceColumn]?.trim() && regularPriceMad === null) ||
      (salePriceColumn >= 0 && values[salePriceColumn].trim() && salePriceMad === null)
    ) {
      issues.push({ line: sourceRow.line, reason: "invalidPrice" });
      continue;
    }

    const availability = availabilityColumn >= 0
      ? values[availabilityColumn].trim().toLowerCase().replace(/_/g, " ")
      : "in stock";
    if (availability !== "in stock" && availability !== "out of stock") {
      issues.push({ line: sourceRow.line, reason: "invalidAvailability" });
      continue;
    }

    const category = categoryColumn >= 0 && values[categoryColumn].trim()
      ? values[categoryColumn].trim()
      : fallbackCategory;
    if (!categoryIds.has(category)) {
      issues.push({ line: sourceRow.line, reason: "invalidCategory" });
      continue;
    }

    const productUrl = productUrlColumn >= 0 && values[productUrlColumn].trim()
      ? parseUrl(values[productUrlColumn])
      : null;
    const imageUrls = [
      ...(imageUrlColumn >= 0 ? values[imageUrlColumn].split(/[;\r\n]+/) : []),
      ...(additionalImageColumn >= 0 ? values[additionalImageColumn].split(/[;\r\n]+/) : []),
      ...(imageUrlsColumn >= 0 ? values[imageUrlsColumn].split(/[;\r\n]+/) : []),
    ].map((url) => url.trim()).filter(Boolean).map(parseUrl);
    if (
      (productUrlColumn >= 0 && values[productUrlColumn].trim() && !productUrl) ||
      imageUrls.some((url) => url === null)
    ) {
      issues.push({ line: sourceRow.line, reason: "invalidUrl" });
      continue;
    }
    const uniqueImageUrls = Array.from(new Set(imageUrls
      .filter((url): url is string => url !== null)
      .map(normalizeImageUrl)));

    const feedAttributes: Record<string, string> = {};
    const mappedColumns = new Set([
      titleColumn, descriptionColumn, availabilityColumn, priceColumn, salePriceColumn,
      categoryColumn, itemIdColumn, conditionColumn, brandColumn, productUrlColumn,
      imageUrlColumn, additionalImageColumn, imageUrlsColumn, quantityColumn,
    ].filter((index) => index >= 0));
    headers.forEach((header, index) => {
      const value = values[index]?.trim() ?? "";
      if (value && !mappedColumns.has(index)) feedAttributes[header] = value;
    });

    const quantity = quantityColumn >= 0 && values[quantityColumn].trim()
      ? Number(toAsciiDigits(values[quantityColumn].trim()))
      : null;
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) {
      issues.push({ line: sourceRow.line, reason: "invalidQuantity" });
      continue;
    }

    const slugColumn = column("slug");
    const suppliedSlug = slugColumn >= 0 ? values[slugColumn].trim() : "";
    const slug = suppliedSlug || slugify(title);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seenSlugs.has(slug)) {
      issues.push({ line: sourceRow.line, reason: "duplicate" });
      continue;
    }
    seenSlugs.add(slug);

    records.push({
      slug,
      category_id: category,
      name: { ar: title, fr: "", en: "", es: "" },
      description: { ar: descriptionColumn >= 0 ? values[descriptionColumn].trim() : "", fr: "", en: "", es: "" },
      price_mad: priceMad,
      available: availability === "in stock",
      ...(itemIdColumn >= 0 && values[itemIdColumn].trim() ? { feed_item_id: values[itemIdColumn].trim() } : {}),
      ...(brandColumn >= 0 && values[brandColumn].trim() ? { brand: values[brandColumn].trim() } : {}),
      ...(conditionColumn >= 0 && values[conditionColumn].trim() ? { condition: values[conditionColumn].trim() } : {}),
      ...(productUrl ? { product_url: productUrl } : {}),
      ...(uniqueImageUrls.length
        ? { image_url: uniqueImageUrls[0], image_urls: uniqueImageUrls }
        : imageUrlColumn >= 0 || additionalImageColumn >= 0 || imageUrlsColumn >= 0
          ? { image_url: null, image_urls: [] }
          : {}),
      ...(regularPriceMad !== null ? { regular_price_mad: regularPriceMad } : {}),
      ...(salePriceMad !== null ? { sale_price_mad: salePriceMad } : {}),
      ...(quantity !== null ? { quantity_to_sell_on_facebook: quantity } : {}),
      ...(Object.keys(feedAttributes).length ? { feed_attributes: feedAttributes } : {}),
    });
  }

  return { records, issues };
}
