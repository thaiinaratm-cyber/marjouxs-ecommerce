"use client";

import Link from "next/link";
import { Check, CreditCard, LoaderCircle, MapPin, PackageCheck, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ProductImage } from "@/components/product-image";
import { useCart } from "@/context/cart-context";
import {
  getGoogleAnalyticsIdentifiers,
  trackAddPaymentInfo,
  trackAddShippingInfo,
  trackBeginCheckout
} from "@/lib/analytics";
import { STORE_ADDRESS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { ShippingQuoteOption, ValidatedCart } from "@/types/checkout";

type DeliveryMethod = "pickup" | "shipping";

const fieldClass =
  "h-12 rounded-md border border-black/10 bg-pearl px-4 text-sm text-ink outline-none transition placeholder:text-taupe focus:border-gold focus:ring-2 focus:ring-gold/15";

function responseMessage(body: unknown, fallback: string) {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string"
    ? body.error
    : fallback;
}

export default function CheckoutPage() {
  const { items, lines, isReady, clearCart } = useCart();
  const [validatedCart, setValidatedCart] = useState<ValidatedCart | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", cpf: "" });
  const [address, setAddress] = useState({
    postalCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: ""
  });
  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteOption[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const checkoutAttempt = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const trackedCheckout = useRef(false);

  const apiItems = useMemo(
    () =>
      lines.map(({ productId, productSlug, quantity, customization }) => ({
        productId,
        productSlug,
        quantity,
        customization
      })),
    [lines]
  );
  const shippingItems = useMemo(
    () => lines.map(({ productId, productSlug, quantity }) => ({ productId, productSlug, quantity })),
    [lines]
  );
  const selectedShipping =
    shippingOptions.find((option) => option.shippingQuoteId === selectedShippingId) ?? null;
  const fallbackSubtotal = items.reduce(
    (sum, item) => sum + (item.product.price ?? 0) * item.quantity,
    0
  );
  const subtotalCents = validatedCart?.subtotalCents ?? Math.round(fallbackSubtotal * 100);
  const shippingCents = deliveryMethod === "shipping" ? selectedShipping?.priceCents ?? 0 : 0;
  const totalCents = subtotalCents + shippingCents;

  useEffect(() => {
    if (!isReady || apiItems.length === 0) return;

    const controller = new AbortController();
    setIsValidating(true);
    setError("");

    fetch("/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: apiItems }),
      signal: controller.signal
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(responseMessage(body, "Não foi possível validar sua sacola."));
        }
        setValidatedCart(body as ValidatedCart);
        if (!trackedCheckout.current) {
          trackedCheckout.current = true;
          trackBeginCheckout(items);
        }
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível validar sua sacola."
        );
      })
      .finally(() => setIsValidating(false));

    return () => controller.abort();
  }, [apiItems, isReady, items]);

  function resetAttempt() {
    checkoutAttempt.current = null;
  }

  async function calculateShipping() {
    setError("");
    setShippingOptions([]);
    setSelectedShippingId("");
    setIsQuoting(true);
    resetAttempt();

    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: address.postalCode, items: shippingItems })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(responseMessage(body, "Não foi possível calcular o frete."));
      }

      const options = (body.options ?? []) as ShippingQuoteOption[];
      setShippingOptions(options);
      if (options.length === 0) {
        setError(
          "Nenhuma modalidade autorizada está disponível para este CEP. Escolha retirada ou fale com a equipe."
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível calcular o frete."
      );
    } finally {
      setIsQuoting(false);
    }
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validatedCart || isValidating) return;

    if (deliveryMethod === "shipping" && !selectedShipping) {
      setError("Calcule e selecione uma modalidade de frete.");
      return;
    }

    const delivery =
      deliveryMethod === "pickup"
        ? { method: "pickup" as const }
        : {
            method: "shipping" as const,
            address: {
              ...address,
              postalCode: address.postalCode.replace(/\D/g, ""),
              state: address.state.toUpperCase(),
              serviceId: selectedShipping!.serviceId,
              shippingQuoteId: selectedShipping!.shippingQuoteId
            }
          };
    const fingerprint = JSON.stringify({ apiItems, customer, delivery });
    if (!checkoutAttempt.current || checkoutAttempt.current.fingerprint !== fingerprint) {
      checkoutAttempt.current = { fingerprint, requestId: crypto.randomUUID() };
    }

    setError("");
    setIsSubmitting(true);
    if (deliveryMethod === "pickup") {
      trackAddShippingInfo(items, "Retirada na loja");
    }
    trackAddPaymentInfo(items, "infinitepay");

    try {
      const response = await fetch("/api/payments/infinitepay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: checkoutAttempt.current.requestId,
          items: apiItems,
          customer,
          delivery,
          analytics: getGoogleAnalyticsIdentifiers()
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(responseMessage(body, "Não foi possível iniciar o pagamento."));
      }
      if (!body.checkoutUrl || typeof body.checkoutUrl !== "string") {
        throw new Error("O link de pagamento não foi retornado.");
      }

      clearCart();
      window.location.assign(body.checkoutUrl);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível iniciar o pagamento."
      );
      setIsSubmitting(false);
    }
  }

  if (!isReady || (isValidating && !validatedCart)) {
    return (
      <section className="mx-auto grid min-h-[55svh] max-w-3xl place-items-center px-4 py-12 text-center">
        <div>
          <LoaderCircle
            className="mx-auto animate-spin text-gold motion-reduce:animate-none"
            size={34}
          />
          <p className="mt-3 text-taupe">Validando sua sacola...</p>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto grid min-h-[55svh] max-w-3xl place-items-center px-4 py-12 text-center sm:px-6 lg:px-8">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-ink">Nenhum item no checkout</h1>
          <p className="mt-3 text-taupe">Adicione produtos à sacola antes de finalizar.</p>
          <Link
            href="/produtos"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold"
          >
            Ver produtos
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">Checkout seguro</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">
          Finalize seu pedido
        </h1>
        <p className="mt-4 leading-7 text-taupe">
          Escolha entrega ou retirada e siga para o ambiente seguro da InfinitePay.
        </p>
      </div>

      <form
        onSubmit={submitCheckout}
        className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start"
      >
        <div className="grid gap-6">
          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">1. Entrega</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">Como deseja receber?</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  value: "pickup" as const,
                  label: "Retirar na loja",
                  detail: "Sem custo de frete",
                  Icon: PackageCheck
                },
                {
                  value: "shipping" as const,
                  label: "Receber no endereço",
                  detail: "Frete calculado pelo CEP",
                  Icon: Truck
                }
              ].map(({ value, label, detail, Icon }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer gap-3 rounded-md border p-4 transition ${
                    deliveryMethod === value
                      ? "border-gold bg-gold/5"
                      : "border-black/10 hover:border-gold/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value={value}
                    checked={deliveryMethod === value}
                    onChange={() => {
                      setDeliveryMethod(value);
                      setError("");
                      resetAttempt();
                    }}
                    className="mt-1 accent-[#b88a44]"
                  />
                  <Icon className="shrink-0 text-gold" size={20} />
                  <span>
                    <strong className="block text-sm text-ink">{label}</strong>
                    <span className="mt-1 block text-xs text-taupe">{detail}</span>
                  </span>
                </label>
              ))}
            </div>

            {deliveryMethod === "pickup" ? (
              <div className="mt-5 flex gap-3 rounded-md border border-black/10 bg-pearl p-4 text-sm leading-6 text-taupe">
                <MapPin className="shrink-0 text-gold" size={19} />
                <p>
                  <strong className="block text-ink">Marjouxs Joias e Alianças</strong>
                  {STORE_ADDRESS.street}
                  <br />
                  {STORE_ADDRESS.complement}
                  <br />
                  {STORE_ADDRESS.city} - {STORE_ADDRESS.state}
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="grid gap-2 text-sm font-medium text-ink">
                    CEP
                    <input
                      required
                      value={address.postalCode}
                      onChange={(event) => {
                        setAddress((current) => ({ ...current, postalCode: event.target.value }));
                        setShippingOptions([]);
                        setSelectedShippingId("");
                        resetAttempt();
                      }}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      className={fieldClass}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={calculateShipping}
                    disabled={isQuoting || shippingItems.length === 0}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-ink bg-white px-5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isQuoting ? (
                      <LoaderCircle className="animate-spin motion-reduce:animate-none" size={17} />
                    ) : (
                      <Truck size={17} />
                    )}
                    Calcular frete
                  </button>
                </div>

                {shippingOptions.length > 0 ? (
                  <div className="grid gap-2">
                    {shippingOptions.map((option) => (
                      <label
                        key={option.shippingQuoteId}
                        className={`flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 text-sm ${
                          selectedShippingId === option.shippingQuoteId
                            ? "border-gold bg-gold/5"
                            : "border-black/10"
                        }`}
                      >
                        <span className="flex min-w-0 gap-3">
                          <input
                            required
                            type="radio"
                            name="shipping"
                            value={option.shippingQuoteId}
                            checked={selectedShippingId === option.shippingQuoteId}
                            onChange={() => {
                              setSelectedShippingId(option.shippingQuoteId);
                              resetAttempt();
                              trackAddShippingInfo(
                                items,
                                `${option.carrierName} ${option.serviceName}`
                              );
                            }}
                            className="accent-[#b88a44]"
                          />
                          <span>
                            <strong className="block text-ink">
                              {option.carrierName} {option.serviceName}
                            </strong>
                            <span className="mt-1 block text-xs text-taupe">
                              Prazo estimado: até {option.deliveryTimeDays} dias
                            </span>
                          </span>
                        </span>
                        <strong className="shrink-0 text-ink">
                          {formatCurrency(option.priceCents / 100)}
                        </strong>
                      </label>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-ink sm:col-span-2">
                    Endereço
                    <input
                      required
                      autoComplete="street-address"
                      value={address.street}
                      onChange={(event) => {
                        setAddress((current) => ({ ...current, street: event.target.value }));
                        resetAttempt();
                      }}
                      className={fieldClass}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-ink">
                    Número
                    <input
                      required
                      value={address.number}
                      onChange={(event) => {
                        setAddress((current) => ({ ...current, number: event.target.value }));
                        resetAttempt();
                      }}
                      className={fieldClass}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-ink">
                    Complemento
                    <input
                      value={address.complement}
                      onChange={(event) => {
                        setAddress((current) => ({ ...current, complement: event.target.value }));
                        resetAttempt();
                      }}
                      className={fieldClass}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-ink">
                    Bairro
                    <input
                      required
                      value={address.neighborhood}
                      onChange={(event) => {
                        setAddress((current) => ({ ...current, neighborhood: event.target.value }));
                        resetAttempt();
                      }}
                      className={fieldClass}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-ink">
                    Cidade
                    <input
                      required
                      autoComplete="address-level2"
                      value={address.city}
                      onChange={(event) => {
                        setAddress((current) => ({ ...current, city: event.target.value }));
                        resetAttempt();
                      }}
                      className={fieldClass}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-ink">
                    Estado
                    <input
                      required
                      autoComplete="address-level1"
                      value={address.state}
                      onChange={(event) => {
                        setAddress((current) => ({
                          ...current,
                          state: event.target.value.slice(0, 2)
                        }));
                        resetAttempt();
                      }}
                      maxLength={2}
                      placeholder="SP"
                      className={`${fieldClass} uppercase`}
                    />
                  </label>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">2. Seus dados</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">Dados para o pedido</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-ink sm:col-span-2">
                Nome completo
                <input
                  required
                  autoComplete="name"
                  value={customer.name}
                  onChange={(event) => {
                    setCustomer((current) => ({ ...current, name: event.target.value }));
                    resetAttempt();
                  }}
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink">
                WhatsApp
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={customer.phone}
                  onChange={(event) => {
                    setCustomer((current) => ({ ...current, phone: event.target.value }));
                    resetAttempt();
                  }}
                  placeholder="(11) 99999-9999"
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink">
                E-mail
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={customer.email}
                  onChange={(event) => {
                    setCustomer((current) => ({ ...current, email: event.target.value }));
                    resetAttempt();
                  }}
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink">
                CPF <span className="font-normal text-taupe">(opcional)</span>
                <input
                  inputMode="numeric"
                  value={customer.cpf}
                  onChange={(event) => {
                    setCustomer((current) => ({ ...current, cpf: event.target.value }));
                    resetAttempt();
                  }}
                  className={fieldClass}
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-black/10 bg-white p-5 shadow-sm lg:sticky lg:top-28">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">3. Resumo</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">Seu pedido</h2>
          <div className="mt-5 grid gap-4">
            {items.map((item) => (
              <div
                key={item.lineId}
                className="grid grid-cols-[64px_1fr] gap-3 border-b border-black/10 pb-4"
              >
                <div className="relative aspect-square overflow-hidden rounded-md bg-champagne">
                  <ProductImage
                    src={item.product.images[0]}
                    alt={item.product.name}
                    sizes="64px"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-serif text-sm font-semibold leading-5 text-ink">
                    {item.product.name}
                  </p>
                  <p className="mt-1 text-xs text-taupe">
                    {item.quantity}x {item.product.priceLabel}
                  </p>
                  {item.customization?.type === "ring_pair" ? (
                    <p className="mt-1 text-xs text-taupe">
                      Aros {item.customization.ring1.size} e {item.customization.ring2.size}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-taupe">Produtos</dt>
              <dd className="font-medium text-ink">{formatCurrency(subtotalCents / 100)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-taupe">{deliveryMethod === "pickup" ? "Retirada" : "Frete"}</dt>
              <dd className="font-medium text-ink">
                {deliveryMethod === "pickup"
                  ? "Grátis"
                  : selectedShipping
                    ? formatCurrency(shippingCents / 100)
                    : "A calcular"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-black/10 pt-3 text-base">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-semibold text-ink">{formatCurrency(totalCents / 100)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex gap-3 rounded-md bg-pearl p-4 text-xs leading-5 text-taupe">
            <CreditCard className="shrink-0 text-gold" size={18} />
            <p>
              Na InfinitePay você escolhe Pix ou cartão de crédito. Nesta versão, ambos usam o valor
              integral do pedido.
            </p>
          </div>

          {error ? (
            <p
              className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || isValidating || !validatedCart}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <LoaderCircle className="animate-spin motion-reduce:animate-none" size={18} />
            ) : (
              <Check size={18} />
            )}
            {isSubmitting ? "Criando pagamento..." : "Ir para o pagamento"}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-taupe">
            O pagamento é concluído no ambiente seguro da InfinitePay.
          </p>
        </aside>
      </form>
    </section>
  );
}
