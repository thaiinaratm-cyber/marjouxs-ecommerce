import { getStoneOptions, stoneColorLabel } from "@/lib/stone-customization";
import type { CartCustomization, CartItem } from "@/types/product";

export function OrderItemStone({ customization }: { customization: CartCustomization }) {
  const label = stoneColorLabel(customization?.stone_color);
  return label ? <p className="mt-2 text-sm text-taupe">Pedra: {label}</p> : null;
}

export function CartStoneField({ item, onChange }: { item: CartItem; onChange: (stone: string) => void }) {
  const options = getStoneOptions(item.product);
  const current = item.customization?.stone_color;
  if (options.length < 2 || !current || !options.some(option => option.id === current)) {
    return <OrderItemStone customization={item.customization} />;
  }
  return (
    <label className="mt-2 flex flex-wrap items-center gap-2 text-sm text-taupe">
      Pedra:
      <select aria-label={"Cor da pedra: " + item.product.name}
        className="min-h-11 max-w-full rounded-md border border-black/15 bg-white px-2 text-sm text-ink focus-visible:outline focus-visible:outline-gold"
        value={current} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}
