"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { add } = useCart();
  function addProduct() {
    add(product.id, selected);
    router.push(`/${locale}/cart`);
  }

  return (
    <div className="product-actions">
      <button className="button button-dark button-wide" disabled={!isProductAvailable(product) || !isVariantAvailable(product, selected)} onClick={addProduct}>
        {copy.addToCart}
      </button>
      <p className="product-action-hint" role="status">🛒 {copy.cartHint}</p>
    </div>
  );
}
