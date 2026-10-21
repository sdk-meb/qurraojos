import { ProductCard } from "@/components/product-card";
import { categories, getProducts } from "@/lib/catalog";
import { getCopy, localized, type Locale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function CatalogPage({ params, searchParams }: { params: { locale: Locale }; searchParams: { q?: string; category?: string } }) {
  const copy = getCopy(params.locale);
  const { products, demo, configured, error } = await getProducts();
  const query = (searchParams.q ?? "").trim().toLocaleLowerCase();
  const category = searchParams.category;
  const filtered = products.filter((product) => {
    const name = localized(product.name, params.locale).toLocaleLowerCase();
    const description = localized(product.description, params.locale).toLocaleLowerCase();
    return (!category || product.categoryId === category) && (!query || name.includes(query) || description.includes(query));
  });
  const currentCategory = categories.find((item) => item.id === category);
  return (
    <section className="section catalog-page">
      {!configured && <div className="site-notice">{demo ? copy.demoNotice : copy.setupNotice}</div>}
      {error && <div className="site-notice" role="alert">{copy.catalogError}</div>}
      <div className="catalog-intro"><span className="eyebrow">QURRAOJOS · {copy.catalog}</span><h1>{currentCategory ? localized(currentCategory.name, params.locale) : copy.all}</h1><p>{currentCategory ? localized(currentCategory.description, params.locale) : copy.aboutText}</p></div>
      <form className="catalog-controls" action={`/${params.locale}/catalog`}><label className="search-box"><span aria-hidden="true">⌕</span><input name="q" defaultValue={searchParams.q} placeholder={copy.search} /></label><div className="category-filters"><a href={`/${params.locale}/catalog`} className={!category ? "active" : ""}>{copy.all}</a>{categories.map((item) => <a key={item.id} href={`/${params.locale}/catalog?category=${item.id}`} className={category === item.id ? "active" : ""}>{localized(item.name, params.locale)}</a>)}</div></form>
      {filtered.length ? <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} locale={params.locale} />)}</div> : error ? <div className="empty-state" role="alert"><h2>{copy.catalogError}</h2></div> : <div className="empty-state"><span>⌕</span><h2>{copy.emptySearch}</h2></div>}
    </section>
  );
}
