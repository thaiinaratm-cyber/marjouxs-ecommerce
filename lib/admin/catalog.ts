import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminTaxonomyOption = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export type AdminSubcategoryOption = AdminTaxonomyOption & {
  category_id: string;
};

export type AdminTaxonomy = {
  categories: AdminTaxonomyOption[];
  materials: AdminTaxonomyOption[];
  subcategories: AdminSubcategoryOption[];
};

export async function getAdminTaxonomy(supabase: SupabaseClient): Promise<AdminTaxonomy> {
  const [categoriesResult, materialsResult, subcategoriesResult] = await Promise.all([
    supabase
      .from("ecommerce_categories")
      .select("id,name,slug,is_active")
      .order("sort_order")
      .order("name"),
    supabase
      .from("ecommerce_materials")
      .select("id,name,slug,is_active")
      .order("sort_order")
      .order("name"),
    supabase
      .from("ecommerce_subcategories")
      .select("id,category_id,name,slug,is_active")
      .order("sort_order")
      .order("name")
  ]);

  const error = categoriesResult.error ?? materialsResult.error ?? subcategoriesResult.error;
  if (error) throw new Error("admin_taxonomy_unavailable");

  return {
    categories: (categoriesResult.data ?? []) as AdminTaxonomyOption[],
    materials: (materialsResult.data ?? []) as AdminTaxonomyOption[],
    subcategories: (subcategoriesResult.data ?? []) as AdminSubcategoryOption[]
  };
}
