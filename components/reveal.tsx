"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  once?: boolean;
};

export function Reveal({ children, className = "", delay = 0, distance = 20, once = true }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setIsReady(true);

    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          if (once) {
            observer.unobserve(entry.target);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [once]);

  const style = {
    "--reveal-delay": `${delay}ms`,
    "--reveal-distance": `${distance}px`
  } as CSSProperties;

  return (
    <div ref={ref} className={`reveal ${isReady ? "reveal-ready" : ""} ${isVisible ? "is-visible" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}
