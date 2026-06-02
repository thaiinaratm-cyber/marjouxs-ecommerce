import { WHATSAPP_NUMBER } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { CartItem, Product } from "@/types/product";

export type CheckoutPayload = {
  name: string;
  whatsapp: string;
  address: string;
  observation: string;
  paymentMethod: string;
};

export function buildQuoteUrl(product: Product) {
  const message = [
    "Ola, Antoer Joalheria e Relojoaria!",
    "Gostaria de solicitar um orcamento.",
    "",
    `Produto: ${product.name}`,
    `Categoria: ${product.category}`,
    `Subcategoria: ${product.subcategory}`,
    `Material: ${product.material}`,
    `Valor exibido: ${product.priceLabel}`,
    `Referencia: ${product.slug}`
  ].join("\n");

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function buildCheckoutUrl(items: CartItem[], payload: CheckoutPayload) {
  const subtotal = items.reduce((total, item) => total + (item.product.price ?? 0) * item.quantity, 0);
  const lines = items.map((item) => {
    const unitPrice = item.product.price === null ? item.product.priceLabel : formatCurrency(item.product.price);
    const itemTotal = item.product.price === null ? "Sob orcamento" : formatCurrency(item.product.price * item.quantity);

    return `- ${item.quantity}x ${item.product.name}\n  Unitario: ${unitPrice}\n  Total: ${itemTotal}`;
  });
  const orderCode = `ANTOER-${Date.now().toString().slice(-6)}`;

  const message = [
    "Ola, Antoer Joalheria e Relojoaria!",
    `Quero finalizar meu pedido ${orderCode}.`,
    "",
    "Resumo do pedido:",
    ...lines,
    "",
    `Total dos itens com preco fixo: ${formatCurrency(subtotal)}`,
    "",
    "Dados do cliente:",
    `Nome: ${payload.name}`,
    `WhatsApp: ${payload.whatsapp}`,
    `Endereco/retirada: ${payload.address}`,
    `Forma de pagamento: ${payload.paymentMethod}`,
    payload.observation ? `Observacoes: ${payload.observation}` : "Observacoes: sem observacoes",
    "",
    "Aguardo a confirmacao de estoque, prazo e valores antes da finalizacao."
  ].join("\n");

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
