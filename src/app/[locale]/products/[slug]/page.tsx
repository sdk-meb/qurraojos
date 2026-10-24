import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductActions } from "@/components/product-actions";
import { ProductImage } from "@/components/product-image";
import { findCategory, formatPrice, getProducts, isProductAvailable, productImageUrls } from "@/lib/catalog";
import { getCopy, localized, type Locale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { locale: Locale; slug: string } }): Promise<Metadata> {
  const { products } = await getProducts();
  const product = products.find((item) => item.slug === params.slug);
  if (!product) return {};
  return {
    title: localized(product.name, params.locale),
    description: localized(product.description, params.locale),
    openGraph: {
      title: localized(product.name, params.locale),
      description: localized(product.description, params.locale),
      ...(productImageUrls(product).length ? { images: productImageUrls(product) } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: { locale: Locale; slug: string } }) {
  const { products, demo, error } = await getProducts();
  if (error) return <section className="section"><p role="alert">{getCopy(params.locale).catalogError}</p></section>;
  const product = products.find((item) => item.slug === params.slug);
  if (!product) notFound();
  const copy = getCopy(params.locale);
  const category = findCategory(product.categoryId);
  const images = productImageUrls(product);
  return (
    <section className="section product-detail">
      {demo && <div className="site-notice">{copy.demoNotice}</div>}
      <div className="detail-gallery">
        <div className={`detail-art art-${category?.accent ?? "rose"}`}><ProductImage sources={images} alt={localized(product.name, params.locale)} sizes="(max-width: 640px) 88vw, 45vw" fallback={category?.icon ?? "♡"} /></div>
        {images.length > 1 && <div className="detail-image-thumbnails">{images.slice(1).map((imageUrl) => <div className="detail-image-thumbnail" key={imageUrl}><ProductImage sources={[imageUrl]} alt={localized(product.name, params.locale)} sizes="(max-width: 640px) 20vw, 8vw" fallback={category?.icon ?? "♡"} fallbackClassName="thumbnail-image-fallback" /></div>)}</div>}
      </div>
      <div className="detail-info"><div className="breadcrumbs"><Link href={`/${params.locale}`}>{copy.home}</Link><span>/</span><Link href={`/${params.locale}/catalog`}>{copy.catalog}</Link><span>/</span>{category && localized(category.name, params.locale)}</div>
        <span className="eyebrow">{category && localized(category.name, params.locale)}</span><h1>{localized(product.name, params.locale)}</h1><strong className="detail-price">{formatPrice(product.priceMad, params.locale)}</strong><p className="detail-description">{localized(product.description, params.locale)}</p>
        <div className="stock-line"><span className={isProductAvailable(product) ? "stock-dot" : "stock-dot unavailable"} />{isProductAvailable(product) ? copy.inStock : copy.outOfStock}</div>
        <ProductActions product={product} locale={params.locale} />
        <div className="detail-notes"><p>♡ {copy.deliveryText}</p><p>✦ {copy.orderNotice}</p></div>
      </div>
    </section>
  );
}
