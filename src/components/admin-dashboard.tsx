"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, productFromRow, type Product, type ProductVariant } from "@/lib/catalog";
import { getCopy, type Locale } from "@/lib/locale";
import { parseProductCsv, type ProductCsvIssue } from "@/lib/product-csv";
import { normalizeImageUrl } from "@/lib/image-url";
import { ProductImage } from "@/components/product-image";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string");
}

type DriveFolderNode = {
  id: string;
  name: string;
  resourceKey?: string;
  images: Array<{ id: string; name: string; url: string }>;
  folders: DriveFolderNode[];
};

function driveImageUrls(folder: DriveFolderNode): string[] {
  return [
    ...folder.images.map(({ url }) => normalizeImageUrl(url)),
    ...folder.folders.flatMap(driveImageUrls),
  ];
}

const blankProduct = (): Partial<Product> => ({
  id: "", slug: "", categoryId: "birth-gifts",
  name: { ar: "", fr: "", en: "", es: "" },
  description: { ar: "", fr: "", en: "", es: "" },
  priceMad: 0, availability: "in-stock", imageUrl: "", imageUrls: [],
  feedItemId: "", brand: "", condition: "new", productUrl: "",
  regularPriceMad: null, salePriceMad: null, quantityToSell: null,
  feedAttributes: {}, variants: [],
});

export function AdminDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product>>(blankProduct());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState<Locale>("ar");
  const [importCategory, setImportCategory] = useState("baby-supplies");
  const [feedAttributesText, setFeedAttributesText] = useState("{}");
  const [driveFolderLink, setDriveFolderLink] = useState("");
  const [driveTree, setDriveTree] = useState<DriveFolderNode | null>(null);
  const [driveAddedImageUrls, setDriveAddedImageUrls] = useState<string[]>([]);
  const labels = getCopy(language);
  const supabase = useMemo(() => getSupabase(), []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setStatus(error.message);
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => setSession(current));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    async function load() {
      if (!supabase || !session) return;
      if (session.user.app_metadata?.store_owner !== true) {
        setStatus(labels.adminDenied);
        return;
      }
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) setStatus(labels.adminLoadError);
      else setProducts((data ?? []).map((row) => productFromRow(row)));
    }
    void load();
  }, [supabase, session, labels.adminDenied, labels.adminLoadError]);

  if (!supabase) return <main className="admin-page"><div className="admin-panel"><span className="eyebrow">QURRAOJOS · ADMIN</span><h1>{labels.adminTitle}</h1><p>{labels.adminSetup}</p><code>NEXT_PUBLIC_SUPABASE_URL<br />NEXT_PUBLIC_SUPABASE_ANON_KEY</code></div></main>;

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setStatus("");
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    setStatus(error?.message ?? "");
    setBusy(false);
  }

  async function importProductsCsv(file?: File) {
    if (!file) return;
    if (!session || session.user.app_metadata?.store_owner !== true) {
      setStatus(labels.adminDenied);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv") || file.size > 2 * 1024 * 1024) {
      setStatus(labels.csvInvalidFile);
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const { records, issues } = parseProductCsv(await file.text(), importCategory);
      const describeIssues = (rows: ProductCsvIssue[]) => rows.map(({ line, reason }) => {
        const reasonLabel = {
          malformed: labels.csvRowMalformed,
          missingName: labels.csvMissingName,
          missingRequiredField: labels.csvMissingRequiredField,
          invalidPrice: labels.csvInvalidPrice,
          invalidAvailability: labels.csvInvalidAvailability,
          invalidQuantity: labels.csvInvalidQuantity,
          invalidCategory: labels.csvInvalidCategory,
          invalidUrl: labels.csvInvalidUrl,
          duplicate: labels.csvDuplicate,
        }[reason];
        return `${labels.csvRow} ${line}: ${reasonLabel}`;
      }).join("; ");
      if (!records.length) {
        const issueSummary = describeIssues(issues);
        setStatus(issueSummary ? `${labels.csvNoProducts} ${issueSummary}` : labels.csvNoProducts);
        return;
      }

      const { data: existingRows, error: lookupError } = await supabase!
        .from("products")
        .select("*")
        .in("slug", records.map((record) => record.slug));
      if (lookupError) {
        setStatus(`${labels.csvImportError} ${lookupError.message}`);
        return;
      }
      const existingBySlug = new Map((existingRows ?? []).map((row) => [row.slug, row]));
      const recordsToUpsert = records.map((record) => {
        const existing = existingBySlug.get(record.slug);
        return existing
          ? {
              ...existing,
              ...record,
              id: existing.id,
              name: { ...existing.name, ...record.name },
              description: { ...existing.description, ...record.description },
              feed_attributes: { ...existing.feed_attributes, ...record.feed_attributes },
            }
          : record;
      });
      const { error } = await supabase!.from("products").upsert(recordsToUpsert, { onConflict: "slug" });
      if (error) {
        setStatus(`${labels.csvImportError} ${error.message}`);
        return;
      }

      const { data, error: refreshError } = await supabase!.from("products").select("*").order("created_at", { ascending: false });
      if (refreshError) {
        setStatus(`${labels.csvImportSuccess} ${records.length}. ${labels.adminLoadError}`);
      } else {
        setProducts((data ?? []).map((row) => productFromRow(row)));
        const issueSummary = describeIssues(issues);
        setStatus(`${labels.csvImportSuccess} ${records.length}.${issueSummary ? ` ${labels.csvSkipped} ${issues.length}: ${issueSummary}` : ""}`);
      }
    } catch (error) {
      setStatus(`${labels.csvImportError} ${error instanceof Error ? error.message : labels.csvUnknownError}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!session || session.user.app_metadata?.store_owner !== true) {
      setStatus(labels.adminDenied);
      return;
    }
    let feedAttributes: Record<string, string>;
    try {
      const parsed: unknown = JSON.parse(feedAttributesText);
      if (!isStringRecord(parsed)) throw new Error(labels.csvAttributesInvalid);
      feedAttributes = parsed;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : labels.csvAttributesInvalid);
      return;
    }
    setBusy(true); setStatus("");
    const variants = editing.variants ?? [];
    const variantIds = variants.map((item) => item.id);
    if (
      variants.length > 8 ||
      variants.some((item) => !item.id?.trim() || !item.label?.ar?.trim() || typeof item.available !== "boolean") ||
      new Set(variantIds).size !== variantIds.length
    ) {
      setStatus(variants.length > 8 ? labels.variantLimit : labels.invalidVariants);
      setBusy(false);
      return;
    }
    const record = {
      slug: editing.slug?.trim(),
      category_id: editing.categoryId,
      name: editing.name,
      description: editing.description,
      price_mad: Number(editing.priceMad),
      available: editing.availability === "in-stock",
      image_urls: (editing.imageUrls ?? (editing.imageUrl ? [editing.imageUrl] : [])).map(normalizeImageUrl),
      image_url: normalizeImageUrl((editing.imageUrls?.[0] ?? editing.imageUrl) || "") || null,
      feed_item_id: editing.feedItemId?.trim() || null,
      brand: editing.brand?.trim() || null,
      condition: editing.condition?.trim() || null,
      product_url: editing.productUrl?.trim() || null,
      regular_price_mad: editing.regularPriceMad ?? null,
      sale_price_mad: editing.salePriceMad ?? null,
      quantity_to_sell_on_facebook: editing.quantityToSell ?? null,
      feed_attributes: feedAttributes,
      variants,
    };
    const imageUrlsValid = record.image_urls.every((url) => isHttpUrl(url));
    if (!record.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug) ||
      !Number.isInteger(record.price_mad) || record.price_mad < 10 || record.price_mad > 300 ||
      (record.regular_price_mad !== null && (!Number.isInteger(record.regular_price_mad) || record.regular_price_mad < 10 || record.regular_price_mad > 300)) ||
      (record.sale_price_mad !== null && (!Number.isInteger(record.sale_price_mad) || record.sale_price_mad < 10 || record.sale_price_mad > 300)) ||
      (record.quantity_to_sell_on_facebook !== null && (!Number.isInteger(record.quantity_to_sell_on_facebook) || record.quantity_to_sell_on_facebook < 1)) ||
      !imageUrlsValid || (record.product_url && !isHttpUrl(record.product_url))) {
      setStatus(labels.invalidProduct);
      setBusy(false);
      return;
    }
    const result = editing.id
      ? await supabase!.from("products").update(record).eq("id", editing.id)
      : await supabase!.from("products").insert(record);
    if (result.error) setStatus(`تعذر الحفظ: ${result.error.message}`);
    else {
      setStatus(labels.saved);
      setEditing(blankProduct());
      setFeedAttributesText("{}");
      setDriveFolderLink("");
      setDriveTree(null);
      setDriveAddedImageUrls([]);
      const { data } = await supabase!.from("products").select("*").order("created_at", { ascending: false });
      if (data) setProducts(data.map((row) => productFromRow(row)));
    }
    setBusy(false);
  }

  async function browseDriveFolder(folderLink?: string, folderId?: string, resourceKey?: string) {
    if (!session || session.user.app_metadata?.store_owner !== true) {
      setStatus(labels.adminDenied);
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/drive-folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(folderLink ? { folderUrl: folderLink } : { folderId, resourceKey }),
      });
      const result = await response.json() as { folder?: DriveFolderNode; error?: string };
      if (!response.ok || !result.folder) {
        throw new Error(result.error ?? `Drive folder request failed (${response.status}).`);
      }

      setDriveTree(result.folder);
      const imageUrls = driveImageUrls(result.folder);
      setDriveAddedImageUrls(imageUrls);
      setEditing((current) => {
        const existingUrls = current.imageUrls ?? (current.imageUrl ? [current.imageUrl] : []);
        const previousDriveUrls = new Set(driveAddedImageUrls);
        const retainedUrls = existingUrls.filter((url) => !previousDriveUrls.has(url));
        const mergedUrls = Array.from(new Set([...retainedUrls, ...imageUrls]));
        return { ...current, imageUrl: mergedUrls[0] ?? null, imageUrls: mergedUrls };
      });
      setStatus(imageUrls.length ? `${labels.driveImagesAdded} ${imageUrls.length}` : labels.driveNoImages);
    } catch (error) {
      setStatus(`${labels.driveLoadError} ${error instanceof Error ? error.message : labels.csvUnknownError}`);
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file?: File) {
    if (!file || !session || session.user.app_metadata?.store_owner !== true) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setStatus(labels.imageFileInvalid);
      return;
    }
    setBusy(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase!.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
    if (error) setStatus(`تعذر رفع الصورة: ${error.message}`);
    else {
      const { data } = supabase!.storage.from("product-images").getPublicUrl(path);
      setEditing((current) => {
        const imageUrls = Array.from(new Set([...(current.imageUrls ?? (current.imageUrl ? [current.imageUrl] : [])), data.publicUrl]));
        return { ...current, imageUrl: imageUrls[0], imageUrls };
      });
      setStatus("");
    }
    setBusy(false);
  }

  async function deleteProduct(id: string) {
    if (!window.confirm(labels.confirmDelete)) return;
    const { error } = await supabase!.from("products").delete().eq("id", id);
    if (error) setStatus(`تعذر الحذف: ${error.message}`);
    else { setProducts((current) => current.filter((product) => product.id !== id)); setStatus(labels.deleted); }
  }

  function updateVariant(index: number, update: Partial<ProductVariant>) {
    setEditing((current) => ({
      ...current,
      variants: (current.variants ?? []).map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...update } : variant,
      ),
    }));
  }

  const isOwner = session?.user.app_metadata?.store_owner === true;
  const editingImageUrls = (editing.imageUrls?.length
    ? editing.imageUrls
    : editing.imageUrl ? [editing.imageUrl] : []).map(normalizeImageUrl);
  const isErrorStatus = status.includes("تعذر") || status.includes("ليس مخولاً") || status.includes(labels.driveLoadError) ||
    [labels.csvInvalidFile, labels.csvImportError, labels.csvNoProducts, labels.csvAttributesInvalid].some((message) => status.includes(message));
  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="admin-heading"><div><span className="eyebrow">QURRAOJOS · ADMIN</span><h1>{labels.adminTitle}</h1><p>{labels.adminHint}</p></div><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Locale)}><option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option></select></div>
        {!session ? <form className="login-form" onSubmit={signIn}><label className="field"><span>{labels.email}</span><input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field"><span>{labels.password}</span><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-dark" disabled={busy}>{labels.signIn}</button></form> :
          !isOwner ? <div className="setup-card"><p>{labels.adminDenied}</p><button className="button button-light" onClick={() => void supabase.auth.signOut()}>{labels.signOut}</button></div> :
          <>
            <div className="admin-toolbar"><p>{session.user.email}</p><button className="button button-light" onClick={() => void supabase.auth.signOut()}>{labels.signOut}</button></div>
            <section className="csv-import" aria-label={labels.csvUpload}>
              <label className="field"><span>{labels.csvCategory}</span><select value={importCategory} onChange={(event) => setImportCategory(event.target.value)} disabled={busy}><option value="birth-gifts">{labels.categoryNames[0]}</option><option value="child-rearing">{labels.categoryNames[1]}</option><option value="children-clothing">{labels.categoryNames[2]}</option><option value="baby-supplies">{labels.categoryNames[3]}</option></select></label>
              <label className="field"><span>{labels.csvUpload}</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importProductsCsv(file); }} /></label>
              <p>{labels.csvHint}</p>
            </section>
            <form className="admin-editor" onSubmit={saveProduct}>
              <div className="editor-heading"><h2>{editing.id ? labels.edit : labels.newProduct}</h2><button className="button button-light" type="button" onClick={() => { setEditing(blankProduct()); setFeedAttributesText("{}"); setDriveFolderLink(""); setDriveTree(null); setDriveAddedImageUrls([]); }}>{labels.newProduct} +</button></div>
              <div className="editor-grid">
                <label className="field"><span>{labels.productName}</span><input required value={editing.name?.ar ?? ""} onChange={(event) => setEditing({ ...editing, name: { ...blankProduct().name!, ...editing.name, ar: event.target.value } })} /></label>
                <label className="field"><span>{labels.productSlug}</span><input required value={editing.slug ?? ""} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} /></label>
                <label className="field"><span>{labels.category}</span><select value={editing.categoryId} onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })}>{["birth-gifts", "child-rearing", "children-clothing", "baby-supplies"].map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
                <label className="field"><span>{labels.productPrice}</span><input type="number" min="10" max="300" step="1" required value={editing.priceMad ?? 0} onChange={(event) => setEditing({ ...editing, priceMad: Number(event.target.value) })} /></label>
                <label className="field"><span>{labels.csvItemId}</span><input value={editing.feedItemId ?? ""} onChange={(event) => setEditing({ ...editing, feedItemId: event.target.value })} /></label>
                <label className="field"><span>{labels.csvBrand}</span><input value={editing.brand ?? ""} onChange={(event) => setEditing({ ...editing, brand: event.target.value })} /></label>
                <label className="field"><span>{labels.csvCondition}</span><input value={editing.condition ?? ""} onChange={(event) => setEditing({ ...editing, condition: event.target.value })} /></label>
                <label className="field"><span>{labels.csvProductUrl}</span><input type="url" value={editing.productUrl ?? ""} onChange={(event) => setEditing({ ...editing, productUrl: event.target.value })} /></label>
                <label className="field"><span>{labels.csvRegularPrice}</span><input type="number" min="10" max="300" step="1" value={editing.regularPriceMad ?? ""} onChange={(event) => setEditing({ ...editing, regularPriceMad: event.target.value ? Number(event.target.value) : null })} /></label>
                <label className="field"><span>{labels.csvSalePrice}</span><input type="number" min="10" max="300" step="1" value={editing.salePriceMad ?? ""} onChange={(event) => setEditing({ ...editing, salePriceMad: event.target.value ? Number(event.target.value) : null })} /></label>
                <label className="field"><span>{labels.csvQuantity}</span><input type="number" min="1" step="1" value={editing.quantityToSell ?? ""} onChange={(event) => setEditing({ ...editing, quantityToSell: event.target.value ? Number(event.target.value) : null })} /></label>
                <label className="field field-full"><span>{labels.description}</span><textarea rows={3} value={editing.description?.ar ?? ""} onChange={(event) => setEditing({ ...editing, description: { ...blankProduct().description!, ...editing.description, ar: event.target.value } })} /></label>
                <label className="field"><span>{labels.status}</span><select value={editing.availability} onChange={(event) => setEditing({ ...editing, availability: event.target.value as Product["availability"] })}><option value="in-stock">{labels.inStock}</option><option value="out-of-stock">{labels.outOfStock}</option></select></label>
                <label className="field"><span>{labels.image}</span><input type="file" accept="image/*" disabled={busy} onChange={(event) => { void uploadImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
                {editingImageUrls.length > 0 && <div className="product-image-previews field-full">{editingImageUrls.map((imageUrl) => <div className="image-preview" key={imageUrl}><ProductImage sources={[imageUrl]} alt={labels.image} sizes="90px" fallback="♡" /></div>)}</div>}
                <section className="drive-folder-picker field-full" aria-label={labels.driveFolderLink}>
                  <label className="field"><span>{labels.driveFolderLink}</span><input type="url" dir="ltr" placeholder="https://drive.google.com/drive/folders/..." value={driveFolderLink} onChange={(event) => setDriveFolderLink(event.target.value)} disabled={busy} /></label>
                  <button className="button button-light" type="button" disabled={busy || !driveFolderLink.trim()} onClick={() => void browseDriveFolder(driveFolderLink.trim())}>{labels.driveBrowse}</button>
                  <p>{labels.driveFolderHelp}</p>
                  {driveTree && <div className="drive-folder-tree" aria-live="polite">
                    <strong>{driveTree.name} · {driveTree.images.length} {labels.driveImageCount}</strong>
                    {driveTree.folders.length > 0 && <ul>{driveTree.folders.map((folder) => (
                      <li key={folder.id}>
                        <button className="text-button" type="button" disabled={busy} onClick={() => void browseDriveFolder(undefined, folder.id, folder.resourceKey)}>
                          {folder.name} · {folder.images.length} {labels.driveImageCount}
                        </button>
                        {folder.folders.length > 0 && <ul>{folder.folders.map((nestedFolder) => (
                          <li key={nestedFolder.id}>
                            <button className="text-button" type="button" disabled={busy} onClick={() => void browseDriveFolder(undefined, nestedFolder.id, nestedFolder.resourceKey)}>{nestedFolder.name}</button>
                          </li>
                        ))}</ul>}
                      </li>
                    ))}</ul>}
                  </div>}
                </section>
                <label className="field field-full"><span>{labels.csvImageUrls}</span><textarea rows={4} dir="ltr" placeholder="https://example.com/main.jpg&#10;https://example.com/second.jpg" value={editingImageUrls.join("\n")} onChange={(event) => {
                  const imageUrls = Array.from(new Set(event.target.value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean)));
                  setEditing({ ...editing, imageUrls, imageUrl: imageUrls[0] ?? null });
                }} /></label>
                <label className="field field-full"><span>{labels.csvExtraAttributes}</span><textarea rows={5} dir="ltr" value={feedAttributesText} onChange={(event) => setFeedAttributesText(event.target.value)} aria-describedby="feed-attributes-help" /></label>
                <small id="feed-attributes-help" className="form-note field-full">{labels.csvExtraAttributesHint}</small>
                <div className="translation-fields field-full"><p>{labels.translationsOptional}</p>{(["fr", "en", "es"] as const).map((locale) => <div className="translation-locale" key={locale}><label className="field"><span>{locale.toUpperCase()} · Name</span><input value={editing.name?.[locale] ?? ""} onChange={(event) => setEditing({ ...editing, name: { ...blankProduct().name!, ...editing.name, [locale]: event.target.value } })} /></label><label className="field"><span>{locale.toUpperCase()} · Description</span><textarea rows={2} value={editing.description?.[locale] ?? ""} onChange={(event) => setEditing({ ...editing, description: { ...blankProduct().description!, ...editing.description, [locale]: event.target.value } })} /></label></div>)}</div>
                <fieldset className="variants-editor field-full"><legend>{labels.variants}</legend><p>{labels.variantHelp}</p>{(editing.variants ?? []).map((variant, index) => <div className="variant-row" key={variant.id}><label className="field"><span>{labels.variantArabic}</span><input required value={variant.label.ar} onChange={(event) => updateVariant(index, { label: { ...variant.label, ar: event.target.value } })} /></label><div className="variant-translations">{(["fr", "en", "es"] as const).map((locale) => <label className="field" key={locale}><span>{locale.toUpperCase()}</span><input value={variant.label[locale]} onChange={(event) => updateVariant(index, { label: { ...variant.label, [locale]: event.target.value } })} /></label>)}</div><label className="variant-availability"><input type="checkbox" checked={variant.available} onChange={(event) => updateVariant(index, { available: event.target.checked })} />{labels.variantAvailable}</label><button className="text-button danger" type="button" onClick={() => setEditing((current) => ({ ...current, variants: (current.variants ?? []).filter((_, variantIndex) => variantIndex !== index) }))}>{labels.removeVariant}</button></div>)}<button className="button button-light" type="button" disabled={(editing.variants?.length ?? 0) >= 8} onClick={() => setEditing((current) => ({ ...current, variants: [...(current.variants ?? []), { id: crypto.randomUUID(), label: { ar: "", fr: "", en: "", es: "" }, available: true }] }))}>{labels.addVariant} +</button>{(editing.variants?.length ?? 0) >= 8 && <small>{labels.variantLimit}</small>}</fieldset>
              </div>
              <button className="button button-dark" disabled={busy}>{labels.save}</button>
            </form>
            {status && <p className={isErrorStatus ? "error-text" : "success-text"} role="status">{status}</p>}
            <div className="admin-list"><h2>{labels.catalog} · {products.length}</h2>{products.map((product) => <article className="admin-product" key={product.id}><div className="admin-thumb"><ProductImage sources={product.imageUrls ?? (product.imageUrl ? [product.imageUrl] : [])} alt="" sizes="45px" fallback="♡" /></div><div><strong>{product.name.ar}</strong><small>{product.slug} · {product.priceMad} DH · {product.availability === "in-stock" ? labels.inStock : labels.outOfStock}</small></div><button className="text-button" onClick={() => { setEditing(product); setFeedAttributesText(JSON.stringify(product.feedAttributes ?? {}, null, 2)); setDriveFolderLink(""); setDriveTree(null); setDriveAddedImageUrls([]); }}>{labels.edit}</button><button className="text-button danger" onClick={() => void deleteProduct(product.id)}>{labels.delete}</button></article>)}</div>
          </>}
        {status && !isOwner && session && <p className="error-text" role="status">{status}</p>}
        {status && !session && <p className="error-text" role="status">{status}</p>}
      </div>
    </main>
  );
}
