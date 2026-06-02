import fs from "node:fs";
import path from "node:path";
import { categories } from "@/data/categories";
import { products } from "@/data/products";
import { normalizeText } from "@/lib/format";
import type { CategoryName, Product } from "@/types/product";

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function hasValidProductImage(product: Product) {
  const image = product.images?.[0]?.trim();

  if (!image) {
    return false;
  }

  const normalizedImage = normalizeText(image);

  if (normalizedImage.includes("placeholder") || normalizedImage.includes("imagem-em-breve")) {
    return false;
  }

  const publicProductsPath = path.resolve(process.cwd(), "public", "produtos");
  const imagePath = path.resolve(process.cwd(), "public", image.replace(/^\/+/, ""));
  const isInsideProductsFolder = imagePath === publicProductsPath || imagePath.startsWith(`${publicProductsPath}${path.sep}`);

  if (!isInsideProductsFolder) {
    return false;
  }

  try {
    return fs.statSync(imagePath).isFile();
  } catch {
    return false;
  }
}

export function getVisibleProducts(productList: Product[] = products) {
  return productList.filter(hasValidProductImage);
}

export function getFeaturedProducts() {
  return getVisibleProducts().filter((product) => product.featured);
}

export function getHomeFeaturedProducts(minimum = 5) {
  const visibleProducts = getVisibleProducts();
  const featuredProducts = visibleProducts.filter((product) => product.featured);

  if (featuredProducts.length >= minimum) {
    return featuredProducts;
  }

  const featuredIds = new Set(featuredProducts.map((product) => product.id));
  const complementaryProducts = visibleProducts.filter((product) => !featuredIds.has(product.id));

  return [...featuredProducts, ...complementaryProducts].slice(0, minimum);
}

export function getProductsByCategory(category: CategoryName) {
  return getVisibleProducts().filter((product) => product.category === category);
}

export function getMaterials(productList: Product[] = getVisibleProducts()) {
  return Array.from(new Set(productList.map((product) => product.material))).sort();
}

export function filterProducts({
  query,
  category,
  material
}: {
  query?: string;
  category?: string;
  material?: string;
}) {
  const normalizedQuery = normalizeText(query ?? "");

  return getVisibleProducts().filter((product) => {
    const searchable = normalizeText(
      [product.name, product.category, product.subcategory, product.material, product.description].join(" ")
    );
    const matchesQuery = normalizedQuery ? searchable.includes(normalizedQuery) : true;
    const matchesCategory = category ? product.category === category : true;
    const matchesMaterial = material ? product.material === material : true;

    return matchesQuery && matchesCategory && matchesMaterial;
  });
}
