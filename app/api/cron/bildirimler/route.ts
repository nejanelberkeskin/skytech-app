import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/mail";
import { runConfiguredNotifications } from "@/lib/orders/notification-outbox";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runRecorded } from "@/lib/jobs/runs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Scheduler worker: vercel.json runs it every ten minutes (Vercel Cron). Without CRON_SECRET the route stays closed (503). */
export async function GET(req: NextRequest) {
    const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
    const secret = process.env.CRON_SECRET;
    if (!secret)
        return reply({ error: "not_configured" }, 503);
    const actual = Buffer.from(req.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
        return reply({ error: "unauthorized" }, 401);
    try {
        const db = createServiceRoleClient();
        const run = await runRecorded(db, "bildirimler", "cron", "all", null, () => runConfiguredNotifications(publicOrigin(), db));
        if (run.status === "running") return reply({ ok: true, skipped: "job_running" });
        if (run.status !== "done" || !run.recorded) return reply({ error: "notification_queue_unavailable" }, 503);
        return reply({ ok: true, ...run.report });
    }
    catch {
        return reply({ error: "notification_queue_unavailable" }, 503);
    }
}
