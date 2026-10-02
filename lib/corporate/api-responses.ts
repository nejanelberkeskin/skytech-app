/**
 * Kurumsal panel uçlarının yanıtlarını arayüz kararına çevirir. Ham sunucu iletisi hiçbir zaman gösterilmez;
 * yalnız buradaki sonuç türü ve mevcut hata kodları çevrilmiş iletiyi seçer. API/DTO sözleşmesi değişmez.
 */

/**
 * Çalışan tahsisi (POST /api/kurumsal/employees). Başarı sözleşmesi: 2xx + `{ success: true, allocation: {...},
 * email_sent: boolean }`.
 * - success: sözleşmeye uyan 2xx. `emailSent` yalnız `email_sent` boole ise dolu; değilse null (e-posta hakkında
 *   iddia kurulmaz).
 * - rejected: 4xx — sunucu isteği reddetti, tahsis oluşmadı.
 * - uncertain: okunamayan/kesik ya da sözleşmeye uymayan 2xx gövde, 5xx (ağ geçidi zaman aşımı dahil) ve ağ hatası.
 *   Tahsis oluşmuş olabilir: başarı denmez, form korunur, istek kendiliğinden yinelenmez.
 */
export type AllocationOutcome =
  | { kind: "success"; emailSent: boolean | null }
  | { kind: "rejected" }
  | { kind: "uncertain" };

export function allocationOutcome(status: number, body: unknown): AllocationOutcome {
  if (status >= 200 && status < 300) {
    const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    if (b && b.success === true && b.allocation !== null && typeof b.allocation === "object") {
      return { kind: "success", emailSent: typeof b.email_sent === "boolean" ? b.email_sent : null };
    }
    return { kind: "uncertain" };
  }
  if (status >= 400 && status < 500) return { kind: "rejected" };
  return { kind: "uncertain" };
}

/**
 * Kurumsal ödeme başlatma (POST /api/payment/b2b-checkout) hata yanıtı → ileti anahtarı (C1 istemci sözleşmesi,
 * outputs/claude-c1-tasarim/C1-TASARIM.md §10):
 * - `checkout_unavailable`: ödeme durumu inceleme/bekletme gerektiriyor; yeniden ödeme önerilmez.
 * - `checkout_pending`: önceki denemenin sonucu kesinleşmedi (geçici kilit); açık ödeme sayfası varsa orada tamamlanır,
 *   yoksa daha sonra yeniden denenir. Süre vaadi verilmez.
 * - `checkout_limit`: kısa sürede çok deneme; daha sonra ya da iletişim.
 * Tanınmayan her kod genel başlatma hatasıdır. Ham sunucu iletisi kullanılmaz.
 */
export type PaymentStartErrorKey = "checkoutUnavailable" | "checkoutPending" | "checkoutLimit" | "startError";
const PAYMENT_START_CODES: Record<string, PaymentStartErrorKey> = {
  checkout_unavailable: "checkoutUnavailable",
  checkout_pending: "checkoutPending",
  checkout_limit: "checkoutLimit",
};
export function paymentStartErrorKey(body: unknown): PaymentStartErrorKey {
  const code = body && typeof body === "object" ? (body as Record<string, unknown>).code : undefined;
  return typeof code === "string" && Object.hasOwn(PAYMENT_START_CODES, code) ? PAYMENT_START_CODES[code] : "startError";
}

/** Ödeme dönüşünün sonuç sayfası durumu (`?status=`). Tanınmayan değer gösterilmez. */
export type PaymentReturnStatus = "success" | "error" | "declined" | "pending";
export function paymentReturnStatus(value: string | null): PaymentReturnStatus | null {
  return value === "success" || value === "error" || value === "declined" || value === "pending" ? value : null;
}
