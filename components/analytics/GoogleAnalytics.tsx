"use client";

import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";

/**
 * GA4 yükleyici — Consent Mode v2 varsayılanlarıyla.
 *
 * Her sayfa yüklemesinde analytics_storage ve tüm ad_* sinyalleri önce
 * varsayılan olarak "denied" ayarlanır (Google'ın önerdiği gizlilik-öncelikli
 * varsayılan). Google, denied durumunda bile cookieless/modeled ping'lerle
 * GA4'e temel (anonim, toplu) trafik verisi ulaştırır — ama kişi bazlı çerez
 * atmaz. components/analytics/CookieConsentBanner.tsx, kullanıcının daha
 * önce verdiği tercihi (varsa) localStorage'dan okuyup updateConsent() ile
 * gerçek duruma çeker; yoksa banner'ı gösterip tercihi ilk kez alır.
 */
export default function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;

          gtag('consent', 'default', {
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied',
            'analytics_storage': 'denied'
          });

          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
