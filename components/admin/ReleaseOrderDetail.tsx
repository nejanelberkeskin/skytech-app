"use client";
import { useRef, useState, type ReactNode } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import type { OrderDetailDto } from "@/lib/orders/admin-dto";
import type { OrderEventType, OrderStatus } from "@/lib/orders/types";
import { CONSENT_LABELS, DOCUMENT_LABELS, INVOICE_STATUS_LABELS, ORDER_EVENT_LABELS, ORDER_STATUS_LABELS, REFUND_REASON_LABELS, REFUND_STATUS_LABELS } from "@/lib/orders/labels";
import { formatCount, formatTry } from "@/lib/pricing";
import { ilAdi } from "@/lib/tr-iller";
import RefundOrderPanel from "./operations/RefundOrderPanel";
import VerifyNotice from "./orders/VerifyNotice";
import { GROUP_LABELS } from "./orders/view";

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


export type ReleaseOrderAct = (body: Record<string, unknown>, message: string) => Promise<boolean>;
export default function ReleaseOrderDetail({ detail, act, disabled, canUseRefundPanel, onRefundBusy, onRefundChanged }: {
  detail: OrderDetailDto; act: ReleaseOrderAct; disabled: boolean; canUseRefundPanel: boolean;
  onRefundBusy: (busy: boolean) => void; onRefundChanged: () => void;
}) {
  const o = detail.order;
  const c = detail.capabilities;
  const contact = detail.groups.includes("contact") ? detail.contact : undefined;
  const tax = detail.groups.includes("tax") ? detail.tax : undefined;
  const finance = detail.groups.includes("finance") ? detail.finance : undefined;
  const invoices = detail.groups.includes("invoices") ? detail.invoices : undefined;
  const legal = detail.groups.includes("legal") ? detail.legal : undefined;
  const certificate = detail.groups.includes("certificate") ? detail.certificate : undefined;
  const [note, setNote] = useState(o.adminNote ?? "");
  const [reason, setReason] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [ettn, setEttn] = useState("");
  const [issuedOn, setIssuedOn] = useState(() => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10));
  const [confirming, setConfirming] = useState<string | null>(null);
  const lock = useRef(false);
  const [localBusy, setLocalBusy] = useState(false);
  const busy = disabled || localBusy;
  const run = async (body: Record<string, unknown>, message: string) => {
    if (lock.current || disabled) return;
    lock.current = true; setLocalBusy(true);
    try { await act(body, message); } finally { lock.current = false; setLocalBusy(false); setConfirming(null); }
  };
  const invoiceable = ["paid", "confirmed", "scheduled", "released", "monitoring", "completed"].includes(o.status);
  const hasOpenInvoice = invoices?.some(i => i.kind === "sale" && ["pending", "issued"].includes(i.status));
  const pending = invoices?.find(i => i.status === "pending");
  const missing = Object.keys(GROUP_LABELS).filter(g => !detail.groups.includes(g as keyof typeof GROUP_LABELS) && !detail.mfaRequiredGroups.includes(g as keyof typeof GROUP_LABELS));
  return <div className="space-y-6 min-w-0">
    <div className="flex flex-wrap gap-2 items-center"><span className={`rounded-full px-3 py-1 text-sm ${STATUS_BADGE[o.status]}`}>{ORDER_STATUS_LABELS[o.status]}</span>{o.isTest && <span className="text-amber-200 text-xs">DENEME</span>}<span className="text-sm text-slate-400">{dt(o.dates.createdAt)} · {o.locale.toUpperCase()}</span></div>
    {!!detail.mfaRequiredGroups.length && <section className="space-y-3" aria-label="Doğrulama gereken bilgiler"><p className="text-sm text-amber-100">Yeniden doğrulama gerekiyor: {detail.mfaRequiredGroups.map(g => GROUP_LABELS[g]).join(", ")}.</p><VerifyNotice /></section>}
    {!!missing.length && <p className="text-sm text-slate-400">Bu kayıtta görüntüleme yetkiniz olmayan bölümler: {missing.map(g => GROUP_LABELS[g as keyof typeof GROUP_LABELS]).join(", ")}.</p>}
    {o.capacity.held === false && <section className="border border-amber-400/40 rounded-xl p-4 space-y-3"><h3 className="text-amber-200 font-medium">Kapasite ayrılmamış</h3><p className="text-sm text-slate-300">Sipariş için ayrılmış saha kapasitesi kaydı bulunmuyor. İşlem yapmadan önce saha ve sipariş durumunu kontrol edin.</p>{c.reserveCapacity && <Confirm action="reserve" label="Kapasite ayırmayı dene" confirming={confirming} setConfirming={setConfirming} disabled={busy} onConfirm={() => run({ action: "reserve_capacity" }, "Kapasite ayırma işlemi tamamlandı.")} />}</section>}
    <Section title="Sipariş"><Grid><Info label="Saha" value={o.site.name ?? o.site.snapshot.name} /><Info label="Konum" value={[o.site.snapshot.district, o.site.snapshot.province].filter(Boolean).join(", ")} /><Info label="Tohum topu adedi" value={formatCount(o.quantity, "tr")} /><Info label="Sezon" value={o.seasonLabel} /><Info label="Sertifikadaki ad" value={o.certificateName} /><Info label="Bırakma partisi" value={o.batch ? `${o.batch.title} · ${day(o.batch.plannedOn)}` : null} /></Grid></Section>
    <Section title="Alıcı"><Grid><Info label="Ad soyad" value={`${o.buyer.firstName} ${o.buyer.lastName}`} /><Info label="Alıcı türü" value={o.buyer.type === "corporate" ? "Kurumsal" : "Bireysel"} />{o.buyer.companyTitle && <Info label="Şirket unvanı" value={o.buyer.companyTitle} />}</Grid></Section>
    {contact && <Section title="İletişim"><Grid><Info label="E-posta" value={<a className="break-all underline text-emerald-300" href={`mailto:${contact.email}`}>{contact.email}</a>} /><Info label="Telefon" value={<a className="underline text-emerald-300" href={`tel:${contact.phone}`}>{contact.phone}</a>} /><Info label="Fatura adresi" value={contact.invoiceAddress ? [contact.invoiceAddress.line, contact.invoiceAddress.district, ilAdi(contact.invoiceAddress.province) ?? contact.invoiceAddress.province, contact.invoiceAddress.postalCode].filter(Boolean).join(", ") : null} /><Info label="Ticari ileti izni" value={contact.marketingConsent ? "Var" : "Yok"} /><Info label="Yetkili kişi" value={contact.authorizedPerson} /><Info label="KEP" value={contact.kep} /></Grid></Section>}
    {tax && <Section title="Vergi bilgileri"><Grid>{tax.invoiceType === "individual" ? <Info label="T.C. kimlik no" value={tax.tckn} /> : <><Info label="Vergi no" value={tax.taxId} /><Info label="Vergi dairesi" value={tax.taxOffice} /><Info label="MERSİS" value={tax.mersis} /><Info label="e-Fatura mükellefi" value={tax.eInvoiceUser === null ? null : tax.eInvoiceUser ? "Evet" : "Hayır"} /><Info label="Satın alma no" value={tax.poNumber} /></>}</Grid></Section>}
    <Section title="Takvim"><Grid><Info label="Ödeme tarihi" value={dt(o.dates.paidAt)} /><Info label="Ödeme süresinin sonu" value={dt(o.dates.paymentExpiresAt)} /><Info label="Cayma hakkının son anı" value={dt(o.dates.withdrawalDeadline)} /><Info label="Sözleşmedeki son tarih" value={dt(o.dates.performanceDeadline, false)} /><Info label="Kesinleşme" value={dt(o.dates.confirmedAt)} /><Info label="Bırakma" value={dt(o.dates.releasedAt)} />{o.dates.withdrawalRequestedAt && <Info label="Cayma bildirimi" value={`${dt(o.dates.withdrawalRequestedAt)} · ${o.withdrawalChannel ?? ""}`} />}{o.dates.cancelledAt && <Info label="Satıcı iptali" value={`${dt(o.dates.cancelledAt)} · ${o.cancelReason ?? ""}`} />}{o.dates.refundedAt && <Info label="İade tarihi" value={dt(o.dates.refundedAt)} />}</Grid></Section>
    {finance && <Section title="Finans"><Grid><Info label="Birim bedel" value={formatTry(finance.unitPriceKurus, "tr")} /><Info label={`Toplam (KDV %${finance.vatRate} dâhil)`} value={formatTry(finance.totalKurus, "tr")} /><Info label="Sağlayıcı" value={finance.payment.provider} /><Info label="Ödeme kimliği" value={finance.payment.paymentId} /></Grid>
      {finance.duplicates.filter(d => !d.refunded).map(d => <p className="text-sm text-amber-200 break-all" key={d.paymentId}>Çift tahsilat: {formatTry(d.paidKurus, "tr")} · {d.paymentId}</p>)}
      {finance.refunds.map(r => <article key={r.id} className="border border-white/10 rounded-xl p-3 text-sm space-y-1"><p>{formatTry(r.amountKurus, "tr")} · {REFUND_REASON_LABELS[r.reason] ?? r.reason} · {REFUND_STATUS_LABELS[r.status] ?? r.status}</p><p className="text-slate-400">{dt(r.createdAt)}{r.completedAt && ` · tamamlandı ${dt(r.completedAt)}`}</p>{r.providerRef && <p className="break-all">Referans: {r.providerRef}</p>}{r.error && <p className="text-red-200 break-words">{r.error}</p>}</article>)}
    </Section>}
    {finance && canUseRefundPanel && (c.refund || c.refundDuplicate) && <fieldset disabled={busy} className="min-w-0"><legend className="sr-only">İade işlemleri</legend><RefundOrderPanel orderId={o.id} onBusyChange={onRefundBusy} onChanged={onRefundChanged} /></fieldset>}
    {invoices && <Section title="Faturalar">
      {!invoices.length && <p className="text-sm text-slate-400">Fatura kaydı yok.</p>}
      {invoices.map(i => <article key={i.id} className="border border-white/10 rounded-xl p-3 space-y-1 text-sm break-words"><p>{i.kind === "refund" ? "İade faturası" : "Satış faturası"} · {i.invoiceNo ?? "Numara bekliyor"} · {INVOICE_STATUS_LABELS[i.status] ?? i.status}</p><p className="text-slate-400">{dt(i.createdAt)}{i.issuedAt && ` · kesildi ${dt(i.issuedAt)}`}</p>{i.ettn && <p className="break-all">ETTN: {i.ettn}</p>}{i.error && <p className="text-red-200">{i.error}</p>}</article>)}
      {c.invoiceIssue && pending && <form className="space-y-3 border border-white/10 rounded-xl p-4" onSubmit={e => { e.preventDefault(); void run({ action: "invoice_issued", invoiceId: pending.id, invoiceNo: invoiceNo.trim(), ettn: ettn.trim() || null, issuedOn }, "Fatura bilgileri kaydedildi."); }}><p className="text-sm text-slate-300">Faturayı muhasebe sisteminde kestikten sonra bilgilerini kaydedin.</p><Input label="Fatura no" minLength={3} maxLength={40} required value={invoiceNo} disabled={busy} onChange={e => setInvoiceNo(e.target.value)} /><Input label="ETTN (isteğe bağlı)" maxLength={60} value={ettn} disabled={busy} onChange={e => setEttn(e.target.value)} /><Input label="Fatura tarihi" type="date" required value={issuedOn} disabled={busy} onChange={e => setIssuedOn(e.target.value)} /><Button type="submit" disabled={busy || invoiceNo.trim().length < 3 || !issuedOn}>Fatura bilgilerini kaydet</Button></form>}
    </Section>}
    {c.invoiceQueue && invoiceable && !hasOpenInvoice && <Section title="Fatura işlemi"><p className="text-sm text-slate-300">Siparişi fatura hazırlanması için kuyruğa alın. Bu düğme faturanın kesildiğini doğrulamaz.</p><Confirm action="invoice" label="Fatura kuyruğuna al" confirming={confirming} setConfirming={setConfirming} disabled={busy} onConfirm={() => run({ action: "invoice_now" }, "Sipariş fatura kuyruğuna alındı.")} /></Section>}
    {legal && <><Section title="Belgeler"><p className="text-xs text-slate-400">Belge sürümü: {legal.documentsVersion}</p>{legal.documents.map(d => <article key={d.kind} className="rounded-xl border border-white/10 p-3 space-y-1"><p className="text-sm">{DOCUMENT_LABELS[d.kind] ?? d.title}</p><p className="text-xs text-slate-400 break-all">{d.templateVersion} · SHA256 {d.sha256}</p>{c.documents && <div className="flex gap-4 text-sm text-emerald-300">{["html", "pdf"].map(format => <a className="min-h-11 inline-flex items-center underline" key={format} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" href={`/api/admin/release-orders/${encodeURIComponent(o.id)}/belge/${d.kind}?bicim=${format}`}>{format === "html" ? "Görüntüle" : "PDF"}</a>)}</div>}</article>)}{!legal.documents.length && <p className="text-sm text-slate-400">Belge kaydı yok.</p>}</Section><Section title="Onay kayıtları">{Object.entries(legal.consents).map(([key, consent]) => <div key={key} className="border-b border-white/10 py-2 text-sm"><p>{CONSENT_LABELS[key] ?? key}: {consent.granted ? "Verildi" : "Verilmedi"}</p><p className="text-xs text-slate-400">{dt(consent.at)} · {consent.version ?? "—"}{consent.revokedAt && ` · geri alındı ${dt(consent.revokedAt)}`}</p></div>)}</Section></>}
    {certificate && <Section title="Özel sertifika"><Info label="Doğrulama kodu" value={certificate.code} /></Section>}
    <Section title="Olay geçmişi"><ol className="space-y-3">{detail.events.map(e => <li key={e.id} className="border-l-2 border-white/15 pl-3 space-y-1"><p className="text-sm">{ORDER_EVENT_LABELS[e.type as OrderEventType] ?? e.type}</p><p className="text-xs text-slate-400">{dt(e.at)} · {e.actor.kind === "customer" ? "Müşteri" : e.actor.kind === "system" ? "Sistem" : "Yönetici"}</p><EventData type={e.type as OrderEventType} data={e.data} /></li>)}</ol>{!detail.events.length && <p className="text-sm text-slate-400">Olay kaydı yok.</p>}</Section>
    <Section title="Yönetici notu">{c.note ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run({ action: "note", note }, "Not kaydedildi."); }}><Textarea label="İç not (müşteriye gösterilmez)" maxLength={4000} rows={3} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /><Button type="submit" variant="secondary" disabled={busy || note === (o.adminNote ?? "")}>Notu kaydet</Button></form> : <p className="text-sm whitespace-pre-wrap break-words text-slate-300">{o.adminNote || "Not yok."}</p>}</Section>
    {c.cancel && ["paid", "confirmed", "scheduled"].includes(o.status) && <Section title="Satıcı kaynaklı iptal"><p className="text-sm text-slate-300">Siparişi iptal etmeden önce hizmet ve iade durumunu kontrol edin. İptal, iadenin tamamlandığı anlamına gelmez.</p><Textarea label="İptal gerekçesi" maxLength={1000} value={reason} disabled={busy || confirming === "cancel"} onChange={e => setReason(e.target.value)} /><Confirm action="cancel" label="Siparişi iptal et" confirming={confirming} setConfirming={setConfirming} disabled={busy || reason.trim().length < 5} onConfirm={() => run({ action: "cancel_by_seller", reason: reason.trim() }, "Sipariş iptal edildi.")} /></Section>}
    <p className="text-xs text-slate-500 break-all">Kayıt kimliği: {o.id}</p>
  </div>;
}
function Confirm({ action, label, confirming, setConfirming, disabled, onConfirm }: { action: string; label: string; confirming: string | null; setConfirming: (value: string | null) => void; disabled: boolean; onConfirm: () => void }) {
  return confirming === action ? <div className="space-y-3 rounded-xl border border-amber-400/40 p-3"><p className="text-sm text-amber-100">“{label}” işlemini onaylıyor musunuz?</p><div className="flex flex-wrap gap-2"><Button disabled={disabled} onClick={onConfirm}>Onayla: {label}</Button><Button variant="ghost" disabled={disabled} onClick={() => setConfirming(null)}>Vazgeç</Button></div></div> : <Button variant="secondary" disabled={disabled} onClick={() => setConfirming(action)}>{label}</Button>;
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="space-y-3 min-w-0"><h3 className="text-base font-semibold text-slate-200">{title}</h3>{children}</section>; }
function Grid({ children }: { children: ReactNode }) { return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</dl>; }
function Info({ label, value }: { label: string; value: ReactNode }) { return <div className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="text-sm mt-1 text-white break-words [overflow-wrap:anywhere]">{value || "—"}</dd></div>; }

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
