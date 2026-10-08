/** Personel/davet uçlarının ortak parçaları: varsayılan bağımlılıklar, doğrulama şemaları, hata dönüşümü. */
import { z } from "zod";
import { fail } from "@/lib/api/envelope";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createStaffService, isServiceError, type ServiceError } from "./staff";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const scopeSchema = z.union([
  z.object({ kind: z.literal("all") }).strict(),
  z.object({ kind: z.literal("assigned") }).strict(),
  z.object({ kind: z.literal("sites"), siteIds: z.array(z.string().regex(UUID_RE)).min(1).max(200) }).strict(),
]);

export const reasonSchema = z.string().trim().min(3).max(500).optional();

export function staffService() {
  const db = createServiceRoleClient();
  return createStaffService({
    db,
    async mfaStatus(userId: string) {
      try {
        const admin = db.auth.admin as unknown as { mfa?: { listFactors(args: { userId: string }): Promise<{ data?: { factors?: unknown[] } | null }> } };
        const result = await admin.mfa?.listFactors({ userId });
        const factors = result?.data?.factors;
        return Array.isArray(factors) ? { enrolled: factors.length > 0 } : null;
      } catch {
        return null;
      }
    },
    now: () => new Date(),
  });
}

export const failFrom = (e: ServiceError) => fail(e.status, e.code, e.message, e.details);
export { isServiceError };

export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return text.length > 8_000 ? null : text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}
