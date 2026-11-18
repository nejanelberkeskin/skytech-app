import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runRecorded } from "@/lib/jobs/runs";
import { publicOrigin } from "@/lib/mail";
import { runInvoiceJob } from "@/lib/invoicing/job";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/cron/fatura — bekleyen satış faturalarını Paraşüt'te keser (Vercel Cron, 30 dakikada bir).
 * Paraşüt bilgileri (PARASUT_*) tanımlı değilse iş çalışır ama hiçbir şey yapmaz (`configured: false`).
 *
 * Yetki: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron bu başlığı kendisi ekler).
 * CRON_SECRET tanımlı değilse uç KAPALIDIR (503) — kimliksiz çağrıya hiçbir koşulda açılmaz.
 * İşlerin hepsi yinelenebilir; iki kez çalışması zarar vermez.
 *
 * Her çalışma `job_runs`a yazılır (sağlık: /api/admin/jobs). Yönetimden elle başlatılmış çalışma sürüyorsa
 * bu çalışma atlanır. Kayıt tutulamasa da (ör. migration 020 henüz uygulanmadı) iş yine çalışır.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: NextRequest) {
  const auth = authorized(req);
  if (auth === null) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const db = createServiceRoleClient();
    const run = await runRecorded(db, "fatura-parasut", "cron", "all", null, async () => ({
      ...(await runInvoiceJob(db, publicOrigin(req.nextUrl.origin))),
    }));
    if (run.status === "running") {
      console.log("[cron] fatura-parasut: elle başlatılmış çalışma sürüyor, atlandı");
      return NextResponse.json({ ok: true, skipped: "job_running" });
    }
    if (run.status !== "done") {
      console.error("[cron] fatura-parasut hata:", run.status === "failed" ? run.error : run.status);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
    console.log("[cron] fatura-parasut:", JSON.stringify(run.report));
    return NextResponse.json({ ok: true, ...run.report });
  } catch (e) {
    console.error("[cron] fatura-parasut hata:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
