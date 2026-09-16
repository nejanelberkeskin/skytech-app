"use client";

/**
 * Talep ↔ hesap bağlama — istemci tarafı yardımcıları.
 *
 * Misafir talep bırakıp sonra hesap açan kullanıcı için talep kimliği
 * (tahmin edilemez UUID) tarayıcıda bekletilir; oturum oluşunca
 * POST /api/auth/claim-request ile hesaba bağlanır. Kayıt sayfası
 * `?talep=<uuid>` ile de gelebilir. E-posta doğrulama açıksa kullanıcı
 * bağlantıya tıklayıp /hesabim'a düşer; orada da denenir.
 */

export const PENDING_CLAIM_KEY = "skytech_pending_claim";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRequestId(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function savePendingClaim(requestId: string): void {
  if (!isRequestId(requestId)) return;
  try {
    localStorage.setItem(PENDING_CLAIM_KEY, requestId);
  } catch {
    // depolama yoksa sessiz geç — kullanıcı talebi yine de e-postasında görür
  }
}

export function readPendingClaim(): string | null {
  try {
    const v = localStorage.getItem(PENDING_CLAIM_KEY);
    return isRequestId(v) ? v : null;
  } catch {
    return null;
  }
}

export function clearPendingClaim(): void {
  try {
    localStorage.removeItem(PENDING_CLAIM_KEY);
  } catch {
    // yoksay
  }
}

/**
 * Bekleyen talebi (varsa) oturumdaki hesaba bağlamayı dener. Sonuç ne olursa
 * olsun sessizdir; kalıcı red (403/404/409) gelirse bekleyen kayıt silinir,
 * geçici hata (ağ, 5xx) gelirse bir sonraki açılışta yeniden denenir.
 */
export async function claimPendingRequest(explicitId?: string | null): Promise<boolean> {
  const requestId = isRequestId(explicitId) ? explicitId : readPendingClaim();
  if (!requestId) return false;
  try {
    const res = await fetch("/api/auth/claim-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (res.ok) {
      clearPendingClaim();
      return true;
    }
    if ([400, 403, 404, 409].includes(res.status)) clearPendingClaim();
    return false;
  } catch {
    return false;
  }
}
