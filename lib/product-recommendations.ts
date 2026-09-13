import { normalizeText } from "@/lib/format";
import type { Product } from "@/types/product";

function productText(product: Product) {
  return normalizeText(
    [product.name, product.category, product.subcategory, product.material, product.description].join(" ")
  );
}

function sortBySimilarity(currentProduct: Product, candidates: Product[]) {
  const currentMaterial = normalizeText(currentProduct.material);
  const currentSubcategory = normalizeText(currentProduct.subcategory);

  return candidates
    .map((product, index) => {
      let score = 0;

      if (normalizeText(product.material) === currentMaterial) {
        score += 4;
      }

      if (normalizeText(product.subcategory) === currentSubcategory) {
        score += 2;
      }

      if (product.featured) {
        score += 1;
      }

      return { product, index, score };
    })
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .map(({ product }) => product);
}

function addUnique(target: Product[], products: Product[], limit: number) {
  for (const product of products) {
    if (target.length >= limit) {
      return;
    }

    if (!target.some((item) => item.id === product.id)) {
      target.push(product);
    }
  }
}

export function selectRelatedProducts(
  currentProduct: Product,
  candidates: Product[],
  limit = 4
) {
  if (limit <= 0) {
    return [];
  }

  const availableCandidates = candidates.filter((product) => product.id !== currentProduct.id);
  const sameCategory = sortBySimilarity(
    currentProduct,
    availableCandidates.filter((product) => product.category === currentProduct.category)
  );

  if (currentProduct.category !== "Alianças") {
    return sameCategory.slice(0, limit);
  }

  const related: Product[] = [];
  const similarAlliances = sameCategory.filter((product) => {
    const text = productText(product);
    return !text.includes("solitario") && !text.includes("aparador");
  });
  const solitaireProducts = sameCategory.filter((product) => productText(product).includes("solitario"));
  const ringGuards = sameCategory.filter((product) => productText(product).includes("aparador"));

  addUnique(related, similarAlliances.slice(0, 2), limit);
  addUnique(related, solitaireProducts.slice(0, 1), limit);
  addUnique(related, ringGuards.slice(0, 1), limit);
  addUnique(related, sameCategory, limit);

  if (related.length < limit) {
    const complementaryRings = sortBySimilarity(
      currentProduct,
      availableCandidates.filter((product) => {
        if (product.category !== "Anéis") {
          return false;
        }

        const text = productText(product);
        return text.includes("solitario") || text.includes("aparador");
      })
    );
    addUnique(related, complementaryRings, limit);
  }

  return related;
}
