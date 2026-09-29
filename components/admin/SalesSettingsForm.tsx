"use client";

import { useAdmin } from "@/lib/admin-context";
import { Link } from "@/i18n/navigation";
import { accessRequest } from "./access/transport";
import { AdminApiError, errorText } from "./operations/client";
import type { SalesSettingsDto as SettingsResponse, SalesSettingsMutationDto } from "@/lib/sales/admin-dto";
import type { ReadinessItem } from "@/lib/orders/readiness";
import type { ApiWarning } from "@/lib/api/envelope";
import { validSalesResult } from "./sales/view";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Button, Input, Select } from "@/components/ui";
import { formatCount, formatTry } from "@/lib/pricing";
import {
  KNOWN_VAT_RATES,
  QUOTE_FIELDS,
  SETTINGS_LIMITS,
  diffSettings,
  salesSettingsSchema,
  settingsFieldErrors,
  type InvoiceTiming,
  type SalesSettings,
  type SettingsChange,
} from "@/lib/orders/settings-schema";

/* ═══════════════════════════════════════════════════════════════════════
   Admin — Satış Ayarları formu (sayfa: /admin/satis-ayarlari, izin gruplarına göre)
   ═══════════════════════════════════════════════════════════════════════
   Birim bedel, adet sınırları, hazır seçenekler, KDV, fatura zamanı,
   hazırlık payı ve ödeme süresi. Kaydedilen değerler sihirbazda ve sitede
   hemen geçerli olur; oluşturulmuş siparişler kendi tutarı ve belgeleriyle
   sürer. Başkası aynı anda kaydettiyse üzerine yazılmaz (409).
   ═══════════════════════════════════════════════════════════════════════ */

type Form = Record<"price" | "vat" | "min" | "max" | "presets" | "prep" | "ttl", string> & {
  timing: InvoiceTiming | "";
  paused: boolean;
};

const TIMING_LABELS: Record<InvoiceTiming, string> = {
  on_performance: "Bırakma yapılınca (önerilen)",
  on_payment: "Ödeme alınınca",
};

const FIELD_LABELS: Record<keyof SalesSettings, string> = {
  unitPriceKurus: "Birim bedel",
  minQuantity: "En az adet",
  maxQuantity: "En çok adet",
  quantityPresets: "Hazır seçenekler",
  vatRate: "KDV oranı",
  invoiceTiming: "Fatura zamanı",
  prepDays: "Hazırlık payı",
  paymentTtlMinutes: "Ödeme süresi",
  ordersPaused: "Sipariş alımı",
};

/** Form alanı → ayar alanı (hata iletisini doğru kutuya koymak için). */
const FORM_FIELD: Record<keyof SalesSettings, keyof Form> = {
  unitPriceKurus: "price",
  minQuantity: "min",
  maxQuantity: "max",
  quantityPresets: "presets",
  vatRate: "vat",
  invoiceTiming: "timing",
  prepDays: "prep",
  paymentTtlMinutes: "ttl",
  ordersPaused: "paused",
};

const L = SETTINGS_LIMITS;
const RANGE_TEXT: Record<keyof SalesSettings, string> = {
  unitPriceKurus: `${formatTry(L.unitPriceKurus.min, "tr")} ile ${formatTry(L.unitPriceKurus.max, "tr")} arasında olmalı.`,
  minQuantity: `${formatCount(L.minQuantity.min, "tr")} ile ${formatCount(L.minQuantity.max, "tr")} arasında olmalı.`,
  maxQuantity: `${formatCount(L.maxQuantity.min, "tr")} ile ${formatCount(L.maxQuantity.max, "tr")} arasında olmalı.`,
  quantityPresets: "Her seçenek geçerli bir adet olmalı.",
  vatRate: "0 ile 99,99 arasında olmalı.",
  invoiceTiming: "Bir seçenek belirleyin.",
  prepDays: `${L.prepDays.min} ile ${L.prepDays.max} gün arasında olmalı.`,
  paymentTtlMinutes: `${L.paymentTtlMinutes.min} ile ${formatCount(L.paymentTtlMinutes.max, "tr")} dakika arasında olmalı.`,
  ordersPaused: "Bir seçenek belirleyin.",
};

const ERROR_TEXT: Record<string, string> = {
  invalid: "Geçerli bir sayı girin.",
  presetsCount: `${L.presets.min} ile ${L.presets.max} arasında hazır seçenek yazın.`,
  presetOutOfRange: "Hazır seçenekler en az ve en çok adet arasında olmalı.",
  presetsOrder: "Hazır seçenekleri küçükten büyüğe, her birini bir kez yazın.",
  maxBelowMin: "En çok adet, en az adetten küçük olamaz.",
  vatDecimals: "KDV oranında en fazla iki ondalık basamak olabilir.",
};

/* ── Metin ⇄ sayı ─────────────────────────────────────────────────────────── */

/** "10" · "10,5" · "10,50" · "7.50" → kuruş; tanınmazsa NaN. */
function parsePrice(text: string): number {
  const m = text.trim().replace(/\s|TL|₺/gi, "").match(/^(\d{1,7})(?:[.,](\d{1,2}))?$/);
  if (!m) return Number.NaN;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

/** "5000" · "5.000" · "5 000" → 5000 (binlik ayırıcı yalnız üçlü gruplarda); tanınmazsa NaN. */
function parseWhole(text: string): number {
  const t = text.trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (/^\d{1,3}([.\s]\d{3})+$/.test(t)) return Number(t.replace(/[.\s]/g, ""));
  return Number.NaN;
}

/** "20" · "18,5" → 18.5; tanınmazsa NaN. */
function parseRate(text: string): number {
  const m = text.trim().replace("%", "").match(/^(\d{1,2})(?:[.,](\d{1,4}))?$/);
  if (!m) return Number.NaN;
  return Number(`${m[1]}.${m[2] ?? "0"}`);
}

/** Form kutusu için binlik ayırıcısız: 1000 → "10" · 1050 → "10,50" · 100000 → "1000". */
const priceText = (kurus: number) =>
  `${Math.trunc(kurus / 100)}${kurus % 100 ? `,${String(kurus % 100).padStart(2, "0")}` : ""}`;
const rateText = (rate: number) => String(rate).replace(".", ",");

function toForm(s: SalesSettings): Form {
  return {
    price: priceText(s.unitPriceKurus),
    vat: rateText(s.vatRate),
    min: String(s.minQuantity),
    max: String(s.maxQuantity),
    presets: s.quantityPresets.join(", "),
    timing: s.invoiceTiming,
    prep: String(s.prepDays),
    ttl: String(s.paymentTtlMinutes),
    paused: s.ordersPaused,
  };
}

/** Invalid stored fields remain visible; defaults are only loaded by an explicit user action. */
function repairForm(raw: Record<string, unknown>): Form {
  const numberText = (v: unknown) => typeof v === "number" || typeof v === "string" ? String(v) : "";
  return {
    price: typeof raw.unitPriceKurus === "number" ? priceText(raw.unitPriceKurus) : numberText(raw.unitPriceKurus),
    vat: numberText(raw.vatRate), min: numberText(raw.minQuantity), max: numberText(raw.maxQuantity),
    presets: Array.isArray(raw.quantityPresets) ? raw.quantityPresets.map(numberText).join(", ") : "",
    timing: raw.invoiceTiming === "on_payment" || raw.invoiceTiming === "on_performance" ? raw.invoiceTiming : "",
    prep: numberText(raw.prepDays), ttl: numberText(raw.paymentTtlMinutes), paused: true,
  };
}
function formErrors(fields: Record<string, string>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [FORM_FIELD[key as keyof SalesSettings] ?? key, value]));
}

function fromForm(f: Form): SalesSettings {
  return {
    unitPriceKurus: parsePrice(f.price),
    minQuantity: parseWhole(f.min),
    maxQuantity: parseWhole(f.max),
    quantityPresets: f.presets.split(/[,;]+/).map((p) => p.trim()).filter(Boolean).map(parseWhole),
    vatRate: parseRate(f.vat),
    invoiceTiming: f.timing as InvoiceTiming,
    prepDays: parseWhole(f.prep),
    paymentTtlMinutes: parseWhole(f.ttl),
    ordersPaused: f.paused,
  };
}

function valueText(field: string, value: unknown): string {
  if (value === null || value === undefined) return "Geçersiz kayıt (boş)";
  if (!["invoiceTiming", "ordersPaused"].includes(field) && !Array.isArray(value) &&
      (typeof value !== "number" || !Number.isFinite(value))) return `Geçersiz kayıt (${String(value)})`;
  if (Array.isArray(value)) return value.map((v) => formatCount(Number(v), "tr")).join(" · ");
  switch (field) {
    case "unitPriceKurus": return formatTry(Number(value), "tr");
    case "vatRate": return `%${rateText(Number(value))}`;
    case "invoiceTiming": return TIMING_LABELS[value as InvoiceTiming] ?? String(value);
    case "prepDays": return `${value} gün`;
    case "paymentTtlMinutes": return `${value} dakika`;
    case "ordersPaused": return typeof value === "boolean" ? (value ? "Durduruldu" : "Açık") : "Geçersiz kayıt";
    default: return formatCount(Number(value), "tr");
  }
}

/** Değişikliğin sonuçları — onay penceresinde gösterilir. */
function consequences(changes: SettingsChange[], openCheckouts: number | undefined): string[] {
  const has = (f: keyof SalesSettings) => changes.some((c) => c.field === f);
  const out: string[] = [];
  const pause = changes.find((c) => c.field === "ordersPaused");
  if (pause?.to === true) {
    out.push(
      `Yeni sipariş ve ödeme alınmaz; sihirbaz talep kipinde açılır ve müşteriye kısa bir açıklama gösterir. Ödeme bekleyen siparişler (${openCheckouts === undefined ? "sayısını görüntüleme yetkiniz yok" : `şu an ${openCheckouts}`}) ödenemez, süresi dolunca düşer ve ayrılan kapasite geri verilir. Ödenmiş siparişler, iadeler ve partiler etkilenmez.`,
    );
  }
  if (pause?.to === false) out.push("Sipariş ve ödeme yeniden alınır.");
  if (changes.some((c) => QUOTE_FIELDS.includes(c.field))) {
    out.push(
      `Sihirbazın son adımındaki müşteriler güncel ${has("prepDays") ? "tutarı ve takvimi" : "tutarı"} görüp siparişi yeniden onaylar. Oluşturulmuş siparişler (${openCheckouts === undefined ? "sayısını görüntüleme yetkiniz yok" : `şu an ${openCheckouts}`} ödeme bekleyen dâhil) kendi tutarı ve belgeleriyle sürer.`,
    );
  }
  if (has("unitPriceKurus") || has("vatRate")) {
    out.push("Sihirbaz, örnek sözleşme ve ön bilgilendirme sayfaları yeni değeri hemen kullanır.");
  }
  if (has("minQuantity")) out.push("Ana sayfadaki hizmet kartı ve SSS'deki en az adet de değişir.");
  if (has("prepDays")) {
    out.push("Sipariş tarihinden sezon sonuna bu kadar gün kalmıyorsa sipariş sonraki sezona yazılır; sözleşmedeki son tarih buna göre hesaplanır.");
  }
  if (has("invoiceTiming")) {
    out.push("Yalnız bundan sonra ödenen siparişlere uygulanır. Bırakılan her siparişin satış faturası, ayar ne olursa olsun, kuyruğa girer.");
  }
  if (has("paymentTtlMinutes")) out.push("Yeni ödeme oturumlarına uygulanır.");
  return out;
}

const LEVEL_STYLE: Record<ReadinessItem["level"], { icon: string; className: string; sr: string }> = {
  ok: { icon: "✓", className: "text-emerald-400", sr: "Hazır" },
  warning: { icon: "!", className: "text-amber-300", sr: "Açılıştan önce tamamlanmalı" },
  blocker: { icon: "✕", className: "text-red-400", sr: "Siparişi şu an engelliyor" },
};
const ENVIRONMENT_LABEL: Record<string, string> = { production: "canlı site", preview: "önizleme", development: "yerel geliştirme" };

const when = (iso: string) => new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });

export default function SalesSettingsForm() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<{ next?: SalesSettings; ordersPaused?: boolean; changes: SettingsChange[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { refresh } = useAdmin();
  const state = useRef({alive:false,generation:0,busy:false});
  const reviewPanel=useRef<HTMLDivElement>(null),feedback=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(confirming){reviewPanel.current?.focus();reviewPanel.current?.scrollIntoView({block:"center"});}},[confirming]);
  const [blocked,setBlocked]=useState(false),[warnings,setWarnings]=useState<ApiWarning[]>([]);
  const load = useCallback(async (keepMessage=false) => {
    const generation=++state.current.generation;setLoading(true);setData(null);setForm(null);setConfirming(null);setBlocked(true);
    try {
      const {data:json}=await accessRequest<SettingsResponse>("/api/admin/sales-settings");
      if(!state.current.alive||generation!==state.current.generation)return;
      if(!Array.isArray(json?.groups)||!json.capabilities||!json.mfa)throw new Error("Ayar yanıtı okunamadı.");
      setData(json);setForm(json.settings?(json.settings.values?toForm(json.settings.values):repairForm(json.settings.raw)):null);setFieldErrors(formErrors(json.settings?.fieldErrors??{}));setBlocked(false);if(!keepMessage)setError(null);
    }catch(e){if(!state.current.alive||generation!==state.current.generation)return;setError(errorText(e));if(e instanceof AdminApiError&&[401,403].includes(e.status))void refresh();}
    finally{if(state.current.alive&&generation===state.current.generation)setLoading(false);}
  },[refresh]);
  useEffect(()=>{const token=state.current;token.alive=true;void load();return()=>{token.alive=false;token.generation++;};},[load]);
  const reviewState = (ordersPaused:boolean) => {
    if(!data?.state || blocked || saving || data.state.repairRequired || !(ordersPaused?data.capabilities.pause:data.capabilities.resume))return;
    setConfirming({ordersPaused,changes:[{field:"ordersPaused",from:data.state.ordersPaused,to:ordersPaused}]});
  };
  const set = (key: keyof Form, value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setFieldErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
    setConfirming(null);
  };

  const errorFor = (key: keyof Form): string | undefined => {
    const code = fieldErrors[key];
    if (!code) return undefined;
    if (key === "timing") return "Fatura zamanını seçin.";
    const field = (Object.keys(FORM_FIELD) as (keyof SalesSettings)[]).find((f) => FORM_FIELD[f] === key);
    return code === "range" && field ? RANGE_TEXT[field] : (ERROR_TEXT[code] ?? RANGE_TEXT[field ?? "unitPriceKurus"]);
  };

  const mapErrors = (fields: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const [field, code] of Object.entries(fields)) {
      const key = FORM_FIELD[field as keyof SalesSettings];
      if (key) out[key] = code;
    }
    return out;
  };

  const review = () => {
    if (!form || !data?.settings || !data.state || !data.capabilities.pricing || blocked || saving) return;
    const candidate = fromForm(form);
    const parsed = salesSettingsSchema.safeParse(candidate);
    if (!parsed.success) {
      setFieldErrors(mapErrors(settingsFieldErrors(parsed.error)));
      setConfirming(null);
      return;
    }
    const changes = diffSettings(data.settings.values ?? data.settings.raw, parsed.data);
    if (changes.length === 0) {
      setSuccess("Değişiklik yok.");
      return;
    }
    setConfirming({ next: parsed.data, changes });
  };

  const save = async () => {
    if(!confirming||!data?.state||state.current.busy||blocked)return;
    state.current.busy=true;setSaving(true);setError(null);setSuccess(null);
    const body={...(confirming.next?{settings:confirming.next}:{ordersPaused:confirming.ordersPaused}),expectedUpdatedAt:data.state.updatedAt};
    try {
      const result=await accessRequest<SalesSettingsMutationDto>("/api/admin/sales-settings","PUT",body);
      if(!state.current.alive)return;
      if(!validSalesResult(result.data))throw new Error("Kayıt sonucu doğrulanamadı. Tekrar göndermeden önce güncel ayarları yükleyin.");
      setWarnings(w=>[...w,...result.warnings]);setSuccess("Değişiklik kaydedildi. Güncel durum sunucudan yükleniyor.");setConfirming(null);await load();
    }catch(e){
      if(!state.current.alive)return;
      setError(errorText(e));setConfirming(null);
      if(e instanceof AdminApiError&&e.details?.fields&&typeof e.details.fields==="object")setFieldErrors(mapErrors(Object.fromEntries(Object.entries(e.details.fields).filter((pair):pair is [string,string]=>typeof pair[1]==="string"))));
      const editable=e instanceof AdminApiError&&["validation","invalid_body","repair_requires_pause"].includes(e.code);setBlocked(!editable);
      if(e instanceof AdminApiError&&e.code==="conflict")await load(true);
      else if(e instanceof AdminApiError&&[401,403].includes(e.status)&&e.code!=="mfa_required"){setData(null);setForm(null);void refresh();}
    }finally{state.current.busy=false;if(state.current.alive){setSaving(false);feedback.current?.focus();feedback.current?.scrollIntoView({block:"center"});}}
  };

  const preview = useMemo(() => {
    if (!form) return null;
    const price = parsePrice(form.price);
    const min = parseWhole(form.min);
    const vat = parseRate(form.vat);
    if (![price, min, vat].every(Number.isFinite) || min < 1) return null;
    const total = price * min;
    return { min, total, vat: Math.round((total * vat) / (100 + vat)), rate: vat };
  }, [form]);

  // Kayıt sonucu odağa alınır; uzun formda geri bildirim kaybolmaz.
  const messages = (
    <>
      {success && <div role="status" className="bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">✅ {success}</div>}
      {error && <div role="alert" className="bg-red-500/10 ring-1 ring-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">❌ {error}</div>}
    </>
  );

  const vatUnusual = form ? !KNOWN_VAT_RATES.some((r) => r === parseRate(form.vat)) && Number.isFinite(parseRate(form.vat)) : false;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Satış Ayarları</h1>
        <p className="text-sm text-slate-400 mt-1">
          Birim bedel, adet sınırları, KDV ve süreler. Kaydettiğiniz değerler sihirbazda ve sitede hemen geçerli olur;
          oluşturulmuş siparişler kendi tutarı ve belgeleriyle sürer.
        </p>
      </div>

      <Button variant="secondary" disabled={saving||loading} onClick={()=>void load()}>Güncel ayarları yükle</Button>
      <div ref={feedback} tabIndex={-1} className="outline-none">{messages}</div>
      {warnings.map((w,i)=><p role="alert" key={i} className="text-amber-100 text-sm">{w.message} İşlemi tekrar göndermeyin.</p>)}
      {blocked&&!loading&&<p className="text-amber-100 text-sm">Sonuç belirsiz veya yetki değişti. İşlem kapalı; güncel ayarları yükleyin.</p>}
      {data?.mfa.enforced&&!data.mfa.satisfied&&(data.capabilities.resume||data.capabilities.pricing)&&<div className="text-sm text-amber-100 border border-amber-400/30 rounded-xl p-4"><p>Yeniden açma ve fiyat değişiklikleri yeniden doğrulama gerektirir. Durdurma için doğrulama gerekmez. Doğrulamadan sonra güncel ayarları yükleyip işlemi yeniden seçin.</p><Link href="/admin/guvenlik" target="_blank" rel="noopener noreferrer" className="underline">Hesap güvenliği (yeni sekme)</Link></div>}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : !data ? null : (
        <>
          {data.state?.repairRequired && <div role="alert" className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            Kayıtlı ayarlarda geçersiz alanlar var; yeni sipariş alımı kapalı. İşaretli alanları düzeltip kaydedin.
            Onarım satış kapalıyken yapılır; yeniden açmak ayrı bir işlemdir.
          </div>}
          {data.readiness && (
            <section className="bg-white/[0.03] ring-1 ring-white/[0.08] rounded-2xl p-5 space-y-3" aria-labelledby="hazirlik-baslik">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 id="hazirlik-baslik" className="font-semibold text-white text-sm">Satışa hazırlık</h2>
                <span className="text-xs text-slate-500">{ENVIRONMENT_LABEL[data.readiness.environment] ?? data.readiness.environment}</span>
              </div>
              <p className={`text-sm font-semibold ${data.readiness.accepting ? "text-emerald-400" : "text-red-300"}`}>
                {data.readiness.accepting ? "✓ Şu an sipariş alınıyor." : "✕ Şu an sipariş alınmıyor — sihirbaz talep topluyor."}
              </p>
              <ul className="space-y-2 text-sm">
                {data.readiness.items.map((item) => (
                  <li key={item.key} className="flex items-start gap-2.5">
                    <span aria-hidden className={`w-4 shrink-0 text-center font-bold ${LEVEL_STYLE[item.level].className}`}>{LEVEL_STYLE[item.level].icon}</span>
                    <span>
                      <span className="sr-only">{LEVEL_STYLE[item.level].sr}: </span>
                      <span className="text-slate-200">{item.label}</span>
                      <span className="block text-xs text-slate-400">{item.detail}</span>
                      <span className="grid sm:grid-cols-3 gap-2 mt-2 text-xs text-slate-300"><span>Yapılandırma: {item.configured?"Tanımlı":"Eksik"}</span><span>Doğrulama: {item.verification===null?"Bu madde için uygulanmaz":({verified:"Doğrulandı",not_verified:"Henüz doğrulanmadı",failed:"Başarısız",unknown:"Bilinmiyor"}[item.verification])}</span><span>Son sonuç: {item.lastResult?`${when(item.lastResult.at)} · ${item.lastResult.source==="provider"?(item.lastResult.ok?"Sağlayıcı kabul etti; teslim kanıtı değil":"Sağlayıcı hatası"):`${item.lastResult.source==="cron"?"Zamanlayıcı":"Elle çalıştırma"} · ${item.lastResult.ok?"başarılı":"başarısız"}`}`:"Kayıt yok"}</span></span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.state && <section className="rounded-xl border border-white/10 p-4 space-y-3"><h2 className="font-semibold text-white">Sipariş alımı</h2><p className="text-sm text-slate-200">{data.state.ordersPaused ? "Çevrim içi sipariş alımı durduruldu." : "Panelde sipariş alımı açık."} {data.state.accepting ? "Şu anda yeni sipariş kabul ediliyor." : "Diğer yayın koşulları nedeniyle de sipariş alımı kapalı olabilir."}</p><p className="text-xs text-slate-400">Son kayıt: {when(data.state.updatedAt)}</p>{!data.state.ordersPaused&&data.capabilities.pause&&<Button variant="danger" disabled={saving||blocked||data.state.repairRequired} onClick={()=>reviewState(true)}>Sipariş alımını durdur</Button>}{data.state.ordersPaused&&data.capabilities.resume&&<Button disabled={saving||blocked||data.state.repairRequired} onClick={()=>reviewState(false)}>Sipariş alımını yeniden aç</Button>}</section>}
          {data.openCheckouts!==undefined&&<p className="text-sm text-slate-300">Ödeme bekleyen sipariş: {data.openCheckouts}</p>}
          {data.settings?.values && <div className="bg-white/[0.03] ring-1 ring-white/[0.08] rounded-2xl p-5 text-sm text-slate-300 space-y-1"><p>Şu an geçerli: {formatTry(data.settings.values.unitPriceKurus,"tr")} / tohum topu (KDV dahil) · en az {formatCount(data.settings.values.minQuantity,"tr")} · KDV %{rateText(data.settings.values.vatRate)}</p><p className="text-xs text-slate-400">Teklif sürümü: {data.settings.quoteVersion}</p></div>}
          {form && data.settings && data.capabilities.pricing && <fieldset disabled={saving||blocked} className="space-y-6">
          <section className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white text-sm">Fiyat</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Birim bedel — TL, KDV dâhil"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                error={errorFor("price")}
                helperText="Tohum topu başına. Örnek: 10 ya da 10,50"
              />
              <Input
                label="KDV oranı — %"
                inputMode="decimal"
                value={form.vat}
                onChange={(e) => set("vat", e.target.value)}
                error={errorFor("vat")}
                helperText={vatUnusual ? "Dikkat: Türkiye'de uygulanan oranlar 0, 1, 10 ve 20. Mali müşavirle teyit edin." : "Birim bedelin içindeki KDV; bedel değişmez, yalnız vergi ayrımı değişir."}
              />
            </div>
            {preview && (
              <p className="text-xs text-slate-400">
                Örnek: {formatCount(preview.min, "tr")} tohum topu → <span className="text-white">{formatTry(preview.total, "tr")}</span> (içindeki KDV {formatTry(preview.vat, "tr")})
              </p>
            )}
          </section>

          <section className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white text-sm">Adet</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="En az adet" inputMode="numeric" value={form.min} onChange={(e) => set("min", e.target.value)} error={errorFor("min")} helperText="Ana sayfadaki SSS ve hizmet kartında da görünür." />
              <Input label="En çok adet (tek siparişte)" inputMode="numeric" value={form.max} onChange={(e) => set("max", e.target.value)} error={errorFor("max")} helperText="Sahanın boş kapasitesi ayrıca denetlenir." />
            </div>
            <Input
              label="Hazır seçenekler"
              value={form.presets}
              onChange={(e) => set("presets", e.target.value)}
              error={errorFor("presets")}
              helperText={`Virgülle ayırın, küçükten büyüğe (en çok ${L.presets.max}). Müşteri bunların dışında da adet yazabilir.`}
            />
          </section>

          <section className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white text-sm">Takvim, ödeme ve fatura</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Hazırlık payı — gün"
                inputMode="numeric"
                value={form.prep}
                onChange={(e) => set("prep", e.target.value)}
                error={errorFor("prep")}
                helperText="14 günlük cayma süresi dâhil. Sezon sonuna bu kadar gün kalmayan sipariş sonraki sezona yazılır."
              />
              <Input
                label="Ödeme süresi — dakika"
                inputMode="numeric"
                value={form.ttl}
                onChange={(e) => set("ttl", e.target.value)}
                error={errorFor("ttl")}
                helperText="Bu sürede ödenmeyen sipariş düşer; ayrılan kapasite geri verilir."
              />
              <Select label="Fatura zamanı" value={form.timing} onChange={(e) => set("timing", e.target.value)} error={errorFor("timing")}>
                <option value="" disabled>Fatura zamanını seçin</option>
                {(Object.keys(TIMING_LABELS) as InvoiceTiming[]).map((k) => (
                  <option key={k} value={k}>{TIMING_LABELS[k]}</option>
                ))}
              </Select>
            </div>
          </section>

          {!confirming && <div className="flex gap-3 flex-wrap"><Button variant="primary" onClick={review}>Değişiklikleri gözden geçir</Button><Button variant="ghost" onClick={()=>{setForm(data.settings?.values?toForm(data.settings.values):repairForm(data.settings?.raw??{}));setFieldErrors(formErrors(data.settings?.fieldErrors??{}));}}>Formu sıfırla</Button><Button variant="ghost" onClick={()=>{if(data.settings)setForm(toForm({...data.settings.defaults,ordersPaused:data.state?.ordersPaused??true}));setFieldErrors({});}}>Varsayılanları yükle</Button></div>}
          </fieldset>}

          {confirming ? (
            <div ref={reviewPanel} tabIndex={-1} role="region" aria-label="Değişiklik onayı" className="bg-amber-500/[0.06] ring-1 ring-amber-500/30 rounded-2xl p-5 space-y-4 outline-none">
              <h2 className="text-sm font-semibold text-amber-200">Bu değişiklikler kaydedilecek</h2>
              <ul className="text-sm text-slate-200 space-y-1">
                {confirming.changes.map((c) => (
                  <li key={c.field}>
                    <span className="text-slate-400">{FIELD_LABELS[c.field]}:</span> {valueText(c.field, c.from)} → <span className="text-white font-medium">{valueText(c.field, c.to)}</span>
                  </li>
                ))}
              </ul>
              <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
                {consequences(confirming.changes, data.openCheckouts).map((line) => <li key={line}>{line}</li>)}
              </ul>
              <div className="flex gap-3 flex-wrap">
                <Button variant="primary" loading={saving} disabled={blocked} onClick={save}>Kaydet</Button>
                <Button variant="ghost" disabled={saving} onClick={() => setConfirming(null)}>Vazgeç</Button>
              </div>
            </div>
          ) : null}

          {data.history && <section className="space-y-2">
            <h2 className="font-semibold text-white text-sm">Son değişiklikler</h2>
            {data.history.length === 0 ? (
              <p className="text-sm text-slate-500">Bu ekrandan henüz değişiklik yapılmadı.</p>
            ) : (
              <ul className="text-sm text-slate-300 space-y-2">
                {data.history.map((h) => (
                  <li key={h.at} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl px-4 py-3">
                    <p className="text-xs text-slate-500">{when(h.at)} · {h.by ?? "—"}</p>
                    <p>
                      {h.changes.map((c) => `${FIELD_LABELS[c.field as keyof SalesSettings] ?? c.field}: ${valueText(c.field, c.from)} → ${valueText(c.field, c.to)}`).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>}
        </>
      )}
    </div>
  );
}
