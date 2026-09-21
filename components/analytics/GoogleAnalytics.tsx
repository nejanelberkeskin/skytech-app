"use client";

import { useSyncExternalStore } from "react";
import Script from "next/script";
import { GA_MEASUREMENT_ID, readConsent, subscribeConsent } from "@/lib/analytics";

/**
 * GA4 yükleyici — YALNIZ izinle.
 *
 * Ziyaretçi çerez bandında "Tümünü Kabul Et" demeden `gtag.js` indirilmez, Google'a hiçbir
 * istek gitmez (çerezsiz "modelleme" sinyali de gönderilmez). KVKK ve Kurul'un çerez rehberi
 * açısından güvenli olan budur: analitik, açık rızaya bağlıdır ve veri yurt dışına (Google)
 * ancak o rızayla aktarılır. İzin verildiği anda — sayfa yenilenmeden — yüklenir; izin geri
 * alınırsa Consent Mode "denied"a çekilir, GA çerezleri silinir ve sonraki sayfalarda yüklenmez.
 *
 * Bedeli: izin vermeyen ziyaretçiler GA'da görünmez. Çerezsiz toplu trafik için Vercel Analytics
 * (aynı alan adından, çerezsiz) yüklenmeye devam eder.
 */
export default function GoogleAnalytics() {
  // Sunucuda ve ilk boyamada "izin yok" sayılır → hydration uyuşmazlığı olmaz, varsayılan kapalıdır.
  const granted = useSyncExternalStore(
    subscribeConsent,
    () => readConsent() === "granted",
    () => false
  );
  if (!granted) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;

          gtag('consent', 'default', {
            'ad_storage': 'granted',
            'ad_user_data': 'granted',
            'ad_personalization': 'granted',
            'analytics_storage': 'granted'
          });

          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
