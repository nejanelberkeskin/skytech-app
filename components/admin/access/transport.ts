import { AdminApiError } from "../operations/client";
import type { ApiWarning } from "@/lib/api/envelope";
export async function accessRequest<T>(
  url: string,
  method = "GET",
  body?: object,
): Promise<{
  data: T;
  warnings: ApiWarning[];
}> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
  } catch {
    throw new AdminApiError(
      "network",
      method === "GET"
        ? "Bağlantı kurulamadı. Yeniden deneyin."
        : "Yanıt alınamadı; işlem gerçekleşmiş olabilir. Tekrar göndermeden önce kayıtları yenileyin.",
    );
  }
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok !== true || !("data" in json))
    throw new AdminApiError(
      json?.error?.code ?? "unavailable",
      json?.error?.message ?? "Sonuç doğrulanamadı. Kayıtları yenileyin.",
      response.ok ? 0 : response.status,
      json?.error?.details,
    );
  return {
    data: json.data,
    warnings: Array.isArray(json.warnings) ? json.warnings : [],
  };
}
