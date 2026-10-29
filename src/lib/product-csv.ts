import type { Locale } from "@/lib/locale";
import { normalizeImageUrl } from "@/lib/image-url";

type CsvRow = { line: number; values: string[] };
export type ProductCsvIssueReason =
  | "malformed"
  | "missingName"
  | "missingRequiredField"
  | "invalidPrice"
  | "invalidAvailability"
  | "invalidCondition"
  | "invalidQuantity"
  | "invalidCategory"
  | "invalidUrl"
  | "invalidColor"
  | "duplicate";
export type ProductCsvIssue = { line: number; reason: ProductCsvIssueReason };
export type ProductCsvRecord = {
  slug: string;
  category_id: string;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  price_mad: number;
  available: boolean;
  feed_item_id?: string | null;
  brand?: string;
  condition?: string;
  image_urls?: string[];
  google_product_category?: string;
  fb_product_category?: string;
  age_group?: string;
  material?: string;
  regular_price_mad?: number | null;
  sale_price_mad?: number | null;
  quantity_to_sell_on_facebook?: number | null;
  feed_attributes?: Record<string, string>;
};
export type ProductColorCsvRecord = {
  product_slug: string;
  feed_item_id: string;
  color_id: string;
  available: boolean;
  price_mad: number;
  image_urls: string[];
  source_title: string;
  source_description: string;
  sort_order: number;
};

const categoryIds = new Set([
  "diapering-potty",
  "feeding-nursing",
  "bath-skincare-health",
  "clothing-footwear",
  "nursery-sleep",
  "gear-safety-toys",
]);

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

function inferCategory(googleCategory: string, facebookCategory: string) {
  const google = googleCategory.toLowerCase();
  const facebook = facebookCategory.toLowerCase();
  if (google.includes("diapering") || facebook.includes("diaper")) return "diapering-potty";
  if (google.includes("feeding") || google.includes("nursing") || facebook.includes("feeding")) {
    return "feeding-nursing";
  }
  if (google.includes("bathing") || google.includes("skincare") || google.includes("health") ||
    facebook.includes("bath") || facebook.includes("health") || facebook.includes("towel")) {
    return "bath-skincare-health";
  }
  if (google.includes("clothing") || google.includes("footwear") ||
    facebook.includes("clothing") || facebook.includes("footwear") || facebook.includes("baby_hat")) {
    return "clothing-footwear";
  }
  if (google.includes("blanket") || google.includes("bedding") || google.includes("nursery") ||
    google.includes("crib") || google.includes("sleep") || facebook.includes("blanket") ||
    facebook.includes("bedding")) {
    return "nursery-sleep";
  }
  if (google.includes("stroller") || google.includes("car seat") || google.includes("toy") ||
    google.includes("safety") || facebook.includes("toy") || facebook.includes("stroller")) {
    return "gear-safety-toys";
  }
  return null;
}

export type ProductCsvColor = { id: string; label: Record<Locale, string>; aliases: string[] };

function findColor(color: string, colors: ProductCsvColor[]) {
  const normalized = color.trim().toLocaleLowerCase();
  return colors.find((candidate) =>
    candidate.id.toLocaleLowerCase() === normalized ||
    Object.values(candidate.label).some((label) => label.toLocaleLowerCase() === normalized) ||
    candidate.aliases.some((alias) => alias.toLocaleLowerCase() === normalized),
  ) ?? null;
}

function titleWithoutColor(title: string, color: string) {
  if (!color.trim()) return title.trim();
  const escaped = color.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title
    .replace(new RegExp(`(?:\\s*[-–—]\\s*|\\s+)${escaped}\\s*$`, "i"), "")
    .replace(/[\s\-–—]+$/g, "")
    .trim() || title.trim();
}

export function parseProductCsv(
  text: string,
  validCategoryIds: ReadonlySet<string> = categoryIds,
  colors: ProductCsvColor[] = [],
) {
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
  const categoryColumn = column("category", "category_id", "store_category");
  const googleCategoryColumn = column("google_product_category");
  const facebookCategoryColumn = column("fb_product_category", "facebook_product_category");
  const itemIdColumn = column("id", "content_id", "sku");
  const conditionColumn = column("condition");
  const brandColumn = column("brand");
  const productUrlColumn = column("link", "product_url");
  const imageUrlColumn = column("image_link", "image_url");
  const imageUrlsColumn = column("image_urls");
  const quantityColumn = column("quantity_to_sell_on_facebook", "quantity");
  const colorColumn = column("color");
  const dataRows = rows.slice(headerIndex + 1);
  const issues: ProductCsvIssue[] = [];
  const parsedRows: Array<{
    line: number;
    product: ProductCsvRecord;
    productTitle: string;
    sourceTitle: string;
    sourceDescription: string;
    sourceId: string;
    color?: string;
    colorId?: string;
    colorPrice?: number;
    colorAvailable?: boolean;
    imageUrls: string[];
  }> = [];
  const additionalImageColumns = headers.flatMap((header, index) =>
    header === "additional_image_link" || /^additional_image_link\[\d+\]$/.test(header) ||
    header === "additional_image_url" ? [index] : [],
  );

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
    if (priceMad === null ||
      (values[priceColumn]?.trim() && regularPriceMad === null) ||
      (salePriceColumn >= 0 && values[salePriceColumn].trim() && salePriceMad === null)) {
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
    const condition = conditionColumn >= 0 ? values[conditionColumn].trim().toLowerCase() : "";
    if (condition && condition !== "new" && condition !== "used") {
      issues.push({ line: sourceRow.line, reason: "invalidCondition" });
      continue;
    }

    const googleCategory = googleCategoryColumn >= 0 ? values[googleCategoryColumn].trim() : "";
    const facebookCategory = facebookCategoryColumn >= 0 ? values[facebookCategoryColumn].trim() : "";
    const category = categoryColumn >= 0 && values[categoryColumn].trim()
      ? values[categoryColumn].trim()
      : inferCategory(googleCategory, facebookCategory);
    if (!category || !validCategoryIds.has(category)) {
      issues.push({ line: sourceRow.line, reason: "invalidCategory" });
      continue;
    }

    const rawImageUrls = [
      ...(imageUrlColumn >= 0 ? values[imageUrlColumn].split(/[;\r\n]+/) : []),
      ...additionalImageColumns.flatMap((index) => values[index].split(/[;\r\n]+/)),
      ...(imageUrlsColumn >= 0 ? values[imageUrlsColumn].split(/[;\r\n]+/) : []),
    ].map((url) => url.trim()).filter(Boolean);
    const imageUrls = rawImageUrls.map(parseUrl);
    if (imageUrls.some((url) => url === null)) {
      issues.push({ line: sourceRow.line, reason: "invalidUrl" });
      continue;
    }
    const uniqueImageUrls = Array.from(new Set(
      imageUrls.filter((url): url is string => url !== null).map(normalizeImageUrl),
    ));

    const quantity = quantityColumn >= 0 && values[quantityColumn].trim()
      ? Number(toAsciiDigits(values[quantityColumn].trim()))
      : null;
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) {
      issues.push({ line: sourceRow.line, reason: "invalidQuantity" });
      continue;
    }

    const sourceId = itemIdColumn >= 0 ? values[itemIdColumn].trim() : "";
    if (!sourceId) {
      issues.push({ line: sourceRow.line, reason: "missingRequiredField" });
      continue;
    }
    const color = colorColumn >= 0 ? values[colorColumn].trim() : "";
    const colorInfo = color ? findColor(color, colors) : null;
    if (color && !colorInfo) {
      issues.push({ line: sourceRow.line, reason: "invalidColor" });
      continue;
    }
    const productTitle = titleWithoutColor(title, color);
    const slug = slugify(productTitle);
    const mappedColumns = new Set([
      titleColumn, descriptionColumn, availabilityColumn, priceColumn, salePriceColumn,
      categoryColumn, googleCategoryColumn, facebookCategoryColumn, itemIdColumn,
      conditionColumn, brandColumn, productUrlColumn, imageUrlColumn,
      imageUrlsColumn, quantityColumn, colorColumn, ...additionalImageColumns,
    ].filter((index) => index >= 0));
    const feedAttributes: Record<string, string> = {};
    headers.forEach((header, index) => {
      const value = values[index]?.trim() ?? "";
      if (value && !mappedColumns.has(index)) feedAttributes[header] = value;
    });
    const product: ProductCsvRecord = {
      slug,
      category_id: category,
      name: { ar: productTitle, fr: "", en: "", es: "" },
      description: { ar: descriptionColumn >= 0 ? values[descriptionColumn].trim() : "", fr: "", en: "", es: "" },
      price_mad: priceMad,
      available: availability === "in stock",
      ...(color ? {} : { feed_item_id: sourceId }),
      ...(brandColumn >= 0 && values[brandColumn].trim() ? { brand: values[brandColumn].trim() } : {}),
      ...(condition ? { condition } : {}),
      ...(uniqueImageUrls.length
        ? { image_urls: uniqueImageUrls }
        : imageUrlColumn >= 0 || additionalImageColumns.length > 0 || imageUrlsColumn >= 0
          ? { image_urls: [] }
          : {}),
      ...(googleCategory ? { google_product_category: googleCategory } : {}),
      ...(facebookCategory ? { fb_product_category: facebookCategory } : {}),
      ...(feedAttributes.age_group ? { age_group: feedAttributes.age_group } : {}),
      ...(feedAttributes.material ? { material: feedAttributes.material } : {}),
      ...(regularPriceMad !== null ? { regular_price_mad: regularPriceMad } : {}),
      ...(salePriceMad !== null ? { sale_price_mad: salePriceMad } : {}),
      ...(quantity !== null ? { quantity_to_sell_on_facebook: quantity } : {}),
      ...(Object.keys(feedAttributes).length ? { feed_attributes: feedAttributes } : {}),
    };
    parsedRows.push({
      line: sourceRow.line,
      product,
      productTitle,
      sourceTitle: title,
      sourceDescription: descriptionColumn >= 0 ? values[descriptionColumn].trim() : "",
      sourceId,
      ...(colorInfo ? { color, colorId: colorInfo.id } : {}),
      ...(color ? { colorPrice: priceMad, colorAvailable: availability === "in stock" } : {}),
      imageUrls: uniqueImageUrls,
    });
  }

  const groups = new Map<string, typeof parsedRows>();
  for (const row of parsedRows) {
    const groupKey = `${row.product.category_id}:${row.product.slug}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }

  const records: ProductCsvRecord[] = [];
  const colorOptions: ProductColorCsvRecord[] = [];
  const seenFeedIds = new Set<string>();
  for (const group of Array.from(groups.values())) {
    const duplicateIdRows = group.filter((row) => {
      if (seenFeedIds.has(row.sourceId)) return true;
      seenFeedIds.add(row.sourceId);
      return false;
    });
    duplicateIdRows.forEach(({ line }) => issues.push({ line, reason: "duplicate" }));
    const validRows = group.filter((row) => !duplicateIdRows.includes(row));
    if (!validRows.length) continue;
    const coloredRows = validRows.filter((row) => row.color && row.colorId);

    const first = validRows[0];
    const uniqueColoredRows = coloredRows.filter((row, index) => {
      const isDuplicate = coloredRows.findIndex((candidate) => candidate.colorId === row.colorId) !== index;
      if (isDuplicate) issues.push({ line: row.line, reason: "duplicate" });
      return !isDuplicate;
    });
    const generalImageUrls = Array.from(new Set(validRows.filter((row) => !row.color).flatMap((row) => row.imageUrls)));
    const product: ProductCsvRecord = {
      ...first.product,
      name: { ...first.product.name },
      description: {
        ...first.product.description,
        ar: first.color
          ? titleWithoutColor(first.sourceDescription, first.color)
          : first.sourceDescription,
      },
      available: coloredRows.length
        ? coloredRows.some((row) => row.colorAvailable)
        : first.product.available,
      image_urls: generalImageUrls,
      ...(uniqueColoredRows.length
        ? {
            feed_item_id: null,
          }
        : {}),
    };
    for (const row of uniqueColoredRows) {
      colorOptions.push({
        product_slug: product.slug,
        feed_item_id: row.sourceId,
        color_id: row.colorId!,
        available: row.colorAvailable ?? false,
        price_mad: row.colorPrice ?? product.price_mad,
        image_urls: row.imageUrls,
        source_title: row.sourceTitle,
        source_description: row.sourceDescription,
        sort_order: colorOptions.filter((option) => option.product_slug === product.slug).length,
      });
    }
    records.push(product);
  }

  return { records, colorOptions, issues };
}
