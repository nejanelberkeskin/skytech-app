/**
 * Yönetim panelindeki sipariş ayrıntısı — YALNIZ SUNUCU (service role). Sözleşme: web-brifler/27 §4.
 *
 * Önce temel alanlar okuma kapsamıyla okunur (kapsam dışı kayıt, olmayan kayıtla aynı `not_found`).
 * Hassas grupların kolonları ve ilişkili tabloları yalnız o grup bu kaydın sahasını kapsıyorsa VE (MFA
 * gerektiren gruplarda) oturum yeniden doğrulanmışsa sorgulanır; kapalı grubun kaynağına hiç gidilmez.
 * `invoice` JSON'u bütün hâlinde okunmaz: iletişim ve vergi yalnız kendi JSON yollarını seçer.
 * Alt sorgu hatası `unavailable` olur, boş değil.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EffectiveAccess } from "@/lib/admin/permissions";
import { MFA_FRESHNESS_MINUTES } from "@/lib/admin/permission-keys";
import {
  SENSITIVE_GROUPS, groupScope, orderCapabilities, scopeCovers,
  type OrderGroup, type ReadMfa, type ReadScope, type SensitiveGroup,
} from "./admin-access";
import {
  contactOf, financeOf, invoicesOf, legalOf, orderCore, sanitizeEvent, taxOf,
  type OrderDetailDto,
} from "./admin-dto";

const BASE_COLUMNS = [
  "id", "order_no", "status", "is_test", "locale", "land_id", "site_snapshot", "season_label", "batch_id", "quantity",
  "certificate_name", "certificate_issued_at", "certificate_cancelled_at", "buyer_type", "buyer_first_name", "buyer_last_name",
  "company_title:invoice->>companyTitle", "capacity_held:payment_meta->>capacityHeld",
  "payment_expires_at", "paid_at", "withdrawal_deadline", "performance_deadline", "confirmed_at", "scheduled_at",
  "released_at", "completed_at", "withdrawal_requested_at", "withdrawal_channel", "cancelled_at", "cancel_reason",
  "refunded_at", "admin_note", "created_at", "updated_at",
];

/** Grup başına release_orders kolonları; ilişkili tablolar ayrıca (27 §4.1). */
const GROUP_COLUMNS: Record<SensitiveGroup, string[]> = {
  contact: [
    "buyer_email", "buyer_phone", "marketing_consent", "invoice_address:invoice->address",
    "invoice_authorized_person:invoice->>authorizedPerson", "invoice_kep:invoice->>kep",
  ],
  tax: [
    "invoice_type:invoice->>type", "invoice_tckn:invoice->>tckn", "invoice_tax_id:invoice->>taxId",
    "invoice_tax_office:invoice->>taxOffice", "invoice_mersis:invoice->>mersis",
    "invoice_e_invoice_user:invoice->>eInvoiceUser", "invoice_po_number:invoice->>poNumber",
  ],
  finance: ["unit_price_kurus", "total_kurus", "vat_rate", "payment_provider", "payment_id", "payment_started_at"],
  invoices: [],
  legal: ["consents", "documents_version", "source_path"],
  certificate: ["certificate_code"],
};

export type OrderDetailResult = { ok: true; detail: OrderDetailDto } | { ok: false; error: "not_found" | "unavailable" };

type Row = Record<string, unknown>;
class Unavailable extends Error {}
const rows = (result: { data: unknown; error: unknown }): Row[] => {
  if (result.error) throw new Unavailable();
  return (result.data ?? []) as Row[];
};

export async function loadOrderDetail(
  supabase: SupabaseClient, id: string, access: EffectiveAccess, read: ReadScope, legacyRole: string, mfa: ReadMfa
): Promise<OrderDetailResult> {
  let base = supabase.from("release_orders").select(BASE_COLUMNS.join(", ")).eq("id", id);
  if (read.kind === "sites") base = base.in("land_id", read.siteIds);
  const { data: baseRow, error } = await base.maybeSingle();
  if (error) return { ok: false, error: "unavailable" };
  if (!baseRow) return { ok: false, error: "not_found" };
  const row = baseRow as unknown as Row;
  const landId = typeof row.land_id === "string" ? row.land_id : null;

  // İzin ∩ saha kapsamı; MFA gerektiren grup oturum tazelenmeden açılmaz (kaynağı da sorgulanmaz).
  const covered = new Set<OrderGroup>(["order"]);
  const mfaRequiredGroups: SensitiveGroup[] = [];
  for (const group of SENSITIVE_GROUPS) {
    if (!scopeCovers(groupScope(access, group, read), landId)) continue;
    if (mfa.blocked.has(group)) mfaRequiredGroups.push(group);
    else covered.add(group);
  }

  try {
    const extraColumns = [...new Set(SENSITIVE_GROUPS.filter((g) => covered.has(g)).flatMap((g) => GROUP_COLUMNS[g]))];
    const skip = Promise.resolve({ data: [] as Row[], error: null });
    const [extra, batch, events, documents, refunds, invoices] = await Promise.all([
      extraColumns.length
        ? supabase.from("release_orders").select(extraColumns.join(", ")).eq("id", id).maybeSingle()
        : Promise.resolve({ data: {}, error: null }),
      row.batch_id
        ? supabase.from("release_batches").select("id, title, planned_on, released_on, season_label").eq("id", row.batch_id as string).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("order_events").select("id, type, actor, data, created_at").eq("order_id", id).order("id", { ascending: true }),
      covered.has("legal")
        ? supabase.from("order_documents").select("kind, title, sha256, template_version, created_at").eq("order_id", id).order("created_at", { ascending: true })
        : skip,
      covered.has("finance")
        ? supabase.from("order_refunds").select("id, amount_kurus, reason, status, provider, provider_ref, error, created_at, completed_at").eq("order_id", id).order("created_at", { ascending: true })
        : skip,
      covered.has("invoices")
        ? supabase.from("order_invoices").select("id, kind, provider, status, invoice_no, ettn, issued_at, sent_at, error, created_at").eq("order_id", id).order("created_at", { ascending: true })
        : skip,
    ]);
    if (extra.error || batch.error) throw new Unavailable();
    const full: Row = { ...row, ...((extra.data ?? {}) as Row) };
    const eventRows = rows(events);

    const detail: OrderDetailDto = {
      groups: [...covered],
      mfaRequiredGroups,
      mfa: mfaRequiredGroups.length && mfa.reason
        ? { enrolled: mfa.enrolled, reason: mfa.reason, freshnessMinutes: MFA_FRESHNESS_MINUTES }
        : null,
      capabilities: orderCapabilities(access, legacyRole),
      order: orderCore(full, (batch.data ?? null) as Row | null),
      ...(covered.has("contact") ? { contact: contactOf(full) } : {}),
      ...(covered.has("tax") ? { tax: taxOf(full) } : {}),
      ...(covered.has("finance") ? { finance: financeOf(full, rows(refunds), eventRows) } : {}),
      ...(covered.has("invoices") ? { invoices: invoicesOf(rows(invoices)) } : {}),
      ...(covered.has("legal") ? { legal: legalOf(full, rows(documents)) } : {}),
      ...(covered.has("certificate") ? { certificate: { code: typeof full.certificate_code === "string" ? full.certificate_code : null } } : {}),
      events: eventRows.map((e) => sanitizeEvent(e, covered)),
    };
    return { ok: true, detail };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
