import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { ok, unavailable } from "@/lib/api/envelope";
import { JOBS, jobHealth, type JobName } from "@/lib/jobs/runs";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/jobs — zamanlanmış işlerin sağlığı (web-brifler/18). İzin: system.readiness.read.
 * Gizli değer döndürmez: yalnız CRON_SECRET tanımlı mı, son çalışmalar ve durum.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "system.readiness.read");
  if (guard.error) return guard.error;
  try {
    const db = createServiceRoleClient();
    const jobs = await Promise.all((Object.keys(JOBS) as JobName[]).map((job) => jobHealth(db, job)));
    return ok({ jobs });
  } catch {
    return unavailable();
  }
}
