"use client";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GA_MEASUREMENT_ID, ANALYTICS_TRANSFER_READY, analyticsAllowedPath, readConsent, subscribeConsent, stopAnalytics } from "@/lib/analytics";

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
    <Script id="ga4-init" strategy="afterInteractive">{`
      if (window.localStorage.getItem('skytech_cookie_consent_v2') === 'granted') {
        window.skytechAnalyticsLoaded = true;
        window['ga-disable-${GA_MEASUREMENT_ID}'] = false;
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
        gtag('js', new Date());
        gtag('config', '${GA_MEASUREMENT_ID}', {
          allow_google_signals: false, allow_ad_personalization_signals: false,
          page_location: window.location.origin + window.location.pathname,
          page_referrer: '', send_page_view: false
        });
        gtag('event', 'page_view', { page_location: window.location.origin + window.location.pathname, page_referrer: '' });
      }
    `}</Script>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
    <Analytics beforeSend={beforeSend} />
    <SpeedInsights beforeSend={beforeSend} />
  </>;
}
