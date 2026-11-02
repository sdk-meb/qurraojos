import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { categories } from "@/lib/catalog";
import { getProducts } from "@/lib/catalog-server";
import { getCopy, localized, type Locale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: { locale: Locale } }) {
  const locale = params.locale;
  const copy = getCopy(locale);
  const { products, demo, configured, error } = await getProducts();
  return (
    <>
      {error && <div className="site-notice" role="alert">{copy.catalogError}</div>}
      {!configured && <div className="site-notice">{demo ? copy.demoNotice : copy.setupNotice}</div>}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> {copy.brand} · MOROCCO</span>
          <h1>{copy.newArrivals}<br /><em>{copy.tagline}</em></h1>
          <p>{copy.aboutText}</p>
          <Link className="button button-dark" href={`/${locale}/catalog`}>{copy.shop}<span aria-hidden="true">↗</span></Link>
          <div className="hero-proof"><span>✦</span> {copy.cod} <i>·</i> {copy.proofShipping} <i>·</i> {copy.proofSelection}</div>
        </div>
        <div className="hero-visual" aria-label={copy.brand}>
          <div className="sun-disc" />
          <div className="hero-label"><span>01 — 04</span><strong>{copy.heroMoment}</strong></div>
          <div className="hero-bloom bloom-one">✿</div><div className="hero-bloom bloom-two">✿</div>
          <div className="hero-product product-one">🧸</div><div className="hero-product product-two">🍼</div>
          <span className="hero-sticker">douceur<br />& amour</span>
        </div>
      </section>
      <section className="section category-section">
        <div className="section-heading"><div><span className="eyebrow">QURRAOJOS · 2026</span><h2>{copy.categories}</h2></div><p>{copy.aboutText}</p></div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link className={`category-tile category-${category.accent}`} href={`/${locale}/catalog?category=${category.id}`} key={category.id}>
              <span className="category-number">0{index + 1}</span><span className="category-icon" aria-hidden="true">{category.icon}</span>
              <strong>{localized(category.name, locale)}</strong><small>{localized(category.description, locale)}</small><span className="category-arrow">↗</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section products-section">
        <div className="section-heading"><div><span className="eyebrow">{copy.selectionEyebrow}</span><h2>{copy.featured}</h2></div><Link className="text-link" href={`/${locale}/catalog`}>{copy.viewAll} <span>↗</span></Link></div>
        {products.length ? <div className="product-grid">{products.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} locale={locale} />)}</div> : <div className="setup-card" role={error ? "alert" : undefined}><span>✦</span><h3>{error ? copy.catalogError : copy.setupNotice}</h3><p>Supabase</p></div>}
      </section>
      <section className="editorial" id="about">
        <div className="editorial-art"><span>✿</span><i>Q</i><b>♡</b></div>
        <div className="editorial-copy"><span className="eyebrow">{copy.editorialEyebrow}</span><h2>{copy.aboutTitle}</h2><p>{copy.aboutText}</p><div className="editorial-badges"><span>♡ {copy.cod}</span><span>✦ {copy.proofSelection}</span><span>✿ {copy.featured}</span></div></div>
      </section>
      <section className="trust-strip"><div><span>01</span><strong>{copy.deliveryTitle}</strong><small>{copy.deliveryText}</small></div><div><span>02</span><strong>{copy.orderNotice}</strong><small>{copy.estimate}</small></div><div><span>03</span><strong>{copy.privacyTitle}</strong><small>{copy.privacyText}</small></div></section>
    </>
  );
}
