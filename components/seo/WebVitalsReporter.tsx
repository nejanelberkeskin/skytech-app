"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Web Vitals raporlama — Next.js'in onReportWebVitals hook'unu kullanır.
 *
 * Şu an sadece development'ta konsola yazar; production'da Speed Insights
 * (Vercel) gerçek kullanıcı metriklerini toplar. İleride özel analytics
 * sağlayıcısına gönderim eklenecekse buraya `gtag` veya `fetch` çağrısı
 * konulur.
 */
export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      // CLS, FID, LCP, FCP, INP, TTFB
      // eslint-disable-next-line no-console
      console.log(`[web-vitals] ${metric.name}:`, metric.value.toFixed(2), metric.rating);
    }
  });

  return null;
}
