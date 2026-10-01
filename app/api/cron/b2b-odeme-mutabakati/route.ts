import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runRecorded } from "@/lib/jobs/runs";
import { reconcileB2bPayments } from "@/lib/b2b/reconcile";
import { createServiceRoleClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Configure an external scheduler every ten minutes; no production schedule is enabled by this route. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!secret) return json({ error: "not_configured" }, 503);
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return json({ error: "unauthorized" }, 401);
  try {
    const db = createServiceRoleClient();
    const run = await runRecorded(db, "b2b-odeme-mutabakati", "cron", "all", null, () => reconcileB2bPayments(db));
    if (run.status === "running") return json({ ok: true, skipped: "job_running" }, 200);
    if (run.status !== "done" || !run.recorded) return json({ error: "reconciliation_unavailable" }, 503);
    return json({ ok: true, ...run.report }, 200);
  } catch {
    return json({ error: "reconciliation_unavailable" }, 503);
  }
}
