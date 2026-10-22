"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { formatPrice, isProductAvailable, type Product } from "@/lib/catalog";
import { lookupDeliveryFee } from "@/lib/delivery";
import { useCart } from "@/lib/cart-context";
import { getCopy, localized, type Locale } from "@/lib/locale";

export function CartPage({ locale, products, demo, catalogError }: { locale: Locale; products: Product[]; demo: boolean; catalogError: boolean }) {
  const copy = getCopy(locale);
  const { items, hydrated, setQuantity, remove } = useCart();
  const [form, setForm] = useState({ name: "", phone: "", city: "", address: "" });
  const [error, setError] = useState("");
  const { fee: deliveryFee, invalidConfiguration } = lookupDeliveryFee(form.city);
  const cartLines = useMemo(() => items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    return { item, product, variant };
  }), [items, products]);
  const validLines = cartLines.filter((line): line is typeof line & { product: Product } => Boolean(
    line.product &&
    isProductAvailable(line.product) &&
    (line.product.variants.length === 0
      ? line.item.variantId === "default"
      : line.variant?.available),
  ));
  const subtotal = validLines.reduce((sum, line) => sum + line.product.priceMad * line.item.quantity, 0);
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
    const lines = validLines.map(({ item, product, variant }, index) =>
      `${index + 1}. ${item.quantity} x ${localized(product.name, locale)}${variant ? ` — ${localized(variant.label, locale)}` : ""} — ${formatPrice(product.priceMad * item.quantity, locale)}`,
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
      copy.orderNotice,
    ].join("\n");
    const destination = `https://wa.me/${normalizedWhatsAppNumber}?text=${encodeURIComponent(message)}`;
    window.open(destination, "_blank", "noopener,noreferrer");
    setError("");
  }

  if (!hydrated) return <section className="section"><div className="loading-state">…</div></section>;
  if (!items.length) return <section className="section empty-cart"><span>♡</span><h1>{copy.emptyCart}</h1><Link className="button button-dark" href={`/${locale}/catalog`}>{copy.continueShopping}</Link></section>;

  return (
    <section className="section cart-page">
      {catalogError && <div className="site-notice" role="alert">{copy.catalogError}</div>}
      {demo && <div className="site-notice">{copy.demoNotice}</div>}
      <div className="cart-heading"><span className="eyebrow">QURRAOJOS · {copy.cart}</span><h1>{copy.cart}</h1></div>
      <div className="cart-layout"><div className="cart-lines">
        {cartLines.map(({ item, product, variant }) => product ? (
          <article className="cart-line" key={`${item.productId}:${item.variantId}`}>
            <div className="cart-line-art">{product.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="75px" /> : <span>{product.name.ar.slice(0, 1)}</span>}</div>
            <div className="cart-line-info"><h2>{localized(product.name, locale)}</h2>{variant && <small>{localized(variant.label, locale)}</small>}<strong>{formatPrice(product.priceMad * item.quantity, locale)}</strong>{(!isProductAvailable(product) || (product.variants.length > 0 && !variant?.available)) && <small className="error-text">{copy.outOfStock}</small>}</div>
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
        <div className="total-row"><span>{copy.subtotal}</span><strong>{formatPrice(subtotal, locale)}</strong></div>
        <div className="total-row"><span>{copy.delivery}</span><strong>{deliveryFee === null ? "—" : formatPrice(deliveryFee, locale)}</strong></div>
        <div className="total-row total-final"><span>{copy.total}</span><strong>{deliveryFee === null ? copy.unknownDelivery : formatPrice(subtotal + deliveryFee, locale)}</strong></div>
        <p className="form-note">{copy.cod}</p><p className="form-note">{invalidConfiguration ? copy.deliveryConfigError : copy.estimate}</p><p className="form-note">{copy.orderNotice}</p>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="button button-dark button-wide" type="submit" disabled={catalogError}>{whatsappReady ? copy.checkout : copy.whatsappNotReady}</button>
      </form></aside></div>
    </section>
  );
}
