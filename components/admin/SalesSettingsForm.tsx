"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
   Admin — Satış Ayarları formu (sayfa: /admin/satis-ayarlari, yalnız SUPER_ADMIN)
   ═══════════════════════════════════════════════════════════════════════
   Birim bedel, adet sınırları, hazır seçenekler, KDV, fatura zamanı,
   hazırlık payı ve ödeme süresi. Kaydedilen değerler sihirbazda ve sitede
   hemen geçerli olur; oluşturulmuş siparişler kendi tutarı ve belgeleriyle
   sürer. Başkası aynı anda kaydettiyse üzerine yazılmaz (409).
   ═══════════════════════════════════════════════════════════════════════ */

interface HistoryItem {
  by: string | null;
  at: string;
  changes: { field: string; from: unknown; to: unknown }[];
}

interface SettingsResponse {
  settings: SalesSettings;
  updatedAt: string;
  defaults: SalesSettings;
  quoteVersion: string;
  openCheckouts: number;
  history: HistoryItem[];
}

type Form = Record<"price" | "vat" | "min" | "max" | "presets" | "prep" | "ttl", string> & {
  timing: InvoiceTiming;
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

const SERVER_ERRORS: Record<string, string> = {
  conflict: "Ayarlar siz düzenlerken başka bir yönetici tarafından değiştirildi. Güncel değerler yüklendi; değişikliğinizi yeniden yapın.",
  unavailable: "Şu anda kaydedilemiyor; yeniden deneyin.",
  invalid_body: "Eksik ya da hatalı bilgi.",
  validation: "Bazı alanlar geçersiz; işaretli kutulara bakın.",
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

function fromForm(f: Form): SalesSettings {
  return {
    unitPriceKurus: parsePrice(f.price),
    minQuantity: parseWhole(f.min),
    maxQuantity: parseWhole(f.max),
    quantityPresets: f.presets.split(/[,;]+/).map((p) => p.trim()).filter(Boolean).map(parseWhole),
    vatRate: parseRate(f.vat),
    invoiceTiming: f.timing,
    prepDays: parseWhole(f.prep),
    paymentTtlMinutes: parseWhole(f.ttl),
    ordersPaused: f.paused,
  };
}

function valueText(field: string, value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => formatCount(Number(v), "tr")).join(" · ");
  switch (field) {
    case "unitPriceKurus": return formatTry(Number(value), "tr");
    case "vatRate": return `%${rateText(Number(value))}`;
    case "invoiceTiming": return TIMING_LABELS[value as InvoiceTiming] ?? String(value);
    case "prepDays": return `${value} gün`;
    case "paymentTtlMinutes": return `${value} dakika`;
    case "ordersPaused": return value ? "Durduruldu" : "Açık";
    default: return formatCount(Number(value), "tr");
  }
}

/** Değişikliğin sonuçları — onay penceresinde gösterilir. */
function consequences(changes: SettingsChange[], openCheckouts: number): string[] {
  const has = (f: keyof SalesSettings) => changes.some((c) => c.field === f);
  const out: string[] = [];
  const pause = changes.find((c) => c.field === "ordersPaused");
  if (pause?.to === true) {
    out.push(
      `Yeni sipariş ve ödeme alınmaz; sihirbaz talep kipinde açılır ve müşteriye kısa bir açıklama gösterir. Ödeme bekleyen siparişler (şu an ${openCheckouts}) ödenemez, süresi dolunca düşer ve ayrılan kapasite geri verilir. Ödenmiş siparişler, iadeler ve partiler etkilenmez.`,
    );
  }
  if (pause?.to === false) out.push("Sipariş ve ödeme yeniden alınır.");
  if (changes.some((c) => QUOTE_FIELDS.includes(c.field))) {
    out.push(
      `Sihirbazın son adımındaki müşteriler güncel ${has("prepDays") ? "tutarı ve takvimi" : "tutarı"} görüp siparişi yeniden onaylar. Oluşturulmuş siparişler (şu an ${openCheckouts} ödeme bekleyen dâhil) kendi tutarı ve belgeleriyle sürer.`,
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

const when = (iso: string) => new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });

export default function SalesSettingsForm() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<{ next: SalesSettings; changes: SettingsChange[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 6000); return () => clearTimeout(t); }
  }, [success]);

  const load = useCallback(async (keepMessage = false) => {
    try {
      const res = await fetch("/api/admin/sales-settings", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as SettingsResponse;
      setData(json);
      setForm(toForm(json.settings));
      setFieldErrors({});
      setConfirming(null);
      if (!keepMessage) setError(null);
    } catch {
      setError("Ayarlar yüklenemedi.");
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setPaused = (value: boolean) => {
    setForm((f) => (f ? { ...f, paused: value } : f));
    setConfirming(null);
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
    if (!form || !data) return;
    const candidate = fromForm(form);
    const parsed = salesSettingsSchema.safeParse(candidate);
    if (!parsed.success) {
      setFieldErrors(mapErrors(settingsFieldErrors(parsed.error)));
      setConfirming(null);
      return;
    }
    const changes = diffSettings(data.settings, parsed.data);
    if (changes.length === 0) {
      setSuccess("Değişiklik yok.");
      return;
    }
    setConfirming({ next: parsed.data, changes });
  };

  const save = async () => {
    if (!confirming || !data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sales-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: confirming.next, expectedUpdatedAt: data.updatedAt }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
      if (res.ok) {
        setSuccess("Ayarlar kaydedildi; sihirbazda ve sitede geçerli.");
        await load();
      } else {
        setError(SERVER_ERRORS[json.error ?? ""] ?? "Kaydedilemedi.");
        if (json.fields) setFieldErrors(mapErrors(json.fields));
        if (json.error === "conflict") await load(true);
        setConfirming(null);
      }
    } catch {
      setError("Bağlantı kurulamadı.");
    }
    setSaving(false);
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

  // İletiler kaydet düğmesinin yanında durur (sayfa uzun; üstte kalsa görülmez) ve duyurulur.
  const messages = (
    <>
      {success && <div role="status" className="bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">✅ {success}</div>}
      {error && <div role="alert" className="bg-red-500/10 ring-1 ring-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">❌ {error}</div>}
    </>
  );

  const vatUnusual = form ? !KNOWN_VAT_RATES.some((r) => r === parseRate(form.vat)) && Number.isFinite(parseRate(form.vat)) : false;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Satış Ayarları</h1>
        <p className="text-sm text-slate-400 mt-1">
          Birim bedel, adet sınırları, KDV ve süreler. Kaydettiğiniz değerler sihirbazda ve sitede hemen geçerli olur;
          oluşturulmuş siparişler kendi tutarı ve belgeleriyle sürer.
        </p>
      </div>

      {!data && messages}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : !data || !form ? null : (
        <>
          <div className="bg-white/[0.03] ring-1 ring-white/[0.08] rounded-2xl p-5 text-sm text-slate-300 space-y-1">
            <p>
              <span className="text-slate-400">Şu an geçerli:</span>{" "}
              <span className="text-white font-medium">{formatTry(data.settings.unitPriceKurus, "tr")}</span> / tohum topu (KDV dâhil) ·
              en az {formatCount(data.settings.minQuantity, "tr")} · KDV %{rateText(data.settings.vatRate)} · hazırlık payı {data.settings.prepDays} gün
            </p>
            {data.settings.ordersPaused && (
              <p className="text-red-300 font-semibold">⏸ Çevrim içi sipariş alımı şu anda DURDURULDU.</p>
            )}
            <p className="text-xs text-slate-500">
              Son kayıt: {when(data.updatedAt)} · Teklif sürümü <code className="text-slate-400">{data.quoteVersion}</code> · Ödeme bekleyen sipariş: {data.openCheckouts}
            </p>
          </div>

          <section
            className={`rounded-2xl p-5 space-y-3 border ${form.paused ? "bg-red-500/[0.06] border-red-500/30" : "bg-[var(--bg-surface)] border-white/[0.06]"}`}
          >
            <h2 className="font-semibold text-white text-sm">Sipariş alımı</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.paused}
                onChange={(e) => setPaused(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-red-500"
                aria-describedby="siparis-alimi-aciklama"
              />
              <span>
                <span className="block text-sm text-white font-medium">Çevrim içi sipariş alımını durdur</span>
                <span id="siparis-alimi-aciklama" className="block text-xs text-slate-400 mt-1">
                  Durdurulunca yeni sipariş ve ödeme alınmaz; sihirbaz talep kipinde açılır ve müşteriye kısa bir açıklama
                  gösterir. Ödenmiş siparişler, iadeler ve partiler etkilenmez. Satış bayrağı ve hukuki metin kilidi ayrıca geçerlidir.
                </span>
              </span>
            </label>
          </section>

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
              <Select label="Fatura zamanı" value={form.timing} onChange={(e) => set("timing", e.target.value)}>
                {(Object.keys(TIMING_LABELS) as InvoiceTiming[]).map((k) => (
                  <option key={k} value={k}>{TIMING_LABELS[k]}</option>
                ))}
              </Select>
            </div>
          </section>

          {messages}

          {confirming ? (
            <div className="bg-amber-500/[0.06] ring-1 ring-amber-500/30 rounded-2xl p-5 space-y-4">
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
                <Button variant="primary" loading={saving} onClick={save}>Kaydet</Button>
                <Button variant="ghost" disabled={saving} onClick={() => setConfirming(null)}>Vazgeç</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              <Button variant="primary" onClick={review}>Değişiklikleri gözden geçir</Button>
              <Button variant="ghost" onClick={() => { setForm(toForm(data.settings)); setFieldErrors({}); }}>Formu sıfırla</Button>
              <Button variant="ghost" onClick={() => { setForm(toForm(data.defaults)); setFieldErrors({}); }}>Varsayılanları yükle</Button>
            </div>
          )}

          <section className="space-y-2">
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
          </section>
        </>
      )}
    </div>
  );
}
