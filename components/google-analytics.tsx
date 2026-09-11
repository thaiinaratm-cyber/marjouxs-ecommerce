"use client";

import Script from "next/script";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  GA_MEASUREMENT_ID,
  isGoogleAnalyticsConfigured,
  trackPageView
} from "@/lib/analytics";

let lastTrackedNavigation = "";

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    const navigationKey = pathname + "?" + searchParamsKey;

    if (lastTrackedNavigation === navigationKey) {
      return;
    }

    lastTrackedNavigation = navigationKey;
    trackPageView(pathname, document.title);
  }, [pathname, searchParamsKey]);

  return null;
}

export function GoogleAnalytics() {
  const [isReady, setIsReady] = useState(false);

  if (!isGoogleAnalyticsConfigured()) {
    return null;
  }

  const debugMode = process.env.NODE_ENV === "development";
  const bootstrapScript = [
    "window.dataLayer = window.dataLayer || [];",
    "window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};",
    "window.gtag('js', new Date());",
    "window.gtag('config', " +
      JSON.stringify(GA_MEASUREMENT_ID) +
      ", { send_page_view: false, debug_mode: " +
      String(debugMode) +
      " });"
  ].join("\n");

  return (
    <>
      <Script id="ga4-bootstrap" strategy="afterInteractive">
        {bootstrapScript}
      </Script>
      <Script
        id="ga4-script"
        src={"https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID}
        strategy="afterInteractive"
        onReady={() => setIsReady(true)}
      />
      {isReady ? (
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
      ) : null}
    </>
  );
}
