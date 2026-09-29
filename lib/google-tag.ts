import { GA_MEASUREMENT_ID, isGoogleAnalyticsConfigured } from "@/lib/analytics";

export const GOOGLE_ADS_TAG_ID = "AW-18482833340";
export const GOOGLE_ADS_PURCHASE_DESTINATION = "AW-18482833340/t-gCCNS624odELzPpu1E";
export const GOOGLE_TAG_READY_EVENT = "marjouxs:google-tag-ready";
export const GOOGLE_TAG_SCRIPT_URL =
  "https://www.googletagmanager.com/gtag/js?id=" +
  (isGoogleAnalyticsConfigured() ? GA_MEASUREMENT_ID : GOOGLE_ADS_TAG_ID);

declare global {
  interface Window {
    marjouxsGoogleTagInitialized?: boolean;
    marjouxsGoogleTagReady?: boolean;
  }
}

// Preserve attribution without sending order-access tokens or arbitrary query data.
const attributionParameters = [
  "gclid", "gbraid", "wbraid", "gclsrc", "_gl",
  "utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_term", "utm_content"
];

export function getGoogleTrackingUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const query = new URLSearchParams();
    for (const key of attributionParameters) {
      const parameter = url.searchParams.get(key);
      if (parameter) query.set(key, parameter);
    }
    const suffix = query.toString();
    return url.origin + url.pathname + (suffix ? "?" + suffix : "");
  } catch {
    return "";
  }
}

export function getGooglePageContext() {
  return {
    page_location: getGoogleTrackingUrl(window.location.href),
    page_referrer: getGoogleTrackingUrl(document.referrer)
  };
}

export function updateGooglePageContext() {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("set", getGooglePageContext());
  }
}

export function initializeGoogleTag() {
  if (typeof window === "undefined") return false;
  if (window.marjouxsGoogleTagInitialized) return true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  updateGooglePageContext();

  if (isGoogleAnalyticsConfigured()) {
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
      debug_mode: process.env.NODE_ENV === "development"
    });
  }
  window.gtag("config", GOOGLE_ADS_TAG_ID);
  window.marjouxsGoogleTagInitialized = true;
  return true;
}

export function markGoogleTagReady() {
  window.marjouxsGoogleTagReady = true;
  window.dispatchEvent(new Event(GOOGLE_TAG_READY_EVENT));
}