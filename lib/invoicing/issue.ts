/**
 * Bekleyen satış faturalarını Paraşüt'te keser ve resmîleştirir (e-Arşiv ya da e-Fatura) — YALNIZ SUNUCU.
 *
 * Adımlar (her biri kaydedilir; iş kesilirse sonraki çalışma kaldığı yerden devam eder):
 *   1. Müşteri (contact) bulunur ya da açılır; tek "hizmet" ürünü bulunur ya da açılır.
 *   2. Satış faturası açılır → `external_id` HEMEN yazılır (yeniden denemede ikinci fatura açılmaz).
 *   3. Paraşüt'ün hesapladığı KDV dâhil toplam siparişle karşılaştırılır; 1 kuruştan fazla fark varsa durur (elle).
 *   4. Alıcı e-Fatura kayıtlıysa e-Fatura, değilse e-Arşiv (internet satışı) → `document_type` + `job_id` yazılır.
 *      Resmîleştirme isteği bir faturada İKİNCİ KEZ gönderilmez; şüphede faturanın e-belgesine bakılır.
 *   5. İş bitince fatura numarası ve ETTN yazılır, satır `issued` olur.
 * Deneme sınırı aşılırsa satır `failed` olur; yönetimden "yeniden dene" ile tekrar kuyruğa alınır.
 * Test siparişleri atlanır. Yalnız satış faturaları (iade belgeleri elle).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ilAdi } from "@/lib/tr-iller";
import type { InvoiceInfo } from "@/lib/orders/types";
import { ParasutError, many, one, type ParasutClient } from "./parasut";

export const MAX_ATTEMPTS = 5;
export const SERVICE_PRODUCT_NAME = "Tohum topu bırakma hizmeti";
/** e-Arşivde TCKN verilmeyen tüketici için GİB'in kabul ettiği yer tutucu (mali müşavir kararı). */
export const PLACEHOLDER_TCKN = "11111111111";

type Row = Record<string, unknown>;

export interface InvoiceRow {
  id: string;
  order_id: string;
  external_id: string | null;
  document_type: "e_archive" | "e_invoice" | null;
  job_id: string | null;
  attempts: number;
}

export interface OrderForInvoice {
  id: string;
  order_no: string;
  is_test: boolean;
  buyer_type: "individual" | "corporate";
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone: string;
  invoice: InvoiceInfo;
  quantity: number;
  unit_price_kurus: number;
  total_kurus: number;
  vat_rate: number | string;
  paid_at: string | null;
  site_snapshot: { name?: string } | null;
}

export type StepResult =
  | { outcome: "issued"; invoiceNo: string | null; ettn: string | null }
  | { outcome: "waiting" }
  | { outcome: "failed"; error: string }
  | { outcome: "skipped"; reason: string };

const turkeyDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** KDV dâhil birim kuruştan KDV hariç birim TL (8 ondalık; Paraşüt satırı 2 ondalığa yuvarlar, toplam ayrıca denetlenir). */
export function netUnitPrice(unitKurus: number, vatRate: number): string {
  return (unitKurus / (1 + vatRate / 100) / 100).toFixed(8);
}

function buyerTaxNumber(order: OrderForInvoice): { tax: string; real: boolean } {
  if (order.invoice.type === "corporate") return { tax: order.invoice.taxId, real: true };
  return order.invoice.tckn ? { tax: order.invoice.tckn, real: true } : { tax: PLACEHOLDER_TCKN, real: false };
}

function displayName(order: OrderForInvoice): string {
  return order.invoice.type === "corporate"
    ? order.invoice.companyTitle
    : `${order.buyer_first_name} ${order.buyer_last_name}`.trim();
}

async function findOrCreateContact(client: ParasutClient, order: OrderForInvoice): Promise<string> {
  const { tax, real } = buyerTaxNumber(order);
  const found = real
    ? many(await client.request("GET", `/contacts?filter[tax_number]=${encodeURIComponent(tax)}&page[size]=1`))
    : many(await client.request("GET", `/contacts?filter[email]=${encodeURIComponent(order.buyer_email)}&page[size]=1`));
  if (found[0]) return found[0].id;
  const inv = order.invoice;
  const created = one(
    await client.request("POST", "/contacts", {
      data: {
        type: "contacts",
        attributes: {
          name: displayName(order),
          account_type: "customer",
          contact_type: inv.type === "corporate" ? "company" : "person",
          tax_number: tax,
          ...(inv.type === "corporate" ? { tax_office: inv.taxOffice } : {}),
          email: order.buyer_email,
          phone: order.buyer_phone,
          city: ilAdi(inv.address.province) ?? undefined,
          district: inv.address.district,
          address: inv.address.line,
          country: "Türkiye",
          is_abroad: false,
        },
      },
    }),
  );
  if (!created) throw new ParasutError(500, "Paraşüt müşteri kaydı oluşturulamadı.");
  return created.id;
}

async function findOrCreateProduct(client: ParasutClient, vatRate: number): Promise<string> {
  const found = many(await client.request("GET", `/products?filter[name]=${encodeURIComponent(SERVICE_PRODUCT_NAME)}&page[size]=1`));
  if (found[0]) return found[0].id;
  const created = one(
    await client.request("POST", "/products", {
      data: { type: "products", attributes: { name: SERVICE_PRODUCT_NAME, vat_rate: vatRate, unit: "Adet", currency: "TRL", inventory_tracking: false } },
    }),
  );
  if (!created) throw new ParasutError(500, "Paraşüt hizmet ürünü oluşturulamadı.");
  return created.id;
}

async function createSalesInvoice(client: ParasutClient, order: OrderForInvoice, contactId: string, productId: string, today: string) {
  const vat = Number(order.vat_rate);
  const inv = order.invoice;
  const { tax } = buyerTaxNumber(order);
  const siteName = order.site_snapshot?.name ?? "Proje Uygulama Sahası";
  const paidDay = order.paid_at ? turkeyDay(new Date(order.paid_at)) : null;
  const doc = one(
    await client.request("POST", "/sales_invoices", {
      data: {
        type: "sales_invoices",
        attributes: {
          item_type: "invoice",
          issue_date: today,
          due_date: today,
          currency: "TRL",
          description: `${order.order_no} · ${siteName}`,
          ...(paidDay ? { order_no: order.order_no, order_date: paidDay } : {}),
          billing_address: inv.address.line,
          city: ilAdi(inv.address.province) ?? undefined,
          district: inv.address.district,
          tax_number: tax,
          ...(inv.type === "corporate" ? { tax_office: inv.taxOffice } : {}),
          country: "Türkiye",
          is_abroad: false,
        },
        relationships: {
          contact: { data: { id: contactId, type: "contacts" } },
          details: {
            data: [
              {
                type: "sales_invoice_details",
                attributes: {
                  quantity: order.quantity,
                  unit_price: netUnitPrice(order.unit_price_kurus, vat),
                  vat_rate: vat,
                  description: `${siteName} — dronla tohum topu bırakma hizmeti (${order.order_no})`,
                },
                relationships: { product: { data: { id: productId, type: "products" } } },
              },
            ],
          },
        },
      },
    }),
  );
  if (!doc) throw new ParasutError(500, "Paraşüt satış faturası oluşturulamadı.");
  return doc;
}

/** Paraşüt'ün hesapladığı KDV dâhil toplam siparişle aynı mı (±1 kuruş)? */
export function totalsMatch(grossTotal: unknown, totalKurus: number): boolean {
  const g = Number(grossTotal);
  return Number.isFinite(g) && Math.abs(Math.round(g * 100) - totalKurus) <= 1;
}

async function activeEDocument(client: ParasutClient, invoiceId: string) {
  const doc = await client.request("GET", `/sales_invoices/${invoiceId}?include=active_e_document`);
  const inv = one(doc);
  const rel = inv?.relationships?.active_e_document?.data;
  const ref = rel && !Array.isArray(rel) ? rel : null;
  const e = ref ? (doc?.included ?? []).find((r) => r.id === ref.id && r.type === ref.type) ?? null : null;
  return { invoice: inv, ref, e };
}

/** Bekleyen tek faturayı bir adım ilerletir. Yan etkileri çağıran DB'ye yazar (aşağıdaki `processInvoice`). */
export async function advanceInvoice(
  client: ParasutClient,
  row: InvoiceRow,
  order: OrderForInvoice,
  ctx: { siteUrl: string; now: Date; save: (patch: Row) => Promise<void>; pollJob?: { tries: number; sleep: (ms: number) => Promise<void> } },
): Promise<StepResult> {
  if (order.is_test) return { outcome: "skipped", reason: "test_order" };
  const today = turkeyDay(ctx.now);

  // 1–3: satış faturası
  let invoiceId = row.external_id;
  if (!invoiceId) {
    const vat = Number(order.vat_rate);
    const contactId = await findOrCreateContact(client, order);
    const productId = await findOrCreateProduct(client, vat);
    const created = await createSalesInvoice(client, order, contactId, productId, today);
    invoiceId = created.id;
    await ctx.save({ external_id: invoiceId, provider: "parasut" });
    if (!totalsMatch(created.attributes.gross_total, order.total_kurus)) {
      return { outcome: "failed", error: `Paraşüt toplamı (${String(created.attributes.gross_total)} TL) siparişle uyuşmuyor; fatura resmîleştirilmedi, Paraşüt'te elle kontrol edin.` };
    }
  }

  // 4: resmîleştirme (bir kez)
  let jobId = row.job_id;
  let docType = row.document_type;
  if (!docType) {
    const existing = await activeEDocument(client, invoiceId);
    if (existing.ref) {
      docType = existing.ref.type === "e_invoices" ? "e_invoice" : "e_archive";
      await ctx.save({ document_type: docType });
    } else {
      // Yeniden denemede de: resmîleştirmeden önce Paraşüt'teki toplam siparişle aynı olmalı.
      if (!totalsMatch(existing.invoice?.attributes.gross_total, order.total_kurus)) {
        return { outcome: "failed", error: `Paraşüt toplamı (${String(existing.invoice?.attributes.gross_total)} TL) siparişle uyuşmuyor; fatura resmîleştirilmedi, Paraşüt'te elle kontrol edin.` };
      }
      const inv = order.invoice;
      const taxId = inv.type === "corporate" ? inv.taxId : inv.tckn;
      const inbox = taxId ? many(await client.request("GET", `/e_invoice_inboxes?filter[vkn]=${encodeURIComponent(taxId)}`))[0] : undefined;
      const alias = inbox ? String(inbox.attributes.e_invoice_address ?? "") : "";
      const paidDay = order.paid_at ? turkeyDay(new Date(order.paid_at)) : today;
      const job = alias
        ? one(await client.request("POST", "/e_invoices", {
            data: { type: "e_invoices", attributes: { scenario: "basic", to: alias }, relationships: { invoice: { data: { id: invoiceId, type: "sales_invoices" } } } },
          }))
        : one(await client.request("POST", "/e_archives", {
            data: {
              type: "e_archives",
              attributes: { internet_sale: { url: ctx.siteUrl, payment_type: "KREDIKARTI/BANKAKARTI", payment_platform: "iyzico", payment_date: paidDay } },
              relationships: { sales_invoice: { data: { id: invoiceId, type: "sales_invoices" } } },
            },
          }));
      docType = alias ? "e_invoice" : "e_archive";
      jobId = job?.id ?? null;
      await ctx.save({ document_type: docType, job_id: jobId });
    }
  }

  // 5: iş sonucu
  if (jobId) {
    const tries = ctx.pollJob?.tries ?? 1;
    for (let i = 0; i < tries; i++) {
      let status = "";
      let errors: string[] = [];
      try {
        const job = one(await client.request("GET", `/trackable_jobs/${jobId}`));
        status = String(job?.attributes.status ?? "");
        errors = Array.isArray(job?.attributes.errors) ? (job!.attributes.errors as unknown[]).map(String) : [];
      } catch (e) {
        // İş kimliği 15 dk sonra geçersizleşir: sonucu faturanın e-belgesinden okuruz.
        if (e instanceof ParasutError && e.status === 404) status = "expired";
        else throw e;
      }
      if (status === "error") return { outcome: "failed", error: `Paraşüt resmîleştirme hatası: ${errors.join("; ").slice(0, 500) || "ayrıntı yok"}` };
      if (status === "done" || status === "expired") break;
      if (i < tries - 1) await ctx.pollJob!.sleep(3000);
      else return { outcome: "waiting" };
    }
  }
  const final = await activeEDocument(client, invoiceId);
  if (!final.ref) return { outcome: "waiting" };
  const invoiceNo = (final.invoice?.attributes.invoice_no as string | undefined) ?? (final.e?.attributes.invoice_number as string | undefined) ?? null;
  const ettn = (final.e?.attributes.uuid as string | undefined) ?? null;
  return { outcome: "issued", invoiceNo, ettn };
}

export interface InvoiceRunReport {
  configured: boolean;
  processed: number;
  issued: number;
  waiting: number;
  failed: number;
  skipped: number;
}

/** Bekleyen satış faturalarını (en eski 10) işler. */
export async function runParasutInvoices(
  db: SupabaseClient,
  client: ParasutClient | null,
  opts: { siteUrl: string; now?: Date; pollJob?: { tries: number; sleep: (ms: number) => Promise<void> }; limit?: number },
): Promise<InvoiceRunReport> {
  const report: InvoiceRunReport = { configured: !!client, processed: 0, issued: 0, waiting: 0, failed: 0, skipped: 0 };
  if (!client) return report;
  const { data: rows, error } = await db
    .from("order_invoices")
    .select("id, order_id, external_id, document_type, job_id, attempts")
    .eq("kind", "sale")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 10);
  if (error) throw new Error("Bekleyen faturalar okunamadı.");
  for (const row of (rows ?? []) as InvoiceRow[]) {
    const { data: order } = await db
      .from("release_orders")
      .select("id, order_no, is_test, buyer_type, buyer_first_name, buyer_last_name, buyer_email, buyer_phone, invoice, quantity, unit_price_kurus, total_kurus, vat_rate, paid_at, site_snapshot")
      .eq("id", row.order_id)
      .maybeSingle();
    if (!order) continue;
    report.processed++;
    const attempts = row.attempts + 1;
    const save = async (patch: Row) => {
      const { error: e } = await db.from("order_invoices").update(patch).eq("id", row.id).eq("status", "pending");
      if (e) throw new Error("Fatura kaydı güncellenemedi.");
    };
    let result: StepResult;
    try {
      if ((order as OrderForInvoice).is_test) {
        report.skipped++;
        continue;
      }
      await save({ attempts, last_attempt_at: (opts.now ?? new Date()).toISOString() });
      result = await advanceInvoice(client, row, order as OrderForInvoice, { siteUrl: opts.siteUrl, now: opts.now ?? new Date(), save, pollJob: opts.pollJob });
    } catch (e) {
      const message = e instanceof ParasutError ? e.message : "Paraşüt'e ulaşılamadı.";
      result = attempts >= MAX_ATTEMPTS ? { outcome: "failed", error: `${message} (${attempts} deneme)` } : { outcome: "waiting" };
      if (result.outcome === "waiting") await save({ error: message.slice(0, 500) }).catch(() => undefined);
    }
    if (result.outcome === "issued") {
      await save({ status: "issued", provider: "parasut", invoice_no: result.invoiceNo, ettn: result.ettn, issued_at: (opts.now ?? new Date()).toISOString(), error: null });
      await db.from("order_events").insert({ order_id: row.order_id, type: "invoice_issued", actor: "system", data: { provider: "parasut", invoiceNo: result.invoiceNo } }).then(() => undefined, () => undefined);
      report.issued++;
    } else if (result.outcome === "failed") {
      await save({ status: "failed", error: result.error.slice(0, 500) });
      report.failed++;
    } else if (result.outcome === "waiting") report.waiting++;
    else report.skipped++;
  }
  return report;
}
