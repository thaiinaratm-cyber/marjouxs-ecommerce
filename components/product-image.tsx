"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

type ProductImageProps = {
  src?: string;
  alt: string;
  priority?: boolean;
  sizes: string;
  className?: string;
};

export function ProductImage({ src, alt, priority = false, sizes, className = "object-cover" }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const imageSrc = src?.trim();

  useEffect(() => {
    setHasError(false);
  }, [imageSrc]);

  if (!imageSrc || hasError) {
    return (
      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-champagne via-pearl to-white px-4 text-center text-taupe">
        <ImageIcon className="text-gold" size={30} />
        <span className="font-serif text-sm font-semibold text-ink sm:text-lg">Imagem em breve</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      onError={() => setHasError(true)}
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );
}
