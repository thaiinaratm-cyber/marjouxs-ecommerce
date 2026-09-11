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
  Search,
  ShoppingBag,
  Sparkles,
  Watch,
  Wrench,
  X,
  type LucideIcon
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency, normalizeText } from "@/lib/format";
import { trackCategoryClick, trackSearch, trackSelectItem } from "@/lib/analytics";
import { getVisibleProducts } from "@/lib/products";
import { getInstallmentsText, hasValidPrice } from "@/lib/product-pricing";
import { useCart } from "@/context/cart-context";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/produtos", label: "Produtos" },
  { href: "/servicos", label: "Serviços" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" }
];

type CategoryMenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  subcategories: {
    label: string;
    href: string;
    children?: { label: string; href: string }[];
  }[];
};

const categoryMenu: CategoryMenuItem[] = [
  {
    label: "Alianças",
    href: "/categorias/aliancas",
    icon: Blend,
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
    icon: Gem,
    subcategories: [
      {
        label: "Ouro 18k",
        href: "/aneis/ouro-18k",
        children: [
          { label: "Masculino", href: "/aneis/ouro-18k/masculino" },
          { label: "Feminino", href: "/aneis/ouro-18k/feminino" },
          { label: "Pérola", href: "/aneis/ouro-18k/perola" },
          { label: "Formatura", href: "/aneis/ouro-18k/formatura" }
        ]
      },
      {
        label: "Prata 950",
        href: "/aneis/prata-950",
        children: [
          { label: "Masculino", href: "/aneis/prata-950/masculino" },
          { label: "Feminino", href: "/aneis/prata-950/feminino" }
        ]
      }
    ]
  },
  {
    label: "Brincos",
    href: "/categorias/brincos",
    icon: Sparkles,
    subcategories: [
      { label: "Ouro 18k", href: "/categorias/brincos?subcategoria=ouro-18k" },
      { label: "Prata 950", href: "/categorias/brincos?subcategoria=prata-950" },
      { label: "Infantil", href: "/categorias/brincos?subcategoria=infantil" }
    ]
  },
  {
    label: "Correntes",
    href: "/categorias/correntes",
    icon: Link2,
    subcategories: [
      { label: "Ouro 18k", href: "/categorias/correntes?subcategoria=ouro-18k" },
      { label: "Prata 925", href: "/categorias/correntes?subcategoria=prata-925" }
    ]
  },
  {
    label: "Pulseiras",
    href: "/categorias/pulseiras",
    icon: Infinity,
    subcategories: [
      { label: "Ouro 18k", href: "/categorias/pulseiras?subcategoria=ouro-18k" },
      { label: "Prata 925", href: "/categorias/pulseiras?subcategoria=prata-925" },
      { label: "Infantil", href: "/categorias/pulseiras?subcategoria=infantil" }
    ]
  },
  {
    label: "Braceletes",
    href: "/categorias/braceletes",
    icon: Eclipse,
    subcategories: [
      { label: "Ouro 18k", href: "/categorias/braceletes?subcategoria=ouro-18k" },
      { label: "Prata 950", href: "/categorias/braceletes?subcategoria=prata-950" }
    ]
  },
  {
    label: "Pingentes",
    href: "/categorias/pingentes",
    icon: Diamond,
    subcategories: [
      { label: "Ouro 18k", href: "/categorias/pingentes?subcategoria=ouro-18k" },
      { label: "Prata 950", href: "/categorias/pingentes?subcategoria=prata-950" }
    ]
  },
  {
    label: "Relógios",
    href: "/categorias/relogios",
    icon: Watch,
    subcategories: [
      { label: "Relógios masculinos", href: "/categorias/relogios?subcategoria=relogios-masculinos" },
      { label: "Relógios femininos", href: "/categorias/relogios?subcategoria=relogios-femininos" }
    ]
  }
];

const desktopCategoryColumns = [
  [categoryMenu[0], categoryMenu[4]],
  [categoryMenu[1]],
  [categoryMenu[2], categoryMenu[5]],
  [categoryMenu[3], categoryMenu[6], categoryMenu[7]]
];

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
        autoComplete="off"
        className="h-12 w-full rounded-full border border-black/10 bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/15"
      />
      {shouldShowSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[60] overflow-hidden rounded-lg border border-black/10 bg-white shadow-soft">
          {suggestions.length > 0 ? (
            <div className="max-h-[min(70vh,28rem)] overflow-y-auto py-2 marjouxs-scrollbar">
              {suggestions.map((product) => {
                const priceText = hasValidPrice(product) && product.price ? formatCurrency(product.price) : product.priceLabel;
                const installmentsText = getInstallmentsText(product);

                return (
                  <Link
                    key={product.id}
                    href={`/produtos/${product.slug}`}
                    onClick={() => {
                      trackSelectItem(product, "Sugestões de busca", "search_suggestions");
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

function MenuTitle({ category }: { category: CategoryMenuItem }) {
  const Icon = category.icon;

  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="text-gold" size={16} strokeWidth={1.7} />
      <span>{category.label}</span>
    </span>
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

  function handleCategoryClick(categoryName: string, source: string, destination: string) {
    trackCategoryClick(categoryName, source, destination);
    closeMenus();
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
            <span className="block font-serif text-2xl font-semibold tracking-normal text-ink md:text-[1.875rem]">Marjouxs</span>
            <span className="block text-[11px] uppercase tracking-[0.24em] text-taupe md:text-[13px]">JOIAS E ALIANÇAS</span>
          </Link>

          <div className="hidden justify-self-center md:block md:w-full md:max-w-xl">
            <SearchBarWithSuggestions onSearch={closeMenus} />
          </div>

          <div className="flex items-center gap-2 justify-self-end">
            <Link
              href="/carrinho"
              onClick={closeMenus}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:border-gold hover:text-gold"
              aria-label={`Sacola com ${totalItems} ${totalItems === 1 ? "item" : "itens"}`}
            >
              <ShoppingBag size={20} />
              {totalItems > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-white">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              ) : null}
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
              className={`absolute left-1/2 top-full z-50 w-[min(94vw,1080px)] -translate-x-1/2 pt-3 transition duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none ${
                isMegaOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
              }`}
            >
              <div className="marjouxs-scrollbar grid max-h-[calc(100svh-9rem)] grid-cols-4 gap-x-6 gap-y-3 overflow-y-auto rounded-lg border border-black/10 bg-white px-5 py-4 text-left shadow-soft">
                {desktopCategoryColumns.map((column, columnIndex) => (
                  <div key={columnIndex} className="grid min-w-0 content-start gap-3.5">
                    {column.map((category) => (
                      <div key={category.href} className="min-w-0">
                        <Link href={category.href} onClick={() => handleCategoryClick(category.label, "mega_menu", category.href)} className="font-serif text-lg font-semibold leading-tight text-ink transition duration-150 hover:text-gold">
                          <MenuTitle category={category} />
                        </Link>
                        <div className="mt-3 grid gap-1">
                          {category.subcategories.map((subcategory) => (
                            <div key={subcategory.href} className="grid gap-1">
                              <Link
                                href={subcategory.href}
                                onClick={() => handleCategoryClick(category.label, "mega_menu", subcategory.href)}
                                className="text-sm font-normal leading-5 text-ink/80 transition duration-150 hover:translate-x-[3px] hover:text-gold"
                              >
                                {subcategory.label}
                              </Link>
                              {subcategory.children ? (
                                <div className="grid gap-1 pl-3">
                                  {subcategory.children.map((child) => (
                                    <Link
                                      key={child.href}
                                      href={child.href}
                                      onClick={() => handleCategoryClick(category.label, "mega_menu", child.href)}
                                      className="text-sm font-normal leading-5 text-taupe transition duration-150 hover:translate-x-[3px] hover:text-gold"
                                    >
                                      {child.label}
                                    </Link>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
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
        <nav className="marjouxs-scrollbar max-h-[calc(100svh-8.5rem)] overflow-y-auto overscroll-contain border-t border-black/10 bg-pearl px-4 py-3 pb-28 lg:hidden">
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

            <details className="rounded-md px-3 py-2.5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
                Categorias <ChevronDown size={16} />
              </summary>
              <div className="mt-3 grid gap-3">
                {categoryMenu.map((category) => (
                  <div key={category.href} className="grid gap-2 border-t border-black/10 pt-2.5">
                    <Link
                      href={category.href}
                      onClick={() => handleCategoryClick(category.label, "mobile_menu", category.href)}
                      className="font-serif text-lg font-semibold text-ink"
                    >
                      <MenuTitle category={category} />
                    </Link>
                    <div className="grid gap-2 pl-2">
                      {category.subcategories.map((subcategory) => (
                        <div key={subcategory.href} className="grid gap-1.5">
                          <Link
                            href={subcategory.href}
                            onClick={() => handleCategoryClick(category.label, "mobile_menu", subcategory.href)}
                            className="py-0.5 text-sm font-normal text-ink/80 transition hover:text-gold"
                          >
                            {subcategory.label}
                          </Link>
                          {subcategory.children ? (
                            <div className="grid gap-1.5 pl-3">
                              {subcategory.children.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => handleCategoryClick(category.label, "mobile_menu", child.href)}
                                  className="py-0.5 text-sm font-normal text-taupe transition hover:text-gold"
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="grid gap-2 rounded-md border border-black/10 bg-champagne/55 p-3">
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
    </header>
  );
}
