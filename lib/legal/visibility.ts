/**
 * Satışa ilişkin hukuk sayfaları (ön bilgilendirme, sözleşme, cayma ve iade, ifa
 * koşulları, işlem rehberi) ne zaman görünür?
 *
 *  • Canlıda: yalnız NEXT_PUBLIC_LEGAL_PAGES_ENABLED=true iken. Metinler hukuk
 *    incelemesinden geçmeden yayımlanmaz; bayrak kapalıyken sayfalar 404 döner,
 *    alt bilgide ve sitemap'te yer almaz.
 *  • Geliştirmede ve Vercel ÖNİZLEME dağıtımlarında: her zaman — avukatın ve
 *    ödeme kuruluşunun incelemesi için bağlantı verilebilsin diye.
 *
 * YALNIZ SUNUCU tarafında çağrılır (VERCEL_ENV istemci paketinde yoktur).
 */
export const LEGAL_PAGES_ENABLED = process.env.NEXT_PUBLIC_LEGAL_PAGES_ENABLED === "true";

export function legalPagesVisible(): boolean {
  return LEGAL_PAGES_ENABLED || process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
}

/** Sayfa adresleri — alt bilgi, sitemap ve middleware aynı listeyi kullanır. */
export const SALES_LEGAL_PAGES = [
  { path: "/on-bilgilendirme", label: "Ön Bilgilendirme Formu" },
  { path: "/mesafeli-satis-sozlesmesi", label: "Mesafeli Satış Sözleşmesi" },
  { path: "/cayma-ve-iade", label: "Cayma ve İade Koşulları" },
  { path: "/ifa-kosullari", label: "İfa ve Teslimat Koşulları" },
  { path: "/islem-rehberi", label: "İşlem Rehberi" },
] as const;

export type SamplePdfSlug = "on-bilgilendirme" | "mesafeli-hizmet-sozlesmesi" | "cayma-formu" | "kvkk-aydinlatma-metni";

/** Örnek PDF ucu — API adresidir; bağlantı düz <a> ile verilir (sayfa yönlendirmesi değildir). */
export const samplePdfHref = (slug: SamplePdfSlug) => `/api/public/hukuk/ornek/${slug}`;
