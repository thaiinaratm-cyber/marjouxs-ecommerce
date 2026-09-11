import type { CartItem, Product } from "@/types/product";

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category: string;
  item_category2?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
};

export type AnalyticsParamValue = string | number | boolean | AnalyticsItem[] | undefined;
export type AnalyticsParams = Record<string, AnalyticsParamValue>;

export type AnalyticsEventSpec = {
  name: string;
  params?: AnalyticsParams;
};

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function isGoogleAnalyticsConfigured() {
  return /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID);
}

function compactParams(params: AnalyticsParams = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  );
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  if (!isGoogleAnalyticsConfigured() || typeof window === "undefined" || typeof window.gtag !== "function") {
    return false;
  }

  window.gtag("event", eventName, compactParams(params));
  return true;
}

export function trackEvents(events: AnalyticsEventSpec | AnalyticsEventSpec[]) {
  const eventList = Array.isArray(events) ? events : [events];
  eventList.forEach((event) => trackEvent(event.name, event.params));
}

export function getAnalyticsItem(product: Product, quantity?: number): AnalyticsItem {
  return {
    item_id: product.id,
    item_name: product.name,
    item_category: product.category,
    ...(product.subcategory ? { item_category2: product.subcategory } : {}),
    ...(product.material ? { item_variant: product.material } : {}),
    ...(typeof product.price === "number" ? { price: product.price } : {}),
    ...(typeof quantity === "number" ? { quantity } : {})
  };
}

function getProductValue(product: Product, quantity = 1) {
  return typeof product.price === "number" ? product.price * quantity : undefined;
}

export function createSelectItemEvent(product: Product, itemListName: string, source: string): AnalyticsEventSpec {
  return {
    name: "select_item",
    params: {
      item_list_name: itemListName,
      source,
      items: [getAnalyticsItem(product)]
    }
  };
}

export function createCategoryClickEvent(
  categoryName: string,
  source: string,
  destination: string
): AnalyticsEventSpec {
  return {
    name: "category_click",
    params: {
      category_name: categoryName,
      source,
      destination
    }
  };
}

export function createWhatsappClickEvent(location: string, product?: Product): AnalyticsEventSpec {
  return {
    name: "whatsapp_click",
    params: {
      location,
      ...(product
        ? {
            item_id: product.id,
            item_name: product.name,
            item_category: product.category,
            value: getProductValue(product)
          }
        : {})
    }
  };
}

export function createDirectionsClickEvent(location: string): AnalyticsEventSpec {
  return {
    name: "directions_click",
    params: { location }
  };
}

export function createSizeGuideClickEvent(
  location: string,
  product?: Product
): AnalyticsEventSpec {
  return {
    name: "size_guide_click",
    params: {
      location,
      ...(product ? { item_id: product.id, item_name: product.name } : {})
    }
  };
}

export function createContactClickEvent(
  method: "whatsapp" | "instagram" | "email" | "directions",
  location = "contact"
): AnalyticsEventSpec {
  return {
    name: "contact_click",
    params: {
      method,
      location
    }
  };
}

export function createServiceContactClickEvent(
  location: string,
  serviceName?: string
): AnalyticsEventSpec {
  return {
    name: "service_contact_click",
    params: {
      location,
      destination: "whatsapp",
      service_name: serviceName
    }
  };
}

export function trackPageView(pathname: string, pageTitle?: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return trackEvent("page_view", {
    page_path: pathname,
    page_location: window.location.origin + pathname,
    page_title: pageTitle
  });
}

export function trackViewItem(product: Product) {
  return trackEvent("view_item", {
    currency: "BRL",
    value: getProductValue(product),
    items: [getAnalyticsItem(product)]
  });
}

export function trackSelectItem(product: Product, itemListName: string, source: string) {
  const event = createSelectItemEvent(product, itemListName, source);
  return trackEvent(event.name, event.params);
}

export function trackViewItemList(products: Product[], itemListName: string, source: string) {
  return trackEvent("view_item_list", {
    item_list_name: itemListName,
    source,
    items: products.slice(0, 200).map((product) => getAnalyticsItem(product))
  });
}

export function trackViewCategory(categoryName: string, source = "category_page") {
  return trackEvent("view_category", {
    category_name: categoryName,
    source
  });
}

export function trackCategoryClick(categoryName: string, source: string, destination: string) {
  const event = createCategoryClickEvent(categoryName, source, destination);
  return trackEvent(event.name, event.params);
}

function containsPotentialPersonalData(value: string) {
  const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
  const digitCount = value.replace(/\D/g, "").length;
  return emailPattern.test(value) || digitCount >= 8;
}

export function trackSearch(searchTerm: string, source: string) {
  const normalizedTerm = searchTerm.trim().slice(0, 100);

  if (!normalizedTerm || containsPotentialPersonalData(normalizedTerm)) {
    return false;
  }

  return trackEvent("search", {
    search_term: normalizedTerm,
    source
  });
}

export function trackWhatsappClick(location: string, product?: Product) {
  const event = createWhatsappClickEvent(location, product);
  return trackEvent(event.name, event.params);
}

export function trackDirectionsClick(location: string) {
  const event = createDirectionsClickEvent(location);
  return trackEvent(event.name, event.params);
}

export function trackSizeGuideClick(location: string, product?: Product) {
  const event = createSizeGuideClickEvent(location, product);
  return trackEvent(event.name, event.params);
}

export function trackContactClick(
  method: "whatsapp" | "instagram" | "email" | "directions",
  location = "contact"
) {
  const event = createContactClickEvent(method, location);
  return trackEvent(event.name, event.params);
}

export function trackServiceContactClick(location: string, serviceName?: string) {
  const event = createServiceContactClickEvent(location, serviceName);
  return trackEvent(event.name, event.params);
}

function getCartPayload(items: CartItem[]) {
  return {
    currency: "BRL",
    value: items.reduce(
      (total, item) => total + (typeof item.product.price === "number" ? item.product.price * item.quantity : 0),
      0
    ),
    items: items.map((item) => getAnalyticsItem(item.product, item.quantity))
  };
}

export function trackAddToCart(product: Product, quantity = 1) {
  return trackEvent("add_to_cart", {
    currency: "BRL",
    value: getProductValue(product, quantity),
    items: [getAnalyticsItem(product, quantity)]
  });
}

export function trackViewCart(items: CartItem[]) {
  return trackEvent("view_cart", getCartPayload(items));
}

export function trackRemoveFromCart(product: Product, quantity = 1) {
  return trackEvent("remove_from_cart", {
    currency: "BRL",
    value: getProductValue(product, quantity),
    items: [getAnalyticsItem(product, quantity)]
  });
}

export function trackBeginCheckout(items: CartItem[]) {
  return trackEvent("begin_checkout", getCartPayload(items));
}

export function trackAddPaymentInfo(items: CartItem[], paymentType: string) {
  return trackEvent("add_payment_info", {
    ...getCartPayload(items),
    payment_type: paymentType
  });
}

export function trackAddShippingInfo(items: CartItem[], shippingTier: string) {
  return trackEvent("add_shipping_info", {
    ...getCartPayload(items),
    shipping_tier: shippingTier
  });
}

export function getGoogleAnalyticsIdentifiers() {
  if (typeof document === "undefined") {
    return { clientId: null, sessionId: null };
  }

  const cookies = Object.fromEntries(
    document.cookie.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return [];
      return [[part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1))]];
    })
  );
  const gaParts = cookies._ga?.split(".") ?? [];
  const clientId = gaParts.length >= 4 ? gaParts.slice(-2).join(".") : null;
  const sessionCookieName = Object.keys(cookies).find((name) => name.startsWith("_ga_"));
  const sessionCookie = sessionCookieName ? cookies[sessionCookieName] : "";
  const sessionMatch = sessionCookie.match(/(?:^|\.)s(\d+)(?:\.|$)/) ?? sessionCookie.match(/^GS\d\.\d\.(\d+)/);

  return {
    clientId,
    sessionId: sessionMatch?.[1] ?? null
  };
}

export function trackPurchase(transactionId: string, items: CartItem[]) {
  const normalizedTransactionId = transactionId.trim();

  if (!normalizedTransactionId || typeof window === "undefined") {
    return false;
  }

  const storageKey = "marjouxs-ga4-purchase-" + normalizedTransactionId;

  try {
    if (window.localStorage.getItem(storageKey)) {
      return false;
    }
  } catch {
    // Analytics remains functional when browser storage is unavailable.
  }

  const tracked = trackEvent("purchase", {
    transaction_id: normalizedTransactionId,
    ...getCartPayload(items)
  });

  if (tracked) {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // The GA4 transaction_id still supports server-side deduplication.
    }
  }

  return tracked;
}
