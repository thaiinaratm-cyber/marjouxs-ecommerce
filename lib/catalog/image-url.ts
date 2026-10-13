export const PRODUCT_IMAGE_BUCKET = "ecommerce-product-images";

export function catalogImageUrl(
  image: { source_type: string; path: string },
  supabaseUrl?: string
): string | null {
  if (image.source_type === "local") {
    return image.path.startsWith("/produtos/") && !image.path.includes("..") &&
      !/placeholder|imagem-em-breve/i.test(image.path) ? image.path : null;
  }

  if (image.source_type !== "storage" || !supabaseUrl) return null;
  const segments = image.path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))) {
    return null;
  }

  try {
    const base = new URL(supabaseUrl);
    if (base.protocol !== "https:") return null;
    const path = segments.map(encodeURIComponent).join("/");
    return new URL(`/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${path}`, base).toString();
  } catch {
    return null;
  }
}
