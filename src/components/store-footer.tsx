import { getCopy, type Locale } from "@/lib/locale";

export function StoreFooter({ locale }: { locale: Locale }) {
  const copy = getCopy(locale);
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div><span className="brand-mark">ق</span><h2>{copy.brand}</h2><p>{copy.aboutText}</p></div>
        <div><h3>{copy.deliveryTitle}</h3><p>{copy.deliveryText}</p><p>{copy.returnsText}</p></div>
        <div><h3>{copy.privacyTitle}</h3><p>{copy.privacyText}</p></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Qurra Ojos</span><span>Morocco · MAD</span></div>
    </footer>
  );
}
