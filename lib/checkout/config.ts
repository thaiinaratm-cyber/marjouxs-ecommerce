const DEFAULT_INFINITEPAY_BASE_URL = "https://api.checkout.infinitepay.io";
const DEFAULT_MELHOR_ENVIO_BASE_URL = "https://sandbox.melhorenvio.com.br";

export const DEFAULT_SHIPMENT_WEIGHT_KG = 0.3;
export const DEFAULT_SHIPMENT_LENGTH_CM = 16;
export const DEFAULT_SHIPMENT_WIDTH_CM = 12;
export const DEFAULT_SHIPMENT_HEIGHT_CM = 6;

export class CheckoutConfigurationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "CheckoutConfigurationError";
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new CheckoutConfigurationError(`A variável ${name} não está configurada.`, "missing_configuration");
  }
  return value;
}

function positiveNumber(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();
  const value = rawValue ? Number(rawValue) : fallback;
  if (!Number.isFinite(value) || value <= 0) {
    throw new CheckoutConfigurationError(`A variável ${name} é inválida.`, "invalid_configuration");
  }
  return value;
}

function baseUrl(name: string, fallback: string) {
  const value = process.env[name]?.trim() || fallback;
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new CheckoutConfigurationError(`A variável ${name} não contém uma URL válida.`, "invalid_configuration");
  }
}

function absoluteUrl(name: string) {
  const value = requiredEnvironment(name);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new CheckoutConfigurationError(`A variável ${name} não contém uma URL válida.`, "invalid_configuration");
  }
}

export function getSupabaseConfiguration() {
  return {
    url: requiredEnvironment("SUPABASE_URL"),
    serviceRoleKey: requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY")
  };
}

export function getInfinitePayConfiguration() {
  return {
    handle: process.env.INFINITEPAY_HANDLE?.trim() || "marjouxsjoias",
    baseUrl: baseUrl("INFINITEPAY_BASE_URL", DEFAULT_INFINITEPAY_BASE_URL)
  };
}

export function getShippingConfiguration() {
  const allowedServiceIds = (process.env.MELHOR_ENVIO_ALLOWED_JEWELRY_SERVICE_IDS ?? "")
    .split(",")
    .map((serviceId) => serviceId.trim())
    .filter(Boolean);

  if (allowedServiceIds.length === 0) {
    throw new CheckoutConfigurationError(
      "Nenhuma modalidade de envio para joias foi autorizada.",
      "shipping_allowlist_empty"
    );
  }

  const originZip = (process.env.MARJOUXS_ORIGIN_ZIP?.trim() || "07400610").replace(/\D/g, "");
  if (!/^\d{8}$/.test(originZip)) {
    throw new CheckoutConfigurationError("O CEP de origem da Marjouxs é inválido.", "invalid_configuration");
  }

  return {
    baseUrl: baseUrl("MELHOR_ENVIO_BASE_URL", DEFAULT_MELHOR_ENVIO_BASE_URL),
    userAgent: requiredEnvironment("MELHOR_ENVIO_USER_AGENT"),
    allowedServiceIds,
    originZip,
    package: {
      weightKg: positiveNumber("DEFAULT_SHIPMENT_WEIGHT_KG", DEFAULT_SHIPMENT_WEIGHT_KG),
      lengthCm: positiveNumber("DEFAULT_SHIPMENT_LENGTH_CM", DEFAULT_SHIPMENT_LENGTH_CM),
      widthCm: positiveNumber("DEFAULT_SHIPMENT_WIDTH_CM", DEFAULT_SHIPMENT_WIDTH_CM),
      heightCm: positiveNumber("DEFAULT_SHIPMENT_HEIGHT_CM", DEFAULT_SHIPMENT_HEIGHT_CM)
    }
  };
}

export function getMelhorEnvioOAuthConfiguration() {
  return {
    clientId: requiredEnvironment("MELHOR_ENVIO_CLIENT_ID"),
    clientSecret: requiredEnvironment("MELHOR_ENVIO_CLIENT_SECRET"),
    baseUrl: baseUrl("MELHOR_ENVIO_BASE_URL", DEFAULT_MELHOR_ENVIO_BASE_URL),
    redirectUri: absoluteUrl("MELHOR_ENVIO_REDIRECT_URI"),
    userAgent: requiredEnvironment("MELHOR_ENVIO_USER_AGENT")
  };
}

export function getMelhorEnvioOAuthSetupKey() {
  const setupKey = requiredEnvironment("MELHOR_ENVIO_OAUTH_SETUP_KEY");
  if (setupKey.length < 32) {
    throw new CheckoutConfigurationError(
      "A variável MELHOR_ENVIO_OAUTH_SETUP_KEY deve ter pelo menos 32 caracteres.",
      "invalid_configuration"
    );
  }
  return setupKey;
}

export function getPublicSiteUrl(fallback?: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return baseUrl("NEXT_PUBLIC_SITE_URL", configured || fallback || "http://localhost:3000");
}

export function getGa4ServerConfiguration() {
  return {
    measurementId: requiredEnvironment("NEXT_PUBLIC_GA_MEASUREMENT_ID"),
    apiSecret: requiredEnvironment("GA4_API_SECRET")
  };
}
