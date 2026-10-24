"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { categories } from "@/lib/catalog";
import { getCopy, localized, type Locale } from "@/lib/locale";

export function CatalogFilters({
  locale,
  query,
  category,
}: {
  locale: Locale;
  query: string;
  category?: string;
}) {
  const copy = getCopy(locale);
  const pathname = usePathname();
  const router = useRouter();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchParams = new URLSearchParams();
    const nextQuery = String(formData.get("q") ?? "").trim();

    if (nextQuery) searchParams.set("q", nextQuery);
    if (category) searchParams.set("category", category);

    const queryString = searchParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  function categoryHref(nextCategory?: string) {
    const searchParams = new URLSearchParams();
    if (query) searchParams.set("q", query);
    if (nextCategory) searchParams.set("category", nextCategory);
    const queryString = searchParams.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }

  return (
    <form className="catalog-controls" key={`${query}:${category ?? ""}`} onSubmit={search}>
      <label className="search-box">
        <span aria-hidden="true">⌕</span>
        <input name="q" defaultValue={query} placeholder={copy.search} />
      </label>
      <div className="category-filters">
        <Link href={categoryHref()} scroll={false} className={!category ? "active" : ""}>{copy.all}</Link>
        {categories.map((item) => (
          <Link
            key={item.id}
            href={categoryHref(item.id)}
            scroll={false}
            className={category === item.id ? "active" : ""}
          >
            {localized(item.name, locale)}
          </Link>
        ))}
      </div>
    </form>
  );
}
