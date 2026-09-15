"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode
} from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function OverlayDrawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  widthClassName = "max-w-md"
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const closeDrawer = useCallback(() => onCloseRef.current(), []);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [closeDrawer, open]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] transition duration-200 motion-reduce:transition-none ${
        open ? "visible" : "invisible pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={closeDrawer}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-y-0 right-0 flex w-full ${widthClassName} flex-col bg-pearl shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-black/10 bg-white px-4 py-4 sm:px-5">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
            ) : null}
            <h2 id={titleId} className="mt-0.5 truncate font-serif text-2xl font-semibold text-ink">
              {title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:border-gold hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            aria-label={`Fechar ${title.toLowerCase()}`}
          >
            <X size={19} />
          </button>
        </header>

        <div className="marjouxs-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
          {children}
        </div>

        {footer ? (
          <footer className="shrink-0 border-t border-black/10 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
