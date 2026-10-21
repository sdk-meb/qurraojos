"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, type Product, type ProductVariant } from "@/lib/catalog";
import { getCopy, type Locale } from "@/lib/locale";

const blankProduct = (): Partial<Product> => ({
  id: "", slug: "", categoryId: "birth-gifts",
  name: { ar: "", fr: "", en: "", es: "" },
  description: { ar: "", fr: "", en: "", es: "" },
  priceMad: 0, availability: "in-stock", imageUrl: "", variants: [],
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
      else setProducts((data ?? []).map((row) => ({
        id: row.id, slug: row.slug, categoryId: row.category_id, name: row.name,
        description: row.description, priceMad: row.price_mad,
        availability: row.available ? "in-stock" : "out-of-stock",
        imageUrl: row.image_url, variants: row.variants ?? [],
      })));
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

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!session || session.user.app_metadata?.store_owner !== true) {
      setStatus(labels.adminDenied);
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
      image_url: editing.imageUrl || null,
      variants,
    };
    if (!record.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug) || !Number.isInteger(record.price_mad) || record.price_mad < 10 || record.price_mad > 300) {
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
      const { data } = await supabase!.from("products").select("*").order("created_at", { ascending: false });
      if (data) setProducts(data.map((row) => ({
        id: row.id, slug: row.slug, categoryId: row.category_id, name: row.name,
        description: row.description, priceMad: row.price_mad,
        availability: row.available ? "in-stock" : "out-of-stock",
        imageUrl: row.image_url, variants: row.variants ?? [],
      })));
    }
    setBusy(false);
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
      setEditing((current) => ({ ...current, imageUrl: data.publicUrl }));
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
  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="admin-heading"><div><span className="eyebrow">QURRAOJOS · ADMIN</span><h1>{labels.adminTitle}</h1><p>{labels.adminHint}</p></div><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Locale)}><option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option></select></div>
        {!session ? <form className="login-form" onSubmit={signIn}><label className="field"><span>{labels.email}</span><input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field"><span>{labels.password}</span><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-dark" disabled={busy}>{labels.signIn}</button></form> :
          !isOwner ? <div className="setup-card"><p>{labels.adminDenied}</p><button className="button button-light" onClick={() => void supabase.auth.signOut()}>{labels.signOut}</button></div> :
          <>
            <div className="admin-toolbar"><p>{session.user.email}</p><button className="button button-light" onClick={() => void supabase.auth.signOut()}>{labels.signOut}</button></div>
            <form className="admin-editor" onSubmit={saveProduct}>
              <div className="editor-heading"><h2>{editing.id ? labels.edit : labels.newProduct}</h2><button className="button button-light" type="button" onClick={() => setEditing(blankProduct())}>{labels.newProduct} +</button></div>
              <div className="editor-grid">
                <label className="field"><span>{labels.productName}</span><input required value={editing.name?.ar ?? ""} onChange={(event) => setEditing({ ...editing, name: { ...blankProduct().name!, ...editing.name, ar: event.target.value } })} /></label>
                <label className="field"><span>{labels.productSlug}</span><input required value={editing.slug ?? ""} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} /></label>
                <label className="field"><span>{labels.category}</span><select value={editing.categoryId} onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })}>{["birth-gifts", "child-rearing", "children-clothing", "baby-supplies"].map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
                <label className="field"><span>{labels.productPrice}</span><input type="number" min="10" max="300" step="1" required value={editing.priceMad ?? 0} onChange={(event) => setEditing({ ...editing, priceMad: Number(event.target.value) })} /></label>
                <label className="field field-full"><span>{labels.description}</span><textarea rows={3} value={editing.description?.ar ?? ""} onChange={(event) => setEditing({ ...editing, description: { ...blankProduct().description!, ...editing.description, ar: event.target.value } })} /></label>
                <label className="field"><span>{labels.status}</span><select value={editing.availability} onChange={(event) => setEditing({ ...editing, availability: event.target.value as Product["availability"] })}><option value="in-stock">{labels.inStock}</option><option value="out-of-stock">{labels.outOfStock}</option></select></label>
                <label className="field"><span>{labels.image}</span><input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0])} /></label>
                {editing.imageUrl && <div className="image-preview"><Image src={editing.imageUrl} alt={labels.image} fill sizes="90px" unoptimized /></div>}
                <div className="translation-fields field-full"><p>{labels.translationsOptional}</p>{(["fr", "en", "es"] as const).map((locale) => <div className="translation-locale" key={locale}><label className="field"><span>{locale.toUpperCase()} · Name</span><input value={editing.name?.[locale] ?? ""} onChange={(event) => setEditing({ ...editing, name: { ...blankProduct().name!, ...editing.name, [locale]: event.target.value } })} /></label><label className="field"><span>{locale.toUpperCase()} · Description</span><textarea rows={2} value={editing.description?.[locale] ?? ""} onChange={(event) => setEditing({ ...editing, description: { ...blankProduct().description!, ...editing.description, [locale]: event.target.value } })} /></label></div>)}</div>
                <fieldset className="variants-editor field-full"><legend>{labels.variants}</legend><p>{labels.variantHelp}</p>{(editing.variants ?? []).map((variant, index) => <div className="variant-row" key={variant.id}><label className="field"><span>{labels.variantArabic}</span><input required value={variant.label.ar} onChange={(event) => updateVariant(index, { label: { ...variant.label, ar: event.target.value } })} /></label><div className="variant-translations">{(["fr", "en", "es"] as const).map((locale) => <label className="field" key={locale}><span>{locale.toUpperCase()}</span><input value={variant.label[locale]} onChange={(event) => updateVariant(index, { label: { ...variant.label, [locale]: event.target.value } })} /></label>)}</div><label className="variant-availability"><input type="checkbox" checked={variant.available} onChange={(event) => updateVariant(index, { available: event.target.checked })} />{labels.variantAvailable}</label><button className="text-button danger" type="button" onClick={() => setEditing((current) => ({ ...current, variants: (current.variants ?? []).filter((_, variantIndex) => variantIndex !== index) }))}>{labels.removeVariant}</button></div>)}<button className="button button-light" type="button" disabled={(editing.variants?.length ?? 0) >= 8} onClick={() => setEditing((current) => ({ ...current, variants: [...(current.variants ?? []), { id: crypto.randomUUID(), label: { ar: "", fr: "", en: "", es: "" }, available: true }] }))}>{labels.addVariant} +</button>{(editing.variants?.length ?? 0) >= 8 && <small>{labels.variantLimit}</small>}</fieldset>
              </div>
              <button className="button button-dark" disabled={busy}>{labels.save}</button>
            </form>
            {status && <p className={status.includes("تعذر") || status.includes("ليس مخولاً") ? "error-text" : "success-text"} role="status">{status}</p>}
            <div className="admin-list"><h2>{labels.catalog} · {products.length}</h2>{products.map((product) => <article className="admin-product" key={product.id}><div className="admin-thumb">{product.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="45px" unoptimized /> : <span>♡</span>}</div><div><strong>{product.name.ar}</strong><small>{product.slug} · {product.priceMad} DH · {product.availability === "in-stock" ? labels.inStock : labels.outOfStock}</small></div><button className="text-button" onClick={() => setEditing(product)}>{labels.edit}</button><button className="text-button danger" onClick={() => void deleteProduct(product.id)}>{labels.delete}</button></article>)}</div>
          </>}
        {status && !isOwner && session && <p className="error-text" role="status">{status}</p>}
        {status && !session && <p className="error-text" role="status">{status}</p>}
      </div>
    </main>
  );
}
