import { z } from "zod";
import type { CartCustomization, Product } from "@/types/product";

export const STONE_COLORS = [
  { id: "cristal", name: "Cristal", color: "#f5f3ef" },
  { id: "azul-safira", name: "Azul Safira", color: "#264a99" },
  { id: "rubi", name: "Rubi", color: "#a92043" },
  { id: "ametista", name: "Ametista", color: "#754495" },
  { id: "esmeralda", name: "Esmeralda", color: "#167652" },
  { id: "onix", name: "Ônix", color: "#21211f" },
  { id: "rosa", name: "Rosa", color: "#e9a5b7" }
] as const;

export const stoneColorSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
export const STONE_REQUIRED = "Selecione a cor da pedra para continuar.";

export function findStoneColor(id: unknown) {
  return STONE_COLORS.find(stone => stone.id === id);
}

export function stoneColorLabel(id: unknown) {
  const parsed = stoneColorSchema.safeParse(id);
  if (!parsed.success) return null;
  return findStoneColor(parsed.data)?.name ?? parsed.data;
}

export function getStoneOptions(product: Pick<Product, "stoneCustomization">) {
  const options = product.stoneCustomization?.options;
  return (Array.isArray(options) ? options : [])
    .map(findStoneColor)
    .filter((stone): stone is (typeof STONE_COLORS)[number] => stone !== undefined);
}

export function readStoneConfiguration(enabled: unknown, options: unknown): Product["stoneCustomization"] {
  if (enabled !== true) return undefined;
  const parsed = z.array(stoneColorSchema).min(1).max(24).safeParse(options);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { options: [] };
  return { options: parsed.data };
}

export function acceptsStone(product: Pick<Product, "stoneCustomization">, customization: CartCustomization) {
  const color = customization?.stone_color;
  return product.stoneCustomization
    ? getStoneOptions(product).some(stone => stone.id === color)
    : color === undefined;
}

// Public order views expose the chosen color, never the ring engravings.
export function publicOrderStone(value: unknown): Extract<CartCustomization, { type: "stone" }> | null {
  if (!value || typeof value !== "object" || !("type" in value) || !("stone_color" in value) ||
      (value.type !== "stone" && value.type !== "ring_pair")) return null;
  const parsed = stoneColorSchema.safeParse(value.stone_color);
  return parsed.success ? { type: "stone", stone_color: parsed.data } : null;
}
