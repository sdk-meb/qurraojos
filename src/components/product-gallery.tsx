"use client";

import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";

export function ProductGallery({
  images,
  alt,
  accent,
  fallback,
  sizes,
  imageLabel,
  previousLabel,
  nextLabel,
}: {
  images: string[];
  alt: string;
  accent: string;
  fallback: string;
  sizes: string;
  imageLabel: string;
  previousLabel: string;
  nextLabel: string;
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
