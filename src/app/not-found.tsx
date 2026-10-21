"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCopy, isLocale } from "@/lib/locale";

export default function NotFound() {
  const pathname = usePathname();
  const firstSegment = pathname.split("/")[1] ?? "ar";
  const locale = isLocale(firstSegment) ? firstSegment : "ar";
  const copy = getCopy(locale);
  return (
    <main className="not-found-page" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <span className="brand-mark">ق</span>
      <span className="eyebrow">404 · QURRAOJOS</span>
      <h1>{copy.notFoundTitle}</h1>
      <p>{copy.notFoundText}</p>
      <Link className="button button-dark" href={`/${locale}`}>{copy.home}</Link>
    </main>
  );
}
