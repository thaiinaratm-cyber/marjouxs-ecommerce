"use client";

import Script from "next/script";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics";
import {
  GOOGLE_TAG_SCRIPT_URL,
  initializeGoogleTag,
  markGoogleTagReady,
  updateGooglePageContext
} from "@/lib/google-tag";

let lastTrackedNavigation = "";

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    const navigationKey = pathname + "?" + searchParamsKey;

    if (lastTrackedNavigation === navigationKey) return;

    lastTrackedNavigation = navigationKey;
    updateGooglePageContext();
    trackPageView(pathname, document.title);
  }, [pathname, searchParamsKey]);

  return null;
}

export function GoogleAnalytics() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsInitialized(initializeGoogleTag());
  }, []);

  if (!isInitialized) return null;

  return (
    <>
      <Script
        id="ga4-script"
        src={GOOGLE_TAG_SCRIPT_URL}
        strategy="afterInteractive"
        onReady={() => {
          markGoogleTagReady();
          setIsReady(true);
        }}
      />
      {isReady ? (
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
      ) : null}
    </>
  );
}