import type { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/admin/permissions";
import { fail, ok, unavailable } from "@/lib/api/envelope";
import { orderReadScope } from "@/lib/orders/admin-access";
import { ORDER_FLAGS, flagScope, loadOrderList, sanitizeSearch, type OrderFlag } from "@/lib/orders/admin-read";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/types";

/**
 * Admin — Bırakma siparişleri (liste). Sözleşme: web-brifler/27 §4.3.
 *
 * GET /api/admin/release-orders?status=&q=&test=all|only|hide&flag=&page=&pageSize= → Ok<OrderListDto>
 *
 * İzin: orders.read (all ya da sites; yalnız assigned → scope_unsupported). Liste, toplam, sayaçlar,
 * uyarılar ve arama aynı kapsamda. flag: capacity herkese; refund_pending/duplicate finance.read,
 * invoice_pending invoices.read ister. E-posta/telefonla arama yalnız iletişim izni okuma kapsamını
 * tamamen kapsıyorsa. Kimlik/vergi no, onay kayıtları ve ödeme ayrıntıları listede yoktur.
 *
 * Okuma veri DEĞİŞTİRMEZ: süresi dolan ödenmemişleri düşürme ve cayma süresi bitenleri kesinleştirme
 * işleri burada çalışmaz. Bunlar zamanlayıcı (`/api/cron/siparis-isleri`) ve `system.jobs.run` izinli
 * elle çalıştırma (`POST /api/admin/jobs/{job}/run`) yollarındadır; zamanlayıcının canlıda kurulu ve son
 * çalışmasının başarılı olması bu paketin yayın önkoşuludur (27 §7).
 */
export const dynamic = "force-dynamic";

const TESTS = ["all", "only", "hide"] as const;

export async function GET(request: NextRequest) {
  const guard = await requirePermission(request, "orders.read", { scope: "any" });
  if (guard.error) return guard.error;
  const read = orderReadScope(guard.access);
  if (!read) {
    return fail(403, "scope_unsupported", "Sipariş okuma yetkiniz yalnız kişiye atanmış işleri kapsıyor; bu ekran henüz atanmış işleri desteklemiyor.", {
      permission: "orders.read",
    });
  }

  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const test = sp.get("test") ?? "all";
  const flag = sp.get("flag");
  const invalid = (param: string) => fail(400, "invalid_query", "Geçersiz sorgu parametresi.", { param });
  if (status && !(ORDER_STATUSES as readonly string[]).includes(status)) return invalid("status");
  if (flag && !(ORDER_FLAGS as readonly string[]).includes(flag)) return invalid("flag");
  if (!(TESTS as readonly string[]).includes(test)) return invalid("test");
  if (flag && !flagScope(guard.access, flag as OrderFlag, read)) {
    return fail(403, "forbidden", "Bu süzgeç için yetkiniz yok.", { flag });
  }
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(sp.get("pageSize") ?? "25", 10) || 25));

  const list = await loadOrderList(createServiceRoleClient(), guard.access, read, {
    status: (status as OrderStatus | null) ?? null,
    test: test as (typeof TESTS)[number],
    flag: (flag as OrderFlag | null) ?? null,
    q: sanitizeSearch(sp.get("q")),
    page,
    pageSize,
  });
  if (!list) {
    console.error("[admin/release-orders] liste okunamadı");
    return unavailable();
  }
  return ok(list);
}
