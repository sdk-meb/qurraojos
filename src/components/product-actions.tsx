"use client";

import { useState } from "react";
import { isProductAvailable, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart-context";
import { getCopy, localized, type Locale } from "@/lib/locale";

export function ProductActions({ product, locale }: { product: Product; locale: Locale }) {
  const copy = getCopy(locale);
  const { add } = useCart();
  const options = product.variants.length > 0
    ? product.variants.filter((variant) => variant.available)
    : [{ id: "default", label: { ar: copy.noVariants, fr: copy.noVariants, en: copy.noVariants, es: copy.noVariants }, available: true }];
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const [added, setAdded] = useState(false);
  return (
    <div className="product-actions">
      {product.variants.length > 0 && (
        <label className="field">
          <span>{copy.chooseVariant}</span>
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            {options.map((variant) => <option key={variant.id} value={variant.id}>{localized(variant.label, locale)}</option>)}
          </select>
        </label>
      )}
      <button className="button button-dark button-wide" disabled={!isProductAvailable(product) || !selected} onClick={() => {
        add(product.id, selected);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1600);
      }}>{added ? copy.added : copy.addToCart}</button>
    </div>
  );
}
