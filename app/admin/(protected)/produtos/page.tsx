import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, PackageOpen, Plus } from "lucide-react";
import { ProductSearchInput } from "@/components/admin/product-search-input";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { getAdminTaxonomy } from "@/lib/admin/catalog";
import { catalogImageUrl } from "@/lib/catalog/image-url";
import { normalizeText } from "@/lib/format";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PAGE_SIZE = 24;
const sorts = {
  recent: { column: "updated_at", ascending: false },
  oldest: { column: "updated_at", ascending: true },
  name: { column: "name", ascending: true },
  name_desc: { column: "name", ascending: false },
  price_asc: { column: "price", ascending: true },
  price_desc: { column: "price", ascending: false }
} as const;

type AdminProductsPageProps = { searchParams?: Record<string, string | undefined> };

function selection(value: string | undefined, ids: string[]) {
  return value && ids.includes(value) ? value : "";
}

export default async function AdminProductsPage({ searchParams = {} }: AdminProductsPageProps) {
  const { supabase } = await requireActiveAdmin();
  const taxonomy = await getAdminTaxonomy(supabase);
  const categoryId = selection(searchParams.category, taxonomy.categories.map((item) => item.id));
  const materialId = selection(searchParams.material, taxonomy.materials.map((item) => item.id));
  const subcategoryId = selection(searchParams.subcategory, taxonomy.subcategories
    .filter((item) => !categoryId || item.category_id === categoryId).map((item) => item.id));
  const status = ["active", "inactive"].includes(searchParams.status ?? "") ? searchParams.status : "";
  const stock = ["available", "made_to_order", "unavailable", "service"]
    .includes(searchParams.stock ?? "") ? searchParams.stock : "";
  const price = ["priced", "without_price"].includes(searchParams.price ?? "") ? searchParams.price : "";
  const origin = ["legacy", "admin"].includes(searchParams.origin ?? "") ? searchParams.origin : "";
  const sort = searchParams.sort && searchParams.sort in sorts ? searchParams.sort as keyof typeof sorts : "recent";
  const requestedPage = Number(searchParams.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const search = (searchParams.q ?? "").replace(/[^A-Za-z\u00C0-\u024F0-9 \-]/g, "").trim().slice(0, 80);

  let query = supabase.from("ecommerce_products")
    .select("id,name,slug,price,is_active,stock_status,category_id,subcategory_id,material_id,legacy_id,updated_at", { count: "exact" });
  if (categoryId) query = query.eq("category_id", categoryId);
  if (subcategoryId) query = query.eq("subcategory_id", subcategoryId);
  if (materialId) query = query.eq("material_id", materialId);
  if (status) query = query.eq("is_active", status === "active");
  if (stock) query = query.eq("stock_status", stock);
  if (price) query = price === "priced" ? query.not("price", "is", null) : query.is("price", null);
  if (origin) query = origin === "legacy" ? query.not("legacy_id", "is", null) : query.is("legacy_id", null);
  if (search) {
    const normalized = normalizeText(search);
    const matchedCategories = taxonomy.categories.filter((item) => normalizeText(item.name).includes(normalized));
    const matchedSubcategories = taxonomy.subcategories.filter((item) => normalizeText(item.name).includes(normalized));
    const matchedMaterials = taxonomy.materials.filter((item) => normalizeText(item.name).includes(normalized));
    const conditions = [
      `name.ilike.%${search}%`, `slug.ilike.%${normalized.replace(/\s+/g, "-")}%`,
      `legacy_id.ilike.%${search}%`,
      ...matchedCategories.map((item) => `category_id.eq.${item.id}`),
      ...matchedSubcategories.map((item) => `subcategory_id.eq.${item.id}`),
      ...matchedMaterials.map((item) => `material_id.eq.${item.id}`)
    ];
    query = query.or(conditions.join(","));
  }
  const selectedSort = sorts[sort];
  const { data: products, error, count } = await query.order(selectedSort.column, {
    ascending: selectedSort.ascending,
    nullsFirst: false
  }).order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("admin_products_unavailable");

  const productIds = (products ?? []).map((item) => item.id);
  const imageResult = productIds.length
    ? await supabase.from("ecommerce_product_images")
      .select("product_id,path,source_type,is_primary")
      .in("product_id", productIds).eq("is_primary", true)
    : { data: [], error: null };
  if (imageResult.error) throw new Error("admin_product_images_unavailable");
  const images = new Map((imageResult.data ?? []).map((item) => [item.product_id, item]));

  const categoryNames = new Map(taxonomy.categories.map((item) => [item.id, item.name]));
  const subcategoryNames = new Map(taxonomy.subcategories.map((item) => [item.id, item.name]));
  const materialNames = new Map(taxonomy.materials.map((item) => [item.id, item.name]));
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageHref = (newPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    params.set("page", String(newPage));
    return `/admin/produtos?${params}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Catálogo administrativo</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Produtos</h1>
          <p className="mt-2 text-sm text-taupe">{count ?? 0} produtos encontrados</p>
        </div>
        <Link href="/admin/produtos/novo" className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-sm font-bold text-white transition hover:bg-gold">
          <Plus size={17} aria-hidden="true" /> Novo rascunho
        </Link>
      </div>

      <form method="get" action="/admin/produtos" className="mt-7 grid gap-3 rounded-md border border-black/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProductSearchInput key={search} initialValue={search} />
        <select name="category" defaultValue={categoryId} aria-label="Categoria" className="h-11 min-w-0 rounded border border-black/15 px-2 text-sm">
          <option value="">Todas categorias</option>
          {taxonomy.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="subcategory" defaultValue={subcategoryId} aria-label="Subcategoria" className="h-11 min-w-0 rounded border border-black/15 px-2 text-sm">
          <option value="">Todas subcategorias</option>
          {taxonomy.subcategories.filter((item) => !categoryId || item.category_id === categoryId)
            .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="material" defaultValue={materialId} aria-label="Material" className="h-11 min-w-0 rounded border border-black/15 px-2 text-sm">
          <option value="">Todos materiais</option>
          {taxonomy.materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="status" defaultValue={status} aria-label="Status" className="h-11 min-w-0 rounded border border-black/15 px-2 text-sm">
          <option value="">Todos status</option><option value="active">Publicados</option><option value="inactive">Rascunhos</option>
        </select>
        <select name="stock" defaultValue={stock} aria-label="Disponibilidade" className="h-11 min-w-0 rounded border border-black/15 px-2 text-sm">
          <option value="">Toda disponibilidade</option><option value="available">Disponível</option>
          <option value="made_to_order">Sob encomenda</option><option value="unavailable">Indisponível</option><option value="service">Serviço</option>
        </select>
        <select name="price" defaultValue={price} aria-label="Preço" className="h-11 min-w-0 rounded border border-black/15 px-2 text-sm">
          <option value="">Todos preços</option><option value="priced">Com preço</option><option value="without_price">Sem preço</option>
        </select>
        <select name="origin" defaultValue={origin} aria-label="Origem" className="h-11 min-w-0 rounded border border-black/15 px-2 text-sm">
          <option value="">Todas origens</option><option value="legacy">Legado</option><option value="admin">Criado pelo painel</option>
        </select>
        <select name="sort" defaultValue={sort} aria-label="Ordenação" className="h-11 min-w-0 rounded border border-black/15 px-2 text-sm">
          <option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option>
          <option value="name">Nome A-Z</option><option value="name_desc">Nome Z-A</option>
          <option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option>
        </select>
        <button className="h-11 rounded bg-ink px-4 text-sm font-semibold text-white hover:bg-gold">Filtrar</button>
      </form>

      {!products?.length ? (
        <div className="mt-8 rounded-lg border border-dashed border-black/20 bg-white px-6 py-14 text-center">
          <PackageOpen className="mx-auto text-gold" size={30} aria-hidden="true" />
          <h2 className="mt-4 font-serif text-2xl font-semibold text-ink">Nenhum produto encontrado</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-taupe">Revise os filtros ou cadastre um novo rascunho.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_130px_40px] gap-4 border-b border-black/10 bg-champagne/45 px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-taupe md:grid">
            <span>Produto</span><span>Classificação</span><span>Material</span><span>Status</span><span />
          </div>
          <div className="divide-y divide-black/10">
            {products.map((product) => {
              const image = images.get(product.id);
              const imageUrl = image ? catalogImageUrl(image, process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
              return <Link key={product.id} href={`/admin/produtos/${product.id}`}
                className="grid gap-3 px-5 py-4 transition hover:bg-champagne/25 md:grid-cols-[minmax(0,2fr)_1fr_1fr_130px_40px] md:items-center md:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-black/10 bg-pearl text-taupe">
                    {imageUrl ? <Image src={imageUrl} alt="" fill sizes="48px" className="object-cover" /> : <ImageOff size={17} aria-label="Sem imagem" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{product.name}</p>
                    <p className="mt-1 truncate text-xs text-taupe">
                      {product.price == null ? "Preço sob consulta" : currency.format(Number(product.price))} · {product.legacy_id ? "Legado" : "Painel"}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-taupe">
                  <p>{categoryNames.get(product.category_id) ?? "—"}</p>
                  {product.subcategory_id ? <p className="text-xs">{subcategoryNames.get(product.subcategory_id)}</p> : null}
                </div>
                <div className="text-sm text-taupe">
                  <p>{materialNames.get(product.material_id) ?? "—"}</p>
                  <p className="text-xs">{product.stock_status === "made_to_order" ? "Sob encomenda" : product.stock_status === "available" ? "Disponível" : product.stock_status === "unavailable" ? "Indisponível" : "Serviço"}</p>
                </div>
                <div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${product.is_active ? "bg-green-100 text-green-800" : "bg-black/5 text-taupe"}`}>
                    {product.is_active ? "Publicado" : "Rascunho/Inativo"}
                  </span>
                  <p className="mt-2 text-xs text-taupe">{new Intl.DateTimeFormat("pt-BR").format(new Date(product.updated_at))}</p>
                </div>
                <ChevronRight className="hidden text-gold md:block" size={18} aria-hidden="true" />
              </Link>;
            })}
          </div>
        </div>
      )}

      {pageCount > 1 ? <nav aria-label="Paginação dos produtos" className="mt-6 flex items-center justify-center gap-4 text-sm">
        {page > 1 ? <Link href={pageHref(page - 1)} className="inline-flex h-10 items-center gap-1 rounded border border-black/15 px-3 hover:border-gold"><ChevronLeft size={16} /> Anterior</Link> : null}
        <span className="text-taupe">Página {page} de {pageCount}</span>
        {page < pageCount ? <Link href={pageHref(page + 1)} className="inline-flex h-10 items-center gap-1 rounded border border-black/15 px-3 hover:border-gold">Próxima <ChevronRight size={16} /></Link> : null}
      </nav> : null}
    </div>
  );
}
