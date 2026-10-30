"use client";

import { useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { ProductImage } from "@/components/product-image";
import type { Color, Product } from "@/lib/catalog";
import { localized, type Locale } from "@/lib/locale";
import {
  inferColorMapping,
  makeCsv,
  normalizeImageLink,
  parseDriveJson,
  parseMetaCsv,
  slugForProduct,
  uuidV5,
  type DriveProductFolder,
  type MetaDriveImage,
  type MetaDriveIssue,
  type MetaProduct,
} from "@/lib/meta-drive-import";

type DbCategory = { id: string; name: Record<string, string> };
type StagedProduct = MetaProduct & {
  categoryId: string;
  folderName: string;
  images: MetaDriveImage[];
  includedImages: Record<string, boolean>;
  order: string[];
  variantColors: Record<string, string>;
  trusted: boolean;
  conflictResolved: boolean;
  folderlessConfirmed: boolean;
};
type OutputFile = { name: string; content: string };
type Props = {
  colors: Color[];
  existingProducts: Product[];
  language: Locale;
  session: Session;
  supabase: SupabaseClient;
  onSaved: () => Promise<boolean>;
};

const COPY: Record<Locale, Record<string, string>> = {
  ar: {
    title: "استيراد Meta + Drive بمراجعة يدوية",
    hint: "حمّلي ملف CSV وملف Drive JSON. لن تُحفظ البيانات قبل مراجعة كل منتج والضغط على «موثوق».",
    csv: "ملف Meta CSV",
    drive: "ملف Drive JSON",
    start: "تحميل الملفات وبدء المراجعة",
    reload: "اختيار ملفات أخرى",
    product: "المنتج",
    prev: "السابق",
    next: "التالي",
    save: "حفظ المنتجات الموثوقة في قاعدة البيانات",
    trust: "موثوق — انتقل للمنتج التالي",
    trusted: "تمت المراجعة",
    name: "الاسم بالعربية",
    price: "السعر بالدرهم",
    slug: "الرابط المختصر",
    category: "الفئة",
    chooseCategory: "اختاري فئة موجودة",
    feedId: "معرّف Meta",
    availability: "التوفر",
    inStock: "متوفر",
    outStock: "غير متوفر",
    description: "الوصف بالعربية",
    source: "معاينة بيانات Meta",
    sourceName: "اسم Meta الأصلي",
    sourceUrl: "رابط المصدر",
    driveFolder: "مطابقة مجلد Drive",
    noFolder: "بدون مجلد مطابق",
    folderless: "أؤكد المتابعة دون صور من Drive",
    driveImages: "صور Drive والألوان",
    productImages: "صور عامة للمنتج",
    noImages: "لا توجد صور في هذا المجلد.",
    image: "صورة",
    include: "إضافة الصورة",
    exclude: "استبعاد الصورة",
    up: "رفع",
    down: "خفض",
    mapColor: "مطابقة لون المجلد",
    chooseColor: "اختاري لوناً من السجل",
    asProduct: "صور عامة للمنتج",
    originalFolder: "صور أصلية (ليست لوناً)",
    unmapped: "غير مطابق",
    duplicateFolders: "مجلدات مكررة دُمجت",
    skippedEmpty: "مجلد لون بلا صور: سيتم تجاهل الخيار.",
    conflict: "توجد صفوف Meta مكررة ببيانات متعارضة. راجعي القيم وعدّليها ثم أكّدي الحل.",
    conflictConfirm: "أؤكد أنني راجعت التعارضات واخترت القيم النهائية.",
    warning: "يحتاج قراراً",
    errors: "أخطاء المصدر",
    noProducts: "لا توجد منتجات محمّلة للمراجعة.",
    loading: "جارٍ تجهيز ملفات الاستيراد…",
    error: "تعذّر الاستيراد:",
    allTrusted: "اكتملت مراجعة جميع المنتجات. تحققي من المعاينة ثم احفظي.",
    saved: "تم حفظ المنتجات. يمكنك تنزيل ملفات CSV للتحقق أو النسخ الاحتياطي.",
    saving: "جارٍ حفظ البيانات…",
    download: "تنزيل ملفات قاعدة البيانات",
    downloadReady: "اجتازت الملفات التحقق؛ نزّلي الملفات بشكل منفصل.",
    downloadFile: "تنزيل",
    temporaryImage: "رابط مؤقت أو غير صالح؛ استبعديه قبل الوثوق بالمنتج.",
    validation: "استعلامات التحقق المطلوبة قبل التنزيل",
    pending: "راجعي المنتج وثقي به للمتابعة.",
    unresolved: "أكملي الاسم والسعر والتوفر والفئة والمطابقات المطلوبة قبل الوثوق بالمنتج.",
    login: "انتهت جلسة المالك أو لا تملك صلاحية الاستيراد.",
    imageDuplicate: "رابط صورة مكرر؛ ستُستخدم أول نسخة فقط لتفادي تكرار الرابط.",
    existingImage: "رابط الصورة موجود مسبقاً في قاعدة البيانات؛ لن تتم إضافته مرة أخرى.",
    variantDuplicate: "هناك لون مكرر لهذا المنتج؛ سيتم دمج الصور في خيار اللون نفسه.",
    partial: "تعذر الحفظ ولم يتم اعتماد أي تغيير من عملية الاستيراد. راجعي رسالة قاعدة البيانات.",
    savedRefreshError: "تم الحفظ بنجاح، لكن تعذر تحديث قائمة لوحة الإدارة.",
    existingProducts: "إذا تطابق slug مع منتج موجود فسيتم تحديثه، مع الاحتفاظ بخياراته وصوره القديمة غير المستبدلة.",
    unmappedFolders: "يجب مطابقة كل مجلد Drive بمنتج قبل الحفظ:",
    reset: "إلغاء المراجعة",
  },
  fr: {
    title: "Importer Meta + Drive avec validation",
    hint: "Chargez le CSV et le JSON Drive. Rien n'est enregistré avant la validation individuelle de chaque produit.",
    csv: "Fichier CSV Meta",
    drive: "Fichier JSON Drive",
    start: "Charger et commencer la revue",
    reload: "Choisir d'autres fichiers",
    product: "Produit",
    prev: "Précédent",
    next: "Suivant",
    save: "Enregistrer les produits approuvés",
    trust: "Valider et passer au suivant",
    trusted: "Vérifié",
    name: "Nom en arabe",
    price: "Prix en MAD",
    slug: "Slug",
    category: "Catégorie",
    chooseCategory: "Choisir une catégorie existante",
    feedId: "ID Meta",
    availability: "Disponibilité",
    inStock: "En stock",
    outStock: "Épuisé",
    description: "Description en arabe",
    source: "Aperçu Meta",
    sourceName: "Nom Meta original",
    sourceUrl: "Lien source",
    driveFolder: "Associer un dossier Drive",
    noFolder: "Aucun dossier associé",
    folderless: "Je confirme continuer sans images Drive",
    driveImages: "Images et couleurs Drive",
    productImages: "Images générales du produit",
    noImages: "Aucune image dans ce dossier.",
    image: "Image",
    include: "Inclure",
    exclude: "Exclure",
    up: "Monter",
    down: "Descendre",
    mapColor: "Associer la couleur du dossier",
    chooseColor: "Choisir une couleur du registre",
    asProduct: "Images générales du produit",
    originalFolder: "Images originales (pas une couleur)",
    unmapped: "Non associé",
    duplicateFolders: "dossiers identiques fusionnés",
    skippedEmpty: "Dossier de couleur vide : l'option sera ignorée.",
    conflict: "Des lignes Meta dupliquées sont en conflit. Vérifiez les valeurs et confirmez la résolution.",
    conflictConfirm: "Je confirme avoir vérifié et résolu les conflits.",
    warning: "À résoudre",
    errors: "Erreurs source",
    noProducts: "Aucun produit chargé.",
    loading: "Préparation des fichiers…",
    error: "Échec de l'import :",
    allTrusted: "Tous les produits sont vérifiés. Enregistrez pour continuer.",
    saved: "Produits enregistrés. Téléchargez les CSV pour contrôle ou sauvegarde.",
    saving: "Enregistrement…",
    download: "Télécharger les fichiers de base de données",
    downloadReady: "Validation réussie ; téléchargez chaque fichier séparément.",
    downloadFile: "Télécharger",
    temporaryImage: "Lien temporaire ou invalide ; excluez-le avant validation.",
    validation: "Requêtes de validation avant téléchargement",
    pending: "Vérifiez puis validez ce produit.",
    unresolved: "Complétez le nom, prix, disponibilité, catégorie et associations requises.",
    login: "Session propriétaire invalide ou non autorisée.",
    imageDuplicate: "Lien d'image dupliqué ; seule la première occurrence sera conservée.",
    existingImage: "Lien déjà présent en base ; il ne sera pas ajouté.",
    variantDuplicate: "Couleur dupliquée ; les images seront fusionnées.",
    partial: "Échec de l'enregistrement ; la transaction a été annulée.",
    savedRefreshError: "Enregistrement réussi, mais la liste admin n'a pas pu être actualisée.",
    existingProducts: "Un slug existant sera mis à jour ; les options et images anciennes non remplacées seront conservées.",
    unmappedFolders: "Associez chaque dossier Drive à un produit avant l'enregistrement :",
    reset: "Annuler la revue",
  },
  en: {
    title: "Review Meta + Drive import",
    hint: "Load the CSV and Drive JSON. Nothing is written until every product is reviewed and trusted.",
    csv: "Meta CSV file",
    drive: "Drive JSON file",
    start: "Load files and begin review",
    reload: "Choose different files",
    product: "Product",
    prev: "Previous",
    next: "Next",
    save: "Save trusted products to database",
    trust: "Trust and continue",
    trusted: "Reviewed",
    name: "Arabic name",
    price: "Price (MAD)",
    slug: "Slug",
    category: "Category",
    chooseCategory: "Choose an existing category",
    feedId: "Meta feed item ID",
    availability: "Availability",
    inStock: "In stock",
    outStock: "Out of stock",
    description: "Arabic description",
    source: "Meta data preview",
    sourceName: "Original Meta name",
    sourceUrl: "Source URL",
    driveFolder: "Match Drive folder",
    noFolder: "No folder",
    folderless: "I confirm proceeding without Drive images",
    driveImages: "Drive images and colors",
    productImages: "General product images",
    noImages: "No images in this folder.",
    image: "Image",
    include: "Include image",
    exclude: "Exclude image",
    up: "Move up",
    down: "Move down",
    mapColor: "Map folder color",
    chooseColor: "Choose a registered color",
    asProduct: "General product images",
    originalFolder: "Original images (not a color)",
    unmapped: "Unmapped",
    duplicateFolders: "duplicate folders merged",
    skippedEmpty: "Color folder has no images; its option will be skipped.",
    conflict: "Duplicate Meta rows conflict. Review the values, edit as needed, and confirm resolution.",
    conflictConfirm: "I confirm that I reviewed and resolved the source conflicts.",
    warning: "Needs a decision",
    errors: "Source errors",
    noProducts: "No products are loaded for review.",
    loading: "Preparing import files…",
    error: "Import failed:",
    allTrusted: "Every product is reviewed. Save to load the approved records.",
    saved: "Products saved. Download the CSV files for validation or backup.",
    saving: "Saving…",
    download: "Download database files",
    downloadReady: "Validation passed; download each file separately.",
    downloadFile: "Download",
    temporaryImage: "Temporary or invalid link; exclude it before trusting this product.",
    validation: "Validation SQL required before download",
    pending: "Review and trust this product to continue.",
    unresolved: "Complete the name, price, availability, category, and required mappings before trusting.",
    login: "The owner session is missing or not authorized to import.",
    imageDuplicate: "Duplicate image URL; only the first occurrence will be kept.",
    existingImage: "Image URL already exists in the database; it will not be added again.",
    variantDuplicate: "Duplicate color; its images will merge into the same option.",
    partial: "Save failed and the import transaction was rolled back.",
    savedRefreshError: "The import succeeded, but the admin catalogue could not be refreshed.",
    existingProducts: "A matching slug updates that product; existing options and images not replaced are retained.",
    unmappedFolders: "Map every Drive folder to a product before saving:",
    reset: "Cancel review",
  },
  es: {
    title: "Revisar importación Meta + Drive",
    hint: "Carga el CSV y el JSON de Drive. No se guarda nada hasta revisar y aprobar cada producto.",
    csv: "Archivo CSV de Meta",
    drive: "Archivo JSON de Drive",
    start: "Cargar archivos y revisar",
    reload: "Elegir otros archivos",
    product: "Producto",
    prev: "Anterior",
    next: "Siguiente",
    save: "Guardar productos aprobados",
    trust: "Aprobar y continuar",
    trusted: "Revisado",
    name: "Nombre en árabe",
    price: "Precio en MAD",
    slug: "Slug",
    category: "Categoría",
    chooseCategory: "Elige una categoría existente",
    feedId: "ID del artículo Meta",
    availability: "Disponibilidad",
    inStock: "Disponible",
    outStock: "Agotado",
    description: "Descripción en árabe",
    source: "Vista previa de Meta",
    sourceName: "Nombre original de Meta",
    sourceUrl: "URL de origen",
    driveFolder: "Asociar carpeta de Drive",
    noFolder: "Sin carpeta",
    folderless: "Confirmo continuar sin imágenes de Drive",
    driveImages: "Imágenes y colores de Drive",
    productImages: "Imágenes generales del producto",
    noImages: "No hay imágenes en esta carpeta.",
    image: "Imagen",
    include: "Incluir imagen",
    exclude: "Excluir imagen",
    up: "Subir",
    down: "Bajar",
    mapColor: "Asignar color de carpeta",
    chooseColor: "Elige un color registrado",
    asProduct: "Imágenes generales del producto",
    originalFolder: "Imágenes originales (no es un color)",
    unmapped: "Sin asignar",
    duplicateFolders: "carpetas duplicadas fusionadas",
    skippedEmpty: "Carpeta de color vacía; se omitirá la opción.",
    conflict: "Hay filas Meta duplicadas en conflicto. Revisa los valores y confirma la resolución.",
    conflictConfirm: "Confirmo que revisé y resolví los conflictos.",
    warning: "Requiere decisión",
    errors: "Errores de origen",
    noProducts: "No hay productos para revisar.",
    loading: "Preparando los archivos…",
    error: "Error de importación:",
    allTrusted: "Todos los productos están revisados. Guarda para cargar los datos.",
    saved: "Productos guardados. Descarga los CSV para validarlos o guardarlos.",
    saving: "Guardando…",
    download: "Descargar archivos de base de datos",
    downloadReady: "Validación correcta; descarga cada archivo por separado.",
    downloadFile: "Descargar",
    temporaryImage: "Enlace temporal o no válido; exclúyelo antes de aprobar el producto.",
    validation: "SQL de validación antes de descargar",
    pending: "Revisa y aprueba este producto para continuar.",
    unresolved: "Completa nombre, precio, disponibilidad, categoría y las asociaciones necesarias.",
    login: "La sesión del propietario no es válida o no está autorizada.",
    imageDuplicate: "URL de imagen duplicada; solo se conservará la primera.",
    existingImage: "La URL ya existe en la base de datos; no se añadirá otra vez.",
    variantDuplicate: "Color duplicado; las imágenes se combinarán en la misma opción.",
    partial: "Error al guardar; se revirtió la transacción de importación.",
    savedRefreshError: "La importación se guardó, pero no se pudo actualizar el catálogo del administrador.",
    existingProducts: "Un slug existente se actualizará; se conservarán las opciones e imágenes antiguas no reemplazadas.",
    unmappedFolders: "Asocia cada carpeta de Drive a un producto antes de guardar:",
    reset: "Cancelar revisión",
  },
};

const validationSql = [
  "SELECT feed_item_id, COUNT(*) FROM public.products WHERE feed_item_id IS NOT NULL GROUP BY feed_item_id HAVING COUNT(*) > 1;",
  "WITH feed_ids AS (SELECT feed_item_id FROM public.products WHERE feed_item_id IS NOT NULL UNION ALL SELECT feed_item_id FROM public.product_color_options WHERE feed_item_id IS NOT NULL) SELECT feed_item_id, COUNT(*) FROM feed_ids GROUP BY feed_item_id HAVING COUNT(*) > 1;",
  "SELECT slug, COUNT(*) FROM public.products GROUP BY slug HAVING COUNT(*) > 1;",
  "SELECT pco.* FROM public.product_color_options pco LEFT JOIN public.products p ON p.id = pco.product_id WHERE p.id IS NULL;",
  "SELECT pi.* FROM public.product_images pi LEFT JOIN public.products p ON p.id = pi.product_id WHERE p.id IS NULL;",
  "SELECT pi.* FROM public.product_images pi LEFT JOIN public.product_color_options pco ON pco.id = pi.color_option_id AND pco.product_id = pi.product_id WHERE pi.color_option_id IS NOT NULL AND pco.id IS NULL;",
  "SELECT image_url, COUNT(*) FROM public.product_images GROUP BY image_url HAVING COUNT(*) > 1;",
].join("\n");

function normalizeFolderKey(value: string) {
  return value.normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function suggestedCategory(name: string, categoryIds: Set<string>) {
  const value = normalizeFolderKey(name);
  const preferred = value.includes("بطاني") || value.includes("فراش") || value.includes("مضيئ")
    ? "nursery-sleep"
    : value.includes("حمام") || value.includes("منشف") || value.includes("سلهام")
      ? "bath-skincare-health"
      : value.includes("لباس") || value.includes("ملابس") || value.includes("افرول") || value.includes("راس")
        ? "clothing-footwear"
        : value.includes("حقيب") || value.includes("ام و") || value.includes("تجميع")
          ? "gear-safety-toys"
          : "";
  return categoryIds.has(preferred) ? preferred : "";
}

function stagedFromMeta(product: MetaProduct, categoryIds: Set<string>): StagedProduct {
  return {
    ...product,
    categoryId: suggestedCategory(product.name, categoryIds),
    folderName: "",
    images: [],
    includedImages: {},
    order: [],
    variantColors: {},
    trusted: false,
    conflictResolved: false,
    folderlessConfirmed: false,
  };
}

function normalizedUrl(value: string) {
  return normalizeImageLink(value) ?? value.trim();
}

function downloadFile(file: OutputFile) {
  const contentType = file.name.endsWith(".json") ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
  const blob = new Blob([file.content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function colorKey(folderName: string) {
  return normalizeFolderKey(folderName);
}

export function MetaDriveImportWizard({
  colors,
  existingProducts,
  language,
  session,
  supabase,
  onSaved,
}: Props) {
  const text = COPY[language];
  const [csvText, setCsvText] = useState("");
  const [driveText, setDriveText] = useState("");
  const [csvName, setCsvName] = useState("");
  const [driveName, setDriveName] = useState("");
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [products, setProducts] = useState<StagedProduct[]>([]);
  const [folders, setFolders] = useState<DriveProductFolder[]>([]);
  const [sourceIssues, setSourceIssues] = useState<MetaDriveIssue[]>([]);
  const [importErrors, setImportErrors] = useState<MetaDriveIssue[]>([]);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [outputFiles, setOutputFiles] = useState<OutputFile[]>([]);
  const [downloadsValidated, setDownloadsValidated] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const currentProduct = products[current];
  const assignedFolderNames = new Set(products.map((product) => product.folderName).filter(Boolean));
  const unmappedFolders = folders.filter((folder) => !assignedFolderNames.has(folder.name));
  const selectedFolder = folders.find((folder) => folder.name === currentProduct?.folderName);
  const allTrusted = products.length > 0 && products.every((product) => product.trusted);
  const isLocked = busy || outputFiles.length > 0;
  const duplicateImageUrls = useMemo(() => {
    const owners = new Map<string, number>();
    products.forEach((product, index) => {
      product.images.forEach((image) => {
        if (product.includedImages[image.url] === false) return;
        const url = normalizedUrl(image.url);
        if (!owners.has(url)) owners.set(url, index);
      });
    });
    return new Map(
      Array.from(owners.keys()).map((url) => [url, owners.get(url)!]),
    );
  }, [products]);

  async function loadFiles() {
    setBusy(true);
    setStatus("");
    try {
      const { products: metaProducts, issues } = parseMetaCsv(csvText);
      const parsedFolders = parseDriveJson(driveText);
      if (!metaProducts.length) throw new Error("The CSV contains no product records.");
      if (!colors.length) throw new Error("The active database color registry has not loaded.");

      const { data: categoryRows, error: categoryError } = await supabase
        .from("categories")
        .select("id, name")
        .order("sort_order", { ascending: true });
      if (categoryError) throw new Error(`Could not load database categories: ${categoryError.message}`);
      const availableCategories = (categoryRows ?? []) as DbCategory[];
      if (!availableCategories.length) throw new Error("No database categories are available.");

      const ids = new Set(availableCategories.map((category) => category.id));
      const staged = metaProducts.map((product) => stagedFromMeta(product, ids));
      const nextIssues = [...issues];
      metaProducts.forEach((product) => {
        product.sourceIssues.forEach((message) =>
          nextIssues.push({ source: `CSV row ${product.sourceLines.join(", ")}`, message }),
        );
      });
      parsedFolders.forEach((folder) => {
        if (folder.duplicateFolders > 1) {
          nextIssues.push({
            source: folder.name,
            message: `${folder.duplicateFolders} identical Drive folders were merged.`,
          });
        }
      });
      setCategories(availableCategories);
      setProducts(staged);
      setFolders(parsedFolders);
      setSourceIssues(nextIssues);
      setImportErrors(nextIssues);
      setOutputFiles([]);
      setDownloadsValidated(false);
      setCurrent(0);
      setLoaded(true);
    } catch (error) {
      setStatus(`${text.error} ${error instanceof Error ? error.message : "Invalid input files."}`);
    } finally {
      setBusy(false);
    }
  }

  function updateCurrent(update: Partial<StagedProduct>) {
    if (outputFiles.length > 0) return;
    setProducts((currentProducts) => currentProducts.map((product, index) =>
      index === current
        ? { ...product, ...update, trusted: false, conflictResolved: update.conflictResolved ?? false }
        : product,
    ));
  }

  function selectFolder(folderName: string) {
    if (outputFiles.length > 0) return;
    const folder = folders.find((candidate) => candidate.name === folderName);
    if (!folder) {
      updateCurrent({
        folderName: "",
        images: [],
        includedImages: {},
        order: [],
        variantColors: {},
        folderlessConfirmed: false,
      });
      return;
    }

    const images: MetaDriveImage[] = folder.images.map((url) => ({
      url,
      name: text.productImages,
      colorId: null,
    }));
    const variantColors: Record<string, string> = {};
    folder.variants.forEach((variant) => {
      const key = colorKey(variant.name);
      const mappedColor = inferColorMapping(variant.name, colors);
      variantColors[key] = mappedColor;
      variant.images.forEach((url) => images.push({
        url,
        name: variant.name,
        colorId: mappedColor,
        variantName: variant.name,
      }));
      if (variant.images.length === 0) {
        setImportErrors((previous) => [
          ...previous,
          { source: `${folder.name}/${variant.name}`, message: text.skippedEmpty },
        ]);
      }
    });
    const uniqueImages = Array.from(new Map(images.map((image) => [image.url, image])).values());
    const invalidImages = uniqueImages.filter((image) => !normalizeImageLink(image.url));
    if (invalidImages.length) {
      setImportErrors((previous) => [
        ...previous,
        ...invalidImages.map((image) => ({
          source: `${folder.name}/${image.name}`,
          message: `Temporary or invalid image URL excluded: ${image.url}`,
        })),
      ]);
    }
    updateCurrent({
      folderName,
      images: uniqueImages,
      includedImages: Object.fromEntries(uniqueImages.map((image) => [image.url, true])),
      order: uniqueImages.map((image) => image.url),
      variantColors,
      folderlessConfirmed: false,
    });
  }

  function setVariantColor(variantName: string, nextColorId: string) {
    if (outputFiles.length > 0) return;
    if (!currentProduct || !selectedFolder) return;
    const key = colorKey(variantName);
    const variant = selectedFolder.variants.find((candidate) => colorKey(candidate.name) === key);
    if (!variant) return;
    updateCurrent({
      variantColors: { ...currentProduct.variantColors, [key]: nextColorId },
      images: currentProduct.images.map((image) =>
        image.variantName && colorKey(image.variantName) === key
          ? { ...image, colorId: nextColorId }
          : image,
      ),
    });
  }

  function reorderImage(url: string, direction: -1 | 1) {
    if (!currentProduct || outputFiles.length > 0) return;
    const order = currentProduct.order.length
      ? [...currentProduct.order]
      : currentProduct.images.map((image) => image.url);
    const index = order.indexOf(url);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    updateCurrent({ order });
  }

  function hasUnresolved(product: StagedProduct) {
    if (!product.name.trim() || !product.categoryId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) ||
      !product.feedItemId.trim() || product.priceMad === null || product.priceMad < 10 ||
      product.priceMad > 300 || !Number.isInteger(product.priceMad) || product.available === null ||
      (product.conflictingSourceRows && !product.conflictResolved) ||
      (!product.folderName && !product.folderlessConfirmed)) return true;
    if (products.some((candidate) =>
      candidate !== product &&
      (candidate.slug === product.slug || candidate.feedItemId === product.feedItemId),
    )) return true;
    if (product.images.some((image) =>
      product.includedImages[image.url] !== false && !normalizeImageLink(image.url),
    )) return true;
    const folder = folders.find((candidate) => candidate.name === product.folderName);
    return !!folder?.variants.some((variant) =>
      variant.images.length > 0 && !product.variantColors[colorKey(variant.name)],
    );
  }

  function trustCurrent() {
    if (!currentProduct || hasUnresolved(currentProduct)) return;
    setProducts((currentProducts) => currentProducts.map((product, index) =>
      index === current ? { ...product, trusted: true } : product,
    ));
    if (current < products.length - 1) setCurrent(current + 1);
  }

  async function readAll<T>(table: string, columns: string) {
    const pageSize = 1000;
    const rows: T[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from(table).select(columns).range(offset, offset + pageSize - 1);
      if (error) throw new Error(`Could not validate ${table}: ${error.message}`);
      rows.push(...((data ?? []) as T[]));
      if (!data || data.length < pageSize) return rows;
    }
  }

  async function buildOutputFiles() {
    const existingRows = await readAll<{
      id: string;
      slug: string;
      feed_item_id: string | null;
      name: Record<string, string>;
      description: Record<string, string>;
      brand: string | null;
      condition: string | null;
      google_product_category: string | null;
      fb_product_category: string | null;
      age_group: string | null;
      material: string | null;
      regular_price_mad: number | null;
      sale_price_mad: number | null;
      quantity_to_sell_on_facebook: number | null;
      feed_attributes: Record<string, string>;
      sort_order: number;
      created_at: string;
    }>(
      "products",
      "id, slug, feed_item_id, name, description, brand, condition, google_product_category, fb_product_category, age_group, material, regular_price_mad, sale_price_mad, quantity_to_sell_on_facebook, feed_attributes, sort_order, created_at",
    );
    const existingOptionRows = await readAll<{
      id: string;
      product_id: string;
      color_id: string;
      feed_item_id: string | null;
    }>("product_color_options", "id, product_id, color_id, feed_item_id");
    const existingImageRows = await readAll<{
      id: string;
      product_id: string;
      color_option_id: string | null;
      image_url: string;
    }>("product_images", "id, product_id, color_option_id, image_url");
    const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));
    const categoryIds = new Set(categories.map((category) => category.id));
    const currentSlugCounts = new Map<string, number>();
    const feedIds = new Set<string>();
    const errors: MetaDriveIssue[] = [...importErrors];
    const productsToSave: Array<Record<string, unknown>> = [];
    const optionsToSave: Array<Record<string, unknown>> = [];
    const imagesToSave: Array<Record<string, unknown>> = [];
    const mapping: Record<string, string> = {};
    const seenImageUrls = new Set<string>();
    const imageOwners = new Map(existingImageRows.map((row) => [row.image_url, row]));
    const productIdBySlug = new Map<string, string>();
    const now = new Date().toISOString();

    products.forEach((product) => {
      currentSlugCounts.set(product.slug, (currentSlugCounts.get(product.slug) ?? 0) + 1);
    });
    const duplicateSlug = Array.from(currentSlugCounts).find(([, count]) => count > 1);
    if (duplicateSlug) throw new Error(`Duplicate slug "${duplicateSlug[0]}" remains unresolved.`);

    for (const product of products) {
      if (hasUnresolved(product) || !product.trusted) {
        throw new Error(`"${product.name}" is not complete and trusted.`);
      }
      if (!categoryIds.has(product.categoryId)) {
        throw new Error(`Category "${product.categoryId}" is not present in the database.`);
      }
      const existing = existingBySlug.get(product.slug);
      const productId = existing?.id ?? await uuidV5(`product:${product.slug}`);
      productIdBySlug.set(product.slug, productId);
      const previousProduct = existingProducts.find((candidate) => candidate.id === productId);
      const sortOrder = existing?.sort_order ?? (previousProduct
        ? existingProducts.indexOf(previousProduct)
        : existingRows.length + productsToSave.length);
      if (feedIds.has(product.feedItemId)) {
        throw new Error(`Feed item ID "${product.feedItemId}" is duplicated.`);
      }
      const dbFeedOwner = existingRows.find((row) =>
        row.feed_item_id === product.feedItemId && row.id !== productId,
      );
      const optionFeedOwner = existingOptionRows.find((row) =>
        row.feed_item_id === product.feedItemId,
      );
      if (dbFeedOwner || optionFeedOwner) {
        throw new Error(`Feed item ID "${product.feedItemId}" already belongs to another database row.`);
      }
      feedIds.add(product.feedItemId);
      productsToSave.push({
        id: productId,
        slug: product.slug,
        category_id: product.categoryId,
        name: { ...(existing?.name ?? {}), ar: product.name.trim() },
        description: { ...(existing?.description ?? {}), ar: product.description.trim() },
        price_mad: product.priceMad,
        available: product.available,
        feed_item_id: product.feedItemId.trim(),
        brand: existing?.brand ?? null,
        condition: existing?.condition ?? null,
        google_product_category: existing?.google_product_category ?? null,
        fb_product_category: existing?.fb_product_category ?? null,
        age_group: existing?.age_group ?? null,
        material: existing?.material ?? null,
        regular_price_mad: existing?.regular_price_mad ?? null,
        sale_price_mad: existing?.sale_price_mad ?? null,
        quantity_to_sell_on_facebook: existing?.quantity_to_sell_on_facebook ?? null,
        feed_attributes: { ...(existing?.feed_attributes ?? {}), ...product.feedAttributes },
        sort_order: sortOrder,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      });
      if (product.folderName) mapping[product.folderName] = product.slug;

      const includedImages = product.order
        .map((url) => product.images.find((image) => image.url === url))
        .filter((image): image is MetaDriveImage => !!image)
        .filter((image) => product.includedImages[image.url] !== false);
      const colorImages = new Map<string, MetaDriveImage[]>();
      includedImages.forEach((image) => {
        if (!image.colorId || image.colorId === "__product__") return;
        const collection = colorImages.get(image.colorId) ?? [];
        collection.push(image);
        colorImages.set(image.colorId, collection);
      });
      const colorIds = Array.from(colorImages.keys());
      const folder = folders.find((candidate) => candidate.name === product.folderName);
      if (folder) {
        const mappedIds = folder.variants
          .map((variant) => product.variantColors[colorKey(variant.name)])
          .filter((colorId) => colorId && colorId !== "__product__");
        if (new Set(mappedIds).size !== mappedIds.length) {
          errors.push({
            source: product.name,
            message: "Duplicate color folders were merged into the same product color option.",
          });
        }
      }
      const optionIds = new Map<string, string>();
      for (let index = 0; index < colorIds.length; index += 1) {
        const colorId = colorIds[index];
        const registryColor = colors.find((color) => color.id === colorId);
        if (!registryColor) throw new Error(`Color "${colorId}" is not in the active color registry.`);
        const existingOption = existingOptionRows.find((row) =>
          row.product_id === productId && row.color_id === colorId,
        );
        const optionId = existingOption?.id ?? await uuidV5(`color-option:${productId}:${colorId}`);
        const optionFeedId = `${product.slug}-${colorId}`;
        const hasLocalFeedOwner = feedIds.has(optionFeedId);
        const persistedProductOwner = existingRows.find((row) =>
          row.feed_item_id === optionFeedId && row.id !== productId,
        );
        const persistedOptionOwner = existingOptionRows.find((row) =>
          row.feed_item_id === optionFeedId && row.id !== existingOption?.id,
        );
        if (hasLocalFeedOwner ||
          persistedProductOwner || persistedOptionOwner) {
          throw new Error(`Color feed ID "${optionFeedId}" is already in use.`);
        }
        feedIds.add(optionFeedId);
        optionIds.set(colorId, optionId);
        optionsToSave.push({
          id: optionId,
          product_id: productId,
          color_id: colorId,
          feed_item_id: optionFeedId,
          available: product.available,
          price_mad: null,
          source_title: product.name,
          source_description: product.description,
          sort_order: index,
          created_at: now,
        });
      }

      let productImageOrder = 0;
      const colorImageOrder = new Map<string, number>();
      for (const image of includedImages) {
        const url = normalizeImageLink(image.url);
        if (!url) {
          errors.push({ source: `${product.name}/${image.name}`, message: "Invalid or temporary image URL skipped." });
          continue;
        }
        if (seenImageUrls.has(url)) {
          errors.push({ source: `${product.name}/${image.name}`, message: `Duplicate image URL excluded: ${url}` });
          continue;
        }
        const optionId = image.colorId && image.colorId !== "__product__"
          ? optionIds.get(image.colorId)
          : null;
        if (image.colorId && image.colorId !== "__product__" && !optionId) {
          throw new Error(`Image color "${image.colorId}" has no color option.`);
        }
        const existingImage = imageOwners.get(url);
        if (existingImage && (
          existingImage.product_id !== productId ||
          existingImage.color_option_id !== optionId
        )) {
          errors.push({ source: `${product.name}/${image.name}`, message: `Existing image URL excluded: ${url}` });
          seenImageUrls.add(url);
          continue;
        }
        seenImageUrls.add(url);
        const imageId = existingImage?.id ??
          await uuidV5(`product-image:${productId}:${optionId ?? "product"}:${url}`);
        const sortOrder = optionId
          ? colorImageOrder.get(optionId) ?? 0
          : productImageOrder;
        if (optionId) colorImageOrder.set(optionId, sortOrder + 1);
        else productImageOrder += 1;
        imagesToSave.push({
          id: imageId,
          product_id: productId,
          color_option_id: optionId,
          image_url: url,
          sort_order: sortOrder,
          created_at: now,
        });
      }
    }

    const productIdsToImport = new Set(productsToSave.map((row) => row.id as string));
    if (productIdsToImport.size !== productsToSave.length) {
      throw new Error("Two reviewed products resolve to the same database ID.");
    }
    const optionKeys = new Set(optionsToSave.map((row) => `${row.product_id}:${row.color_id}`));
    if (optionKeys.size !== optionsToSave.length) {
      errors.push({ source: "Color options", message: "Duplicate product/color pairs were merged." });
    }
    const mappedFolders = new Set(Object.keys(mapping));
    folders.filter((folder) => !mappedFolders.has(folder.name)).forEach((folder) =>
      errors.push({ source: folder.name, message: "Drive folder was not mapped to a product." }),
    );

    const categoryHeaders = ["id", "name", "description", "sort_order", "created_at"];
    const colorHeaders = ["id", "label", "hex_color", "aliases", "sort_order", "active", "created_at"];
    const productHeaders = [
      "id", "slug", "category_id", "name", "description", "price_mad", "available",
      "feed_item_id", "brand", "condition", "google_product_category", "fb_product_category",
      "age_group", "material", "regular_price_mad", "sale_price_mad",
      "quantity_to_sell_on_facebook", "feed_attributes", "sort_order", "created_at", "updated_at",
    ];
    const optionHeaders = [
      "id", "product_id", "color_id", "feed_item_id", "available", "price_mad",
      "source_title", "source_description", "sort_order", "created_at",
    ];
    const imageHeaders = [
      "id", "product_id", "color_option_id", "image_url", "sort_order", "created_at",
    ];
    const errorRows = errors.map((issue) => ({ source: issue.source, message: issue.message }));
    const folderRows = JSON.stringify(mapping, null, 2);
    return {
      productRows: productsToSave,
      optionRows: optionsToSave,
      imageRows: imagesToSave,
      files: [
        { name: "categories.csv", content: `${makeCsv(categoryHeaders, [])}\r\n` },
        { name: "colors.csv", content: `${makeCsv(colorHeaders, [])}\r\n` },
        { name: "products.csv", content: makeCsv(productHeaders, productsToSave) },
        { name: "product_color_options.csv", content: makeCsv(optionHeaders, optionsToSave) },
        { name: "product_images.csv", content: makeCsv(imageHeaders, imagesToSave) },
        { name: "folder_name_to_retailer_id.json", content: folderRows },
        { name: "import_errors.csv", content: makeCsv(["source", "message"], errorRows) },
      ] satisfies OutputFile[],
      errors,
    };
  }

  async function saveImport() {
    if (!session.user || session.user.app_metadata?.store_owner !== true) {
      setStatus(text.login);
      return;
    }
    if (!allTrusted) {
      setStatus(text.unresolved);
      return;
    }
    setBusy(true);
    setStatus(text.loading);
    try {
      const { data: categoryRows, error: categoryError } = await supabase.from("categories").select("id");
      if (categoryError) throw new Error(`Category validation failed: ${categoryError.message}`);
      const categoryIds = new Set((categoryRows ?? []).map((row) => row.id as string));
      if (products.some((product) => !categoryIds.has(product.categoryId))) {
        throw new Error("A selected category no longer exists in the database.");
      }

      const output = await buildOutputFiles();
      const { error: importError } = await supabase.rpc("save_reviewed_catalogue", {
        p_products: output.productRows,
        p_color_options: output.optionRows,
        p_product_images: output.imageRows,
      });
      if (importError) throw new Error(importError.message);
      setImportErrors(output.errors);
      setOutputFiles(output.files);
      const refreshed = await onSaved();
      setStatus(refreshed ? text.saved : text.savedRefreshError);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown import error.";
      setImportErrors((previous) => [...previous, { source: "Database save", message }]);
      setStatus(`${text.partial} ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadFiles() {
    if (!outputFiles.length) return;
    setBusy(true);
    setStatus("");
    try {
      const productsCheck = await readAll<{ id: string; slug: string; feed_item_id: string | null }>(
        "products",
        "id, slug, feed_item_id",
      );
      const optionsCheck = await readAll<{ id: string; product_id: string; color_id: string; feed_item_id: string | null }>(
        "product_color_options",
        "id, product_id, color_id, feed_item_id",
      );
      const imagesCheck = await readAll<{ id: string; product_id: string; color_option_id: string | null; image_url: string }>(
        "product_images",
        "id, product_id, color_option_id, image_url",
      );
      const issues: string[] = [];
      const countDuplicates = (values: string[]) => {
        const counts = new Map<string, number>();
        values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
        return Array.from(counts).filter(([, count]) => count > 1).map(([value]) => value);
      };
      if (countDuplicates(productsCheck.map((row) => row.slug)).length) issues.push("Duplicate product slugs exist.");
      if (countDuplicates([
        ...productsCheck.map((row) => row.feed_item_id ?? ""),
        ...optionsCheck.map((row) => row.feed_item_id ?? ""),
      ]).length) issues.push("Duplicate feed IDs exist across products and color options.");
      const productIds = new Set(productsCheck.map((row) => row.id));
      const optionById = new Map(optionsCheck.map((row) => [row.id, row]));
      if (optionsCheck.some((row) => !productIds.has(row.product_id))) issues.push("Orphan product color options exist.");
      if (imagesCheck.some((row) =>
        !productIds.has(row.product_id) ||
        (row.color_option_id !== null &&
          optionById.get(row.color_option_id)?.product_id !== row.product_id),
      )) issues.push("Orphan or mismatched product images exist.");
      if (countDuplicates(imagesCheck.map((row) => row.image_url)).length) issues.push("Duplicate global image URLs exist.");
      if (issues.length) throw new Error(issues.join(" "));

      setDownloadsValidated(true);
      setStatus(text.downloadReady);
    } catch (error) {
      setStatus(`${text.error} ${error instanceof Error ? error.message : "Validation failed."}`);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCsvText("");
    setDriveText("");
    setCsvName("");
    setDriveName("");
    setProducts([]);
    setFolders([]);
    setSourceIssues([]);
    setImportErrors([]);
    setOutputFiles([]);
    setDownloadsValidated(false);
    setLoaded(false);
    setCurrent(0);
    setStatus("");
  }

  if (!loaded) {
    return <section className="meta-drive-import" aria-label={text.title}>
      <header className="meta-drive-heading"><div><h2>{text.title}</h2><p>{text.hint}</p></div></header>
      <div className="meta-drive-file-inputs">
        <label className="field"><span>{text.csv}</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) {
            setStatus(`${text.error} CSV file exceeds 2 MB.`);
            return;
          }
          setCsvName(file.name);
          void file.text().then(setCsvText).catch((error: unknown) =>
            setStatus(`${text.error} ${error instanceof Error ? error.message : "Could not read CSV."}`),
          );
        }} /></label>
        <label className="field"><span>{text.drive}</span><input type="file" accept=".json,application/json" disabled={busy} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            setStatus(`${text.error} Drive JSON file exceeds 5 MB.`);
            return;
          }
          setDriveName(file.name);
          void file.text().then(setDriveText).catch((error: unknown) =>
            setStatus(`${text.error} ${error instanceof Error ? error.message : "Could not read Drive JSON."}`),
          );
        }} /></label>
      </div>
      {(csvName || driveName) && <p className="meta-drive-selected-files" dir="ltr">{csvName} · {driveName}</p>}
      {status && <p className="meta-drive-status error-text" role="alert">{status}</p>}
      <button className="button button-dark" type="button" disabled={busy || !csvText || !driveText} onClick={() => void loadFiles()}>
        {busy ? text.loading : text.start}
      </button>
    </section>;
  }

  if (!currentProduct) return <section className="meta-drive-import"><p>{text.noProducts}</p></section>;

  const unresolved = hasUnresolved(currentProduct);
  const categoryName = (category: DbCategory) =>
    localized(category.name as Record<Locale, string>, language);
  const orderedImages = (currentProduct.order.length ? currentProduct.order : currentProduct.images.map((image) => image.url))
    .map((url) => currentProduct.images.find((image) => image.url === url))
    .filter((image): image is MetaDriveImage => !!image);

  return <section className="meta-drive-import" aria-label={text.title}>
    <header className="meta-drive-heading"><div><h2>{text.title}</h2><p>{text.hint}</p></div>
      <button className="text-button danger" type="button" disabled={busy} onClick={reset}>{text.reset}</button>
    </header>
    <div className="meta-drive-progress" role="status">
      <strong>{text.product} {current + 1}/{products.length}</strong>
      <span>{products.filter((product) => product.trusted).length} / {products.length} {text.trusted}</span>
      <progress value={products.filter((product) => product.trusted).length} max={products.length} />
    </div>
    {status && <p className={`meta-drive-status ${status.includes(text.partial) ? "error-text" : ""}`} role="status">{status}</p>}
    <p className="meta-drive-note">{text.existingProducts}</p>
    {unmappedFolders.length > 0 && <p className="meta-drive-warning">
      {text.unmappedFolders} {unmappedFolders.map((folder) => folder.name).join("، ")}
    </p>}
    <div className="meta-drive-columns">
      <section className="meta-drive-column meta-drive-source" aria-label={text.driveImages}>
        <h3>{text.driveImages}</h3>
        <label className="field"><span>{text.driveFolder}</span><select value={currentProduct.folderName} disabled={isLocked} onChange={(event) => selectFolder(event.target.value)}>
          <option value="">{text.noFolder}</option>
          {folders.filter((folder) => !assignedFolderNames.has(folder.name) || folder.name === currentProduct.folderName)
            .map((folder) => <option key={folder.name} value={folder.name}>{folder.name}</option>)}
        </select></label>
        {!currentProduct.folderName && <label className="meta-drive-check">
          <input type="checkbox" checked={currentProduct.folderlessConfirmed} onChange={(event) =>
            updateCurrent({ folderlessConfirmed: event.target.checked })
          } />
          {text.folderless}
        </label>}
        {selectedFolder?.duplicateFolders && selectedFolder.duplicateFolders > 1 && <small className="form-note">
          {selectedFolder.duplicateFolders} {text.duplicateFolders}
        </small>}
        {selectedFolder?.variants.map((variant) => {
          const mappedColor = currentProduct.variantColors[colorKey(variant.name)] ?? "";
          const sameColorFolders = mappedColor && mappedColor !== "__product__"
            ? selectedFolder.variants.filter((candidate) =>
              currentProduct.variantColors[colorKey(candidate.name)] === mappedColor,
            ).length
            : 0;
          return <div className="meta-drive-color-map" key={colorKey(variant.name)}>
            <label className="field"><span>{text.mapColor}: {variant.name}</span><select value={mappedColor} disabled={isLocked} onChange={(event) =>
              setVariantColor(variant.name, event.target.value)
            }>
              <option value="">{text.chooseColor}</option>
              <option value="__product__">{text.asProduct}</option>
              {colors.map((color) => <option key={color.id} value={color.id}>{localized(color.label, language)}</option>)}
            </select></label>
            {variant.images.length === 0 && <small className="form-note">{text.skippedEmpty}</small>}
            {sameColorFolders > 1 && <small className="form-note">{text.variantDuplicate}</small>}
          </div>;
        })}
        <div className="meta-drive-image-list">
          {orderedImages.length === 0 && <p className="file-manager-empty">{text.noImages}</p>}
          {orderedImages.map((image, imageIndex) => {
            const key = normalizedUrl(image.url);
            const duplicateOwner = duplicateImageUrls.get(key);
            const isDuplicate = duplicateOwner !== undefined && duplicateOwner !== current;
            const selectedColor = image.colorId && image.colorId !== "__product__"
              ? colors.find((color) => color.id === image.colorId)
              : null;
            return <article className={`meta-drive-image ${currentProduct.includedImages[image.url] === false ? "is-excluded" : ""}`} key={`${image.url}-${imageIndex}`}>
              <div className="meta-drive-image-thumb"><ProductImage sources={[image.url]} alt={image.name} sizes="76px" fallback="♡" /></div>
              <div className="meta-drive-image-details">
                <strong>{image.name === text.productImages ? text.productImages : image.name}</strong>
                <span dir="ltr">{image.url}</span>
                <small>{image.colorId === "__product__" || image.colorId === null
                  ? text.productImages
                  : selectedColor ? localized(selectedColor.label, language) : text.unmapped}</small>
                {isDuplicate && <small className="error-text">{text.imageDuplicate}</small>}
                {!normalizeImageLink(image.url) && <small className="error-text">{text.temporaryImage}</small>}
              </div>
              <div className="meta-drive-image-actions">
                <button className="text-button" type="button" disabled={isLocked || imageIndex === 0} aria-label={text.up} onClick={() => reorderImage(image.url, -1)}>↑</button>
                <button className="text-button" type="button" disabled={isLocked} onClick={() => updateCurrent({
                  includedImages: { ...currentProduct.includedImages, [image.url]: currentProduct.includedImages[image.url] === false },
                })}>{currentProduct.includedImages[image.url] === false ? text.include : text.exclude}</button>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="meta-drive-column meta-drive-editor">
        <h3>{text.product} · {current + 1}</h3>
        <label className="field"><span>{text.name}</span><input value={currentProduct.name} disabled={isLocked} onChange={(event) => {
          const name = event.target.value;
          const slug = currentProduct.slug === slugForProduct(currentProduct.name)
            ? slugForProduct(name)
            : currentProduct.slug;
          updateCurrent({
            name,
            slug,
            feedItemId: currentProduct.feedItemId === currentProduct.slug ? slug : currentProduct.feedItemId,
          });
        }} /></label>
        <div className="meta-drive-edit-grid">
          <label className="field"><span>{text.price}</span><input type="number" min="10" max="300" step="1" value={currentProduct.priceMad ?? ""} disabled={isLocked} onChange={(event) =>
            updateCurrent({ priceMad: event.target.value ? Number(event.target.value) : null })
          } /></label>
          <label className="field"><span>{text.availability}</span><select value={currentProduct.available === null ? "" : currentProduct.available ? "in-stock" : "out-of-stock"} disabled={isLocked} onChange={(event) =>
            updateCurrent({ available: event.target.value === "" ? null : event.target.value === "in-stock" })
          }>
            <option value="">{text.warning}</option>
            <option value="in-stock">{text.inStock}</option>
            <option value="out-of-stock">{text.outStock}</option>
          </select></label>
        </div>
        <label className="field"><span>{text.slug}</span><input dir="ltr" value={currentProduct.slug} disabled={isLocked} onChange={(event) => {
          const slug = event.target.value.trim().toLowerCase();
          updateCurrent({
            slug,
            feedItemId: currentProduct.feedItemId === currentProduct.slug ? slug : currentProduct.feedItemId,
          });
        }} /></label>
        <label className="field"><span>{text.feedId}</span><input dir="ltr" value={currentProduct.feedItemId} disabled={isLocked} onChange={(event) =>
          updateCurrent({ feedItemId: event.target.value })
        } /></label>
        <label className="field"><span>{text.category}</span><select value={currentProduct.categoryId} disabled={isLocked} onChange={(event) =>
          updateCurrent({ categoryId: event.target.value })
        }>
          <option value="">{text.chooseCategory}</option>
          {categories.map((category) => <option value={category.id} key={category.id}>{categoryName(category)}</option>)}
        </select></label>
        <label className="field"><span>{text.description}</span><textarea rows={5} value={currentProduct.description} disabled={isLocked} onChange={(event) =>
          updateCurrent({ description: event.target.value })
        } /></label>
        {currentProduct.conflictingSourceRows && <div className="meta-drive-conflict">
          <p>{text.conflict}</p>
          <label className="meta-drive-check"><input type="checkbox" checked={currentProduct.conflictResolved} disabled={isLocked} onChange={(event) =>
            updateCurrent({ conflictResolved: event.target.checked })
          } />{text.conflictConfirm}</label>
        </div>}
        {unresolved && <p className="meta-drive-warning" role="alert">{text.unresolved}</p>}
        {currentProduct.trusted && <p className="success-text">{text.trusted}</p>}
        <button className="button button-dark button-wide" type="button" disabled={isLocked || unresolved || currentProduct.trusted} onClick={trustCurrent}>
          {text.trust}
        </button>
      </section>

      <aside className="meta-drive-column meta-drive-meta-preview">
        <h3>{text.source}</h3>
        <dl>
          <dt>{text.sourceName}</dt><dd>{currentProduct.sourceNames.join(" / ")}</dd>
          {currentProduct.sourceUrl && <><dt>{text.sourceUrl}</dt><dd dir="ltr">{currentProduct.sourceUrl}</dd></>}
          <dt>CSV rows</dt><dd>{currentProduct.sourceLines.join(", ")}</dd>
          <dt>{text.slug}</dt><dd dir="ltr">{currentProduct.slug}</dd>
          <dt>{text.feedId}</dt><dd dir="ltr">{currentProduct.feedItemId}</dd>
        </dl>
        {currentProduct.sourceIssues.length > 0 && <div className="meta-drive-warning-list">
          <strong>{text.warning}</strong>
          {currentProduct.sourceIssues.map((issue, index) => <p key={`${issue}-${index}`}>{issue}</p>)}
        </div>}
        <div className="meta-drive-steps">
          <p>{currentProduct.trusted ? text.trusted : text.pending}</p>
          <p>{text.allTrusted}</p>
        </div>
      </aside>
    </div>

    {sourceIssues.length > 0 && <details className="meta-drive-source-errors">
      <summary>{text.errors} ({sourceIssues.length})</summary>
      {sourceIssues.map((issue, index) => <p key={`${issue.source}-${index}`}><strong>{issue.source}</strong>: {issue.message}</p>)}
    </details>}
    <div className="meta-drive-footer">
      <button className="button button-light" type="button" disabled={isLocked || current === 0} onClick={() => setCurrent((index) => Math.max(0, index - 1))}>{text.prev}</button>
      <button className="button button-light" type="button" disabled={isLocked || !currentProduct.trusted || current >= products.length - 1} onClick={() => setCurrent((index) => Math.min(products.length - 1, index + 1))}>{text.next}</button>
      <button className="button button-dark" type="button" disabled={busy || !allTrusted || unmappedFolders.length > 1  || !!outputFiles.length} onClick={() => void saveImport()}>
        {busy ? text.saving : text.save}
      </button>
      {outputFiles.length > 0 && !downloadsValidated && <button className="button button-light" type="button" disabled={busy} onClick={() => void downloadFiles()}>{text.download}</button>}
    </div>
    {downloadsValidated && <div className="meta-drive-downloads" role="status">
      <p>{text.downloadReady}</p>
      {outputFiles.map((file) => <button className="button button-light" type="button" key={file.name} onClick={() => downloadFile(file)}>
        {text.downloadFile} · {file.name}
      </button>)}
    </div>}
    <details className="meta-drive-sql">
      <summary>{text.validation}</summary>
      <p className="form-note">The wizard runs equivalent checks against the current database before download.</p>
      <pre dir="ltr">{validationSql}</pre>
    </details>
  </section>;
}
