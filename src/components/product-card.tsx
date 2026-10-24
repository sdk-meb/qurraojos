import Link from "next/link";
import { findCategory, formatPrice, isProductAvailable, productImageUrls, type Product } from "@/lib/catalog";
import { getCopy, localized, type Locale } from "@/lib/locale";
import { ProductImage } from "@/components/product-image";

export function ProductCard({ product, locale }: { product: Product; locale: Locale }) {
  const copy = getCopy(locale);
  const category = findCategory(product.categoryId);
  const imageUrls = productImageUrls(product);
  return (
    <article className="product-card">
      <Link className={`product-art art-${category?.accent ?? "rose"}`} href={`/${locale}/products/${product.slug}`} aria-label={localized(product.name, locale)}>
        <ProductImage
          sources={imageUrls}
          alt={localized(product.name, locale)}
          sizes="(max-width: 640px) 44vw, (max-width: 900px) 28vw, 22vw"
          fallback={category?.icon ?? "♡"}
          cycleOnHover
        />
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
