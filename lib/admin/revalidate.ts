import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateAdminProduct(productId: string) {
  revalidateTag("marjouxs-public-catalog");
  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${productId}`);
}
