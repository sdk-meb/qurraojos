"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { categories } from "@/lib/catalog";
import type { LocalizedText } from "@/lib/catalog";
import { getCopy, localized, type Locale } from "@/lib/locale";

export function CatalogFilters({
  locale,
  query,
  category,
  color,
  colors,
}: {
  locale: Locale;
  query: string;
  category?: string;
  color?: string;
  colors: Array<{ id: string; label: LocalizedText }>;
}) {
  const copy = getCopy(locale);
  const pathname = usePathname();
  const router = useRouter();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchParams = new URLSearchParams();
    const nextQuery = String(formData.get("q") ?? "").trim();
    const nextColor = String(formData.get("color") ?? "");

    if (nextQuery) searchParams.set("q", nextQuery);
    if (category) searchParams.set("category", category);
    if (nextColor) searchParams.set("color", nextColor);

    const queryString = searchParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  function categoryHref(nextCategory?: string) {
    const searchParams = new URLSearchParams();
    if (query) searchParams.set("q", query);
    if (nextCategory) searchParams.set("category", nextCategory);
    if (color) searchParams.set("color", color);
    const queryString = searchParams.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }

  function selectColor(nextColor: string) {
    const searchParams = new URLSearchParams();
    if (query) searchParams.set("q", query);
    if (category) searchParams.set("category", category);
    if (nextColor) searchParams.set("color", nextColor);
    const queryString = searchParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  return (
    <form className="catalog-controls" key={`${query}:${category ?? ""}:${color ?? ""}`} onSubmit={search}>
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
      {colors.length > 0 && (
        <label className="color-filter">
          <span>{copy.chooseColor}</span>
          <select name="color" value={color ?? ""} onChange={(event) => selectColor(event.target.value)}>
            <option value="">{copy.all}</option>
            {colors.map((option) => (
              <option key={option.id} value={option.id}>{localized(option.label, locale)}</option>
            ))}
          </select>
        </label>
      )}
    </form>
  );
}
