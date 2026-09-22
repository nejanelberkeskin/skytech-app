import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/permissions";
import { fail, ok } from "@/lib/api/envelope";
import { isJobName, jobHealth, runRecorded } from "@/lib/jobs/runs";
import { publicOrigin } from "@/lib/mail";
import { confirmDueOrders } from "@/lib/orders/admin-actions";
import { expireStaleOrders } from "@/lib/orders/create";
import { runScheduledJobs, startMonitoringDue } from "@/lib/orders/jobs";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/jobs/{job}/run — zamanlanmış işi yetkili kişi elle çalıştırır (web-brifler/18).
 * İzin: system.jobs.run (bugün yalnız SUPER_ADMIN). Gövde: { scope: "status" | "all" }.
 *   status: süre dolumu, kesinleşme, izleme dönemi — e-posta GÖNDERMEZ
 *   all:    cron'un yaptığının tamamı — sertifika ve video bildirim e-postaları dahil
 * Cron ile aynı anda çalışmaz (409 job_running). Kayıt tutulamıyorsa çalıştırılmaz (503).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ scope: z.enum(["status", "all"]) }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const guard = await requirePermission(request, "system.jobs.run");
  if (guard.error) return guard.error;
  const { job } = await params;
  if (!isJobName(job)) return fail(404, "not_found", "Böyle bir zamanlanmış iş yok.");
  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }
  const body = bodySchema.safeParse(raw);
  if (!body.success) return fail(400, "invalid_body", "Geçersiz istek: scope \"status\" ya da \"all\" olmalı.");

  const db = createServiceRoleClient();
  const scope = body.data.scope;
  const run = await runRecorded(db, job, "admin", scope, guard.admin.user_id, async () =>
    scope === "status"
      ? { expired: await expireStaleOrders(db), confirmed: await confirmDueOrders(db), monitoring: await startMonitoringDue(db) }
      : { ...(await runScheduledJobs(publicOrigin(request.nextUrl.origin), db)) }
  );
  if (run.status === "running") return fail(409, "job_running", "Bu iş şu anda çalışıyor. Bitince yeniden deneyin.");
  if (run.status === "unavailable") return fail(503, "unavailable", "Çalışma kaydı açılamadı; iş çalıştırılmadı.");
  if (run.status === "failed") return fail(500, "job_failed", "İş çalışırken hata oluştu; ayrıntı çalışma kaydında.", { runId: run.runId });
  try {
    return ok({ runId: run.runId, report: run.report, health: await jobHealth(db, job) });
  } catch {
    return ok({ runId: run.runId, report: run.report, health: null }, [
      { code: "view_unavailable", message: "İş çalıştı ancak güncel sağlık bilgisi alınamadı; sayfayı yenileyin." },
    ]);
  }
}
