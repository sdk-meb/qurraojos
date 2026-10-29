import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { parseProductCsv, type ProductCsvColor, type ProductCsvIssue } from "@/lib/product-csv";

export const dynamic = "force-dynamic";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

function isUploadedCsv(value: FormDataEntryValue | null): value is File {
  return value !== null &&
    typeof value !== "string" &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    typeof value.text === "function";
}

async function importProducts(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_CSV_BYTES + 128 * 1024) {
    return NextResponse.json({ error: "The CSV upload exceeds the 2 MB limit." }, { status: 413 });
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Sign in with the store owner account to import products." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || authData.user?.app_metadata?.store_owner !== true) {
    return NextResponse.json({ error: "This account is not authorized to import products." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload a valid CSV form." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!isUploadedCsv(file) || !file.name.toLowerCase().endsWith(".csv") || file.size > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "Choose a CSV file smaller than 2 MB." }, { status: 400 });
  }

  let parsed: ReturnType<typeof parseProductCsv>;
  try {
    const [categoriesResult, colorsResult] = await Promise.all([
      supabase.from("categories").select("id"),
      supabase.from("colors").select("id, label, aliases").eq("active", true),
    ]);
    if (categoriesResult.error) {
      return NextResponse.json({
        error: `Could not verify database categories. Apply the fresh catalogue schema and reference data first. ${categoriesResult.error.message}`,
      }, { status: 500 });
    }
    if (colorsResult.error) {
      return NextResponse.json({
        error: `Could not load the fixed color list. Apply the fresh catalogue schema and reference data first. ${colorsResult.error.message}`,
      }, { status: 500 });
    }
    const categoryIds = new Set((categoriesResult.data ?? []).map(({ id }) => id as string));
    const colors = (colorsResult.data ?? []) as ProductCsvColor[];
    parsed = parseProductCsv(await file.text(), categoryIds, colors);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not interpret this CSV.",
    }, { status: 400 });
  }

  if (!parsed.records.length) {
    return NextResponse.json({
      error: "No valid product rows were found. Check the CSV columns, category rows, prices, and required values.",
      issues: parsed.issues,
    }, { status: 422 });
  }

  const { error: productsSchemaError } = await supabase
    .from("products")
    .select("id, slug, category_id, name, description, price_mad, available, feed_item_id, brand, condition, google_product_category, fb_product_category, age_group, material, regular_price_mad, sale_price_mad, quantity_to_sell_on_facebook, feed_attributes")
    .limit(0);
  if (productsSchemaError) {
    return NextResponse.json({
      error: `The products table is missing columns required by the importer. Apply the catalogue schema upgrade. ${productsSchemaError.message}`,
    }, { status: 500 });
  }

  const { error: colorsTableError } = await supabase
    .from("product_color_options")
    .select("id, color_id")
    .limit(1);
  if (colorsTableError) {
    return NextResponse.json({
      error: `The color option table is unavailable. Apply the fresh catalogue schema first. ${colorsTableError.message}`,
    }, { status: 500 });
  }
  const { error: imagesTableError } = await supabase.from("product_images").select("id").limit(1);
  if (imagesTableError) {
    return NextResponse.json({
      error: `The product image table is unavailable. Apply the fresh catalogue schema first. ${imagesTableError.message}`,
    }, { status: 500 });
  }

  const slugs = parsed.records.map(({ slug }) => slug);
  const { data: existingRows, error: lookupError } = await supabase
    .from("products")
    .select("*")
    .in("slug", slugs);
  if (lookupError) {
    return NextResponse.json({ error: `Could not check existing products. ${lookupError.message}` }, { status: 500 });
  }

  const existingBySlug = new Map((existingRows ?? []).map((row) => [row.slug as string, row]));
  const recordsToUpsert = parsed.records.map((record) => {
    const productRecord = { ...record };
    delete productRecord.image_urls;
    const existing = existingBySlug.get(record.slug);
    if (!existing) return productRecord;
    return {
      ...existing,
      ...productRecord,
      id: existing.id,
      name: { ...existing.name, ...productRecord.name },
      description: { ...existing.description, ...productRecord.description },
      feed_attributes: { ...existing.feed_attributes, ...productRecord.feed_attributes },
    };
  });
  const { error: productWriteError } = await supabase
    .from("products")
    .upsert(recordsToUpsert, { onConflict: "slug" });
  if (productWriteError) {
    return NextResponse.json({ error: `Product import failed. ${productWriteError.message}` }, { status: 500 });
  }

  const { data: productRows, error: productLookupError } = await supabase
    .from("products")
    .select("id, slug")
    .in("slug", slugs);
  if (productLookupError) {
    return NextResponse.json({
      error: `Products were saved, but their images and colors could not be linked. ${productLookupError.message}`,
      productsSaved: parsed.records.length,
    }, { status: 500 });
  }
  const productIds = new Map((productRows ?? []).map((row) => [row.slug as string, row.id as string]));
  const unlinked = parsed.records.find(({ slug }) => !productIds.has(slug));
  if (unlinked) {
    return NextResponse.json({
      error: `Products were saved, but their images could not be linked to ${unlinked.slug}.`,
      productsSaved: parsed.records.length,
    }, { status: 500 });
  }
  if (parsed.colorOptions.length) {
    const colorRows = parsed.colorOptions.map((option) => {
      const { product_slug, ...color } = option;
      const colorRow: Record<string, unknown> = { ...color };
      delete colorRow.image_urls;
      return { ...colorRow, product_id: productIds.get(product_slug)! };
    });
    const { error: colorWriteError } = await supabase
      .from("product_color_options")
      .upsert(colorRows, { onConflict: "product_id,color_id" });
    if (colorWriteError) {
      return NextResponse.json({
        error: `Products were saved, but color options could not be imported. ${colorWriteError.message}`,
        productsSaved: parsed.records.length,
      }, { status: 500 });
    }
  }

  const productIdList = Array.from(productIds.values());
  const { data: savedOptions, error: savedOptionsError } = await supabase
    .from("product_color_options")
    .select("id, product_id, color_id")
    .in("product_id", productIdList);
  if (savedOptionsError) {
    return NextResponse.json({
      error: `Products were saved, but color images could not be linked. ${savedOptionsError.message}`,
      productsSaved: parsed.records.length,
    }, { status: 500 });
  }
  const optionIds = new Map((savedOptions ?? []).map((option) => [
    `${option.product_id}:${option.color_id}`,
    option.id as string,
  ]));
  const expectedImages = new Map<string, { product_id: string; color_option_id: string | null; image_urls: Set<string> }>();
  const addExpectedImages = (productId: string, optionId: string | null, urls: string[]) => {
    const scope = `${productId}:${optionId ?? "general"}`;
    const current = expectedImages.get(scope) ?? {
      product_id: productId,
      color_option_id: optionId,
      image_urls: new Set<string>(),
    };
    urls.forEach((url) => current.image_urls.add(url));
    expectedImages.set(scope, current);
  };
  for (const record of parsed.records) {
    addExpectedImages(productIds.get(record.slug)!, null, record.image_urls ?? []);
  }
  for (const option of parsed.colorOptions) {
    const productId = productIds.get(option.product_slug)!;
    const optionId = optionIds.get(`${productId}:${option.color_id}`);
    if (!optionId) {
      return NextResponse.json({
        error: `Products were saved, but color images could not be linked to ${option.product_slug}.`,
        productsSaved: parsed.records.length,
      }, { status: 500 });
    }
    addExpectedImages(productId, optionId, option.image_urls);
  }

  const imageRows = Array.from(expectedImages.values()).flatMap(({ product_id, color_option_id, image_urls }) =>
    Array.from(image_urls).map((image_url, sort_order) => ({
      product_id,
      color_option_id,
      image_url,
      sort_order,
    })),
  );
  if (imageRows.length) {
    const { error: imageWriteError } = await supabase
      .from("product_images")
      .upsert(imageRows, { onConflict: "product_id,color_option_id,image_url" });
    if (imageWriteError) {
      return NextResponse.json({
        error: `Products and colors were saved, but images could not be imported. ${imageWriteError.message}`,
        productsSaved: parsed.records.length,
      }, { status: 500 });
    }
  }
  const { data: existingImages, error: existingImagesError } = await supabase
    .from("product_images")
    .select("id, product_id, color_option_id, image_url")
    .in("product_id", productIdList);
  if (existingImagesError) {
    return NextResponse.json({
      error: `Products were saved, but stale images could not be checked. ${existingImagesError.message}`,
      productsSaved: parsed.records.length,
    }, { status: 500 });
  }
  const staleIds = (existingImages ?? []).filter((image) => {
    const scope = `${image.product_id}:${image.color_option_id ?? "general"}`;
    const expected = expectedImages.get(scope);
    return expected !== undefined && !expected.image_urls.has(image.image_url as string);
  }).map((image) => image.id as string);
  if (staleIds.length) {
    const { error: staleDeleteError } = await supabase.from("product_images").delete().in("id", staleIds);
    if (staleDeleteError) {
      return NextResponse.json({
        error: `Products and images were saved, but outdated image links could not be removed. ${staleDeleteError.message}`,
        productsSaved: parsed.records.length,
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    imported: parsed.records.length,
    colorsImported: parsed.colorOptions.length,
    issues: parsed.issues satisfies ProductCsvIssue[],
  });
}

export async function POST(request: Request) {
  try {
    return await importProducts(request);
  } catch (error) {
    console.error("Unexpected product CSV import failure:", error);
    return NextResponse.json({
      error: error instanceof Error
        ? `The server could not complete the CSV import. ${error.message}`
        : "The server could not complete the CSV import.",
    }, { status: 500 });
  }
}
