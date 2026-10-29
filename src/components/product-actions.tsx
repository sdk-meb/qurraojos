"use client";

import { useState } from "react";
import { isProductAvailable, isVariantAvailable, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart-context";
import { getCopy, type Locale } from "@/lib/locale";

export function ProductActions({
  product,
  locale,
  selected,
}: {
  product: Product;
  locale: Locale;
  selected: string;
}) {
  const copy = getCopy(locale);
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <div className="product-actions">
      <button className="button button-dark button-wide" disabled={!isProductAvailable(product) || !isVariantAvailable(product, selected)} onClick={() => {
        add(product.id, selected);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1600);
      }}>{added ? copy.added : copy.addToCart}</button>
    </div>
  );
}
