/** Browser transport only; the server owns permissions, amounts and transitions. No mutation retries. */
import type { ApiWarning } from "@/lib/api/envelope";

export class AdminApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;
  constructor(code: string, message: string, status = 0, details?: Record<string, unknown>) {
    super(message); this.code = code; this.status = status; this.details = details;
  }
}

export async function adminRequest<T>(url: string, body?: object, signal?: AbortSignal): Promise<{ data: T; warnings: ApiWarning[] }> {
  let response: Response;
  try {
    response = await fetch(url, { method: body ? "POST" : "GET", cache: "no-store", signal,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AdminApiError("network", body ? "Yanıt alınamadı; işlem gerçekleşmiş olabilir. Tekrar göndermeden önce güncel durumu yenileyin." : "Bağlantı kurulamadı. Yeniden deneyin.");
  }
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok !== true || !("data" in json)) {
    throw new AdminApiError(json?.error?.code ?? "unavailable", json?.error?.message ?? (body
      ? "İşlem sonucu doğrulanamadı. Yeniden işlem yapmadan önce görünümü yenileyin."
      : "Veri alınamadı. Yeniden deneyin."), response.status, json?.error?.details);
  }
  return { data: json.data, warnings: Array.isArray(json.warnings) ? json.warnings : [] };
}

export const errorText = (error: unknown) => error instanceof Error ? error.message : "Veri alınamadı. Yeniden deneyin.";
export const istanbulDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }) : "—";
