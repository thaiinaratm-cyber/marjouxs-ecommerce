"use client";

import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  LoaderCircle,
  MapPin,
  PackageCheck,
  Truck
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ProductImage } from "@/components/product-image";
import { useCart } from "@/context/cart-context";
import {
  getGoogleAnalyticsIdentifiers,
  trackAddPaymentInfo,
  trackAddShippingInfo,
  trackBeginCheckout
} from "@/lib/analytics";
import {
  formatBrazilianPhone,
  formatCpf,
  formatPostalCode,
  getCheckoutAddressLines,
  getCheckoutRequestErrorMessage,
  normalizeCheckoutAddress,
  normalizeCheckoutCustomer,
  onlyDigits,
  validateCheckoutForm,
  type CheckoutAddressInput,
  type CheckoutCustomerInput,
  type CheckoutDeliveryMethod,
  type CheckoutFieldErrors,
  type CheckoutFieldName
} from "@/lib/checkout/checkout-form";
import { STORE_ADDRESS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import {
  PRODUCT_PAGE_INSTALLMENTS_COUNT,
  PRODUCT_PAGE_PIX_DISCOUNT_PERCENT
} from "@/lib/product-pricing";
import { JEWELRY_PRODUCTION_DEADLINE } from "@/lib/production";
import type { ShippingQuoteOption, ValidatedCart } from "@/types/checkout";

type PostalCodeLookupStatus =
  | "idle"
  | "incomplete"
  | "loading"
  | "success"
  | "not_found"
  | "error";

const fieldClass =
  "h-12 w-full rounded-md border bg-pearl px-4 text-sm text-ink outline-none transition placeholder:text-taupe focus:ring-2";

const checkoutFieldOrder: CheckoutFieldName[] = [
  "postalCode",
  "shippingService",
  "street",
  "number",
  "neighborhood",
  "city",
  "state",
  "name",
  "phone",
  "email",
  "cpf"
];

function responseMessage(body: unknown, fallback: string) {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string"
    ? body.error
    : fallback;
}

function responseCode(body: unknown) {
  return body && typeof body === "object" && "code" in body ? body.code : null;
}

function getFieldClass(hasError: boolean) {
  return `${fieldClass} ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-black/10 focus:border-gold focus:ring-gold/15"
  }`;
}

function FieldError({ field, errors }: { field: CheckoutFieldName; errors: CheckoutFieldErrors }) {
  const message = errors[field];
  return message ? (
    <span id={`checkout-${field}-error`} className="text-xs font-normal text-red-700" role="alert">
      {message}
    </span>
  ) : null;
}

function removeFieldErrors(
  errors: CheckoutFieldErrors,
  fields: CheckoutFieldName[]
): CheckoutFieldErrors {
  const nextErrors = { ...errors };
  fields.forEach((field) => delete nextErrors[field]);
  return nextErrors;
}

function focusFirstError(errors: CheckoutFieldErrors) {
  const firstField = checkoutFieldOrder.find((field) => errors[field]);
  if (!firstField) return;
  window.requestAnimationFrame(() => document.getElementById(`checkout-${firstField}`)?.focus());
}

export default function CheckoutPage() {
  const { items, lines, isReady } = useCart();
  const [validatedCart, setValidatedCart] = useState<ValidatedCart | null>(null);
  const [deliveryMethod, setDeliveryMethod] =
    useState<CheckoutDeliveryMethod>("pickup");
  const [customer, setCustomer] = useState<CheckoutCustomerInput>({
    name: "",
    phone: "",
    email: "",
    cpf: ""
  });
  const [address, setAddress] = useState<CheckoutAddressInput>({
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
  const [postalCodeStatus, setPostalCodeStatus] =
    useState<PostalCodeLookupStatus>("idle");
  const [postalCodeMessage, setPostalCodeMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const checkoutAttempt = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const submissionLocked = useRef(false);
  const trackedCheckout = useRef(false);
  const postalCodeController = useRef<AbortController | null>(null);
  const postalCodeRequestSequence = useRef(0);
  const lastPostalCodeLookup = useRef("");

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
  const addressReviewLines = getCheckoutAddressLines(address);

  useEffect(() => {
    if (!isReady || apiItems.length === 0) return;

    const controller = new AbortController();
    setIsValidating(true);
    setCheckoutError("");

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
        setCheckoutError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível validar sua sacola."
        );
      })
      .finally(() => setIsValidating(false));

    return () => controller.abort();
  }, [apiItems, isReady, items]);

  const lookupPostalCode = useCallback(
    async (rawPostalCode: string, force = false) => {
      const postalCode = onlyDigits(rawPostalCode);
      if (deliveryMethod !== "shipping" || postalCode.length !== 8) return;
      if (!force && lastPostalCodeLookup.current === postalCode) return;

      lastPostalCodeLookup.current = postalCode;
      postalCodeController.current?.abort();
      const controller = new AbortController();
      postalCodeController.current = controller;
      const requestSequence = ++postalCodeRequestSequence.current;
      setPostalCodeStatus("loading");
      setPostalCodeMessage("Buscando endereço...");

      try {
        const response = await fetch("/api/address/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postalCode }),
          signal: controller.signal
        });
        const body = await response.json().catch(() => null);
        if (requestSequence !== postalCodeRequestSequence.current) return;

        if (!response.ok) {
          const code = responseCode(body);
          const unavailable = code === "postal_code_service_unavailable";
          setPostalCodeStatus(code === "postal_code_not_found" ? "not_found" : "error");
          setPostalCodeMessage(
            responseMessage(
              body,
              unavailable
                ? "Não foi possível consultar o CEP agora. Você pode continuar preenchendo o endereço manualmente."
                : "CEP não encontrado. Confira os números ou preencha o endereço manualmente."
            )
          );
          if (unavailable) lastPostalCodeLookup.current = "";
          return;
        }

        const result =
          body && typeof body === "object" && "address" in body && body.address
            ? body.address
            : null;
        if (!result || typeof result !== "object") {
          throw new Error("invalid_postal_code_response");
        }

        const street = "street" in result && typeof result.street === "string" ? result.street : "";
        const neighborhood =
          "neighborhood" in result && typeof result.neighborhood === "string"
            ? result.neighborhood
            : "";
        const city = "city" in result && typeof result.city === "string" ? result.city : "";
        const state = "state" in result && typeof result.state === "string" ? result.state : "";
        if (!city || !state) throw new Error("invalid_postal_code_response");

        setAddress((current) =>
          onlyDigits(current.postalCode) === postalCode
            ? {
                ...current,
                postalCode: formatPostalCode(postalCode),
                street,
                neighborhood,
                city,
                state
              }
            : current
        );
        setFieldErrors((current) =>
          removeFieldErrors(current, ["postalCode", "street", "neighborhood", "city", "state"])
        );
        checkoutAttempt.current = null;
        setPostalCodeStatus("success");
        setPostalCodeMessage(
          street && neighborhood
            ? "Endereço encontrado. Confira os dados e informe o número."
            : "CEP encontrado. Complete os campos de endereço que ficaram vazios."
        );
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        if (requestSequence !== postalCodeRequestSequence.current) return;
        lastPostalCodeLookup.current = "";
        setPostalCodeStatus("error");
        setPostalCodeMessage(
          "Não foi possível consultar o CEP agora. Você pode continuar preenchendo o endereço manualmente."
        );
      } finally {
        if (postalCodeController.current === controller) {
          postalCodeController.current = null;
        }
      }
    },
    [deliveryMethod]
  );

  useEffect(() => {
    const postalCode = onlyDigits(address.postalCode);

    if (deliveryMethod !== "shipping") {
      postalCodeController.current?.abort();
      setPostalCodeStatus("idle");
      setPostalCodeMessage("");
      return;
    }

    if (!postalCode) {
      postalCodeController.current?.abort();
      lastPostalCodeLookup.current = "";
      setPostalCodeStatus("idle");
      setPostalCodeMessage("");
      return;
    }

    if (postalCode.length < 8) {
      postalCodeController.current?.abort();
      lastPostalCodeLookup.current = "";
      setPostalCodeStatus("incomplete");
      setPostalCodeMessage("Digite os 8 números do CEP.");
      return;
    }

    const timeout = window.setTimeout(() => void lookupPostalCode(postalCode), 250);
    return () => window.clearTimeout(timeout);
  }, [address.postalCode, deliveryMethod, lookupPostalCode]);

  useEffect(
    () => () => {
      postalCodeController.current?.abort();
    },
    []
  );

  function resetAttempt() {
    checkoutAttempt.current = null;
  }

  function clearFieldError(field: CheckoutFieldName) {
    setFieldErrors((current) => (current[field] ? removeFieldErrors(current, [field]) : current));
  }

  function updateCustomerField(field: keyof CheckoutCustomerInput, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
    setCheckoutError("");
    resetAttempt();
  }

  function updateAddressField(field: keyof CheckoutAddressInput, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
    setCheckoutError("");
    resetAttempt();
  }

  async function calculateShipping() {
    if (isQuoting) return;

    const postalCode = onlyDigits(address.postalCode);
    if (postalCode.length !== 8) {
      const nextErrors = {
        ...fieldErrors,
        postalCode: "Informe um CEP válido com 8 números."
      };
      setFieldErrors(nextErrors);
      setShippingError("");
      focusFirstError(nextErrors);
      return;
    }

    setFieldErrors((current) => removeFieldErrors(current, ["postalCode", "shippingService"]));
    setShippingError("");
    setShippingOptions([]);
    setSelectedShippingId("");
    setIsQuoting(true);
    resetAttempt();

    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode, items: shippingItems })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseMessage(body, "Não foi possível calcular o frete."));
      }

      const options = (body?.options ?? []) as ShippingQuoteOption[];
      setShippingOptions(options);
      if (options.length === 0) {
        setShippingError(
          "Nenhuma modalidade autorizada está disponível para este CEP. Escolha retirada ou fale com a equipe."
        );
      }
    } catch (requestError) {
      setShippingError(
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
    if (!validatedCart || isValidating || submissionLocked.current) return;

    const nextErrors = validateCheckoutForm({
      customer,
      address,
      deliveryMethod,
      hasSelectedShipping: Boolean(selectedShipping)
    });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setCheckoutError("Revise os campos destacados antes de continuar.");
      focusFirstError(nextErrors);
      return;
    }

    const normalizedCustomer = normalizeCheckoutCustomer(customer);
    const normalizedAddress = normalizeCheckoutAddress(address);
    const delivery =
      deliveryMethod === "pickup"
        ? { method: "pickup" as const }
        : {
            method: "shipping" as const,
            address: {
              ...normalizedAddress,
              serviceId: selectedShipping!.serviceId,
              shippingQuoteId: selectedShipping!.shippingQuoteId
            }
          };
    const fingerprint = JSON.stringify({ apiItems, customer: normalizedCustomer, delivery });
    if (!checkoutAttempt.current || checkoutAttempt.current.fingerprint !== fingerprint) {
      checkoutAttempt.current = { fingerprint, requestId: crypto.randomUUID() };
    }

    submissionLocked.current = true;
    setCheckoutError("");
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
          customer: normalizedCustomer,
          delivery,
          analytics: getGoogleAnalyticsIdentifiers()
        })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getCheckoutRequestErrorMessage(
            responseCode(body),
            response.status,
            responseMessage(body, "Não foi possível iniciar o pagamento.")
          )
        );
      }
      if (!body?.checkoutUrl || typeof body.checkoutUrl !== "string") {
        throw new Error(getCheckoutRequestErrorMessage("infinitepay_link_error", 502));
      }

      window.location.assign(body.checkoutUrl);
    } catch (requestError) {
      setCheckoutError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível continuar para o pagamento."
      );
      submissionLocked.current = false;
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
          Escolha entrega ou retirada, confira os dados e siga para o ambiente seguro da
          InfinitePay.
        </p>
      </div>

      <form
        noValidate
        onSubmit={submitCheckout}
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start"
      >
        <div className="grid min-w-0 gap-6">
          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">1. Entrega</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">Como deseja receber?</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  value: "pickup" as const,
                  label: "Retirada na loja",
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
                      setCheckoutError("");
                      setShippingError("");
                      if (value === "pickup") {
                        setFieldErrors((current) =>
                          removeFieldErrors(current, [
                            "postalCode",
                            "street",
                            "number",
                            "neighborhood",
                            "city",
                            "state",
                            "shippingService"
                          ])
                        );
                      }
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

            <div className="mt-5 flex gap-3 rounded-md border border-gold/25 bg-gold/5 p-4 text-sm leading-6 text-taupe">
              <Clock3 className="mt-0.5 shrink-0 text-gold" size={19} />
              <p>
                <strong className="block text-ink">
                  {deliveryMethod === "pickup" ? "Prazo de confecção" : "Confecção"}: {JEWELRY_PRODUCTION_DEADLINE}
                </strong>
                {deliveryMethod === "pickup"
                  ? "Você será avisado quando o pedido estiver pronto para retirada."
                  : "O prazo de transporte é informado separadamente e começa após a confecção."}
              </p>
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
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <label htmlFor="checkout-postalCode" className="grid min-w-0 gap-2 text-sm font-medium text-ink">
                    CEP
                    <input
                      id="checkout-postalCode"
                      required
                      value={address.postalCode}
                      onChange={(event) => {
                        updateAddressField("postalCode", formatPostalCode(event.target.value));
                        setShippingOptions([]);
                        setSelectedShippingId("");
                        setShippingError("");
                        clearFieldError("shippingService");
                      }}
                      onBlur={() => {
                        const postalCode = onlyDigits(address.postalCode);
                        if (postalCode.length > 0 && postalCode.length < 8) {
                          setPostalCodeStatus("incomplete");
                          setPostalCodeMessage("Digite os 8 números do CEP.");
                        } else if (postalCode.length === 8 && postalCodeStatus === "error") {
                          void lookupPostalCode(postalCode, true);
                        }
                      }}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={9}
                      placeholder="00000-000"
                      aria-invalid={Boolean(fieldErrors.postalCode)}
                      aria-describedby={
                        [
                          fieldErrors.postalCode ? "checkout-postalCode-error" : "",
                          postalCodeMessage ? "checkout-postalCode-status" : ""
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                      className={getFieldClass(Boolean(fieldErrors.postalCode))}
                    />
                    <FieldError field="postalCode" errors={fieldErrors} />
                    {postalCodeMessage ? (
                      <span
                        id="checkout-postalCode-status"
                        className={`flex items-center gap-1.5 text-xs font-normal ${
                          postalCodeStatus === "success" ? "text-green-700" : "text-taupe"
                        }`}
                        role={postalCodeStatus === "loading" || postalCodeStatus === "success" ? "status" : "alert"}
                        aria-live="polite"
                      >
                        {postalCodeStatus === "loading" ? (
                          <LoaderCircle className="shrink-0 animate-spin motion-reduce:animate-none" size={14} />
                        ) : postalCodeStatus === "success" ? (
                          <CheckCircle2 className="shrink-0" size={14} />
                        ) : null}
                        {postalCodeMessage}
                      </span>
                    ) : null}
                  </label>
                  <button
                    id="checkout-shippingService"
                    type="button"
                    onClick={calculateShipping}
                    disabled={isQuoting || shippingItems.length === 0}
                    aria-busy={isQuoting}
                    aria-describedby={fieldErrors.shippingService ? "checkout-shippingService-error" : undefined}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-ink bg-white px-5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:mt-7"
                  >
                    {isQuoting ? (
                      <LoaderCircle className="animate-spin motion-reduce:animate-none" size={17} />
                    ) : (
                      <Truck size={17} />
                    )}
                    {isQuoting ? "Calculando..." : "Calcular frete"}
                  </button>
                </div>

                {shippingOptions.length > 0 ? (
                  <fieldset className="grid gap-2">
                    <legend className="sr-only">Modalidades de frete</legend>
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
                            type="radio"
                            name="shipping"
                            value={option.shippingQuoteId}
                            checked={selectedShippingId === option.shippingQuoteId}
                            onChange={() => {
                              setSelectedShippingId(option.shippingQuoteId);
                              clearFieldError("shippingService");
                              setCheckoutError("");
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
                              Transporte: até {option.deliveryTimeDays} dias úteis
                            </span>
                          </span>
                        </span>
                        <strong className="shrink-0 text-ink">
                          {formatCurrency(option.priceCents / 100)}
                        </strong>
                      </label>
                    ))}
                  </fieldset>
                ) : null}

                <FieldError field="shippingService" errors={fieldErrors} />
                {shippingError ? (
                  <p
                    className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                    role="alert"
                  >
                    {shippingError}
                  </p>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label htmlFor="checkout-street" className="grid gap-2 text-sm font-medium text-ink sm:col-span-2">
                    Rua
                    <input
                      id="checkout-street"
                      required
                      autoComplete="address-line1"
                      value={address.street}
                      onChange={(event) => updateAddressField("street", event.target.value)}
                      aria-invalid={Boolean(fieldErrors.street)}
                      aria-describedby={fieldErrors.street ? "checkout-street-error" : undefined}
                      className={getFieldClass(Boolean(fieldErrors.street))}
                    />
                    <FieldError field="street" errors={fieldErrors} />
                  </label>
                  <label htmlFor="checkout-number" className="grid gap-2 text-sm font-medium text-ink">
                    Número
                    <input
                      id="checkout-number"
                      required
                      autoComplete="address-line2"
                      value={address.number}
                      onChange={(event) => updateAddressField("number", event.target.value)}
                      aria-invalid={Boolean(fieldErrors.number)}
                      aria-describedby={fieldErrors.number ? "checkout-number-error" : undefined}
                      className={getFieldClass(Boolean(fieldErrors.number))}
                    />
                    <FieldError field="number" errors={fieldErrors} />
                  </label>
                  <label htmlFor="checkout-complement" className="grid gap-2 text-sm font-medium text-ink">
                    Complemento <span className="font-normal text-taupe">(opcional)</span>
                    <input
                      id="checkout-complement"
                      autoComplete="address-line3"
                      value={address.complement}
                      onChange={(event) => updateAddressField("complement", event.target.value)}
                      className={getFieldClass(false)}
                    />
                  </label>
                  <label htmlFor="checkout-neighborhood" className="grid gap-2 text-sm font-medium text-ink">
                    Bairro
                    <input
                      id="checkout-neighborhood"
                      required
                      value={address.neighborhood}
                      onChange={(event) => updateAddressField("neighborhood", event.target.value)}
                      aria-invalid={Boolean(fieldErrors.neighborhood)}
                      aria-describedby={fieldErrors.neighborhood ? "checkout-neighborhood-error" : undefined}
                      className={getFieldClass(Boolean(fieldErrors.neighborhood))}
                    />
                    <FieldError field="neighborhood" errors={fieldErrors} />
                  </label>
                  <label htmlFor="checkout-city" className="grid gap-2 text-sm font-medium text-ink">
                    Cidade
                    <input
                      id="checkout-city"
                      required
                      autoComplete="address-level2"
                      value={address.city}
                      onChange={(event) => updateAddressField("city", event.target.value)}
                      aria-invalid={Boolean(fieldErrors.city)}
                      aria-describedby={fieldErrors.city ? "checkout-city-error" : undefined}
                      className={getFieldClass(Boolean(fieldErrors.city))}
                    />
                    <FieldError field="city" errors={fieldErrors} />
                  </label>
                  <label htmlFor="checkout-state" className="grid gap-2 text-sm font-medium text-ink">
                    Estado
                    <input
                      id="checkout-state"
                      required
                      autoComplete="address-level1"
                      value={address.state}
                      onChange={(event) =>
                        updateAddressField(
                          "state",
                          event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase()
                        )
                      }
                      maxLength={2}
                      placeholder="SP"
                      aria-invalid={Boolean(fieldErrors.state)}
                      aria-describedby={fieldErrors.state ? "checkout-state-error" : undefined}
                      className={`${getFieldClass(Boolean(fieldErrors.state))} uppercase`}
                    />
                    <FieldError field="state" errors={fieldErrors} />
                  </label>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">2. Seus dados</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">Dados para o pedido</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label htmlFor="checkout-name" className="grid gap-2 text-sm font-medium text-ink sm:col-span-2">
                Nome completo
                <input
                  id="checkout-name"
                  required
                  autoComplete="name"
                  value={customer.name}
                  onChange={(event) => updateCustomerField("name", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "checkout-name-error" : undefined}
                  className={getFieldClass(Boolean(fieldErrors.name))}
                />
                <FieldError field="name" errors={fieldErrors} />
              </label>
              <label htmlFor="checkout-phone" className="grid gap-2 text-sm font-medium text-ink">
                WhatsApp
                <input
                  id="checkout-phone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={customer.phone}
                  onChange={(event) =>
                    updateCustomerField("phone", formatBrazilianPhone(event.target.value))
                  }
                  maxLength={15}
                  placeholder="(11) 99999-9999"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? "checkout-phone-error" : undefined}
                  className={getFieldClass(Boolean(fieldErrors.phone))}
                />
                <FieldError field="phone" errors={fieldErrors} />
              </label>
              <label htmlFor="checkout-email" className="grid gap-2 text-sm font-medium text-ink">
                E-mail
                <input
                  id="checkout-email"
                  required
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={customer.email}
                  onChange={(event) => updateCustomerField("email", event.target.value)}
                  onBlur={(event) =>
                    updateCustomerField("email", event.currentTarget.value.trim().toLowerCase())
                  }
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "checkout-email-error" : undefined}
                  className={getFieldClass(Boolean(fieldErrors.email))}
                />
                <FieldError field="email" errors={fieldErrors} />
              </label>
              <label htmlFor="checkout-cpf" className="grid gap-2 text-sm font-medium text-ink">
                CPF <span className="font-normal text-taupe">(opcional)</span>
                <input
                  id="checkout-cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  value={customer.cpf}
                  onChange={(event) => updateCustomerField("cpf", formatCpf(event.target.value))}
                  maxLength={14}
                  placeholder="000.000.000-00"
                  aria-invalid={Boolean(fieldErrors.cpf)}
                  aria-describedby={fieldErrors.cpf ? "checkout-cpf-error" : undefined}
                  className={getFieldClass(Boolean(fieldErrors.cpf))}
                />
                <FieldError field="cpf" errors={fieldErrors} />
              </label>
            </div>
          </section>
        </div>

        <aside className="h-fit min-w-0 rounded-lg border border-black/10 bg-white p-5 shadow-sm lg:sticky lg:top-28">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">3. Resumo</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">Seu pedido</h2>
          <div className="mt-5 grid gap-4">
            {items.map((item, index) => {
              const validatedItem = validatedCart?.items[index];
              const unitPriceCents =
                validatedItem?.unitPriceCents ?? Math.round((item.product.price ?? 0) * 100);
              const itemSubtotalCents =
                validatedItem?.subtotalCents ?? unitPriceCents * item.quantity;
              const customization = validatedItem?.customization ?? item.customization;

              return (
                <article
                  key={item.lineId}
                  className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-black/10 pb-4"
                >
                  <div className="relative aspect-square overflow-hidden rounded-md bg-champagne">
                    <ProductImage
                      src={validatedItem?.image ?? item.product.images[0]}
                      alt={validatedItem?.name ?? item.product.name}
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif text-sm font-semibold leading-5 text-ink">
                      {validatedItem?.name ?? item.product.name}
                    </p>
                    <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-taupe">
                      <span>
                        {item.quantity}x {formatCurrency(unitPriceCents / 100)}
                      </span>
                      <strong className="font-semibold text-ink">
                        {formatCurrency(itemSubtotalCents / 100)}
                      </strong>
                    </div>
                    {customization?.type === "ring_pair" ? (
                      <dl className="mt-3 grid gap-2 rounded-md bg-pearl p-3 text-xs leading-5">
                        {[
                          { label: "Aliança 1", ring: customization.ring1 },
                          { label: "Aliança 2", ring: customization.ring2 }
                        ].map(({ label, ring }) => (
                          <div key={label} className="grid gap-0.5">
                            <dt className="font-semibold text-ink">{label}</dt>
                            <dd className="text-taupe">Aro: {ring.size}</dd>
                            <dd className="break-words text-taupe">
                              Gravação: {ring.engraving?.trim() || "Sem gravação"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 rounded-md border border-black/10 bg-pearl p-4 text-sm leading-6">
            <div className="flex gap-3">
              {deliveryMethod === "pickup" ? (
                <PackageCheck className="mt-0.5 shrink-0 text-gold" size={18} />
              ) : (
                <MapPin className="mt-0.5 shrink-0 text-gold" size={18} />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {deliveryMethod === "pickup" ? "Retirada na loja" : "Entrega para:"}
                </p>
                {deliveryMethod === "shipping" ? (
                  addressReviewLines.length > 0 ? (
                    <address className="mt-1 not-italic text-taupe">
                      {addressReviewLines.map((line) => (
                        <span key={line} className="block break-words">
                          {line}
                        </span>
                      ))}
                    </address>
                  ) : (
                    <p className="mt-1 text-taupe">Preencha o endereço de entrega.</p>
                  )
                ) : null}
              </div>
            </div>
            <dl className="mt-3 grid gap-1 border-t border-black/10 pt-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-taupe">Confecção</dt>
                <dd className="text-right font-medium text-ink">{JEWELRY_PRODUCTION_DEADLINE}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-taupe">
                  {deliveryMethod === "pickup" ? "Retirada" : "Transporte"}
                </dt>
                <dd className="text-right font-medium text-ink">
                  {deliveryMethod === "pickup"
                    ? "Após confirmação de pedido pronto"
                    : selectedShipping
                      ? `Até ${selectedShipping.deliveryTimeDays} dias úteis`
                      : "Selecione uma modalidade"}
                </dd>
              </div>
            </dl>
          </div>

          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-taupe">Subtotal</dt>
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

          <div className="mt-5 flex gap-3 rounded-md border border-gold/20 bg-gold/5 p-4 text-xs leading-5 text-taupe">
            <CreditCard className="shrink-0 text-gold" size={18} />
            <div>
              <p className="font-semibold text-ink">
                {PRODUCT_PAGE_PIX_DISCOUNT_PERCENT}% OFF no Pix
              </p>
              <p className="mt-0.5">Até {PRODUCT_PAGE_INSTALLMENTS_COUNT}x no cartão</p>
              <p className="mt-2 text-[11px] leading-4">
                As condições e o valor final são confirmados no ambiente seguro da InfinitePay.
              </p>
            </div>
          </div>

          {checkoutError ? (
            <p
              className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
              aria-live="assertive"
            >
              {checkoutError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || isValidating || !validatedCart}
            aria-busy={isSubmitting}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <LoaderCircle className="animate-spin motion-reduce:animate-none" size={18} />
            ) : (
              <Check size={18} />
            )}
            {isSubmitting ? "Preparando pagamento..." : "Continuar para pagamento"}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-taupe">
            O pagamento é concluído no ambiente seguro da InfinitePay.
          </p>
        </aside>
      </form>
    </section>
  );
}
