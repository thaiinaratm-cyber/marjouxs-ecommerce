"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { AdminTaxonomy } from "@/lib/admin/catalog";
import { toProductSlug, type AdminProductInput } from "@/lib/admin/product-form";

export type AdminProductFieldValues = Omit<Partial<AdminProductInput>, "price" | "oldPrice"> & {
  price?: string | number | null;
  oldPrice?: string | number | null;
};

type ProductFieldsProps = {
  taxonomy: AdminTaxonomy;
  values?: AdminProductFieldValues;
};

const inputClass =
  "h-11 w-full rounded-md border border-black/15 bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20";
const textareaClass =
  "min-h-28 w-full rounded-md border border-black/15 bg-white px-3 py-3 text-sm font-normal leading-6 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-5 border-t border-black/10 pt-6 first:border-t-0 first:pt-0">
      <legend className="mb-4 font-serif text-xl font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, name, value, suffix, inputMode = "text" }: {
  label: string;
  name: string;
  value?: string | number | null;
  suffix?: string;
  inputMode?: "text" | "decimal" | "numeric";
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      <div className="relative">
        <input className={`${inputClass} ${suffix ? "pr-10" : ""}`} name={name} inputMode={inputMode} defaultValue={value ?? ""} />
        {suffix ? <span className="pointer-events-none absolute right-3 top-3 text-sm font-normal text-taupe">{suffix}</span> : null}
      </div>
    </label>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-gold" />
      {label}
    </label>
  );
}

export function ProductFields({ taxonomy, values = {} }: ProductFieldsProps) {
  const firstCategoryId = taxonomy.categories.find((category) => category.is_active)?.id ?? "";
  const [categoryId, setCategoryId] = useState(values.categoryId ?? firstCategoryId);
  const [subcategoryId, setSubcategoryId] = useState(values.subcategoryId ?? "");
  const [slug, setSlug] = useState(values.slug ?? "");
  const [slugWasEdited, setSlugWasEdited] = useState(Boolean(values.slug));
  const [saleUnit, setSaleUnit] = useState(values.saleUnit ?? (
    taxonomy.categories.find((category) => category.id === categoryId)?.name === "Alianças" ? "pair" : "unit"
  ));
  const [seoTitle, setSeoTitle] = useState(values.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(values.seoDescription ?? "");
  const category = taxonomy.categories.find((item) => item.id === categoryId);
  const isAlliance = category?.name === "Alianças";
  const availableSubcategories = useMemo(
    () => taxonomy.subcategories.filter((item) => item.is_active && item.category_id === categoryId),
    [categoryId, taxonomy.subcategories]
  );

  return (
    <div className="grid gap-7">
      <Section title="Informações básicas">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Nome do produto *
            <input
              className={inputClass}
              name="name"
              defaultValue={values.name}
              required
              maxLength={180}
              onChange={(event) => {
                if (!slugWasEdited) setSlug(toProductSlug(event.target.value));
              }}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Slug *
            <input
              className={inputClass}
              name="slug"
              value={slug}
              required
              maxLength={180}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              onChange={(event) => {
                setSlugWasEdited(true);
                setSlug(toProductSlug(event.target.value));
              }}
            />
          </label>
        </div>
      </Section>

      <Section title="Classificação">
        <div className="grid gap-5 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Categoria *
            <select
              className={inputClass}
              name="categoryId"
              value={categoryId}
              required
              onChange={(event) => {
                const id = event.target.value;
                setCategoryId(id);
                setSubcategoryId("");
                setSaleUnit(taxonomy.categories.find((item) => item.id === id)?.name === "Alianças" ? "pair" : "unit");
              }}
            >
              {taxonomy.categories.filter((item) => item.is_active).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Subcategoria
            <select className={inputClass} name="subcategoryId" value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)}>
              <option value="">Sem subcategoria</option>
              {availableSubcategories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Material *
            <select className={inputClass} name="materialId" defaultValue={values.materialId ?? ""} required>
              <option value="" disabled>Selecione</option>
              {taxonomy.materials.filter((item) => item.is_active).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Comercial">
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Preço atual" name="price" value={values.price} inputMode="decimal" />
          <Field label="Preço anterior" name="oldPrice" value={values.oldPrice} inputMode="decimal" />
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Disponibilidade
            <select className={inputClass} name="stockStatus" defaultValue={values.stockStatus ?? "available"}>
              <option value="available">Disponível</option>
              <option value="made_to_order">Sob encomenda</option>
              <option value="unavailable">Indisponível</option>
              {category?.name === "Serviços" ? <option value="service">Serviço</option> : null}
            </select>
          </label>
          <Field label="Desconto anterior" name="discountPercent" value={values.discountPercent} suffix="%" inputMode="decimal" />
          <Field label="Desconto à vista" name="cashDiscountPercent" value={values.cashDiscountPercent} suffix="%" inputMode="decimal" />
          <Field label="Número de parcelas" name="installmentsCount" value={values.installmentsCount} inputMode="numeric" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox name="isCustomOrder" label="Produto personalizado ou sob encomenda" defaultChecked={values.isCustomOrder} />
          <Checkbox name="isFeatured" label="Destacar no catálogo" defaultChecked={values.isFeatured} />
          <Checkbox name="allowWhatsappQuote" label="Permitir consulta pelo WhatsApp" defaultChecked={values.allowWhatsappQuote ?? true} />
        </div>
      </Section>

      <Section title="Descrição">
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Descrição curta
          <input className={inputClass} name="shortDescription" defaultValue={values.shortDescription ?? ""} maxLength={280} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Descrição completa
          <textarea className={textareaClass} name="description" defaultValue={values.description ?? ""} maxLength={12000} />
        </label>
      </Section>

      <Section title="Características técnicas">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Peso aproximado" name="approximateWeightGrams" value={values.approximateWeightGrams} suffix="g" inputMode="decimal" />
          <Field label="Largura" name="widthMm" value={values.widthMm} suffix="mm" inputMode="decimal" />
          <Field label="Espessura" name="thicknessMm" value={values.thicknessMm} suffix="mm" inputMode="decimal" />
          <Field label="Altura" name="heightMm" value={values.heightMm} suffix="mm" inputMode="decimal" />
          <Field label="Comprimento" name="lengthCm" value={values.lengthCm} suffix="cm" inputMode="decimal" />
          <Field label="Diâmetro" name="diameterMm" value={values.diameterMm} suffix="mm" inputMode="decimal" />
          <Field label="Acabamento" name="finish" value={values.finish} />
          <Field label="Tipo de pedra" name="stoneType" value={values.stoneType} />
          <Field label="Cor da pedra" name="stoneColor" value={values.stoneColor} />
          <Field label="Quantidade de pedras" name="stoneQuantity" value={values.stoneQuantity} inputMode="numeric" />
          <Field label="Estilo/público" name="genderStyle" value={values.genderStyle} />
        </div>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Detalhes do material
          <input className={inputClass} name="materialDetails" defaultValue={values.materialDetails ?? ""} maxLength={500} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Observações técnicas
          <textarea className={textareaClass} name="technicalNotes" defaultValue={values.technicalNotes ?? ""} maxLength={2000} />
        </label>
      </Section>

      <Section title="Regras especiais">
        <label className="grid max-w-xs gap-2 text-sm font-semibold text-ink">
          Unidade de venda
          <select className={inputClass} name="saleUnit" value={saleUnit} onChange={(event) => setSaleUnit(event.target.value as "unit" | "pair")}>
            <option value="unit">Unidade</option>
            <option value="pair">Par</option>
          </select>
        </label>
        {(isAlliance || category?.name === "Anéis") ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Aro mínimo" name="sizeMin" value={values.sizeMin ?? (isAlliance ? 8 : null)} inputMode="numeric" />
            <Field label="Aro máximo" name="sizeMax" value={values.sizeMax ?? (isAlliance ? 35 : null)} inputMode="numeric" />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox name="engravingAvailable" label="Gravação disponível" defaultChecked={values.engravingAvailable} />
          <Checkbox name="engravingIncluded" label="Gravação inclusa" defaultChecked={values.engravingIncluded} />
          <Checkbox name="jewelryBoxIncluded" label="Caixinha inclusa" defaultChecked={values.jewelryBoxIncluded} />
        </div>
      </Section>

      <Section title="SEO">
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Título SEO
          <input className={inputClass} name="seoTitle" value={seoTitle} maxLength={180} onChange={(event) => setSeoTitle(event.target.value)} />
          <span className="text-xs font-normal text-taupe">{seoTitle.length} caracteres · referência: 50–60</span>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Meta descrição
          <textarea className={textareaClass} name="seoDescription" value={seoDescription} maxLength={500} onChange={(event) => setSeoDescription(event.target.value)} />
          <span className="text-xs font-normal text-taupe">{seoDescription.length} caracteres · referência: até 160</span>
        </label>
      </Section>
    </div>
  );
}
