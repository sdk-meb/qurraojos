"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { getCopy, locales, type Locale } from "@/lib/locale";

export function StoreHeader({ locale }: { locale: Locale }) {
  const copy = getCopy(locale);
  const pathname = usePathname();
  const { items } = useCart();
  const count = items.reduce((total, item) => total + item.quantity, 0);
  return (
    <>
      <div className="announcement">{copy.deliveryText}</div>
      <header className="site-header">
        <Link className="brand" href={`/${locale}`} aria-label={copy.brand}>
          <span className="brand-mark">ق</span>
          <span><strong>{copy.brand}</strong><small>{copy.tagline}</small></span>
        </Link>
        <nav className="main-nav" aria-label={copy.catalog}>
          <Link href={`/${locale}`}>{copy.home}</Link>
          <Link href={`/${locale}/catalog`}>{copy.catalog}</Link>
          <a href={`/${locale}#about`}>{copy.about}</a>
        </nav>
        <div className="header-actions">
          <div className="locale-switch" aria-label="Language">
            {locales.map((language) => (
              <Link key={language} href={pathname.replace(/^\/(ar|fr|en|es)(?=\/|$)/, `/${language}`)} aria-current={language === locale ? "page" : undefined}>
                {language.toUpperCase()}
              </Link>
            ))}
          </div>
          <Link className="cart-link" href={`/${locale}/cart`} aria-label={`${copy.cart} (${count})`}>
            <span aria-hidden="true">▢</span><span>{copy.cart}</span><b>{count}</b>
          </Link>
        </div>
      </header>
    </>
  );
}
