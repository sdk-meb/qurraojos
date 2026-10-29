"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ProductGallery } from "@/components/product-gallery";
import { ProductActions } from "@/components/product-actions";
import { formatPrice, isVariantAvailable, productImageUrlsForVariant, type Product } from "@/lib/catalog";
import { getCopy, localized, type Locale } from "@/lib/locale";

export function ProductConfigurator({
  product,
  locale,
  accent,
  fallback,
  children,
  details,
}: {
  product: Product;
  locale: Locale;
  accent: string;
  fallback: string;
  children: ReactNode;
  details: ReactNode;
}) {
  const copy = getCopy(locale);
  const colorOptions = product.colorOptions ?? [];
  const initialSelection = colorOptions.find((option) =>
    option.available && isVariantAvailable(product, option.colorKey),
  )?.colorKey ?? "default";
  const [selected, setSelected] = useState(initialSelection);

  useEffect(() => {
    setSelected(initialSelection);
  }, [product.id, initialSelection]);

  const selectedColor = colorOptions.find((option) => option.colorKey === selected);
  const images = productImageUrlsForVariant(product, selected);

  return (
    <>
      <ProductGallery
        images={images}
        alt={localized(product.name, locale)}
        accent={accent}
        sizes="(max-width: 640px) 88vw, 45vw"
        fallback={fallback}
        imageLabel={copy.productImage}
        previousLabel={copy.previousImage}
        nextLabel={copy.nextImage}
        colorOptions={colorOptions}
        selectedColorKey={selectedColor?.colorKey}
        onSelectColor={setSelected}
        colorLabel={copy.chooseColor}
        locale={locale}
      />
      <div className="detail-info">
        {children}
        <strong className="detail-price">{formatPrice(selectedColor?.priceMad ?? product.priceMad, locale)}</strong>
        {details}
        <ProductActions product={product} locale={locale} selected={selected} />
      </div>
    </>
  );
}
