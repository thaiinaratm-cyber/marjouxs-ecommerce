"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, Search, ShoppingBag, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/context/cart-context";
import { formatCurrency, normalizeText } from "@/lib/format";
import { getVisibleProducts } from "@/lib/products";
import { getInstallmentsText, hasValidPrice } from "@/lib/product-pricing";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/produtos", label: "Produtos" },
  { href: "/servicos", label: "Serviços" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" }
];

const categoryMenu = [
  {
    label: "Alianças",
    href: "/categorias/aliancas",
    subcategories: [
      { label: "Ouro 18k/750", href: "/categorias/aliancas?subcategoria=ouro-18k-750" },
      { label: "Prata 950", href: "/categorias/aliancas?subcategoria=prata-950" },
      { label: "Banhado a Ouro", href: "/categorias/aliancas?subcategoria=banhado-a-ouro" },
      { label: "Moeda", href: "/categorias/aliancas?subcategoria=moeda" }
    ]
  },
  {
    label: "Anéis",
    href: "/categorias/aneis",
    subcategories: [
      { label: "Ouro 18k", href: "/categorias/aneis?subcategoria=ouro-18k" },
      { label: "Prata 950", href: "/categorias/aneis?subcategoria=prata-950" },
      { label: "Pérola", href: "/categorias/aneis?subcategoria=perola" },
      { label: "Formatura", href: "/categorias/aneis?subcategoria=formatura" }
    ]
  },
  {
    label: "Brincos",
    href: "/categorias/brincos",
    subcategories: [
      { label: "Ouro 18k", href: "/categorias/brincos?subcategoria=ouro-18k" },
      { label: "Prata 950", href: "/categorias/brincos?subcategoria=prata-950" },
      { label: "Infantil", href: "/categorias/brincos?subcategoria=infantil" }
    ]
  },
  {
    label: "Correntes",
    href: "/categorias/correntes",
    subcategories: [
      { label: "Ouro 18k", href: "/categorias/correntes?subcategoria=ouro-18k" },
      { label: "Prata 925", href: "/categorias/correntes?subcategoria=prata-925" }
    ]
  },
  {
    label: "Pulseiras",
    href: "/categorias/pulseiras",
    subcategories: [
      { label: "Ouro 18k", href: "/categorias/pulseiras?subcategoria=ouro-18k" },
      { label: "Prata 925", href: "/categorias/pulseiras?subcategoria=prata-925" },
      { label: "Infantil", href: "/categorias/pulseiras?subcategoria=infantil" }
    ]
  }
];

const mobileOnlyCategoryLinks = [
  { label: "Pingentes", href: "/categorias/pingentes" },
  { label: "Relógios", href: "/categorias/relogios" }
];

const serviceItems = [
  "Conserto de joias",
  "Banho de joias",
  "Polimento",
  "Gravação",
  "Ajuste de alianças",
  "Relojoaria",
  "Troca de bateria"
];

function SearchBarLegacy({ onSearch }: { onSearch?: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTerm = term.trim();

    if (!trimmedTerm) {
      router.push("/produtos");
      onSearch?.();
      return;
    }

    router.push(`/produtos?busca=${encodeURIComponent(trimmedTerm)}`);
    onSearch?.();
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-taupe" size={18} />
      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="O que você está procurando?"
        className="h-12 w-full rounded-full border border-black/10 bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/15"
      />
    </form>
  );
}

function SearchBarWithSuggestions({ onSearch }: { onSearch?: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const trimmedTerm = term.trim();
  const shouldShowSuggestions = trimmedTerm.length >= 2 && isSuggestionsOpen;
  const suggestions = useMemo(() => {
    if (trimmedTerm.length < 2) {
      return [];
    }

    const normalizedTerm = normalizeText(trimmedTerm);

    return getVisibleProducts()
      .filter((product) => {
        const searchable = normalizeText(
          [product.name, product.category, product.subcategory, product.material, product.description].join(" ")
        );

        return searchable.includes(normalizedTerm);
      })
      .slice(0, 6);
  }, [trimmedTerm]);

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
    const trimmedTerm = term.trim();
    setIsSuggestionsOpen(false);

    if (!trimmedTerm) {
      router.push("/produtos");
      onSearch?.();
      return;
    }

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
        autoComplete="off"
        className="h-12 w-full rounded-full border border-black/10 bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/15"
      />
      {shouldShowSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[60] overflow-hidden rounded-lg border border-black/10 bg-white shadow-soft">
          {suggestions.length > 0 ? (
            <div className="max-h-[min(70vh,28rem)] overflow-y-auto py-2">
              {suggestions.map((product) => {
                const priceText = hasValidPrice(product) && product.price ? formatCurrency(product.price) : product.priceLabel;
                const installmentsText = getInstallmentsText(product);

                return (
                  <Link
                    key={product.id}
                    href={`/produtos/${product.slug}`}
                    onClick={() => {
                      setIsSuggestionsOpen(false);
                      onSearch?.();
                    }}
                    className="grid grid-cols-[56px_1fr] gap-3 px-3 py-2.5 text-left transition hover:bg-champagne/60 focus:bg-champagne/60 focus:outline-none"
                  >
                    <span className="relative block h-14 w-14 overflow-hidden rounded-md border border-black/10 bg-champagne">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-sm font-semibold text-ink">{product.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-taupe">{product.material}</span>
                      <span className="mt-1 block text-sm font-semibold text-ink">{priceText}</span>
                      {installmentsText ? <span className="mt-0.5 block truncate text-xs text-taupe">{installmentsText}</span> : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-taupe">Nenhum produto encontrado</p>
          )}
        </div>
      )}
    </form>
  );
}

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { totalItems } = useCart();

  function closeMenus() {
    setIsOpen(false);
    setIsMegaOpen(false);
  }

  useEffect(() => {
    setIsOpen(false);
    setIsMegaOpen(false);
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
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link href="/" className="leading-tight" onClick={closeMenus}>
            <span className="block font-serif text-2xl font-semibold tracking-normal text-ink">Marjouxs</span>
            <span className="block text-[11px] uppercase tracking-[0.24em] text-taupe">JOIAS E ALIANÇAS</span>
          </Link>

          <div className="hidden justify-self-center md:block md:w-full md:max-w-xl">
            <SearchBarWithSuggestions onSearch={closeMenus} />
          </div>

          <div className="flex items-center gap-2 justify-self-end">
            <Link
            href="/carrinho"
            onClick={closeMenus}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:border-gold hover:text-gold"
              aria-label="Abrir carrinho"
            >
              <ShoppingBag size={20} />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-white">
                  {totalItems}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setIsOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink lg:hidden"
              aria-label="Abrir menu"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <div className="md:hidden">
          <SearchBarWithSuggestions onSearch={() => setIsOpen(false)} />
        </div>

        <nav className="hidden items-center justify-center gap-7 lg:flex">
          <Link href="/" onClick={closeMenus} className="text-sm font-medium text-ink/75 transition hover:text-gold">
            Home
          </Link>
          <Link href="/produtos" onClick={closeMenus} className="text-sm font-medium text-ink/75 transition hover:text-gold">
            Produtos
          </Link>

          <div
            ref={megaMenuRef}
            className="relative"
            onMouseEnter={() => setIsMegaOpen(true)}
            onMouseLeave={() => setIsMegaOpen(false)}
            onFocus={() => setIsMegaOpen(true)}
          >
            <Link
              href="/categorias"
              onClick={closeMenus}
              className="inline-flex items-center gap-1 text-sm font-medium text-ink/75 transition hover:text-gold"
            >
              Categorias <ChevronDown size={15} />
            </Link>
            <div
              className={`absolute left-1/2 top-full z-50 w-[min(92vw,980px)] -translate-x-1/2 pt-4 transition duration-150 ${
                isMegaOpen ? "visible opacity-100" : "invisible opacity-0"
              }`}
            >
              <div className="grid max-h-[70vh] grid-cols-3 gap-x-8 gap-y-6 overflow-y-auto rounded-lg border border-black/10 bg-white p-6 text-left shadow-soft">
                {categoryMenu.map((category) => (
                  <div key={category.href} className="min-w-0">
                    <Link href={category.href} onClick={closeMenus} className="font-serif text-lg font-semibold text-ink transition hover:text-gold">
                      {category.label}
                    </Link>
                    <div className="mt-3 grid gap-2">
                      {category.subcategories.map((subcategory) => (
                        <Link
                          key={subcategory.href}
                          href={subcategory.href}
                          onClick={closeMenus}
                          className="text-sm leading-5 text-taupe transition hover:text-gold"
                        >
                          {subcategory.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="min-w-0 rounded-md bg-champagne/60 p-4">
                  <p className="font-serif text-lg font-semibold text-ink">Serviços</p>
                  <div className="mt-3 grid gap-2">
                    {serviceItems.map((service) => (
                      <span key={service} className="text-sm leading-5 text-taupe">
                        {service}
                      </span>
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
        <nav className="max-h-[calc(100svh-8.5rem)] overflow-y-auto overscroll-contain border-t border-black/10 bg-pearl px-4 py-3 pb-28 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
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

            <details className="rounded-md px-3 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
                Categorias <ChevronDown size={16} />
              </summary>
              <div className="mt-4 grid gap-4">
                {categoryMenu.map((category) => (
                  <div key={category.href} className="grid gap-2 border-t border-black/10 pt-3">
                    <Link
                      href={category.href}
                      onClick={() => setIsOpen(false)}
                      className="font-serif text-lg font-semibold text-ink"
                    >
                      {category.label}
                    </Link>
                    <div className="grid gap-2 pl-2">
                      {category.subcategories.map((subcategory) => (
                        <Link
                          key={subcategory.href}
                          href={subcategory.href}
                          onClick={() => setIsOpen(false)}
                          className="text-sm text-taupe transition hover:text-gold"
                        >
                          {subcategory.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
                {mobileOnlyCategoryLinks.map((category) => (
                  <div key={category.href} className="grid gap-2 border-t border-black/10 pt-3">
                    <Link
                      href={category.href}
                      onClick={() => setIsOpen(false)}
                      className="font-serif text-lg font-semibold text-ink"
                    >
                      {category.label}
                    </Link>
                  </div>
                ))}
                <div className="grid gap-2 border-t border-black/10 pt-3">
                  <p className="font-serif text-lg font-semibold text-ink">Serviços</p>
                  <div className="grid gap-2 pl-2">
                    {serviceItems.map((service) => (
                      <span key={service} className="text-sm text-taupe">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </nav>
      )}
    </header>
  );
}
