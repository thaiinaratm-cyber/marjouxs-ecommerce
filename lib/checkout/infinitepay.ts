import { z } from "zod";
import { getInfinitePayConfiguration } from "@/lib/checkout/config";

type FetchImplementation = typeof fetch;

export type InfinitePayCheckoutItem = {
  quantity: number;
  price: number;
  description: string;
};

export type InfinitePayCreateInput = {
  orderNsu: string;
  redirectUrl: string;
  webhookUrl: string;
  items: InfinitePayCheckoutItem[];
  customer: {
    name: string;
    email: string;
    phoneNumber: string;
  };
  address?: {
    cep: string;
    street: string;
    neighborhood: string;
    number: string;
    complement?: string;
  };
};

const linkResponseSchema = z.object({ url: z.string().url() }).passthrough();
const paymentCheckResponseSchema = z
  .object({
    success: z.boolean(),
    paid: z.boolean(),
    amount: z.coerce.number().int().positive(),
    paid_amount: z.coerce.number().int(),
    installments: z.coerce.number().int(),
    capture_method: z.enum(["pix", "credit_card"])
  })
  .passthrough();

export class InfinitePayError extends Error {
  constructor(message: string, readonly code: string, readonly status = 502) {
    super(message);
    this.name = "InfinitePayError";
  }
}

async function postInfinitePay(
  path: string,
  payload: Record<string, unknown>,
  fetchImplementation: FetchImplementation
) {
  const configuration = getInfinitePayConfiguration();
  const response = await fetchImplementation(`${configuration.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store"
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new InfinitePayError("A InfinitePay retornou uma resposta inválida.", "invalid_payment_response");
  }

  if (!response.ok) {
    throw new InfinitePayError(
      "Não foi possível iniciar o pagamento neste momento.",
      "payment_provider_error",
      response.status >= 400 && response.status < 500 ? 422 : 502
    );
  }

  return body;
}

export function getProviderCheckoutId(checkoutUrl: string) {
  const url = new URL(checkoutUrl);
  const queryIdentifier = url.searchParams.get("lenc") || url.searchParams.get("slug");
  if (queryIdentifier?.trim()) {
    return queryIdentifier.trim();
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  return pathParts.at(-1)?.trim() || null;
}

export async function createInfinitePayCheckout(
  input: InfinitePayCreateInput,
  fetchImplementation: FetchImplementation = fetch
) {
  const { handle } = getInfinitePayConfiguration();
  const body = await postInfinitePay(
    "/links",
    {
      handle,
      redirect_url: input.redirectUrl,
      webhook_url: input.webhookUrl,
      order_nsu: input.orderNsu,
      items: input.items,
      customer: {
        name: input.customer.name,
        email: input.customer.email,
        phone_number: input.customer.phoneNumber
      },
      ...(input.address ? { address: input.address } : {})
    },
    fetchImplementation
  );
  const parsed = linkResponseSchema.safeParse(body);
  if (!parsed.success || !parsed.data.url.startsWith("https://")) {
    throw new InfinitePayError("A InfinitePay não retornou um link seguro.", "invalid_checkout_url");
  }

  const providerCheckoutId = getProviderCheckoutId(parsed.data.url);
  if (!providerCheckoutId) {
    throw new InfinitePayError("A InfinitePay não retornou o identificador do checkout.", "missing_checkout_id");
  }

  return { checkoutUrl: parsed.data.url, providerCheckoutId };
}

export async function checkInfinitePayPayment(
  input: { orderNsu: string; transactionNsu: string; invoiceSlug: string },
  fetchImplementation: FetchImplementation = fetch
) {
  const { handle } = getInfinitePayConfiguration();
  const body = await postInfinitePay(
    "/payment_check",
    {
      handle,
      order_nsu: input.orderNsu,
      transaction_nsu: input.transactionNsu,
      slug: input.invoiceSlug
    },
    fetchImplementation
  );
  const parsed = paymentCheckResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new InfinitePayError("A confirmação da InfinitePay é inválida.", "invalid_payment_check");
  }
  return parsed.data;
}
