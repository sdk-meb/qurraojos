"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatPrice, isProductAvailable, isVariantAvailable, productImageUrlsForVariant, productPriceForVariant, type Product } from "@/lib/catalog";
import { lookupDeliveryFee } from "@/lib/delivery";
import { useCart } from "@/lib/cart-context";
import { getCopy, localized, type Locale } from "@/lib/locale";
import { ProductImage } from "@/components/product-image";

export function CartPage({ locale, products, demo, catalogError }: { locale: Locale; products: Product[]; demo: boolean; catalogError: boolean }) {
  const copy = getCopy(locale);
  const router = useRouter();
  const { items, hydrated, setQuantity, remove } = useCart();
  const [form, setForm] = useState({ name: "", phone: "", city: "", address: "", ageRange: "" });
  const [profileToken, setProfileToken] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [error, setError] = useState("");
  const profileStorageKey = "qurraojos-checkout-profile-v1";

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(profileStorageKey) ?? "null");
      if (saved && typeof saved === "object") {
        setForm((current) => ({
          ...current,
          ...Object.fromEntries(Object.keys(current).map((key) => [key, typeof saved[key] === "string" ? saved[key] : ""])),
        }));
        setProfileToken(typeof saved.token === "string" ? saved.token : crypto.randomUUID());
      } else {
        setProfileToken(crypto.randomUUID());
      }
    } catch {
      setProfileToken(`guest-${Date.now()}`);
    }
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    if (!profileLoaded || !profileToken) return;
    window.localStorage.setItem(profileStorageKey, JSON.stringify({ ...form, token: profileToken }));
  }, [form, profileLoaded, profileToken]);
  const { fee: deliveryFee, invalidConfiguration } = lookupDeliveryFee(form.city);
  const cartLines = useMemo(() => items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const colorOption = product?.colorOptions?.find((option) => option.colorKey === item.variantId);
    return {
      item,
      product,
      colorOption,
      priceMad: product ? productPriceForVariant(product, item.variantId) : 0,
    };
  }), [items, products]);
  const validLines = cartLines.filter((line): line is typeof line & { product: Product } => Boolean(
    line.product &&
    isProductAvailable(line.product) &&
    ((line.product.colorOptions?.length ?? 0) === 0
      ? line.item.variantId === "default"
      : isVariantAvailable(line.product, line.item.variantId)),
  ));
  const subtotal = validLines.reduce((sum, line) => sum + line.priceMad * line.item.quantity, 0);
  const configuredNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() ?? "";
  const normalizedWhatsAppNumber = /^[+\d()\s-]+$/.test(configuredNumber)
    ? configuredNumber.replace(/\D/g, "")
    : "";
  const whatsappReady = normalizedWhatsAppNumber.length >= 8 && normalizedWhatsAppNumber.length <= 15;

  function sendOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappReady) {
      setError(copy.whatsappSetup);
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim() || !form.address.trim()) {
      setError(copy.checkoutRequired);
      return;
    }
    const phoneValidCharacters = /^[+\d٠-٩۰-۹\s().-]+$/.test(form.phone);
    const phoneDigits = form.phone.replace(/[٠-٩۰-۹]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹".indexOf(digit) % 10)).replace(/\D/g, "");
    if (!phoneValidCharacters || phoneDigits.length < 8 || phoneDigits.length > 15) {
      setError(copy.phoneInvalid);
      return;
    }
    if (catalogError) {
      setError(copy.catalogError);
      return;
    }
    if (!validLines.length || validLines.length !== cartLines.length) {
      setError(copy.unavailableItems);
      return;
    }
    const lines = validLines.map(({ item, product, colorOption }, index) =>
      `${index + 1}. ${item.quantity} x ${localized(product.name, locale)}${colorOption ? ` — ${localized(colorOption.label, locale)}` : ""} — ${formatPrice(productPriceForVariant(product, item.variantId) * item.quantity, locale)}`,
    );
    const deliveryText = deliveryFee === null ? copy.unknownDelivery : formatPrice(deliveryFee, locale);
    const totalText = deliveryFee === null ? copy.unknownDelivery : formatPrice(subtotal + deliveryFee, locale);
    const message = [
      `Qurra Ojos — ${copy.orderNotice}`,
      copy.cod,
      ...lines,
      `${copy.subtotal}: ${formatPrice(subtotal, locale)}`,
      `${copy.delivery}: ${deliveryText}`,
      `${copy.total}: ${totalText}`,
      `${copy.name}: ${form.name.trim()}`,
      `${copy.phone}: ${form.phone.trim()}`,
      `${copy.city}: ${form.city.trim()}`,
      `${copy.address}: ${form.address.trim()}`,
      `${copy.ageRange}: ${form.ageRange.trim() || "—"}`,
      ...validLines.flatMap(({ product }) => Object.entries(product.feedAttributes ?? {}).map(([key, value]) => `${key}: ${value}`)),
      `Customer token: ${profileToken}`,
      copy.orderNotice,
    ].join("\n");
    const destination = `https://wa.me/${normalizedWhatsAppNumber}?text=${encodeURIComponent(message)}`;
    window.open(destination, "_blank", "noopener,noreferrer");
    items.forEach((item) => remove(item.productId, item.variantId));
    setError("");
    router.push(`/${locale}/catalog`);
  }

  if (!hydrated) return <section className="section"><div className="loading-state">…</div></section>;
  if (!items.length) return <section className="section empty-cart"><span>♡</span><h1>{copy.emptyCart}</h1><Link className="button button-dark" href={`/${locale}/catalog`}>{copy.continueShopping}</Link></section>;

  return (
    <section className="section cart-page">
      {catalogError && <div className="site-notice" role="alert">{copy.catalogError}</div>}
      {demo && <div className="site-notice">{copy.demoNotice}</div>}
      <div className="cart-heading"><span className="eyebrow">QURRAOJOS · {copy.cart}</span><h1>{copy.cart}</h1></div>
      <div className="cart-layout"><div className="cart-lines">
        {cartLines.map(({ item, product, colorOption }) => product ? (
          <article className="cart-line" key={`${item.productId}:${item.variantId}`}>
            <div className="cart-line-art"><ProductImage sources={productImageUrlsForVariant(product, item.variantId)} alt="" sizes="75px" fallback={product.name.ar.slice(0, 1)} /></div>
            <div className="cart-line-info"><h2>{localized(product.name, locale)}</h2>{colorOption && <small>{localized(colorOption.label, locale)}</small>}<strong>{formatPrice(productPriceForVariant(product, item.variantId) * item.quantity, locale)}</strong>{(!isProductAvailable(product) || ((product.colorOptions?.length ?? 0) > 0 && !isVariantAvailable(product, item.variantId))) && <small className="error-text">{copy.outOfStock}</small>}</div>
            <div className="quantity-control"><button aria-label="−" onClick={() => item.quantity > 1 ? setQuantity(item.productId, item.variantId, item.quantity - 1) : remove(item.productId, item.variantId)}>−</button><span>{item.quantity}</span><button aria-label="+" onClick={() => setQuantity(item.productId, item.variantId, item.quantity + 1)}>+</button></div>
            <button className="remove-link" onClick={() => remove(item.productId, item.variantId)}>{copy.delete}</button>
          </article>
        ) : (
          <article className="cart-line stale-line" key={`${item.productId}:${item.variantId}`}><div className="cart-line-info"><h2>{copy.removedProduct}</h2></div><button className="remove-link" onClick={() => remove(item.productId, item.variantId)}>{copy.delete}</button></article>
        ))}
        <Link className="continue-link" href={`/${locale}/catalog`}>← {copy.continueShopping}</Link>
      </div>
      <aside className="checkout-card"><h2>{copy.total}</h2><form onSubmit={sendOrder}>
        <label className="field"><span>{copy.name}</span><input autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="field"><span>{copy.phone}</span><input autoComplete="tel" type="tel" inputMode="tel" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="field"><span>{copy.city}</span><input autoComplete="address-level2" required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
                <label className="field"><span>{copy.address}</span><textarea autoComplete="street-address" required rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label className="field"><span>{copy.ageRange}</span><input autoComplete="off" placeholder="0–6 أشهر" value={form.ageRange} onChange={(event) => setForm({ ...form, ageRange: event.target.value })} /></label>
        <div className="total-row">
<span>{copy.subtotal}</span><strong>{formatPrice(subtotal, locale)}</strong></div>
        <div className="total-row"><span>{copy.delivery}</span><strong>{deliveryFee === null ? "—" : formatPrice(deliveryFee, locale)}</strong></div>
        <div className="total-row total-final"><span>{copy.total}</span><strong>{deliveryFee === null ? copy.unknownDelivery : formatPrice(subtotal + deliveryFee, locale)}</strong></div>
        <p className="form-note">{copy.cod}</p><p className="form-note">{invalidConfiguration ? copy.deliveryConfigError : copy.estimate}</p><p className="form-note">{copy.orderNotice}</p>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="button button-dark button-wide" type="submit" disabled={catalogError}>{whatsappReady ? copy.checkout : copy.whatsappNotReady}</button>
      </form></aside></div>
    </section>
  );
}
