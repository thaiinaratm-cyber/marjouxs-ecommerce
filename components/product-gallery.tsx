"use client";

import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const validImages = images.filter((image) => image?.trim());
  const galleryImages = validImages.length > 0 ? validImages : [""];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const selectedImage = galleryImages[selectedIndex];
  const hasMultipleImages = galleryImages.length > 1;

  useEffect(() => {
    setSelectedIndex(0);
  }, [productName]);

  useEffect(() => {
    if (!isZoomOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsZoomOpen(false);
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((current) => (current + 1) % galleryImages.length);
      }
      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [galleryImages.length, isZoomOpen]);

  function goToPrevious() {
    setSelectedIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length);
  }

  function goToNext() {
    setSelectedIndex((current) => (current + 1) % galleryImages.length);
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => setIsZoomOpen(true)}
        className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-champagne shadow-soft"
        aria-label={`Ampliar imagem de ${productName}`}
      >
        <ProductImage
          src={selectedImage}
          alt={productName}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-105"
          priority
        />
        <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-ink shadow-sm">
          <Maximize2 size={15} /> Ampliar
        </span>
      </button>

      {hasMultipleImages ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {galleryImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`relative aspect-square overflow-hidden rounded-md border bg-champagne transition ${
                selectedIndex === index ? "border-gold ring-2 ring-gold/20" : "border-black/10 hover:border-gold"
              }`}
              aria-label={`Ver imagem ${index + 1} de ${productName}`}
            >
              <ProductImage
                src={image}
                alt={`${productName} - imagem ${index + 1}`}
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {isZoomOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/90 p-4">
          <button
            type="button"
            onClick={() => setIsZoomOpen(false)}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm transition hover:bg-gold hover:text-white"
            aria-label="Fechar imagem ampliada"
          >
            <X size={20} />
          </button>

          {hasMultipleImages ? (
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-sm transition hover:bg-gold hover:text-white"
              aria-label="Imagem anterior"
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}

          <div className="relative h-[82vh] w-full max-w-5xl">
            <ProductImage
              src={selectedImage}
              alt={productName}
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          {hasMultipleImages ? (
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-sm transition hover:bg-gold hover:text-white"
              aria-label="Próxima imagem"
            >
              <ChevronRight size={22} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
