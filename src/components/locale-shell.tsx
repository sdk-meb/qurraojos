import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import type { Locale } from "@/lib/locale";
import { StoreFooter } from "./store-footer";
import { StoreHeader } from "./store-header";

export function LocaleShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <CartProvider>
      <div className="store-shell" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
        <StoreHeader locale={locale} />
        <main>{children}</main>
        <StoreFooter locale={locale} />
      </div>
    </CartProvider>
  );
}
