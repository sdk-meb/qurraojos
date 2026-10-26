import { createClient } from "@supabase/supabase-js";
import type { Locale } from "@/lib/locale";
import { normalizeImageUrl } from "@/lib/image-url";

export type LocalizedText = Record<Locale, string>;
export type ProductVariant = {
  id: string;
  label: LocalizedText;
  available: boolean;
  kind?: "color" | "size";
};
export type Category = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  accent: string;
  icon: string;
};
export type Product = {
  id: string;
  slug: string;
  categoryId: string;
  name: LocalizedText;
  description: LocalizedText;
  priceMad: number;
  availability: "in-stock" | "out-of-stock";
  imageUrl?: string | null;
  imageUrls?: string[];
  feedItemId?: string | null;
  brand?: string | null;
  condition?: string | null;
  productUrl?: string | null;
  regularPriceMad?: number | null;
  salePriceMad?: number | null;
  quantityToSell?: number | null;
  feedAttributes?: Record<string, string>;
  variants: ProductVariant[];
};

export const categories: Category[] = [
  { id: "diapering-potty", name: { ar: "الحفاضات والتدريب على استخدام المرحاض", fr: "Couches et propreté", en: "Diapering & Potty", es: "Pañales y orinal" }, description: { ar: "حفاضات ومستلزمات تغيير الطفل والتدريب على استخدام المرحاض.", fr: "Couches, accessoires de change et articles pour apprendre la propreté.", en: "Diapers, changing essentials, and potty-training supplies.", es: "Pañales, artículos para el cambio y productos para aprender a ir al baño." }, accent: "blue", icon: "🧷" },
  { id: "feeding-nursing", name: { ar: "الرضاعة والتغذية", fr: "Alimentation et allaitement", en: "Feeding & Nursing", es: "Alimentación y lactancia" }, description: { ar: "مستلزمات الرضاعة الطبيعية والرضاعة بالزجاجة وإطعام الطفل.", fr: "Essentiels pour l’allaitement, le biberon et les repas de bébé.", en: "Breastfeeding, bottle-feeding, and baby-feeding essentials.", es: "Artículos esenciales para la lactancia, el biberón y la alimentación del bebé." }, accent: "gold", icon: "🍼" },
  { id: "bath-skincare-health", name: { ar: "الاستحمام والعناية بالبشرة والصحة", fr: "Bain, soins de la peau et santé", en: "Bath, Skincare & Health", es: "Baño, cuidado de la piel y salud" }, description: { ar: "مستلزمات استحمام الطفل والعناية ببشرته وصحته اليومية.", fr: "Essentiels pour le bain, les soins de la peau et la santé quotidienne.", en: "Bath-time, skincare, and everyday health essentials.", es: "Artículos esenciales para el baño, el cuidado de la piel y la salud diaria." }, accent: "sage", icon: "🛁" },
  { id: "clothing-footwear", name: { ar: "الملابس والأحذية", fr: "Vêtements et chaussures", en: "Clothing & Footwear", es: "Ropa y calzado" }, description: { ar: "ملابس وأحذية مريحة للأطفال والرضع.", fr: "Vêtements et chaussures confortables pour les bébés et les enfants.", en: "Comfortable clothing and footwear for babies and children.", es: "Ropa y calzado cómodos para bebés y niños." }, accent: "rose", icon: "🧦" },
  { id: "nursery-sleep", name: { ar: "غرفة الطفل والنوم", fr: "Chambre de bébé et sommeil", en: "Nursery & Sleep", es: "Habitación infantil y sueño" }, description: { ar: "أسرّة الأطفال ومستلزمات الفراش ومراقبة الطفل ومنتجات النوم.", fr: "Lits bébé, literie, babyphones et essentiels pour le sommeil.", en: "Cribs, bedding, baby monitors, and sleep essentials.", es: "Cunas, ropa de cama, vigilabebés y artículos para dormir." }, accent: "blue", icon: "🛏️" },
  { id: "gear-safety-toys", name: { ar: "معدات التنقل والسلامة والألعاب", fr: "Équipement, sécurité et jouets", en: "Gear, Safety & Toys", es: "Equipamiento, seguridad y juguetes" }, description: { ar: "عربات الأطفال ومقاعد السيارة ومستلزمات السلامة والألعاب.", fr: "Poussettes, sièges auto, articles de sécurité et jouets.", en: "Strollers, car seats, safety essentials, and toys.", es: "Cochecitos, sillas de coche, artículos de seguridad y juguetes." }, accent: "gold", icon: "🧸" },
];

const text = (ar: string, fr: string, en: string, es: string): LocalizedText => ({ ar, fr, en, es });
const sizeVariants = [
  { id: "0-6m", label: text("٠–٦ أشهر", "0–6 mois", "0–6 months", "0–6 meses"), available: true },
  { id: "6-12m", label: text("٦–١٢ شهراً", "6–12 mois", "6–12 months", "6–12 meses"), available: true },
];
const colors = [
  { id: "cream", label: text("عاجي", "Écru", "Cream", "Crema"), available: true, kind: "color" as const },
  { id: "sage", label: text("أخضر هادئ", "Vert sauge", "Sage", "Verde salvia"), available: true, kind: "color" as const },
];
const demoCategoryMap: Record<string, string> = {
  "birth-gifts": "nursery-sleep",
  "child-rearing": "gear-safety-toys",
  "children-clothing": "clothing-footwear",
  "baby-supplies": "bath-skincare-health",
};

export const demoProducts: Product[] = ([
  { id: "demo-01", slug: "newborn-gift-set", categoryId: "nursery-sleep", name: text("طقم هدية للمولود", "Coffret cadeau bébé", "Newborn gift set", "Set de regalo para bebé"), description: text("طقم تجريبي لطيف لاستقبال المولود. يُرجى استبدال الوصف والصورة قبل الإطلاق.", "Exemple de coffret de naissance. Remplacez le descriptif et la photo avant lancement.", "Demo newborn gift set. Replace this description and image before launch.", "Set de regalo de muestra. Sustituye descripción e imagen antes del lanzamiento."), priceMad: 180, availability: "in-stock", variants: colors },
  { id: "demo-02", slug: "soft-baby-blanket", categoryId: "birth-gifts", name: text("بطانية ناعمة", "Couverture douce", "Soft baby blanket", "Manta suave"), description: text("بطانية تجريبية ناعمة. تحقق من الخامة والمقاس قبل البيع.", "Couverture de démonstration. Vérifiez la matière et la taille.", "Sample blanket. Confirm material and dimensions before sale.", "Manta de muestra. Confirma material y medidas antes de vender."), priceMad: 120, availability: "in-stock", variants: colors },
  { id: "demo-03", slug: "welcome-baby-box", categoryId: "birth-gifts", name: text("علبة ترحيب بالمولود", "Boîte bienvenue bébé", "Welcome baby box", "Caja bienvenida bebé"), description: text("اقتراح تجريبي لهدية المولود الجديد.", "Suggestion de coffret cadeau de démonstration.", "Demo newborn gift box idea.", "Idea de caja de regalo de muestra."), priceMad: 250, availability: "in-stock", variants: [] },
  { id: "demo-04", slug: "wooden-shape-toy", categoryId: "child-rearing", name: text("لعبة أشكال خشبية", "Jeu de formes en bois", "Wooden shape toy", "Juego de formas de madera"), description: text("لعبة تعليمية تجريبية. راجعي شروط السلامة والعمر المناسب.", "Jouet éducatif de démonstration. Vérifiez sécurité et âge recommandé.", "Sample learning toy. Verify safety and age guidance.", "Juguete educativo de muestra. Verifica seguridad y edad recomendada."), priceMad: 85, availability: "in-stock", variants: [] },
  { id: "demo-05", slug: "soft-rattle", categoryId: "child-rearing", name: text("خشخيشة قماشية", "Hochet en tissu", "Soft fabric rattle", "Sonajero de tela"), description: text("مثال تجريبي — تحقق من المواد وتعليمات الاستخدام.", "Exemple démo — vérifiez les matières et les consignes.", "Demo item — confirm materials and instructions.", "Ejemplo de muestra: confirma materiales e instrucciones."), priceMad: 45, availability: "in-stock", variants: colors },
  { id: "demo-06", slug: "stacking-cups", categoryId: "child-rearing", name: text("أكواب التكديس", "Gobelets à empiler", "Stacking cups", "Vasos apilables"), description: text("أكواب لعب تجريبية بألوان مرحة.", "Gobelets de jeu de démonstration.", "Sample play cups in cheerful colors.", "Vasos de juego de muestra."), priceMad: 55, availability: "in-stock", variants: [] },
  { id: "demo-07", slug: "cotton-bodysuit", categoryId: "children-clothing", name: text("بودي قطني", "Body en coton", "Cotton bodysuit", "Body de algodón"), description: text("ملابس تجريبية. يجب تأكيد الخامة والمقاسات والألوان.", "Vêtement démo. Confirmez matière, tailles et couleurs.", "Demo clothing. Confirm fabric, sizes and colors.", "Ropa de muestra. Confirma tejido, tallas y colores."), priceMad: 65, availability: "in-stock", variants: sizeVariants },
  { id: "demo-08", slug: "baby-sleepsuit", categoryId: "children-clothing", name: text("بيجامة نوم للرضع", "Pyjama bébé", "Baby sleepsuit", "Pijama para bebé"), description: text("قطعة تجريبية؛ أضيفي القياسات الفعلية قبل النشر.", "Article démo ; ajoutez les mesures réelles avant publication.", "Sample item; add actual sizing before publishing.", "Artículo de muestra; añade medidas reales antes de publicar."), priceMad: 95, availability: "in-stock", variants: sizeVariants },
  { id: "demo-09", slug: "newborn-hat-set", categoryId: "children-clothing", name: text("طقم قبعة وقفازات", "Ensemble bonnet et moufles", "Newborn hat and mittens", "Gorro y manoplas de recién nacido"), description: text("مثال تجريبي لطقم ملابس حديثي الولادة.", "Exemple démo d'un ensemble nouveau-né.", "Sample newborn clothing set.", "Conjunto de ropa de muestra para recién nacido."), priceMad: 40, availability: "in-stock", variants: colors },
  { id: "demo-10", slug: "feeding-bottle", categoryId: "baby-supplies", name: text("قارورة رضاعة", "Biberon", "Feeding bottle", "Biberón"), description: text("مثال تجريبي. تحققي من السعة والخامة ومعايير السلامة.", "Exemple démo. Vérifiez capacité, matière et sécurité.", "Demo item. Confirm capacity, material and safety.", "Ejemplo de muestra. Confirma capacidad, material y seguridad."), priceMad: 35, availability: "in-stock", variants: [] },
  { id: "demo-11", slug: "changing-mat", categoryId: "baby-supplies", name: text("مفرش تغيير محمول", "Matelas à langer nomade", "Portable changing mat", "Cambiador portátil"), description: text("مفرش تجريبي للعناية اليومية.", "Tapis de démonstration pour le quotidien.", "Demo changing mat for everyday care.", "Cambiador de muestra para el día a día."), priceMad: 75, availability: "in-stock", variants: colors },
  { id: "demo-12", slug: "baby-care-organizer", categoryId: "baby-supplies", name: text("منظم مستلزمات الرضيع", "Organisateur bébé", "Baby care organizer", "Organizador para bebé"), description: text("مثال تجريبي — تحققي من المقاسات والمحتويات قبل الإطلاق.", "Exemple démo — vérifiez dimensions et contenu.", "Demo item — verify size and contents before launch.", "Ejemplo de muestra: verifica medidas y contenido."), priceMad: 145, availability: "in-stock", variants: [] },
 ] satisfies Product[]).map((product) => ({
  ...product,
  categoryId: demoCategoryMap[product.categoryId] ?? product.categoryId,
}));

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabase() {
  if (!hasSupabaseConfig()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
        detectSessionInUrl: typeof window !== "undefined",
      },
    },
  );
}

export function productFromRow(row: Record<string, unknown>): Product {
  const storedImageUrls = Array.isArray(row.image_urls)
    ? row.image_urls.filter((imageUrl): imageUrl is string => typeof imageUrl === "string").map(normalizeImageUrl)
    : [];
  const rawImageUrl = (row.image_url as string | null) ?? storedImageUrls[0] ?? null;
  const imageUrl = rawImageUrl ? normalizeImageUrl(rawImageUrl) : null;
  const imageUrls = storedImageUrls.length ? storedImageUrls : imageUrl ? [imageUrl] : [];
  const feedAttributes = row.feed_attributes && typeof row.feed_attributes === "object" && !Array.isArray(row.feed_attributes)
    ? row.feed_attributes as Record<string, string>
    : {};
  return {
    id: String(row.id),
    slug: String(row.slug),
    categoryId: String(row.category_id),
    name: row.name as LocalizedText,
    description: row.description as LocalizedText,
    priceMad: Number(row.price_mad),
    availability: row.available ? "in-stock" : "out-of-stock",
    imageUrl,
    imageUrls,
    feedItemId: (row.feed_item_id as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    condition: (row.condition as string | null) ?? null,
    productUrl: (row.product_url as string | null) ?? null,
    regularPriceMad: (row.regular_price_mad as number | null) ?? null,
    salePriceMad: (row.sale_price_mad as number | null) ?? null,
    quantityToSell: (row.quantity_to_sell_on_facebook as number | null) ?? null,
    feedAttributes,
    variants: (row.variants as ProductVariant[] | null) ?? [],
  };
}

export async function getProducts(): Promise<{ products: Product[]; demo: boolean; configured: boolean; error?: boolean }> {
  const supabase = getSupabase();
  if (!supabase) {
    return process.env.NODE_ENV !== "production"
      ? { products: demoProducts, demo: true, configured: false }
      : { products: [], demo: false, configured: false };
  }
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Unable to load the public catalogue:", error.message);
    return { products: [], demo: false, configured: true, error: true };
  }
  return { products: (data ?? []).map((row) => productFromRow(row as Record<string, unknown>)), demo: false, configured: true };
}

export function findCategory(id: string) {
  return categories.find((category) => category.id === id);
}

export function productImageUrls(product: Product) {
  return Array.from(new Set([
    ...(product.imageUrls ?? []).map(normalizeImageUrl),
    ...(product.imageUrl ? [normalizeImageUrl(product.imageUrl)] : []),
  ]));
}

export function isProductAvailable(product: Product) {
  return product.availability === "in-stock" &&
    (product.variants.length === 0 || product.variants.some((variant) => variant.available));
}

export function formatPrice(amount: number, locale: Locale) {
  const formatterLocale = locale === "ar" ? "ar-MA" : locale === "es" ? "es-MA" : locale === "fr" ? "fr-MA" : "en-MA";
  return new Intl.NumberFormat(formatterLocale, { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(amount);
}
