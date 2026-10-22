import Link from "next/link";
import Image from "next/image";
import { findCategory, formatPrice, isProductAvailable, type Product } from "@/lib/catalog";
import { getCopy, localized, type Locale } from "@/lib/locale";

export function ProductCard({ product, locale }: { product: Product; locale: Locale }) {
  const copy = getCopy(locale);
  const category = findCategory(product.categoryId);
  return (
    <article className="product-card">
      <Link className={`product-art art-${category?.accent ?? "rose"}`} href={`/${locale}/products/${product.slug}`} aria-label={localized(product.name, locale)}>
        {product.imageUrl ? <Image src={product.imageUrl} alt={localized(product.name, locale)} fill sizes="(max-width: 640px) 44vw, (max-width: 900px) 28vw, 22vw" /> : <span aria-hidden="true">{category?.icon ?? "♡"}</span>}
        {product.id.startsWith("demo-") && <small className="demo-pill">{copy.sample}</small>}
      </Link>
      <div className="product-card-info">
        <div className="product-meta">{category && localized(category.name, locale)} <span>•</span> {isProductAvailable(product) ? copy.inStock : copy.outOfStock}</div>
        <Link className="product-title" href={`/${locale}/products/${product.slug}`}>{localized(product.name, locale)}</Link>
        <strong className="product-price">{formatPrice(product.priceMad, locale)}</strong>
      </div>
    </article>
  );
}
