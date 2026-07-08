"use client";

import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";

/**
 * GA4 yükleyici — Consent Mode v2 varsayılanlarıyla.
 *
 * Henüz çerez onay banner'ı yok; bu yüzden analytics_storage ve tüm ad_*
 * sinyalleri varsayılan olarak "denied" ayarlanır. Google, denied durumunda
 * bile cookieless/modeled ping'lerle GA4'e temel (anonim, toplu) trafik
 * verisi ulaştırır — ama kişi bazlı çerez atmaz. Banner eklenince, kullanıcı
 * onay verdiğinde `gtag('consent', 'update', { analytics_storage: 'granted' })`
 * çağrısıyla tam izlemeye geçilecek.
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
