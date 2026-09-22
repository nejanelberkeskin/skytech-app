"use client";

import { useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import {
  CONSENT_LABELS,
  DOCUMENT_LABELS,
  INVOICE_STATUS_LABELS,
  ORDER_EVENT_LABELS,
  ORDER_STATUS_LABELS,
  REFUND_REASON_LABELS,
  REFUND_STATUS_LABELS,
} from "@/lib/orders/labels";
import type { OrderEventType, OrderStatus } from "@/lib/orders/types";
import { formatCount, formatTry } from "@/lib/pricing";
import { ilAdi } from "@/lib/tr-iller";

/* Admin — sipariş ayrıntısı: alıcı/fatura, takvim, ödeme, uyarılar, iade, fatura, belgeler,
   onay kayıtları, olay geçmişi ve işlemler. Veri /api/admin/release-orders/[id] ucundan gelir;
   işlemler `act` ile aynı uca POST edilir (sayfa listeyi ve ayrıntıyı tazeler). */

export interface Detail {
  order: Record<string, unknown> & {
    id: string;
    order_no: string;
    status: OrderStatus;
    is_test: boolean;
    quantity: number;
    unit_price_kurus: number;
    total_kurus: number;
    vat_rate: number;
    invoice: Record<string, unknown> & { type: "individual" | "corporate"; address?: Record<string, string | null> };
    consents: Record<string, { granted: boolean; at: string; version: string }>;
    payment_meta: Record<string, unknown> | null;
    site_snapshot: { name: string; province: string | null; district: string | null };
  };
  documents: { kind: string; title: string; sha256: string; template_version: string; created_at: string }[];
  events: { id: number; type: OrderEventType; actor: string; data: Record<string, unknown> | null; created_at: string }[];
  refunds: { id: string; amount_kurus: number; reason: string; status: string; provider: string | null; provider_ref: string | null; error: string | null; requested_by: string; created_at: string; completed_at: string | null }[];
  invoices: { id: string; kind: string; status: string; invoice_no: string | null; ettn: string | null; issued_at: string | null; created_at: string }[];
  duplicates: { paymentId: string; paidKurus: number; provider: string; refunded: boolean }[];
  batch: { id: string; title: string | null; planned_on: string | null; released_on: string | null } | null;
  canManageMoney: boolean;
}

export const STATUS_BADGE: Record<OrderStatus, string> = {
  draft: "ring-1 ring-slate-500/50 bg-slate-500/10 text-slate-300",
  awaiting_payment: "ring-1 ring-yellow-500/50 bg-yellow-500/10 text-yellow-300",
  payment_failed: "ring-1 ring-orange-500/50 bg-orange-500/10 text-orange-300",
  expired: "ring-1 ring-slate-500/50 bg-slate-500/10 text-slate-400",
  paid: "ring-1 ring-sky-500/50 bg-sky-500/10 text-sky-300",
  confirmed: "ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  scheduled: "ring-1 ring-teal-500/50 bg-teal-500/10 text-teal-300",
  released: "ring-1 ring-green-500/50 bg-green-500/10 text-green-300",
  monitoring: "ring-1 ring-lime-500/50 bg-lime-500/10 text-lime-300",
  completed: "ring-1 ring-emerald-500/50 bg-emerald-500/15 text-emerald-200",
  withdrawal_requested: "ring-1 ring-amber-500/50 bg-amber-500/10 text-amber-300",
  cancelled_by_seller: "ring-1 ring-amber-500/50 bg-amber-500/10 text-amber-300",
  refunded: "ring-1 ring-red-500/40 bg-red-500/10 text-red-300",
};

export const dt = (iso: string | null | undefined, withTime = true) =>
  iso ? new Date(iso).toLocaleString("tr-TR", withTime ? { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" } : { dateStyle: "long", timeZone: "Europe/Istanbul" }) : "—";
export const day = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("tr-TR", { dateStyle: "long" }) : "—");

export type ReleaseOrderAct = (body: Record<string, unknown>, okMessage: string) => Promise<boolean>;


export default function ReleaseOrderDetail({ detail, act, onClose }: { detail: Detail; act: ReleaseOrderAct; onClose: () => void }) {
  const o = detail.order;
  const inv = o.invoice;
  const addr = inv.address ?? {};
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : null);

  const [note, setNote] = useState(s("admin_note") ?? "");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<"refund" | "cancel" | string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [ettn, setEttn] = useState("");
  const [issuedOn, setIssuedOn] = useState(() => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10));

  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const done = await act(body, ok);
    setBusy(false);
    if (done) setConfirming(null);
    return done;
  };

  const money = detail.canManageMoney;
  const refundable = o.status === "withdrawal_requested" || o.status === "cancelled_by_seller";
  const cancellable = o.status === "paid" || o.status === "confirmed" || o.status === "scheduled";
  const invoiceable = ["paid", "confirmed", "scheduled", "released", "monitoring", "completed"].includes(o.status);
  const hasOpenInvoice = detail.invoices.some((i) => i.kind === "sale" && (i.status === "pending" || i.status === "issued"));
  const pendingInvoice = detail.invoices.find((i) => i.status === "pending");
  const openDuplicates = detail.duplicates.filter((d) => !d.refunded);
  const capacityNotHeld = o.payment_meta?.capacityHeld === false;
  const total = formatTry(o.total_kurus, "tr");

  return (
    <>
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4 sticky top-0 bg-[#0b1410]/95 backdrop-blur z-10">
        <div>
          <h2 id="siparis-detay-baslik" className="font-bold text-white text-lg font-mono flex items-center gap-3 flex-wrap">
            {o.order_no}
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-sans ${STATUS_BADGE[o.status]}`}>{ORDER_STATUS_LABELS[o.status]}</span>
            {o.is_test && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold font-sans ring-1 ring-amber-500/50 bg-amber-500/10 text-amber-300">DENEME</span>}
          </h2>
          <p className="text-xs text-slate-400">{dt(s("created_at"))} · {(s("locale") ?? "tr").toUpperCase()} · {o.user_id ? "üye" : "misafir"}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-xl transition-colors" aria-label="Kapat">&times;</button>
      </div>

      <div className="p-6 space-y-6">
        {(openDuplicates.length > 0 || capacityNotHeld) && (
          <div className="bg-amber-500/10 ring-1 ring-amber-500/40 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-amber-200 text-sm">⚠️ Dikkat gerektiren durum</h3>
            {capacityNotHeld && (
              <p className="text-sm text-amber-100/90">
                Bu sipariş ödeme süresi dolduktan SONRA ödendi ve o sırada sahada yer kalmamıştı: sipariş için kapasite ayrılamadı. Sahanın kapasitesini artırın ya da
                siparişi satıcı kaynaklı iptal edip bedelini iade edin.{" "}
                <button type="button" disabled={busy} onClick={() => run({ action: "reserve_capacity" }, "Kapasite ayrıldı.")} className="underline font-semibold text-amber-200 hover:text-white disabled:opacity-60">
                  Kapasiteyi şimdi ayırmayı dene
                </button>
              </p>
            )}
            {openDuplicates.map((d) => (
              <div key={d.paymentId} className="flex items-center justify-between gap-4 flex-wrap text-sm text-amber-100/90">
                <span>
                  Aynı siparişe <strong>ikinci bir tahsilat</strong> yapılmış: {formatTry(d.paidKurus, "tr")} · ödeme kimliği <span className="font-mono">{d.paymentId}</span>
                </span>
                {money &&
                  (confirming === `dup:${d.paymentId}` ? (
                    <span className="flex gap-2">
                      <Button size="sm" variant="primary" loading={busy} onClick={() => run({ action: "refund_duplicate", paymentId: d.paymentId }, "Çift tahsilat iade edildi.")}>
                        {formatTry(d.paidKurus, "tr")} iade et
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>Vazgeç</Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setConfirming(`dup:${d.paymentId}`)}>Bu tahsilatı iade et</Button>
                  ))}
              </div>
            ))}
          </div>
        )}

        <Section title="Sipariş">
          <Grid>
            <Info label="Proje Uygulama Sahası" value={o.site_snapshot.name} />
            <Info label="Konum" value={[o.site_snapshot.district, o.site_snapshot.province].filter(Boolean).join(", ") || "—"} />
            <Info label="Tohum topu adedi" value={formatCount(o.quantity, "tr")} />
            <Info label="Birim bedel" value={formatTry(o.unit_price_kurus, "tr")} />
            <Info label={`Toplam (KDV %${Number(o.vat_rate)} dâhil)`} value={total} />
            <Info label="Sertifikadaki ad" value={s("certificate_name") ?? "—"} />
            <Info label="Sezon" value={s("season_label") ?? "—"} />
            <Info label="Bırakma partisi" value={detail.batch ? `${detail.batch.title ?? "Parti"} · plan ${day(detail.batch.planned_on)}` : "—"} />
          </Grid>
        </Section>

        <Section title="Alıcı ve fatura">
          <Grid>
            <Info label="Ad soyad" value={`${s("buyer_first_name")} ${s("buyer_last_name")}`} />
            <Info label="Fatura türü" value={inv.type === "corporate" ? "Kurumsal" : "Bireysel"} />
            <Info label="E-posta" value={<a href={`mailto:${s("buyer_email")}`} className="text-emerald-300 hover:underline break-all">{s("buyer_email")}</a>} />
            <Info label="Telefon" value={<a href={`tel:${s("buyer_phone")}`} className="text-emerald-300 hover:underline">{s("buyer_phone")}</a>} />
            {inv.type === "corporate" ? (
              <>
                <Info label="Unvan" value={String(inv.companyTitle ?? "—")} />
                <Info label="Vergi dairesi / no" value={`${inv.taxOffice ?? "—"} / ${inv.taxId ?? "—"}`} />
                <Info label="Yetkili" value={String(inv.authorizedPerson ?? "—")} />
                <Info label="e-Fatura mükellefi" value={inv.eInvoiceUser ? "Evet" : "Hayır"} />
                {inv.mersis ? <Info label="MERSİS" value={String(inv.mersis)} /> : null}
                {inv.kep ? <Info label="KEP" value={String(inv.kep)} /> : null}
                {inv.poNumber ? <Info label="Satın alma no" value={String(inv.poNumber)} /> : null}
              </>
            ) : (
              <Info label="T.C. kimlik no" value={inv.tckn ? String(inv.tckn) : "verilmedi (faturada 11111111111)"} />
            )}
            <div className="col-span-2">
              <Info label="Fatura adresi" value={[addr.line, addr.district, ilAdi(addr.province ?? null) ?? addr.province, addr.postalCode].filter(Boolean).join(", ")} />
            </div>
          </Grid>
        </Section>

        <Section title="Takvim ve ödeme">
          <Grid>
            <Info label="Ödeme" value={o.paid_at ? dt(s("paid_at")) : `ödenmedi · son ${dt(s("payment_expires_at"))}`} />
            <Info label="Sağlayıcı / ödeme kimliği" value={`${s("payment_provider") ?? "—"} / ${s("payment_id") ?? "—"}`} />
            <Info label="Cayma hakkının son anı" value={dt(s("withdrawal_deadline"))} />
            <Info label="Sözleşmedeki son tarih" value={day(s("performance_deadline"))} />
            <Info label="Kesinleşme" value={dt(s("confirmed_at"))} />
            <Info label="Bırakma" value={dt(s("released_at"))} />
            {o.withdrawal_requested_at ? <Info label="Cayma bildirimi" value={`${dt(s("withdrawal_requested_at"))} · ${s("withdrawal_channel") ?? ""}`} /> : null}
            {o.cancelled_at ? <Info label="Satıcı iptali" value={`${dt(s("cancelled_at"))}${s("cancel_reason") ? ` · ${s("cancel_reason")}` : ""}`} /> : null}
            {o.refunded_at ? <Info label="İade" value={dt(s("refunded_at"))} /> : null}
            {o.payment_meta?.lastFourDigits ? <Info label="Kart" value={`${o.payment_meta.cardAssociation ?? ""} •••• ${o.payment_meta.lastFourDigits}`} /> : null}
          </Grid>
        </Section>

        {(detail.refunds.length > 0 || refundable) && (
          <Section title="İade">
            {detail.refunds.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 text-sm bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                <div>
                  <p className="text-white font-medium">{formatTry(r.amount_kurus, "tr")} · {REFUND_REASON_LABELS[r.reason] ?? r.reason}</p>
                  <p className="text-xs text-slate-500">açıldı {dt(r.created_at)}{r.completed_at ? ` · yapıldı ${dt(r.completed_at)}` : ""}{r.provider_ref ? ` · ref ${r.provider_ref}` : ""}</p>
                  {r.error ? <p className="text-xs text-red-300 mt-1 break-words">Son hata: {r.error}</p> : null}
                </div>
                <span className={`shrink-0 text-xs font-semibold ${r.status === "succeeded" ? "text-emerald-300" : r.status === "failed" ? "text-red-300" : "text-amber-300"}`}>{REFUND_STATUS_LABELS[r.status] ?? r.status}</span>
              </div>
            ))}
            {refundable && money && (
              <div className="pt-1">
                {confirming === "refund" ? (
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
                    <p className="text-sm text-slate-200">
                      <strong>{total}</strong> tutarın tamamı, ödemenin alındığı araca ({s("payment_provider")}) iade edilecek. Müşteriye bildirim e-postası gider; sahada ayrılan kapasite serbest kalır. Bu işlem geri alınamaz.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="primary" loading={busy} onClick={() => run({ action: "refund" }, "İade yapıldı; müşteriye bildirildi.")}>{total} iade et</Button>
                      <Button variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>Vazgeç</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="primary" onClick={() => setConfirming("refund")}>İadeyi yap</Button>
                )}
              </div>
            )}
            {refundable && !money && <p className="text-xs text-slate-500">İade işlemini Muhasebe &amp; Finans ya da Super Admin yapabilir.</p>}
          </Section>
        )}

        {(detail.invoices.length > 0 || (invoiceable && money)) && (
          <Section title="Fatura">
            {detail.invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-4 text-sm bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                <div>
                  <p className="text-white font-medium">
                    {i.kind === "refund" ? <span className="text-amber-300">İade faturası · </span> : null}
                    {i.invoice_no ?? "Numara bekliyor"}{i.ettn ? <span className="text-slate-500 font-normal"> · ETTN {i.ettn}</span> : null}
                  </p>
                  <p className="text-xs text-slate-500">kuyruğa alındı {dt(i.created_at)}{i.issued_at ? ` · fatura tarihi ${dt(i.issued_at, false)}` : ""}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold ${i.status === "issued" ? "text-emerald-300" : "text-amber-300"}`}>{INVOICE_STATUS_LABELS[i.status] ?? i.status}</span>
              </div>
            ))}
            {money && invoiceable && !hasOpenInvoice && (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-slate-500">Fatura olağan durumda bırakma tamamlanınca kuyruğa girer. Alıcı önceden isterse şimdi kuyruğa alabilirsiniz.</p>
                <Button variant="secondary" size="sm" loading={busy} onClick={() => run({ action: "invoice_now" }, "Sipariş fatura kuyruğuna alındı.")}>Şimdi fatura kes</Button>
              </div>
            )}
            {money && pendingInvoice && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
                <p className="text-xs text-slate-400">
                  {pendingInvoice.kind === "refund"
                    ? "Bu siparişin satış faturası kesilmişti ve bedeli iade edildi: iade faturasını (ya da fatura iptalini) muhasebe programında işleyip numarasını buraya yazın."
                    : "Faturayı muhasebe programında / e-Arşiv portalında kestikten sonra numarasını buraya işleyin."}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input label="Fatura no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="SKY2026000000001" maxLength={40} />
                  <Input label="ETTN (isteğe bağlı)" value={ettn} onChange={(e) => setEttn(e.target.value)} maxLength={60} />
                  <Input label="Fatura tarihi" type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={busy}
                  disabled={invoiceNo.trim().length < 3}
                  onClick={async () => {
                    const ok = await run({ action: "invoice_issued", invoiceId: pendingInvoice.id, invoiceNo: invoiceNo.trim(), ettn: ettn.trim() || null, issuedOn }, "Fatura işlendi.");
                    if (ok) { setInvoiceNo(""); setEttn(""); }
                  }}
                >
                  Faturayı işle
                </Button>
              </div>
            )}
          </Section>
        )}

        <Section title="Belgeler (müşteriye giden kopyalar)">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
            {detail.documents.map((d) => (
              <div key={d.kind} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="text-white">{DOCUMENT_LABELS[d.kind] ?? d.title}</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">sürüm {d.template_version} · sha256 {d.sha256.slice(0, 16)}…</p>
                </div>
                {money && <div className="flex gap-3 shrink-0">
                  <a href={`/api/admin/release-orders/${o.id}/belge/${d.kind}?bicim=html`} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">Görüntüle</a>
                  <a href={`/api/admin/release-orders/${o.id}/belge/${d.kind}?bicim=pdf`} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">PDF</a>
                </div>}
              </div>
            ))}
            {detail.documents.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Belge yok.</p>}
          </div>
        </Section>

        <Section title="Onay kayıtları">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
            {Object.entries(o.consents ?? {}).map(([k, c]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="text-slate-300">{CONSENT_LABELS[k] ?? k}</span>
                <span className="text-xs text-slate-500 text-right">
                  <span className={c.granted ? "text-emerald-300 font-semibold" : "text-slate-400"}>{c.granted ? "işaretlendi" : "işaretlenmedi"}</span> · {dt(c.at)} · sürüm {c.version}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Olay geçmişi">
          <ol className="space-y-2">
            {detail.events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="text-[11px] text-slate-500 w-28 shrink-0 pt-0.5">{dt(e.created_at)}</span>
                <div className="min-w-0">
                  <p className="text-slate-200">
                    {ORDER_EVENT_LABELS[e.type] ?? e.type}
                    <span className="text-xs text-slate-500"> · {e.actor === "customer" ? "müşteri" : e.actor === "system" ? "sistem" : "yönetici"}</span>
                  </p>
                  <EventData type={e.type} data={e.data} />
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Yönetici notu (müşteriye gösterilmez)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={4000} placeholder="Görüşme özeti, sonraki adım…" />
          <Button variant="secondary" size="sm" loading={busy} disabled={note === (s("admin_note") ?? "")} onClick={() => run({ action: "note", note }, "Not kaydedildi.")}>Notu kaydet</Button>
        </Section>

        {cancellable && money && (
          <Section title="Satıcı kaynaklı iptal">
            <p className="text-xs text-slate-500">
              Hizmet ifa edilemeyecekse (saha kapandı, izin alınamadı vb.) sipariş iptal edilir, müşteriye bildirim gider ve bedelin tamamı en geç 14 gün içinde iade edilmelidir.
              İptalden sonra yukarıda &quot;İadeyi yap&quot; düğmesi açılır.
            </p>
            <Textarea label="İptal gerekçesi (iç kayıt)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} />
            {confirming === "cancel" ? (
              <div className="flex gap-3">
                <Button variant="primary" loading={busy} onClick={async () => { const ok = await run({ action: "cancel_by_seller", reason: reason.trim() }, "Sipariş iptal edildi; müşteriye bildirildi."); if (ok) setReason(""); }}>
                  Evet, siparişi iptal et
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>Vazgeç</Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" disabled={reason.trim().length < 5} onClick={() => setConfirming("cancel")}>Siparişi iptal et…</Button>
            )}
          </Section>
        )}

        <p className="text-[11px] text-slate-600 break-all">Kayıt kimliği: {o.id} · belge sürümü {s("documents_version")} · kaynak {s("source_path") ?? "—"}</p>
      </div>
    </>
  );
}

/** Olay verisinin okunur özeti (ham JSON yerine). */
function EventData({ type, data }: { type: OrderEventType; data: Record<string, unknown> | null }) {
  if (!data) return null;
  const parts: string[] = [];
  const add = (label: string, v: unknown) => { if (v !== undefined && v !== null && v !== "") parts.push(`${label}: ${String(v)}`); };
  if (data.duplicate === true) parts.push("ÇİFT TAHSİLAT");
  if (type === "status_changed") { add("", data.from && data.to ? `${ORDER_STATUS_LABELS[data.from as OrderStatus] ?? data.from} → ${ORDER_STATUS_LABELS[data.to as OrderStatus] ?? data.to}` : data.note); add("gerekçe", data.reason); if (data.capacityReserved === false) parts.push("kapasite ayrılamadı"); }
  if (typeof data.paidKurus === "number") add("tutar", formatTry(data.paidKurus, "tr"));
  if (typeof data.amountKurus === "number") add("tutar", formatTry(data.amountKurus, "tr"));
  add("ödeme kimliği", data.paymentId);
  add("iade ref", data.refundId);
  add("yöntem", data.method === "cancel" ? "aynı gün iptali" : data.method === "refund" ? "iade" : undefined);
  add("şablon", data.template);
  add("neden", type === "email_failed" ? (data.reason === "no_api_key" ? "e-posta anahtarı yok (yerel ortam)" : "gönderim hatası") : type === "payment_failed" ? data.reason : undefined);
  add("hata", data.error);
  add("kanal", data.channel);
  add("iade son günü", data.refundDueOn);
  add("fatura no", data.invoiceNo);
  if (type === "admin_note") add("not", data.note === "invoice_queued" ? "fatura kuyruğuna alındı" : data.note);
  if (type === "withdrawal_requested") add("müşteri notu", data.note);
  if (type === "documents_generated" && Array.isArray(data.kinds)) add("belgeler", (data.kinds as string[]).map((k) => DOCUMENT_LABELS[k] ?? k).join(", "));
  const text = parts.map((p) => p.replace(/^: /, "")).join(" · ");
  return text ? <p className="text-xs text-slate-500 break-words">{text}</p> : null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</h3>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-white font-medium break-words">{value}</p>
    </div>
  );
}
