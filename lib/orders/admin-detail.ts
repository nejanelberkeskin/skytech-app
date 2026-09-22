/**
 * Yönetim panelindeki sipariş ayrıntısı — YALNIZ SUNUCU (service role).
 * Kimlik / vergi numarası yalnız para-fatura rollerine açık gider; diğerlerine maskeli.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { duplicateChargesFrom } from "./admin-actions";

const ORDER_SELECT = [
  "id", "order_no", "status", "is_test", "user_id", "locale", "land_id", "site_snapshot", "season_label", "batch_id",
  "quantity", "unit_price_kurus", "total_kurus", "vat_rate", "certificate_name", "certificate_code",
  "certificate_issued_at", "certificate_cancelled_at", "buyer_type", "buyer_first_name", "buyer_last_name",
  "buyer_email", "buyer_phone", "invoice", "consents", "marketing_consent", "documents_version", "source_path",
  "payment_provider", "payment_id", "payment_meta", "payment_started_at", "payment_expires_at", "paid_at",
  "withdrawal_deadline", "performance_deadline", "confirmed_at", "scheduled_at", "released_at", "completed_at",
  "withdrawal_requested_at", "withdrawal_channel", "cancelled_at", "cancel_reason", "refunded_at", "admin_note",
  "created_at", "updated_at",
].join(", ");

const mask = (v: unknown) => (typeof v === "string" && v.length > 4 ? `${"•".repeat(v.length - 4)}${v.slice(-4)}` : v);

export type OrderDetailResult = { ok: true; detail: Record<string, unknown> } | { ok: false; error: "not_found" | "unavailable" };

export async function loadOrderDetail(supabase: SupabaseClient, id: string, canSeeTaxIds: boolean): Promise<OrderDetailResult> {
  const { data: row, error } = await supabase.from("release_orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: "unavailable" };
  if (!row) return { ok: false, error: "not_found" };
  const order = row as unknown as Record<string, unknown> & { batch_id: string | null; invoice: Record<string, unknown> };

  const [documents, events, refunds, invoices, batch] = await Promise.all([
    supabase.from("order_documents").select("kind, title, sha256, template_version, created_at").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("order_events").select("id, type, actor, data, created_at").eq("order_id", id).order("id", { ascending: true }),
    supabase.from("order_refunds").select("id, amount_kurus, reason, status, provider, provider_ref, error, requested_by, created_at, completed_at").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("order_invoices").select("id, kind, provider, status, invoice_no, ettn, issued_at, sent_at, error, created_by, created_at").eq("order_id", id).order("created_at", { ascending: true }),
    order.batch_id ? supabase.from("release_batches").select("id, title, planned_on, released_on, season_label").eq("id", order.batch_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Belgelerin yapısal kaynağı (yüzlerce blok) panele taşınmaz; yalnız özet.
  const eventList = ((events.data ?? []) as { id: number; type: string; actor: string; data: Record<string, unknown> | null; created_at: string }[]).map((e) =>
    e.type === "documents_generated"
      ? { ...e, data: { version: e.data?.version ?? null, kinds: Array.isArray(e.data?.documents) ? (e.data!.documents as { kind: string }[]).map((d) => d.kind) : [] } }
      : e
  );

  const invoice = canSeeTaxIds ? order.invoice : { ...order.invoice, tckn: mask(order.invoice?.tckn), taxId: mask(order.invoice?.taxId) };

  return {
    ok: true,
    detail: {
      order: { ...order, invoice },
      documents: documents.data ?? [],
      events: eventList,
      // Sahiplenme işareti ("claim:…") iç ayrıntıdır; panelde "işleniyor" olarak görünür.
      refunds: (refunds.data ?? []).map((r) => ({ ...r, provider_ref: typeof r.provider_ref === "string" && r.provider_ref.startsWith("claim:") ? "işleniyor" : r.provider_ref })),
      invoices: invoices.data ?? [],
      duplicates: duplicateChargesFrom(eventList),
      batch: batch.data ?? null,
      canManageMoney: canSeeTaxIds,
    },
  };
}
