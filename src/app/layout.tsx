import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Qurra Ojos | قرة عيني",
    template: "%s | Qurra Ojos",
  },
  description: "منتجات مختارة بعناية للصغار والعائلة في المغرب. الدفع عند الاستلام.",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  alternates: {
    languages: { ar: "/ar", fr: "/fr", en: "/en", es: "/es" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
