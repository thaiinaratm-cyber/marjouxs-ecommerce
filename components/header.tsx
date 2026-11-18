"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Blend,
  ChevronDown,
  Diamond,
  Eclipse,
  Gem,
  Infinity,
  Link2,
  Menu,
  PackageSearch,
  Search,
  ShoppingBag,
  Sparkles,
  Watch,
  Wrench,
  X
} from "lucide-react";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { CartDrawer } from "@/components/cart-drawer";
import { formatCurrency } from "@/lib/format";
import { trackCategoryClick, trackSearch, trackSelectItem } from "@/lib/analytics";
import { categoryMenu, type CategoryMenuItem } from "@/lib/catalog/category-menu";
import { readSearchTerm } from "@/lib/product-discovery";
import { getInstallmentsText, hasValidPrice } from "@/lib/product-pricing";
import { useCart } from "@/context/cart-context";
import type { Product } from "@/types/product";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/produtos", label: "Produtos" },
  { href: "/servicos", label: "Serviços" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" }
];

const categoryIcons = {
  aliancas: Blend, aneis: Gem, brincos: Sparkles, correntes: Link2,
  pulseiras: Infinity, braceletes: Eclipse, pingentes: Diamond, relogios: Watch
};
const desktopCategoryColumns = [
  ["aliancas", "pulseiras"],
  ["aneis", "braceletes"],
  ["correntes", "relogios"],
  ["pingentes", "brincos"]
].map((column) => column.map((slug) => categoryMenu.find((category) => category.slug === slug)!));
const menuFocus = "rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

const serviceItems = [
  { label: "Consertos de joias", href: "/servicos#consertos-de-joias" },
  { label: "Confecção de joias personalizadas", href: "/servicos#confeccao-de-joias-personalizadas" },
  { label: "Banhos em joias", href: "/servicos#banhos-em-joias" },
  { label: "Polimentos", href: "/servicos#polimentos" },
  { label: "Gravação manual e a laser", href: "/servicos#gravacao-manual-e-a-laser" },
  { label: "Ajuste de alianças", href: "/servicos#ajuste-de-aliancas" },
  { label: "Relojoaria em geral", href: "/servicos#relojoaria-em-geral" },
  { label: "Troca de bateria", href: "/servicos#troca-de-bateria" }
];

function SearchBarWithSuggestions({ onSearch }: { onSearch?: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsUnavailable, setSuggestionsUnavailable] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const suggestionsId = useId();
  const trimmedTerm = readSearchTerm(term);
  const shouldShowSuggestions = trimmedTerm.length >= 2 && isSuggestionsOpen;

  useEffect(() => {
    if (!shouldShowSuggestions) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      setSuggestionsUnavailable(false);
      return;
    }

    const controller = new AbortController();
    setIsLoadingSuggestions(true);
    setSuggestions([]);
    setSuggestionsUnavailable(false);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/catalog/suggestions?busca=${encodeURIComponent(trimmedTerm)}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("suggestions_unavailable");
        const data = await response.json() as { products: Product[] };
        if (!controller.signal.aborted) setSuggestions(data.products);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSuggestionsUnavailable(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingSuggestions(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [shouldShowSuggestions, trimmedTerm]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSuggestionsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSuggestionsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSuggestionsOpen(false);

    if (!trimmedTerm) {
      router.push("/produtos");
      onSearch?.();
      return;
    }

    trackSearch(trimmedTerm, "header");
    router.push(`/produtos?busca=${encodeURIComponent(trimmedTerm)}`);
    onSearch?.();
  }

  return (
    <form ref={searchRef} onSubmit={handleSubmit} className="relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-taupe" size={18} />
      <input
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setIsSuggestionsOpen(event.target.value.trim().length >= 2);
        }}
        onFocus={() => setIsSuggestionsOpen(trimmedTerm.length >= 2)}
        placeholder="O que você está procurando?"
        maxLength={120}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shouldShowSuggestions}
        aria-controls={suggestionsId}
        className="h-12 w-full rounded-full border border-black/10 bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/15"
      />
      {shouldShowSuggestions && (
        <div
          id={suggestionsId}
          role="listbox"
          aria-label="Sugestões de produtos"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[60] overflow-hidden rounded-lg border border-black/10 bg-white shadow-soft"
        >
          {isLoadingSuggestions ? (
            <p className="px-4 py-4 text-sm text-taupe">Buscando produtos...</p>
          ) : suggestionsUnavailable ? (
            <p className="px-4 py-4 text-sm text-taupe">Busca indisponível no momento</p>
          ) : suggestions.length > 0 ? (
            <>
              <div className="marjouxs-scrollbar max-h-[min(62vh,25rem)] overflow-y-auto py-2">
                {suggestions.map((product) => {
                  const priceText = hasValidPrice(product) && product.price ? formatCurrency(product.price) : product.priceLabel;
                  const installmentsText = getInstallmentsText(product);

                  return (
                    <Link
                      key={product.id}
                      role="option"
                      aria-selected="false"
                      href={`/produtos/${product.slug}`}
                      onClick={() => {
                        trackSelectItem(product, "Sugestões de busca", "search_suggestions");
                        setIsSuggestionsOpen(false);
                        onSearch?.();
                      }}
                      className="grid min-h-20 grid-cols-[56px_1fr] gap-3 px-3 py-2.5 text-left transition hover:bg-champagne/60 focus:bg-champagne/60 focus:outline-none"
                    >
                      <span className="relative block h-14 w-14 overflow-hidden rounded-md border border-black/10 bg-champagne">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.images[0]}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          width={56}
                          height={56}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-serif text-sm font-semibold text-ink">{product.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-taupe">
                          {[product.material, product.category].filter(Boolean).join(" · ")}
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-ink">{priceText}</span>
                        {installmentsText ? <span className="mt-0.5 block truncate text-xs text-taupe">{installmentsText}</span> : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
              <Link
                href={`/produtos?busca=${encodeURIComponent(trimmedTerm)}`}
                onClick={() => {
                  trackSearch(trimmedTerm, "search_suggestions");
                  setIsSuggestionsOpen(false);
                  onSearch?.();
                }}
                className="flex min-h-12 items-center justify-center border-t border-black/10 bg-pearl px-4 text-center text-sm font-semibold text-ink transition hover:text-gold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold/25"
              >
                Ver todos os resultados para “{trimmedTerm}”
              </Link>
            </>
          ) : (
            <p className="px-4 py-4 text-sm text-taupe">Nenhum produto encontrado</p>
          )}
        </div>
      )}
    </form>
  );
}

function MenuTitle({ category }: { category: CategoryMenuItem }) {
  const Icon = categoryIcons[category.slug];

  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="shrink-0 text-gold" size={16} strokeWidth={1.7} aria-hidden="true" />
      <span>{category.label}</span>
    </span>
  );
}

function CategoryMenuLinks({ category, mobile = false, onSelect }: {
  category: CategoryMenuItem;
  mobile?: boolean;
  onSelect: (href: string) => void;
}) {
  const linkStyle = `flex min-w-0 items-center text-sm leading-5 hover:text-gold ${menuFocus} ${mobile ? "min-h-11 py-1" : "min-h-6"}`;

  return (
    <ul className={mobile ? "grid" : "mt-2 grid gap-0.5"}>
      {category.links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} onClick={() => onSelect(link.href)}
            className={`${linkStyle} ${link.children ? "font-semibold text-ink" : "text-ink/80"}`}>
            {link.label}
          </Link>
          {link.children && (
            <ul aria-label={link.label} className="ml-1.5 border-l border-gold/30 pl-3">
              {link.children.map((child) => (
                <li key={child.href}>
                  <Link href={child.href} onClick={() => onSelect(child.href)} className={`${linkStyle} text-taupe`}>
                    {child.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const megaTriggerRef = useRef<HTMLAnchorElement>(null);
  const desktopMenuId = useId();
  const mobileMenuId = useId();
  const pathname = usePathname();
  const { totalItems } = useCart();

  function closeMenus() {
    setIsOpen(false);
    setIsMegaOpen(false);
  }

  function handleCategoryClick(categoryName: string, source: string, destination: string) {
    trackCategoryClick(categoryName, source, destination);
    closeMenus();
  }

  useEffect(() => {
    setIsOpen(false);
    setIsMegaOpen(false);
    setIsCartOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target as Node)) {
        setIsMegaOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMegaOpen(false);
        if (megaMenuRef.current?.contains(document.activeElement) && document.activeElement !== megaTriggerRef.current) {
          megaTriggerRef.current?.focus();
        }
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-pearl/95 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <Link href="/" className="leading-tight" onClick={closeMenus}>
            <span className="block font-serif text-2xl font-semibold tracking-normal text-ink md:text-[1.875rem]">Marjouxs</span>
            <span className="block text-[11px] uppercase tracking-[0.24em] text-taupe md:text-[13px]">JOIAS E ALIANÇAS</span>
          </Link>

          <div className="hidden justify-self-center md:block md:w-full md:max-w-xl">
            <SearchBarWithSuggestions onSearch={closeMenus} />
          </div>

          <div className="flex items-center gap-2 justify-self-end">
            <Link href="/acompanhar-pedido" onClick={closeMenus} aria-label="Acompanhar pedido"
              title="Acompanhar pedido"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium text-ink/80 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold lg:w-auto lg:px-2">
              <PackageSearch size={20} aria-hidden="true" />
              <span className="hidden lg:inline">Acompanhar pedido</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                closeMenus();
                setIsCartOpen(true);
              }}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:border-gold hover:text-gold"
              aria-label={`Sacola com ${totalItems} ${totalItems === 1 ? "item" : "itens"}`}
              aria-haspopup="dialog"
              aria-expanded={isCartOpen}
            >
              <ShoppingBag size={20} />
              {totalItems > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-white">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink lg:hidden"
              aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={isOpen}
              aria-controls={mobileMenuId}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <div className="md:hidden">
          <SearchBarWithSuggestions onSearch={() => setIsOpen(false)} />
        </div>

        <nav className="relative hidden items-center justify-center gap-7 lg:flex">
          <Link href="/" onClick={closeMenus} className="text-sm font-medium text-ink/75 transition hover:text-gold">
            Home
          </Link>
          <Link href="/produtos" onClick={closeMenus} className="text-sm font-medium text-ink/75 transition hover:text-gold">
            Produtos
          </Link>

          <div
            ref={megaMenuRef}
            onMouseEnter={() => setIsMegaOpen(true)}
            onMouseLeave={(event) => {
              if (!event.currentTarget.contains(document.activeElement)) setIsMegaOpen(false);
            }}
            onFocus={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsMegaOpen(true);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsMegaOpen(false);
            }}
          >
            <Link
              ref={megaTriggerRef}
              href="/categorias"
              onClick={closeMenus}
              aria-expanded={isMegaOpen}
              aria-controls={desktopMenuId}
              className={`inline-flex items-center gap-1 text-sm font-medium text-ink/75 transition hover:text-gold ${menuFocus}`}
            >
              Categorias <ChevronDown size={15} />
            </Link>
            <div
              id={desktopMenuId}
              className={`absolute left-1/2 top-full z-50 w-[min(94vw,1080px)] -translate-x-1/2 pt-3 transition duration-200 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none ${
                isMegaOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
              }`}
            >
              <div className="marjouxs-scrollbar grid max-h-[calc(100svh-9rem)] grid-cols-4 gap-x-6 gap-y-3 overflow-y-auto rounded-lg border border-black/10 bg-white px-5 py-4 text-left shadow-soft">
                {desktopCategoryColumns.map((column, columnIndex) => (
                  <div key={columnIndex} className="grid min-w-0 content-start gap-3.5">
                    {column.map((category) => (
                      <section key={category.href} aria-label={category.label} className="min-w-0">
                        <Link href={category.href} onClick={() => handleCategoryClick(category.label, "mega_menu", category.href)} className={`font-serif text-lg font-semibold leading-tight text-ink hover:text-gold ${menuFocus}`}>
                          <MenuTitle category={category} />
                        </Link>
                        <CategoryMenuLinks category={category} onSelect={(href) => handleCategoryClick(category.label, "mega_menu", href)} />
                      </section>
                    ))}
                  </div>
                ))}
                <div className="col-span-4 grid min-w-0 grid-cols-[11rem_1fr] items-center gap-4 rounded-md border border-black/10 bg-champagne/55 px-4 py-3">
                  <p className="font-serif text-lg font-semibold leading-tight text-ink">
                    <span className="inline-flex items-center gap-2">
                      <Wrench className="text-gold" size={16} strokeWidth={1.7} /> Serviços
                    </span>
                  </p>
                  <div className="grid grid-cols-4 gap-x-5 gap-y-1">
                    {serviceItems.map((service) => (
                      <Link
                        key={service.href}
                        href={service.href}
                        onClick={closeMenus}
                        className="text-sm font-normal leading-5 text-taupe transition duration-150 hover:translate-x-[3px] hover:text-gold"
                      >
                        {service.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {navItems.slice(2).map((item) => (
            <Link key={item.href} href={item.href} onClick={closeMenus} className="text-sm font-medium text-ink/75 transition hover:text-gold">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {isOpen && (
        <nav id={mobileMenuId} aria-label="Menu principal" className="marjouxs-scrollbar max-h-[calc(100svh-8.5rem)] overflow-y-auto overscroll-contain border-t border-black/10 bg-pearl px-4 py-3 pb-28 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
            <Link href="/acompanhar-pedido" onClick={closeMenus}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-ink hover:bg-champagne">
              <PackageSearch size={18} className="text-gold" aria-hidden="true" />
              Acompanhar pedido
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="rounded-md px-3 py-3 text-sm font-medium text-ink transition hover:bg-champagne"
              >
                {item.label}
              </Link>
            ))}

            <details className="rounded-md px-3 py-2.5">
              <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-ink ${menuFocus}`}>
                Categorias <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="mt-1 grid">
                {categoryMenu.map((category) => (
                  <details key={category.href} className="group/category border-t border-black/10">
                    <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-serif text-lg font-semibold text-ink ${menuFocus}`}>
                      <MenuTitle category={category} />
                      <ChevronDown size={16} aria-hidden="true" className="shrink-0 group-open/category:rotate-180" />
                    </summary>
                    <div className="pb-2 pl-3">
                      <Link href={category.href} onClick={() => handleCategoryClick(category.label, "mobile_menu", category.href)}
                        className={`flex min-h-11 items-center text-sm font-semibold text-ink/80 hover:text-gold ${menuFocus}`}>
                        Ver todos: {category.label}
                      </Link>
                      <CategoryMenuLinks mobile category={category} onSelect={(href) => handleCategoryClick(category.label, "mobile_menu", href)} />
                    </div>
                  </details>
                ))}
                <div className="mt-3 grid gap-2 rounded-md border border-black/10 bg-champagne/55 p-3">
                  <p className="font-serif text-lg font-semibold text-ink">
                    <span className="inline-flex items-center gap-2">
                      <Wrench className="text-gold" size={16} strokeWidth={1.7} /> Serviços
                    </span>
                  </p>
                  <div className="grid gap-2 pl-2">
                    {serviceItems.map((service) => (
                      <Link
                        key={service.href}
                        href={service.href}
                        onClick={() => setIsOpen(false)}
                        className="py-0.5 text-sm font-normal text-taupe transition hover:text-gold"
                      >
                        {service.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </nav>
      )}
      <CartDrawer open={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </header>
  );
}
