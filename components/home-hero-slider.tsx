"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { WHATSAPP_NUMBER } from "@/lib/constants";

type HeroSlide = {
  image: string;
  eyebrow: string;
  title: string;
  text: string;
  primaryLabel: string;
  primaryHref: string;
};

const slides: HeroSlide[] = [
  {
    image: "/images/banner-aliancas-marjouxs.png",
    eyebrow: "LUXO MODERNO PARA MOMENTOS ESPECIAIS",
    title: "Alianças para momentos únicos",
    text: "Modelos em Ouro 18k, Prata 950 e sob medida, com atendimento personalizado.",
    primaryLabel: "Ver alianças",
    primaryHref: "/categorias/aliancas"
  },
  {
    image: "/images/banner-joias-marjouxs.png",
    eyebrow: "JOIAS PARA PRESENTEAR",
    title: "Joias para surpreender",
    text: "Anéis, solitários e presentes especiais para celebrar com elegância.",
    primaryLabel: "Ver produtos",
    primaryHref: "/produtos"
  }
];

function WhatsappIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size} fill="currentColor">
      <path d="M16.01 3.2A12.66 12.66 0 0 0 5.22 22.5L3.6 28.8l6.45-1.56A12.67 12.67 0 1 0 16.01 3.2Zm0 22.98c-1.97 0-3.9-.56-5.56-1.62l-.4-.25-3.83.93.97-3.73-.26-.39a10.24 10.24 0 1 1 9.08 5.06Zm5.83-7.66c-.32-.16-1.9-.94-2.2-1.05-.3-.11-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.27-.19.21-.38.24-.7.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.5.14-.66.15-.15.32-.38.48-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.76-1-2.41-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.68s1.16 3.12 1.32 3.33c.16.21 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.24 1.48.21 2.04.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

export function HomeHeroSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex];
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Olá, Marjouxs! Gostaria de falar sobre alianças sob medida."
  )}`;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [activeIndex]);

  return (
    <section className="relative overflow-hidden bg-ink text-white">
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={slide.image}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={index !== activeIndex}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.image}
              alt=""
              className="h-full w-full object-cover object-center"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/48 to-black/18" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
      </div>

      <div className="relative mx-auto grid min-h-[64svh] max-w-7xl content-end px-4 pb-20 pt-24 sm:min-h-[78svh] sm:px-6 sm:pb-24 sm:pt-28 lg:px-8">
        <div key={activeSlide.title} className="max-w-3xl">
          <p className="inline-flex rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#f3d38c] shadow-sm ring-1 ring-white/10 [text-shadow:0_1px_10px_rgba(0,0,0,0.65)] sm:text-sm sm:tracking-[0.28em]">
            {activeSlide.eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-6xl lg:text-7xl">
            {activeSlide.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">
            {activeSlide.text}
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href={activeSlide.primaryHref}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-ink sm:w-auto"
            >
              {activeSlide.primaryLabel} <ArrowRight size={18} />
            </Link>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-white/20 transition hover:bg-[#1ebe5d] hover:shadow-soft sm:w-auto"
            >
              <WhatsappIcon size={18} />
              Comprar pelo WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 left-0 right-0 z-10 flex justify-center gap-2 px-4 sm:bottom-7">
        {slides.map((slide, index) => (
          <button
            key={slide.image}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`h-2.5 rounded-full transition ${
              index === activeIndex ? "w-8 bg-gold" : "w-2.5 bg-white/65 hover:bg-white"
            }`}
            aria-label={`Ir para o banner ${index + 1}`}
            aria-current={index === activeIndex ? "true" : undefined}
          />
        ))}
      </div>
    </section>
  );
}
