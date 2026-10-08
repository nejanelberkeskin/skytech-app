/**
 * İade uçlarının ortak parçaları — varsayılan bağımlılıklar, yanıt dönüştürme, müşteri bildirimi.
 * Rotalar ince kalır; iş kuralları lib/refunds/service.ts'te.
 */
import { after, type NextRequest } from "next/server";
import { getClientIP } from "@/lib/admin-auth";
import { fail, ok } from "@/lib/api/envelope";
import { LEGACY_REFUND_ROLES } from "@/lib/orders/admin-access";
import { sendRefundCompletedEmail } from "@/lib/orders/admin-mails";
import { getProviderByName } from "@/lib/payments";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createRefundService, type ActionOutcome, type ServiceError } from "./service";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function refundService() {
  return createRefundService({
    db: createServiceRoleClient(),
    getProvider: getProviderByName,
    now: () => new Date(),
    log: (message, data) => console.error(message, JSON.stringify(data)),
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
}

export const isServiceError = (value: unknown): value is ServiceError =>
  typeof value === "object" && value !== null && (value as { ok?: unknown }).ok === false;

export const failFrom = (e: ServiceError) => fail(e.status, e.code, e.message, e.details);

/**
 * İade SQL'i (019 talep, 020 yeniden deneme ve mutabakat) etkin SUPER_ADMIN/FINANCE eski rolünü ister; `refunds.execute`
 * taşıyan özel rol bu sürümde iade yapamaz (27 §7). Uçlar aynı sınırı servisten önce uygular, görünüm de eylemi
 * yalnız bu rollere sunar. Ret gövdesi eski sipariş yolundakiyle aynı biçimdedir (27 §5, `legacy_role`).
 */
export const hasLegacyRefundRole = (role: string) => LEGACY_REFUND_ROLES.includes(role);
export const legacyRoleDenied = () =>
  fail(403, "forbidden", "İade işlemleri yalnız finans ya da sistem sahibi rolüyle yapılabilir.", { reason: "legacy_role" });

export function clientIp(request: NextRequest): string | null {
  const ip = getClientIP(request);
  return ip && ip !== "unknown" ? ip : null;
}

/** Eylem sonucu → yanıt. Tamamlanan sipariş iadesinde müşteri e-postası yanıttan SONRA gönderilir. */
export function respondAction(outcome: ActionOutcome | ServiceError) {
  if (isServiceError(outcome)) return failFrom(outcome);
  const order = outcome.notify;
  if (order) after(() => sendRefundCompletedEmail(order));
  return ok({ view: outcome.view, result: outcome.result }, outcome.warnings);
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.length > 8_000) return null;
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}
