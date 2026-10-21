import { notFound } from "next/navigation";
import { LocaleShell } from "@/components/locale-shell";
import { isLocale, type Locale } from "@/lib/locale";

export function generateStaticParams() {
  return ["ar", "fr", "en", "es"].map((locale) => ({ locale }));
}

export default function LocalizedLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  return <LocaleShell locale={params.locale as Locale}>{children}</LocaleShell>;
}
