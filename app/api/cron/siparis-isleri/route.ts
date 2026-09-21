import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/mail";
import { runScheduledJobs } from "@/lib/orders/jobs";

/**
 * GET /api/cron/siparis-isleri — sipariş akışının zamana bağlı işleri (Vercel Cron, günde bir).
 *
 *   • ödeme süresi dolmuş siparişleri kapatır, kapasitelerini geri verir
 *   • cayma süresi dolan siparişleri kesinleştirir (`paid` → `confirmed`)
 *   • bırakma sezonu bitince `released` → `monitoring`
 *   • gitmemiş Katılım Sertifikası ve çalışma videosu bildirimlerini gönderir
 *
 * Yetki: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron bu başlığı kendisi ekler).
 * CRON_SECRET tanımlı değilse uç KAPALIDIR (503) — kimliksiz çağrıya hiçbir koşulda açılmaz.
 * İşlerin hepsi yinelenebilir; iki kez çalışması zarar vermez.
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
    const report = await runScheduledJobs(publicOrigin(req.nextUrl.origin));
    console.log("[cron] siparis-isleri:", JSON.stringify(report));
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    console.error("[cron] siparis-isleri hata:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
