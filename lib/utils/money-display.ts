import { formatTry } from "@/lib/pricing";
import type { UiLocale } from "@/lib/utils/locale";

/**
 * Kurumsal ekranlarda TL tutar gösterimi (tutar TL, kuruş değil). TR önceki biçimle birebir; EN/RU sipariş
 * sayfalarıyla aynı biçim (`formatTry`: "₺2,000" · "2 000 ₺"). Tutarın kendisi ve hesaplama değişmez.
 */
export function moneyTry(amountTl: number, lang: UiLocale): string {
  return lang === "tr"
    ? amountTl.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })
    : formatTry(Math.round(amountTl * 100), lang);
}

/** "1.234 TL" biçimi (TR önceki biçimle birebir); EN/RU `formatTry`. */
export function plainTl(amountTl: number, lang: UiLocale): string {
  return lang === "tr" ? `${amountTl.toLocaleString("tr-TR")} TL` : formatTry(Math.round(amountTl * 100), lang);
}
