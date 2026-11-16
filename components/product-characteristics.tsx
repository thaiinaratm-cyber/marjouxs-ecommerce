import { normalizeText } from "@/lib/format";
import { getProductCommercialDetails } from "@/lib/product-merchandising";
import type { Product } from "@/types/product";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const placeholders = new Set(["não informado", "não informada", "não se aplica", "n/a", "-", "—"].map(normalizeText));

export function ProductCharacteristics({ product }: { product: Product }) {
  const details: Array<{ label: string; value: string }> = [];
  const add = (label: string, value?: string) => {
    const text = value?.trim();
    if (text && !placeholders.has(normalizeText(text))) details.push({ label, value: text });
  };
  const measure = (label: string, value?: number, unit?: string) => {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      add(label, unit ? [number.format(value), unit].join(" ") : number.format(value));
    }
  };
  const spec = product.technicalDetails;
  add("Material", product.material);
  add("Detalhes do material", spec?.materialDetails);
  measure("Peso aproximado", spec?.weightGrams, "g");
  measure("Largura", spec?.widthMm, "mm");
  measure("Comprimento", spec?.lengthCm, "cm");
  measure("Espessura", spec?.thicknessMm, "mm");
  measure("Altura", spec?.heightMm, "mm");
  measure("Diâmetro", spec?.diameterMm, "mm");
  add("Acabamento", spec?.finish);
  add("Tipo de pedra", spec?.stoneType);
  add("Cor da pedra", spec?.stoneColor);
  measure("Quantidade de pedras", spec?.stoneQuantity);
  add("Estilo", spec?.genderStyle);
  if (product.category === "Alianças" && spec?.comfortProfile) {
    add("Conforto", spec.comfortProfile === "anatomica" ? "Anatômica" : "Reta");
  }
  if ((product.category === "Correntes" || product.category === "Pulseiras") && spec?.structureType) {
    add("Estrutura", spec.structureType === "solid" ? "Maciça" : "Oca");
  }
  const { sizeMin, sizeMax } = product;
  if (typeof sizeMin === "number" && typeof sizeMax === "number" &&
      Number.isInteger(sizeMin) && Number.isInteger(sizeMax) && sizeMin > 0 && sizeMax >= sizeMin) {
    add("Faixa de aros", sizeMin === sizeMax ? number.format(sizeMin) : [sizeMin, sizeMax].join(" a "));
  }
  const commercial = getProductCommercialDetails(product);
  add("Disponibilidade", commercial.find(detail => detail.kind === "availability")?.value);
  add("Produção", commercial.find(detail => detail.kind === "production")?.value);
  if (!details.length) return null;

  return (
    <section className="mt-10 border-t border-black/10 pt-6" aria-labelledby="product-characteristics-title">
      <h2 id="product-characteristics-title" className="font-serif text-2xl font-semibold text-ink">Características</h2>
      <dl className="mt-4 grid gap-x-6 gap-y-3 min-[390px]:grid-cols-2 md:grid-cols-3">
        {details.map(({ label, value }) => (
          <div key={label} className="min-w-0 border-b border-black/10 pb-3">
            <dt className="text-sm font-medium text-taupe">{label}</dt>
            <dd className="mt-1 whitespace-pre-line text-sm text-ink [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
