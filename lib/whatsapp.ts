import { WHATSAPP_NUMBER } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { CartItem, Product } from "@/types/product";

const STORE_URL = "https://marjouxsjoias.com.br";

export type CheckoutPayload = {
  name: string;
  whatsapp: string;
  address: string;
  observation: string;
  paymentMethod: string;
};

function getAbsoluteProductImageUrl(product: Product) {
  const [image] = product.images;

  if (!image) {
    return `${STORE_URL}/produtos`;
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${STORE_URL}${image.startsWith("/") ? image : `/${image}`}`;
}

export function buildQuoteUrl(product: Product) {
  const message = [
    "Ola, Marjouxs!",
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
  const hasItemsPendingConfirmation = items.some(
    (item) => item.product.price === null || item.product.stockStatus === "Sob encomenda"
  );
  const lines = items.map((item) => {
    const unitPrice = item.product.price === null ? item.product.priceLabel : formatCurrency(item.product.price);
    const itemTotal = item.product.price === null ? "Sob orçamento" : formatCurrency(item.product.price * item.quantity);
    const imageUrl = getAbsoluteProductImageUrl(item.product);

    return `• ${item.quantity}x ${item.product.name}\nValor unitário: ${unitPrice}\nTotal: ${itemTotal}\nImagem do produto: ${imageUrl}`;
  });
  const orderCode = `MARJOUXS-${Date.now().toString().slice(-6)}`;

  const message = [
    "Olá, Marjouxs Joias e Alianças!",
    "",
    `Quero finalizar meu pedido: ${orderCode}`,
    "",
    "Resumo do pedido:",
    ...lines,
    "",
    `Total do pedido: ${formatCurrency(subtotal)}`,
    ...(hasItemsPendingConfirmation ? ["Alguns itens precisam de confirmação da loja."] : []),
    "",
    "Dados do cliente:",
    `Nome: ${payload.name}`,
    `WhatsApp: ${payload.whatsapp}`,
    `Entrega/retirada: ${payload.address}`,
    `Forma de pagamento: ${payload.paymentMethod}`,
    payload.observation ? `Observações: ${payload.observation}` : "Observações: sem observações",
    "",
    "Aguardo a confirmação da loja para seguir com o pagamento/retirada."
  ].join("\n");

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
