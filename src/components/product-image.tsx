"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function ProductImage({
  sources,
  alt,
  sizes,
  fallback,
  fallbackClassName,
  cycleOnHover = false,
}: {
  sources: string[];
  alt: string;
  sizes: string;
  fallback: string;
  fallbackClassName?: string;
  cycleOnHover?: boolean;
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const sourceKey = sources.join("\u0000");
  const hoverSources = sources.slice(0, 3);

  useEffect(() => {
    setSourceIndex(0);
    setIsHovered(false);
  }, [sourceKey]);

  useEffect(() => {
    if (!cycleOnHover || !isHovered || hoverSources.length < 2) return;
    const timer = window.setInterval(() => {
      setSourceIndex((current) => (current + 1) % hoverSources.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [cycleOnHover, hoverSources.length, isHovered]);

  const source = (cycleOnHover ? hoverSources : sources)[sourceIndex];
  if (!source) {
    return <span aria-hidden="true" className={`product-image-fallback ${fallbackClassName ?? ""}`}>{fallback}</span>;
  }

  return (
    <>
      <Image
        src={source}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized
        onMouseEnter={cycleOnHover ? () => setIsHovered(true) : undefined}
        onMouseLeave={cycleOnHover ? () => { setIsHovered(false); setSourceIndex(0); } : undefined}
        onError={() => setSourceIndex((current) => current + 1)}
      />
      {cycleOnHover && isHovered && hoverSources.slice(1).map((preloadSource) => (
        <Image
          key={preloadSource}
          src={preloadSource}
          alt=""
          fill
          sizes={sizes}
          unoptimized
          aria-hidden="true"
          style={{ opacity: 0, pointerEvents: "none" }}
        />
      ))}
    </>
  );
}
