"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { categories, getSupabase, productFromRow, type Product, type ProductVariant } from "@/lib/catalog";
import { getCopy, localized, type Locale } from "@/lib/locale";
import type { ProductCsvIssue } from "@/lib/product-csv";
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

const blankProduct = (): Partial<Product> => ({
  id: "", slug: "", categoryId: "",
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
  const [feedAttributesText, setFeedAttributesText] = useState("{}");
  const [driveFolderLink, setDriveFolderLink] = useState("");
  const [driveTree, setDriveTree] = useState<DriveFolderNode | null>(null);
  const [drivePath, setDrivePath] = useState<DriveFolderNode[]>([]);
  const [manualImageUrl, setManualImageUrl] = useState("");
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

  function addProductImageUrl(url: string) {
    const normalizedUrl = normalizeImageUrl(url);
    setEditing((current) => {
      const currentUrls = current.imageUrls?.length
        ? current.imageUrls
        : current.imageUrl ? [current.imageUrl] : [];
      const imageUrls = Array.from(new Set([...currentUrls.map(normalizeImageUrl), normalizedUrl]));
      return { ...current, imageUrl: imageUrls[0] ?? null, imageUrls };
    });
  }

  function replaceProductImageUrls(imageUrls: string[]) {
    const normalizedUrls = Array.from(new Set(imageUrls.map(normalizeImageUrl).filter(Boolean)));
    setEditing((current) => ({
      ...current,
      imageUrl: normalizedUrls[0] ?? null,
      imageUrls: normalizedUrls,
    }));
  }

  function addManualImage() {
    const imageUrl = normalizeImageUrl(manualImageUrl);
    if (!isHttpUrl(imageUrl)) {
      setStatus(labels.invalidImageUrl);
      return;
    }
    addProductImageUrl(imageUrl);
    setManualImageUrl("");
    setStatus("");
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
      const describeIssues = (rows: ProductCsvIssue[]) => rows.map(({ line, reason }) => {
        const reasonLabel = {
          malformed: labels.csvRowMalformed,
          missingName: labels.csvMissingName,
          missingRequiredField: labels.csvMissingRequiredField,
          invalidPrice: labels.csvInvalidPrice,
          invalidAvailability: labels.csvInvalidAvailability,
          invalidCondition: labels.csvInvalidCondition,
          invalidQuantity: labels.csvInvalidQuantity,
          invalidCategory: labels.csvInvalidCategory,
          invalidUrl: labels.csvInvalidUrl,
          duplicate: labels.csvDuplicate,
          tooManyVariants: labels.csvTooManyVariants,
        }[reason];
        return `${labels.csvRow} ${line}: ${reasonLabel}`;
      }).join("; ");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/import-products", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const responseText = await response.text();
      type ImportResponse = {
        error?: string;
        imported?: number;
        colorsImported?: number;
        issues?: ProductCsvIssue[];
      };
      let result: ImportResponse;
      try {
        const payload: unknown = responseText ? JSON.parse(responseText) : null;
        result = payload && typeof payload === "object" && !Array.isArray(payload)
          ? payload as ImportResponse
          : { error: `The server returned an empty or invalid response (HTTP ${response.status}).` };
      } catch {
        result = {
          error: `The server returned an invalid response (HTTP ${response.status}). Check the server logs and database schema.`,
        };
      }
      if (!response.ok) {
        const issueSummary = result.issues?.length
          ? ` ${describeIssues(result.issues)}`
          : "";
        setStatus(`${labels.csvImportError} ${result.error ?? labels.csvUnknownError}${issueSummary}`);
        return;
      }

      const { data, error: refreshError } = await supabase!.from("products").select("*").order("created_at", { ascending: false });
      if (refreshError) {
        setStatus(`${labels.csvImportSuccess} ${result.imported ?? 0}. ${labels.adminLoadError}`);
      } else {
        setProducts((data ?? []).map((row) => productFromRow(row)));
        const issues = result.issues ?? [];
        const issueSummary = describeIssues(issues);
        const colorSummary = result.colorsImported ? ` ${labels.csvColorsImported} ${result.colorsImported}.` : "";
        setStatus(`${labels.csvImportSuccess} ${result.imported ?? 0}.${colorSummary}${issueSummary ? ` ${labels.csvSkipped} ${issues.length}: ${issueSummary}` : ""}`);
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
      setDrivePath([]);
      setManualImageUrl("");
      const { data } = await supabase!.from("products").select("*").order("created_at", { ascending: false });
      if (data) setProducts(data.map((row) => productFromRow(row)));
    }
    setBusy(false);
  }

  async function browseDriveFolder(
    folderLink?: string,
    folderId?: string,
    resourceKey?: string,
    ancestors: DriveFolderNode[] = [],
  ) {
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
      setDrivePath([...ancestors, result.folder]);
      setStatus("");
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
    try {
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error } = await supabase!.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) {
        setStatus(`تعذر رفع الصورة: ${error.message}`);
        return;
      }
      const { data } = supabase!.storage.from("product-images").getPublicUrl(path);
      addProductImageUrl(data.publicUrl);
      setStatus("");
    } catch (error) {
      setStatus(`تعذر رفع الصورة: ${error instanceof Error ? error.message : labels.csvUnknownError}`);
    } finally {
      setBusy(false);
    }
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

  function editProductImages(product: Product, openManager = false) {
    setEditing(product);
    setFeedAttributesText(JSON.stringify(product.feedAttributes ?? {}, null, 2));
    setDriveFolderLink("");
    setDriveTree(null);
    setDrivePath([]);
    setManualImageUrl("");
    if (openManager) {
      document.getElementById("product-file-manager")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const isOwner = session?.user.app_metadata?.store_owner === true;
  const editingImageUrls = (editing.imageUrls?.length
    ? editing.imageUrls
    : editing.imageUrl ? [editing.imageUrl] : []).map(normalizeImageUrl);
  const isErrorStatus = status.includes("تعذر") || status.includes("ليس مخولاً") || status.includes(labels.driveLoadError) ||
    [labels.csvInvalidFile, labels.csvImportError, labels.csvNoProducts, labels.csvAttributesInvalid, labels.invalidImageUrl].some((message) => status.includes(message));
  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="admin-heading"><div><span className="eyebrow">QURRAOJOS · ADMIN</span><h1>{labels.adminTitle}</h1><p>{labels.adminHint}</p></div><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Locale)}><option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option></select></div>
        {!session ? <form className="login-form" onSubmit={signIn}><label className="field"><span>{labels.email}</span><input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field"><span>{labels.password}</span><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-dark" disabled={busy}>{labels.signIn}</button></form> :
          !isOwner ? <div className="setup-card"><p>{labels.adminDenied}</p><button className="button button-light" onClick={() => void supabase.auth.signOut()}>{labels.signOut}</button></div> :
          <>
            <div className="admin-toolbar"><p>{session.user.email}</p><button className="button button-light" onClick={() => void supabase.auth.signOut()}>{labels.signOut}</button></div>
            <section className="csv-import" aria-label={labels.csvUpload}>
                      <label className="field"><span>{labels.csvUpload}</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importProductsCsv(file); }} /></label>
              <p>{labels.csvHint}</p>
            </section>
            <form className="admin-editor" onSubmit={saveProduct}>
              <div className="editor-heading"><h2>{editing.id ? labels.edit : labels.newProduct}</h2><button className="button button-light" type="button" onClick={() => { setEditing(blankProduct()); setFeedAttributesText("{}"); setDriveFolderLink(""); setDriveTree(null); setDrivePath([]); setManualImageUrl(""); }}>{labels.newProduct} +</button></div>
              <div className="editor-grid">
                <label className="field"><span>{labels.productName}</span><input required value={editing.name?.ar ?? ""} onChange={(event) => setEditing({ ...editing, name: { ...blankProduct().name!, ...editing.name, ar: event.target.value } })} /></label>
                <label className="field"><span>{labels.productSlug}</span><input required value={editing.slug ?? ""} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} /></label>
                <label className="field"><span>{labels.category}</span><select required value={editing.categoryId ?? ""} onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })}><option value="" disabled>{labels.csvCategory}</option>{categories.map((category) => <option key={category.id} value={category.id}>{localized(category.name, language)}</option>)}</select></label>
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
                <section id="product-file-manager" className="product-file-manager field-full" aria-label={labels.imageManager}>
                  <div className="file-manager-heading">
                    <div><h3>{labels.imageManager}</h3><p>{labels.imageManagerHelp}</p></div>
                  </div>
                  <div className="file-manager-grid">
                    <section className="drive-browser" aria-label={labels.driveContents}>
                      <div className="drive-folder-picker">
                        <label className="field"><span>{labels.driveFolderLink}</span><input type="url" dir="ltr" placeholder="https://drive.google.com/drive/folders/..." value={driveFolderLink} onChange={(event) => setDriveFolderLink(event.target.value)} disabled={busy} /></label>
                        <button className="button button-light" type="button" disabled={busy || !driveFolderLink.trim()} onClick={() => void browseDriveFolder(driveFolderLink.trim())}>{labels.driveBrowse}</button>
                      </div>
                      {drivePath.length > 0 && <nav className="drive-breadcrumbs" aria-label={labels.driveContents}>
                        {drivePath.map((folder, index) => <span key={folder.id}>
                          {index > 0 && <span aria-hidden="true"> / </span>}
                          <button className="text-button" type="button" disabled={busy} onClick={() => void browseDriveFolder(undefined, folder.id, folder.resourceKey, drivePath.slice(0, index))}>{folder.name}</button>
                        </span>)}
                      </nav>}
                      {driveTree ? <div className="drive-browser-content" aria-live="polite">
                        <div className="drive-subfolders">
                          {driveTree.folders.map((folder) => <button className="drive-folder-item" key={folder.id} type="button" disabled={busy} onClick={() => void browseDriveFolder(undefined, folder.id, folder.resourceKey, drivePath)}>
                            <span aria-hidden="true">📁</span><span>{folder.name}</span>
                          </button>)}
                          {driveTree.folders.length === 0 && <p className="file-manager-empty">{labels.driveFoldersEmpty}</p>}
                        </div>
                        <div className="drive-image-grid">
                          {driveTree.images.map((image) => {
                            const imageUrl = normalizeImageUrl(image.url);
                            const isAdded = editingImageUrls.includes(imageUrl);
                            return <article className="drive-image-item" key={image.id}>
                              <div className="drive-image-thumb"><ProductImage sources={[imageUrl]} alt={image.name} sizes="110px" fallback="♡" /></div>
                              <span title={image.name}>{image.name}</span>
                              <button className="text-button" type="button" disabled={busy || isAdded} onClick={() => addProductImageUrl(imageUrl)}>{isAdded ? labels.imageAdded : labels.addImage}</button>
                            </article>;
                          })}
                          {driveTree.images.length === 0 && <p className="file-manager-empty">{labels.driveNoImages}</p>}
                        </div>
                      </div> : <p className="file-manager-empty">{labels.driveFolderHelp}</p>}
                      <div className="image-manager-tools">
                        <label className="field"><span>{labels.upload}</span><input type="file" accept="image/*" disabled={busy} onChange={(event) => { void uploadImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
                        <div className="manual-image-add">
                          <label className="field"><span>{labels.addImageUrl}</span><input type="url" dir="ltr" placeholder={labels.imageUrlPlaceholder} value={manualImageUrl} onChange={(event) => setManualImageUrl(event.target.value)} /></label>
                          <button className="button button-light" type="button" disabled={!manualImageUrl.trim()} onClick={addManualImage}>{labels.addImage}</button>
                        </div>
                      </div>
                    </section>
                    <section className="selected-product-images" aria-label={labels.selectedImages}>
                      <h4>{labels.selectedImages} · {editingImageUrls.length}</h4>
                      {editingImageUrls.length > 0 ? <ol className="selected-image-list">
                        {editingImageUrls.map((imageUrl, index) => <li className="selected-image-item" key={imageUrl}>
                          <div className="selected-image-thumb"><ProductImage sources={[imageUrl]} alt={`${labels.image} ${index + 1}`} sizes="70px" fallback="♡" /></div>
                          <div className="selected-image-info">
                            <strong>{index === 0 ? labels.primaryImage : `${labels.image} ${index + 1}`}</strong>
                            <span dir="ltr" title={imageUrl}>{imageUrl}</span>
                          </div>
                          <div className="selected-image-actions">
                            <button className="text-button" type="button" aria-label={`${labels.moveImageUp} ${index + 1}`} title={labels.moveImageUp} disabled={index === 0} onClick={() => {
                              const next = [...editingImageUrls];
                              [next[index - 1], next[index]] = [next[index], next[index - 1]];
                              replaceProductImageUrls(next);
                            }}>↑</button>
                            <button className="text-button" type="button" aria-label={`${labels.moveImageDown} ${index + 1}`} title={labels.moveImageDown} disabled={index === editingImageUrls.length - 1} onClick={() => {
                              const next = [...editingImageUrls];
                              [next[index], next[index + 1]] = [next[index + 1], next[index]];
                              replaceProductImageUrls(next);
                            }}>↓</button>
                            <button className="text-button danger" type="button" onClick={() => replaceProductImageUrls(editingImageUrls.filter((_, imageIndex) => imageIndex !== index))}>{labels.removeImage}</button>
                          </div>
                        </li>)}
                      </ol> : <p className="file-manager-empty">{labels.noProductImages}</p>}
                    </section>
                  </div>
                </section>
                <label className="field field-full"><span>{labels.csvExtraAttributes}</span><textarea rows={5} dir="ltr" value={feedAttributesText} onChange={(event) => setFeedAttributesText(event.target.value)} aria-describedby="feed-attributes-help" /></label>
                <small id="feed-attributes-help" className="form-note field-full">{labels.csvExtraAttributesHint}</small>
                <div className="translation-fields field-full"><p>{labels.translationsOptional}</p>{(["fr", "en", "es"] as const).map((locale) => <div className="translation-locale" key={locale}><label className="field"><span>{locale.toUpperCase()} · Name</span><input value={editing.name?.[locale] ?? ""} onChange={(event) => setEditing({ ...editing, name: { ...blankProduct().name!, ...editing.name, [locale]: event.target.value } })} /></label><label className="field"><span>{locale.toUpperCase()} · Description</span><textarea rows={2} value={editing.description?.[locale] ?? ""} onChange={(event) => setEditing({ ...editing, description: { ...blankProduct().description!, ...editing.description, [locale]: event.target.value } })} /></label></div>)}</div>
                <fieldset className="variants-editor field-full"><legend>{labels.variants}</legend><p>{labels.variantHelp}</p>{(editing.variants ?? []).map((variant, index) => <div className="variant-row" key={variant.id}><label className="field"><span>{labels.variantArabic}</span><input required value={variant.label.ar} onChange={(event) => updateVariant(index, { label: { ...variant.label, ar: event.target.value } })} /></label><div className="variant-translations">{(["fr", "en", "es"] as const).map((locale) => <label className="field" key={locale}><span>{locale.toUpperCase()}</span><input value={variant.label[locale]} onChange={(event) => updateVariant(index, { label: { ...variant.label, [locale]: event.target.value } })} /></label>)}</div><label className="variant-availability"><input type="checkbox" checked={variant.available} onChange={(event) => updateVariant(index, { available: event.target.checked })} />{labels.variantAvailable}</label><button className="text-button danger" type="button" onClick={() => setEditing((current) => ({ ...current, variants: (current.variants ?? []).filter((_, variantIndex) => variantIndex !== index) }))}>{labels.removeVariant}</button></div>)}<button className="button button-light" type="button" disabled={(editing.variants?.length ?? 0) >= 8} onClick={() => setEditing((current) => ({ ...current, variants: [...(current.variants ?? []), { id: crypto.randomUUID(), label: { ar: "", fr: "", en: "", es: "" }, available: true }] }))}>{labels.addVariant} +</button>{(editing.variants?.length ?? 0) >= 8 && <small>{labels.variantLimit}</small>}</fieldset>
              </div>
              <button className="button button-dark" disabled={busy}>{labels.save}</button>
            </form>
            {status && <p className={isErrorStatus ? "error-text" : "success-text"} role="status">{status}</p>}
            <div className="admin-list"><h2>{labels.catalog} · {products.length}</h2>{products.map((product) => <article className="admin-product" key={product.id}><div className="admin-thumb"><ProductImage sources={product.imageUrls ?? (product.imageUrl ? [product.imageUrl] : [])} alt="" sizes="45px" fallback="♡" /></div><div><strong>{product.name.ar}</strong><small>{product.slug} · {product.priceMad} DH · {product.availability === "in-stock" ? labels.inStock : labels.outOfStock}</small></div><div className="admin-product-actions"><button className="text-button" onClick={() => editProductImages(product)}>{labels.edit}</button><button className="text-button" onClick={() => editProductImages(product, true)}>{labels.imageManager}</button><button className="text-button danger" onClick={() => void deleteProduct(product.id)}>{labels.delete}</button></div></article>)}</div>
          </>}
        {status && !isOwner && session && <p className="error-text" role="status">{status}</p>}
        {status && !session && <p className="error-text" role="status">{status}</p>}
      </div>
    </main>
  );
}
