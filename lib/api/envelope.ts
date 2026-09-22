/**
 * Yönetim API'lerinin ortak yanıt zarfı (web-brifler/17 §2).
 *
 *   başarı: { ok: true, data, warnings? }        — warnings: işlem YAPILDI ama dikkat gerektiren durum var
 *   hata:   { ok: false, error: { code, message, details? } }
 *
 * `message` Türkçedir ve kullanıcıya gösterilebilir; arayüz kararlarını `code`a göre verir.
 * Veri kaynağı hatası hiçbir zaman boş liste ya da sıfır olarak dönmez: 503 `unavailable`.
 */
import { NextResponse } from "next/server";

export interface ApiWarning {
  code: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

const NO_STORE = { "Cache-Control": "private, no-store" };

export function ok<T>(data: T, warnings: ApiWarning[] = [], status = 200) {
  return NextResponse.json({ ok: true as const, data, ...(warnings.length ? { warnings } : {}) }, { status, headers: NO_STORE });
}

export function fail(status: number, code: string, message: string, details?: Record<string, unknown>) {
  const error: ApiErrorBody = { code, message, ...(details ? { details } : {}) };
  return NextResponse.json({ ok: false as const, error }, { status, headers: NO_STORE });
}

export const unavailable = () => fail(503, "unavailable", "Veri alınamadı. Lütfen yeniden deneyin.");
