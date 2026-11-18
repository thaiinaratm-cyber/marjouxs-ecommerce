"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";

export function ProductMobileCta({ primary, label, children }: {
  primary: RefObject<HTMLDivElement | null>;
  label: string;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = primary.current;
    if (!target) return;

    const mobile = window.matchMedia("(max-width: 1023px)");
    const viewport = window.visualViewport;
    let frame = 0;
    function update() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const editing = document.activeElement?.matches(
          "textarea, [contenteditable=true], input:not([type=radio]):not([type=checkbox])"
        );
        const keyboardOrZoom = viewport && (viewport.scale > 1 || window.innerHeight - viewport.height > 120);
        // The gallery and drawers already lock body scrolling while open.
        const overlay = document.body.style.overflow === "hidden";
        setShow(mobile.matches && !editing && !keyboardOrZoom && !overlay &&
          (target?.getBoundingClientRect().bottom ?? 1) <= 0);
      });
    }

    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      window.cancelAnimationFrame(frame);
    };
  }, [primary]);

  if (!show) return null;
  return (
    <aside data-pdp-mobile-cta aria-label="Compra rápida do produto"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-black/10 bg-white lg:hidden">
      <div className="mx-auto flex max-w-lg flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
        <p className="min-w-0 max-w-full break-words text-sm font-semibold text-ink">{label}</p>
        {children}
      </div>
    </aside>
  );
}
