export type CheckoutDeliveryMethod = "pickup" | "shipping";

export type CheckoutCustomerInput = {
  name: string;
  phone: string;
  email: string;
  cpf: string;
};

export type CheckoutAddressInput = {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type CheckoutFieldName =
  | keyof CheckoutCustomerInput
  | keyof CheckoutAddressInput
  | "shippingService";

export type CheckoutFieldErrors = Partial<Record<CheckoutFieldName, string>>;

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeBrazilianPhoneDigits(value: string) {
  let digits = onlyDigits(value);
  if (digits.length > 11 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

export function formatBrazilianPhone(value: string) {
  const digits = normalizeBrazilianPhoneDigits(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;

  const areaCode = digits.slice(0, 2);
  const localNumber = digits.slice(2);
  if (localNumber.length <= 4) return `(${areaCode}) ${localNumber}`;

  const prefixLength = digits.length === 11 ? 5 : 4;
  return `(${areaCode}) ${localNumber.slice(0, prefixLength)}-${localNumber.slice(prefixLength)}`;
}

export function formatPostalCode(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function normalizeCheckoutCustomer(customer: CheckoutCustomerInput) {
  return {
    name: customer.name.trim(),
    phone: normalizeBrazilianPhoneDigits(customer.phone),
    email: customer.email.trim().toLowerCase(),
    cpf: onlyDigits(customer.cpf)
  };
}

export function normalizeCheckoutAddress(address: CheckoutAddressInput) {
  return {
    postalCode: onlyDigits(address.postalCode),
    street: address.street.trim(),
    number: address.number.trim(),
    complement: address.complement.trim(),
    neighborhood: address.neighborhood.trim(),
    city: address.city.trim(),
    state: address.state.trim().toUpperCase()
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateCheckoutForm({
  customer,
  address,
  deliveryMethod,
  hasSelectedShipping
}: {
  customer: CheckoutCustomerInput;
  address: CheckoutAddressInput;
  deliveryMethod: CheckoutDeliveryMethod;
  hasSelectedShipping: boolean;
}) {
  const errors: CheckoutFieldErrors = {};
  const normalizedCustomer = normalizeCheckoutCustomer(customer);

  if (!normalizedCustomer.name) {
    errors.name = "Informe seu nome.";
  }

  if (![10, 11].includes(normalizedCustomer.phone.length)) {
    errors.phone = "Informe um WhatsApp válido.";
  }

  if (!isValidEmail(normalizedCustomer.email)) {
    errors.email = "Informe um e-mail válido.";
  }

  if (normalizedCustomer.cpf && normalizedCustomer.cpf.length !== 11) {
    errors.cpf = "Informe um CPF válido com 11 números.";
  }

  if (deliveryMethod === "shipping") {
    const normalizedAddress = normalizeCheckoutAddress(address);
    if (!/^\d{8}$/.test(normalizedAddress.postalCode)) {
      errors.postalCode = "Informe um CEP válido com 8 números.";
    }
    if (!normalizedAddress.street) errors.street = "Informe a rua.";
    if (!normalizedAddress.number) errors.number = "Informe o número.";
    if (!normalizedAddress.neighborhood) errors.neighborhood = "Informe o bairro.";
    if (!normalizedAddress.city) errors.city = "Informe a cidade.";
    if (!/^[A-Z]{2}$/.test(normalizedAddress.state)) {
      errors.state = "Informe a sigla do estado com 2 letras.";
    }
    if (!hasSelectedShipping) {
      errors.shippingService = "Calcule e selecione uma modalidade de frete.";
    }
  }

  return errors;
}

export function getCheckoutAddressLines(address: CheckoutAddressInput) {
  const normalized = normalizeCheckoutAddress(address);
  const lines = [
    normalized.street
      ? `${normalized.street}${normalized.number ? `, nº ${normalized.number}` : ""}`
      : "",
    normalized.complement,
    normalized.neighborhood,
    normalized.city && normalized.state
      ? `${normalized.city} - ${normalized.state}`
      : normalized.city || normalized.state,
    normalized.postalCode ? `CEP ${formatPostalCode(normalized.postalCode)}` : ""
  ];

  return lines.filter(Boolean);
}

export function getCheckoutRequestErrorMessage(
  code: unknown,
  status: number,
  fallback?: string
) {
  switch (code) {
    case "checkout_validation_error":
      return "Revise os dados do pedido e tente novamente.";
    case "checkout_order_creation_error":
      return "Não foi possível criar o pedido agora. Tente novamente.";
    case "checkout_payment_attempt_error":
      return "Não foi possível preparar o pagamento agora. Tente novamente.";
    case "infinitepay_link_error":
      return "O pedido foi criado, mas o ambiente de pagamento não pôde ser aberto agora. Tente novamente.";
    default:
      if (status >= 500) {
        return "O serviço está temporariamente indisponível. Tente novamente em instantes.";
      }
      return fallback || "Não foi possível continuar para o pagamento.";
  }
}
