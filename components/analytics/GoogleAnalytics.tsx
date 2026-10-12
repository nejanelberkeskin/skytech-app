"use client";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GA_MEASUREMENT_ID, ANALYTICS_TRANSFER_READY, analyticsAllowedPath, readConsent, subscribeConsent, stopAnalytics } from "@/lib/analytics";
import { GA_INIT_SCRIPT } from "@/lib/analytics-init";

/** Aktarım dosyası + ayrı analitik izni gerekir; özel işlem sayfaları ölçüme girmez. */
export default function GoogleAnalytics() {
  const path = usePathname();
  const granted = useSyncExternalStore(subscribeConsent, () => readConsent() === "granted", () => false);
  const allowed = ANALYTICS_TRANSFER_READY && granted && analyticsAllowedPath(path);
  useEffect(() => {
    if (allowed) window.skytechAnalyticsLoaded = true;
    else if (window.skytechAnalyticsLoaded) stopAnalytics();
  }, [allowed]);
  if (!allowed) return null;
  const beforeSend = <T extends { url: string }>(event: T): T | null => {
    if (readConsent() !== "granted" || !analyticsAllowedPath(window.location.pathname)) return null;
    const url = new URL(event.url);
    url.search = ""; url.hash = "";
    return { ...event, url: url.toString() };
  };
  return <>
    <Script id="ga4-init" strategy="afterInteractive">{GA_INIT_SCRIPT}</Script>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
    <Analytics beforeSend={beforeSend} />
    <SpeedInsights beforeSend={beforeSend} />
  </>;
}
