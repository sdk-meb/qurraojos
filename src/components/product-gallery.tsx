"use client";

import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { localized, type Locale } from "@/lib/locale";
import type { ProductColorOption } from "@/lib/catalog";

export function ProductGallery({
  images,
  alt,
  accent,
  fallback,
  sizes,
  imageLabel,
  previousLabel,
  nextLabel,
  colorOptions = [],
  selectedColorKey,
  onSelectColor,
  colorLabel,
  locale,
}: {
  images: string[];
  alt: string;
  accent: string;
  fallback: string;
  sizes: string;
  imageLabel: string;
  previousLabel: string;
  nextLabel: string;
  colorOptions?: ProductColorOption[];
  selectedColorKey?: string;
  onSelectColor?: (colorKey: string) => void;
  colorLabel?: string;
  locale?: Locale;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const imageKey = images.join("\u0000");

  useEffect(() => {
    setActiveIndex(0);
  }, [imageKey]);

  const selectImage = (index: number) => {
    setActiveIndex((index + images.length) % images.length);
  };

  return (
    <div className="detail-gallery">
      <div className={`detail-art art-${accent}`}>
        <ProductImage
          key={activeIndex}
          sources={images.length ? [images[activeIndex] ?? images[0]] : []}
          alt={alt}
          sizes={sizes}
          fallback={fallback}
        />
        {images.length > 1 && (
          <>
            <button
              className="detail-gallery-control detail-gallery-previous"
              type="button"
              aria-label={previousLabel}
              onClick={() => selectImage(activeIndex - 1)}
            >
              ‹
            </button>
            <button
              className="detail-gallery-control detail-gallery-next"
              type="button"
              aria-label={nextLabel}
              onClick={() => selectImage(activeIndex + 1)}
            >
              ›
            </button>
            <span className="detail-gallery-count" aria-hidden="true">
              {String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
            </span>
          </>
        )}
      </div>
      {colorOptions.length > 0 && onSelectColor && locale && (
        <div className="product-color-options" role="group" aria-label={colorLabel}>
          <span>{colorLabel}</span>
          <div>
            {colorOptions.map((option) => (
              <button
                className={`product-color-option${option.colorKey === selectedColorKey ? " is-active" : ""}`}
                key={option.colorKey}
                type="button"
                disabled={!option.available}
                aria-pressed={option.colorKey === selectedColorKey}
                onClick={() => onSelectColor(option.colorKey)}
              >
                <span className="product-color-swatch" style={{ backgroundColor: option.hexColor }} aria-hidden="true" />
                {localized(option.label, locale)}
              </button>
            ))}
          </div>
        </div>
      )}
      {images.length > 1 && (
        <div className="detail-image-thumbnails" role="group" aria-label={imageLabel}>
          {images.map((imageUrl, index) => (
            <button
              className={`detail-image-thumbnail${index === activeIndex ? " is-active" : ""}`}
              type="button"
              key={`${imageUrl}-${index}`}
              aria-label={`${imageLabel} ${index + 1}`}
              aria-pressed={index === activeIndex}
              onClick={() => selectImage(index)}
            >
              <ProductImage
                sources={[imageUrl]}
                alt=""
                sizes="(max-width: 640px) 20vw, 8vw"
                fallback={fallback}
                fallbackClassName="thumbnail-image-fallback"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
