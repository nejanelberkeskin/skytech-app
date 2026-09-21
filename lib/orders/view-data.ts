/**
 * Sipariş görünümü — SUNUCU tarafı veri erişimi.
 *
 * Erişim iki yoldan doğrulanır: e-postadaki imzalı belirteç (`?t=`) ya da oturumdaki
 * üyenin kendi siparişi. Sipariş numarasını bilmek tek başına YETMEZ; yetkisiz istek
 * ile "böyle bir sipariş yok" aynı yanıtı alır (null → sayfa 404).
 *
 * Sözleşmesi kurulmamış (ödenmemiş) siparişin sayfası yoktur: o aşamadaki müşteri
 * ödeme sonucu sayfasını (`/odeme/sonuc/<no>`) görür.
 *
 * Geliştirmede `?t=ornek` ile lib/orders/view.ts içindeki örnek siparişler döner.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { signOrderToken, verifyOrderToken } from "./access";
import { trToday } from "./schedule";
import { canWithdraw } from "./state";
import { db, getOrderByNo } from "./store";
import { ORDER_NO_RE, type DocumentKind, type ReleaseOrderRow } from "./types";
import { ORDER_VIEW_FIXTURES, ORDER_VIEW_FIXTURE_TOKEN, timelineFor, type OrderViewDocument, type PublicOrderView } from "./view";

export interface OrderViewAccess {
  /** E-postadaki bağlantıdan gelen belirteç (`?t=`) */
  token?: string | null;
  /** Oturumdaki üyenin kimliği (yalnız sunucuda, çerezden okunur) */
  userId?: string | null;
}

const day = (iso: string | null | undefined) => (iso ? trToday(new Date(iso)) : null);

/** Numara + erişim bilgisinden siparişi döner; yetki yoksa null. */
export async function getAuthorizedOrder(
  orderNo: string,
  access: OrderViewAccess,
  supabase: SupabaseClient = db()
): Promise<ReleaseOrderRow | null> {
  const no = orderNo.trim().toUpperCase();
  if (!ORDER_NO_RE.test(no)) return null;
  const order = await getOrderByNo(supabase, no);
  if (!order) return null;
  const byToken = verifyOrderToken(order.id, access.token);
  const byOwner = Boolean(access.userId) && order.user_id === access.userId;
  return byToken || byOwner ? order : null;
}

/** Belgenin yetkili indirme adresi (aynı kaynak; belirteç yalnız bu adreste taşınır). */
export function orderDocumentUrl(order: Pick<ReleaseOrderRow, "id" | "order_no">, kind: DocumentKind, format: "html" | "pdf"): string {
  const token = signOrderToken(order.id);
  const query = new URLSearchParams({ ...(token ? { t: token } : {}), bicim: format });
  return `/api/public/siparis/${order.order_no}/belge/${kind}?${query}`;
}

export async function getOrderView(orderNo: string, access: OrderViewAccess = {}): Promise<PublicOrderView | null> {
  const no = orderNo.trim().toUpperCase();
  if (!ORDER_NO_RE.test(no)) return null;

  if (process.env.NODE_ENV !== "production" && access.token === ORDER_VIEW_FIXTURE_TOKEN) {
    return ORDER_VIEW_FIXTURES.find((o) => o.orderNo === no) ?? null;
  }

  const supabase = db();
  const order = await getAuthorizedOrder(no, access, supabase);
  if (!order || !order.paid_at) return null;

  const [documents, refunds, invoices, batch, land] = await Promise.all([
    supabase.from("order_documents").select("kind, title, sha256").eq("order_id", order.id).order("created_at", { ascending: true }),
    supabase.from("order_refunds").select("reason, status, created_at, completed_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("order_invoices").select("status, issued_at").eq("order_id", order.id).eq("kind", "sale").in("status", ["pending", "issued"]).order("created_at", { ascending: false }).limit(1),
    order.batch_id
      ? supabase.from("release_batches").select("released_on, video_url, video_published_at").eq("id", order.batch_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("lands").select("slug, is_public").eq("id", order.land_id).maybeSingle(),
  ]);

  const site = order.site_snapshot;
  const location = [site.district, site.province].filter(Boolean).join(", ") || null;
  const refund = refunds.data?.[0] ?? null;
  const invoice = invoices.data?.[0] ?? null;
  const batchRow = batch.data as { released_on: string | null; video_url: string | null; video_published_at: string | null } | null;
  // Saha sayfası yalnız saha hâlâ yayındaysa bağlanır (kaldırılmış sahaya kırık bağlantı verilmez).
  const landRow = land.data as { slug: string | null; is_public: boolean | null } | null;

  // Bırakma tarihi yalnız bırakma GERÇEKLEŞTİYSE gösterilir (partiye yazılmış plan tarihi değil).
  const releasedOn = order.released_at ? (batchRow?.released_on ?? day(order.released_at)) : null;

  const orderDocuments: OrderViewDocument[] = (documents.data ?? []).map((d) => ({
    kind: d.kind as DocumentKind,
    title: d.title as string,
    sha256: d.sha256 as string,
    htmlUrl: orderDocumentUrl(order, d.kind as DocumentKind, "html"),
    pdfUrl: orderDocumentUrl(order, d.kind as DocumentKind, "pdf"),
  }));

  return {
    orderNo: order.order_no,
    status: order.status,
    isTest: order.is_test,
    createdOn: trToday(new Date(order.created_at)),
    buyerFirstName: order.buyer_first_name,
    site: {
      name: site.name,
      slug: landRow?.is_public && landRow.slug ? landRow.slug : null,
      location,
      workType: site.workType,
    },
    species: site.species.map((s) => ({ slug: s.slug, name: s.name })),
    quantity: order.quantity,
    totals: { unitPriceKurus: order.unit_price_kurus, totalKurus: order.total_kurus, vatRate: Number(order.vat_rate) },
    certificateName: order.certificate_name,
    schedule: {
      seasonLabel: order.season_label,
      performanceDeadline: order.performance_deadline ?? "",
      withdrawalLastDay: day(order.withdrawal_deadline) ?? "",
    },
    canWithdraw: canWithdraw(order.status, order.withdrawal_deadline),
    timeline: timelineFor(order.status, {
      paid: day(order.paid_at),
      confirmed: day(order.confirmed_at),
      scheduled: day(order.scheduled_at),
      released: releasedOn,
      completed: day(order.completed_at),
    }),
    documents: orderDocuments,
    releasedOn,
    certificate: order.certificate_code
      ? { code: order.certificate_code, status: order.certificate_cancelled_at ? "cancelled" : "valid" }
      : null,
    videoUrl: batchRow?.video_published_at ? batchRow.video_url : null,
    refund: refund
      ? {
          reason: refund.reason === "withdrawal" ? "withdrawal" : "seller_cancellation",
          // Başarısız iade girişimi yönetimde yeniden denenir; müşteri açısından iade hâlâ bekliyor.
          status: refund.status === "succeeded" ? "succeeded" : "pending",
          requestedOn: trToday(new Date(refund.created_at as string)),
          completedOn: day(refund.completed_at as string | null),
        }
      : null,
    invoice: invoice
      ? { status: invoice.status === "issued" ? "issued" : "pending", issuedOn: day(invoice.issued_at as string | null), pdfUrl: null }
      : null,
  };
}
