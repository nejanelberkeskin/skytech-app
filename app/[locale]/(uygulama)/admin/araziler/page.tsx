"use client";

import { useAdmin } from "@/lib/admin-context";
import { Link } from "@/i18n/navigation";
import { containDialogTab } from "@/lib/hooks/dialog-keyboard";
import { accessRequest } from "@/components/admin/access/transport";
import { AdminApiError, errorText } from "@/components/admin/operations/client";
import type { SiteAdminItem as Land, SiteAdminListDto, SiteMutationDto, SiteSpeciesOption as SpeciesOption } from "@/lib/sites/admin-dto";
import type { ApiWarning } from "@/lib/api/envelope";
import { siteAccessKey, statusAllowed } from "@/components/admin/sites/view";

import { useEffect, useState, useCallback, useRef } from "react";
import RoleGuard from "@/components/RoleGuard";
import { CardStat, Button, Input, Select, Textarea } from "@/components/ui";

import { TR_ILLER_ALFABETIK } from "@/lib/tr-iller";
import { WORK_TYPES, type WorkType } from "@/lib/sites/types";
import { slugify } from "@/lib/sites/slug";
import {
  LAND_STATUSES,
  LAND_STATUS_LABELS,
  SITE_LIMITS,
  WORK_TYPE_LABELS,
  siteAdminSchema,
  siteFieldErrors,
  type LandStatus,
} from "@/lib/sites/admin";

/* ═══════════════════════════════════════════════════════════════════════
   Yönetim — Proje Uygulama Sahaları
   ═══════════════════════════════════════════════════════════════════════
   Vitrindeki saha kartlarını ve saha sayfalarını besleyen kayıtlar buradan
   yönetilir: konum, hektar, yangın bilgisi, çalışma türü, sahaya bırakılan
   tür(ler), çok dilli ad/tanıtım, kapak ve video.
   KAPASİTE yalnız bu ekranda görünür; vitrinde hektar gösterilir, bırakılacak
   tohum topu sayısı gösterilmez.
   ═══════════════════════════════════════════════════════════════════════ */

type ModalMode = "add" | "edit" | "delete" | "publish" | null;

interface SiteForm {
  name: string;
  slug: string;
  province: string;
  district: string;
  area_hectares: string;
  is_fire_affected: boolean;
  fire_year: string;
  work_type: WorkType;
  species_slugs: string[];
  name_en: string;
  name_ru: string;
  summary_tr: string;
  summary_en: string;
  summary_ru: string;
  cover_image: string;
  video_url: string;
  sort_order: string;
  status: LandStatus;
  is_public: boolean;
  capacity_seeds: string;
}

const EMPTY_FORM: SiteForm = {
  name: "",
  slug: "",
  province: "",
  district: "",
  area_hectares: "",
  is_fire_affected: true,
  fire_year: "",
  work_type: "ormanlastirma_genclestirme",
  species_slugs: [],
  name_en: "",
  name_ru: "",
  summary_tr: "",
  summary_en: "",
  summary_ru: "",
  cover_image: "",
  video_url: "",
  sort_order: "0",
  status: "open",
  is_public: true,
  capacity_seeds: "",
};

const fmt = (n: number) => n.toLocaleString("tr-TR");
const num = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const hectares = (l: Land): number | null => {
  const n = typeof l.areaHectares === "string" ? Number(l.areaHectares) : l.areaHectares;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
};

function formFromLand(l: Land): SiteForm {
  const ha = hectares(l);
  return {
    name: l.name,
    slug: l.slug ?? "",
    province: l.province ?? l.region ?? "",
    district: l.district ?? "",
    area_hectares: ha !== null ? String(ha).replace(".", ",") : "",
    is_fire_affected: l.isFireAffected ?? false,
    fire_year: l.fireYear ? String(l.fireYear) : "",
    work_type: l.workType ?? "ormanlastirma_genclestirme",
    species_slugs: l.speciesSlugs ?? [],
    name_en: l.nameI18n?.en ?? "",
    name_ru: l.nameI18n?.ru ?? "",
    summary_tr: l.summaryI18n?.tr ?? "",
    summary_en: l.summaryI18n?.en ?? "",
    summary_ru: l.summaryI18n?.ru ?? "",
    cover_image: l.coverImage ?? "",
    video_url: l.videoUrl ?? "",
    sort_order: String(l.sortOrder ?? 0),
    status: l.status,
    is_public: l.isPublic,
    capacity_seeds: String(l.capacity.total),
  };
}

/** Form → API gövdesi (şemanın beklediği türlerde). */
function payloadFromForm(f: SiteForm) {
  return {
    name: f.name,
    slug: f.slug,
    province: f.province,
    district: f.district,
    area_hectares: num(f.area_hectares),
    is_fire_affected: f.is_fire_affected,
    fire_year: f.is_fire_affected ? num(f.fire_year) : null,
    work_type: f.work_type,
    species_slugs: f.species_slugs,
    name_en: f.name_en,
    name_ru: f.name_ru,
    summary_tr: f.summary_tr,
    summary_en: f.summary_en,
    summary_ru: f.summary_ru,
    cover_image: f.cover_image,
    video_url: f.video_url,
    sort_order: num(f.sort_order) ?? 0,
    status: f.status,
    is_public: f.is_public,
    capacity_seeds: num(f.capacity_seeds) ?? NaN,
  };
}

function StatusBadge({ land }: { land: Land }) {
  if (!land.isPublic) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-orange-500/40 bg-orange-500/10 text-orange-400">
        Yayında değil
      </span>
    );
  }
  const tone: Record<LandStatus, string> = {
    open: "ring-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    full: "ring-amber-500/40 bg-amber-500/10 text-amber-400",
    scheduled: "ring-sky-500/40 bg-sky-500/10 text-sky-300",
    seeded: "ring-lime-500/40 bg-lime-500/10 text-lime-300",
    monitoring: "ring-violet-500/40 bg-violet-500/10 text-violet-300",
    closed: "ring-slate-500/40 bg-slate-500/10 text-slate-400",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${tone[land.status]}`}>
      {LAND_STATUS_LABELS[land.status]}
    </span>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
function SahalarContent() {
  const { refresh } = useAdmin();
  const state = useRef({ alive: false, generation: 0, busy: false });
  const [data, setData] = useState<SiteAdminListDto | null>(null);
  const lands = data?.items ?? [], species = data?.species ?? [];
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null), [selectedLand, setSelectedLand] = useState<Land | null>(null);
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false), [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const load = useCallback(async () => {
    const generation = ++state.current.generation;
    setLoading(true); setLoadError(null); setData(null);
    try {
      const { data } = await accessRequest<SiteAdminListDto>("/api/admin/lands?include=species");
      if (!state.current.alive || generation !== state.current.generation) return;
      if (!Array.isArray(data?.items) || !data.capabilities || !data.scope || !data.mfa) throw new Error("Saha yanıtı okunamadı.");
      setData(data); setBlocked(false);
    } catch (e) {
      if (!state.current.alive || generation !== state.current.generation) return;
      setLoadError(errorText(e));
      if (e instanceof AdminApiError && [401, 403].includes(e.status)) void refresh();
    } finally { if (state.current.alive && generation === state.current.generation) setLoading(false); }
  }, [refresh]);
  useEffect(() => { const token = state.current; token.alive = true; void load(); return () => { token.alive = false; token.generation++; }; }, [load]);
  const speciesName = (slug: string) => species.find(s => s.slug === slug)?.name ?? slug;
  const resetErrors = () => { setError(null); setFieldErrors({}); };
  const closeModal = () => { if (state.current.busy) return; setModalMode(null); setSelectedLand(null); resetErrors(); };
  const reload = () => { closeModal(); void load(); };
  const openAdd = () => { if (!data?.capabilities.create || blocked) return; setSelectedLand(null); setForm({ ...EMPTY_FORM, is_public: false, sort_order: String(lands.length * 10) }); resetErrors(); setModalMode("add"); };
  const openEdit = (land: Land) => { setSelectedLand(land); setForm(formFromLand(land)); resetErrors(); setModalMode("edit"); };
  const openDelete = (land: Land) => { setSelectedLand(land); resetErrors(); setModalMode("delete"); };
  const togglePublished = (land: Land) => { setSelectedLand(land); resetErrors(); setModalMode("publish"); };
  const mutate = async (method: string, body: object) => {
    if (state.current.busy || blocked) return;
    state.current.busy = true; setSaving(true); resetErrors(); setSuccess(null);
    try {
      const result = await accessRequest<SiteMutationDto | { deleted: true; id: string }>("/api/admin/lands", method, body);
      if (!state.current.alive) return;
      if (method === "DELETE" ? !("deleted" in result.data && result.data.deleted && result.data.id === selectedLand?.id) : !("site" in result.data && result.data.site?.id && (method === "POST" || result.data.site.id === selectedLand?.id) && Array.isArray(result.data.changed))) throw new Error("İşlem sonucu doğrulanamadı. Tekrar göndermeden önce listeyi yenileyin.");
      setWarnings(previous => [...previous, ...result.warnings]);
      setSuccess(method === "DELETE" ? "Saha silindi." : "Saha bilgileri kaydedildi.");
      setModalMode(null); setSelectedLand(null); await load();
    } catch (e) {
      if (!state.current.alive) return;
      setError(errorText(e));
      if (e instanceof AdminApiError && e.details?.fields && typeof e.details.fields === "object") setFieldErrors(Object.fromEntries(Object.entries(e.details.fields).filter((pair): pair is [string, string] => typeof pair[1] === "string")));
      const editable = e instanceof AdminApiError && ["invalid_body", "slug_taken"].includes(e.code);
      setBlocked(!editable);
      if (e instanceof AdminApiError && [401,403,404].includes(e.status) && e.code !== "mfa_required") { setModalMode(null); setSelectedLand(null); setData(null); void refresh(); }
    } finally { state.current.busy = false; if (state.current.alive) setSaving(false); }
  };
  const handleSave = async () => {
    const payload = payloadFromForm(form), pre = siteAdminSchema.safeParse(payload);
    if (!pre.success) { setFieldErrors(siteFieldErrors(pre.error.issues)); setError("Lütfen işaretli alanları kontrol edin."); return; }
    await mutate(modalMode === "add" ? "POST" : "PUT", modalMode === "add" ? payload : { id: selectedLand?.id, ...payload });
  };
  const handleDelete = () => { if (selectedLand && data?.capabilities.delete) void mutate("DELETE", { id: selectedLand.id }); };
  const editCaps = modalMode === "add" ? { edit: true, capacity: true, publish: !!data?.capabilities.createPublic } : selectedLand?.capabilities ?? { edit: false, capacity: false, publish: false };
  // ── Metrikler ─────────────────────────────────────────────────────────────
  const published = lands.filter((l) => l.isPublic && l.status !== "closed");
  const openCount = published.filter((l) => l.status === "open").length;
  const totalHectares = published.reduce((s, l) => s + (hectares(l) ?? 0), 0);
  const totalFilled = lands.reduce((s, l) => s + l.capacity.filled, 0);
  const missingInfo = published.filter((l) => hectares(l) === null || !(l.speciesSlugs ?? []).length).length;

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Proje Uygulama Sahaları</h1>
          <p className="text-sm text-slate-400 mt-1">
            Vitrindeki saha kartlarını ve saha sayfalarını buradan yönetirsiniz. Kapasite yalnız bu ekranda görünür.
          </p>
        </div>
        {data?.capabilities.create && <Button variant="primary" disabled={blocked || saving || loading} onClick={openAdd}>
          + Yeni Saha Ekle
        </Button>}
        <Button variant="secondary" disabled={saving || loading} onClick={reload}>Listeyi yenile</Button>
      </div>

      {data && <p className="text-sm text-slate-300">{data.scope.kind === "all" ? "Kapsam: tüm sahalar" : `Kapsam: yetkili olduğunuz ${data.scope.siteIds.length} saha`}</p>}
      {(blocked || (data?.mfa.enforced && !data.mfa.satisfied && (data.capabilities.create || data.items.some(s => s.capabilities.publish || s.capabilities.capacity)))) && <div className="rounded-xl border border-amber-400/30 p-4 text-sm text-amber-100 space-y-3"><p>{blocked ? "İşlem yeniden gönderilmeyecek. Güncel kayıtları yüklemek için listeyi yenileyin." : "Yayın ve kapasite değişiklikleri için yeniden doğrulama gerekir."}</p><Link href="/admin/guvenlik" target="_blank" rel="noopener noreferrer" className="underline">Hesap güvenliğini aç (yeni sekme)</Link><p>Doğrulamadan sonra listeyi yenileyip işlemi yeniden seçin.</p></div>}
      {success && <p role="status" className="text-emerald-200">{success}</p>}
      {warnings.map((w,i) => <p role="alert" key={i} className="text-amber-100">{w.message} İşlemi tekrar göndermeyin.</p>)}
      {error && !modalMode && <p role="alert" className="text-red-200">{error}</p>}
      {/* Özet */}
      {data && <div className="grid md:grid-cols-4 gap-5">
        <CardStat icon="🗺️" label="Yayındaki Saha" value={fmt(published.length)} sub={`${fmt(openCount)} katılıma açık`} />
        <CardStat icon="📐" label="Toplam Alan" value={totalHectares.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} sub="hektar (yayındaki sahalar)" />
        <CardStat icon="🌱" label="Bırakılan Tohum Topu" value={fmt(totalFilled)} sub="görüntüleme kapsamındaki sahalar" />
        <CardStat icon="⚠️" label="Eksik Bilgi" value={fmt(missingInfo)} sub="hektarı ya da türü girilmemiş" />
      </div>}

      {loadError && (
        <div role="alert" className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{loadError}</div>
      )}

      {/* Saha tablosu */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-white/[0.08] border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : data ? (
        <div className="bg-[var(--bg-surface)] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">Tüm Sahalar</h2>
            <span className="text-xs text-slate-500">{lands.length} saha</span>
          </div>

          {lands.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl block mb-3">🌿</span>
              <p className="text-slate-400 mb-4">Henüz saha eklenmemiş.</p>
              {data.capabilities.create && <Button variant="primary" disabled={blocked} onClick={openAdd}>İlk Sahayı Ekle</Button>}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {lands.map((l) => {
                const used = l.capacity.filled + l.capacity.reserved;
                const pct = l.capacity.total > 0 ? Math.round((used / l.capacity.total) * 100) : 0;
                const ha = hectares(l);
                const place = [l.district, l.province ?? l.region].filter(Boolean).join(", ");
                const speciesList = (l.speciesSlugs ?? []).map(speciesName);
                return (
                  <div key={l.id} className="px-5 py-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center hover:bg-white/[0.02] transition-colors">
                    {/* Saha */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-white font-medium break-words">{l.name}</p>
                        <StatusBadge land={l} />
                      </div>
                      {place && <p className="text-xs text-slate-500 mt-1">📍 {place}</p>}
                      {l.slug && (
                        <a
                          href={`/sahalar/${l.slug}`}
                          target="_blank"
                          rel="noopener"
                          className="text-xs text-emerald-400/80 hover:text-emerald-300 mt-1 inline-block break-all"
                        >
                          /sahalar/{l.slug} ↗
                        </a>
                      )}
                    </div>

                    {/* Vitrin bilgileri */}
                    <div className="text-xs text-slate-400 space-y-1 min-w-0">
                      <p>
                        <span className="text-slate-500">Alan:</span>{" "}
                        {ha !== null ? (
                          <span className="text-slate-200">{ha.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} hektar</span>
                        ) : (
                          <span className="text-amber-400">girilmemiş</span>
                        )}
                        {l.isFireAffected && (
                          <span className="ml-2 text-orange-300">🔥 Yangın Sahası{l.fireYear ? ` · ${l.fireYear}` : ""}</span>
                        )}
                      </p>
                      <p>
                        <span className="text-slate-500">Çalışma:</span>{" "}
                        <span className="text-slate-200">{WORK_TYPE_LABELS[l.workType ?? "ormanlastirma_genclestirme"]}</span>
                      </p>
                      <p className="break-words">
                        <span className="text-slate-500">Tür:</span>{" "}
                        {speciesList.length ? (
                          <span className="text-slate-200">{speciesList.join(", ")}</span>
                        ) : (
                          <span className="text-amber-400">girilmemiş</span>
                        )}
                      </p>
                    </div>

                    {/* Kapasite (yalnız panel) */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-amber-400" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">%{pct}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">
                        {fmt(l.capacity.filled)} bırakılan + {fmt(l.capacity.reserved)} ayrılan / {fmt(l.capacity.total)}
                      </p>
                    </div>

                    {/* İşlemler */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(l.capabilities.edit || l.capabilities.capacity) && <button disabled={saving || blocked}

                        onClick={() => openEdit(l)}
                        className="text-xs text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.06] border border-white/[0.06]"
                      >
                        Düzenle
                      </button>}
                      {l.capabilities.publish && <button disabled={saving || blocked}
                        onClick={() => togglePublished(l)}
                        className={`text-xs transition-colors px-3 py-2 rounded-lg border ${
                          l.isPublic
                            ? "text-orange-400 border-orange-500/20 hover:bg-orange-500/10"
                            : "text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                        }`}
                      >
                        {l.isPublic ? "Yayından al" : "Yayına al"}
                      </button>}
                      {data.capabilities.delete && <button disabled={saving || blocked}
                        onClick={() => openDelete(l)}
                        className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10 border border-red-500/[0.15]"
                      >
                        Sil
                      </button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
       ) : null}

      {/* ── Modallar ─────────────────────────────────────────────────────── */}
      {(modalMode === "add" || modalMode === "edit") && (
        <SiteModal
          mode={modalMode}
          form={form}
          setForm={setForm}
          species={species}
          onSave={handleSave}
          onClose={closeModal}
          saving={saving}
          error={error}
          fieldErrors={fieldErrors}
          caps={editCaps} original={selectedLand} blocked={blocked} onReload={reload}
        />
      )}

      {modalMode === "publish" && selectedLand && <SiteDialog title="Yayın durumunu değiştir" busy={saving} onClose={closeModal}><h2 className="font-semibold text-white">{selectedLand.name}</h2><p className="text-slate-300 my-4">{selectedLand.isPublic ? "Saha yayından alınacak ve yeni sipariş kabulü duracak." : "Saha yayına alınacak. Katılıma açık evredeyse yeni sipariş kabul edilecek."}</p>{error && <p role="alert" className="text-red-200">{error}</p>}{blocked && <Recovery onReload={reload} />}<div className="flex gap-3 mt-4"><Button disabled={saving} onClick={closeModal} variant="ghost">Vazgeç</Button><Button disabled={saving || blocked} onClick={() => void mutate("PUT", { id: selectedLand.id, maintenance: selectedLand.isPublic })}>Onayla</Button></div></SiteDialog>}
      {modalMode === "delete" && selectedLand && (
        <DeleteModal land={selectedLand} onConfirm={handleDelete} onClose={closeModal} saving={saving} error={error} blocked={blocked} onReload={reload} />
      )}
    </div>
  );
}

// ── Saha Ekle/Düzenle ─────────────────────────────────────────────────────────
function SiteModal({
  mode,
  form,
  setForm,
  species,
  onSave,
  onClose,
  saving,
  error,
  fieldErrors, caps, original, blocked, onReload,
}: {
  caps: Land["capabilities"]; original: Land | null; blocked: boolean; onReload: () => void;
  mode: "add" | "edit";
  form: SiteForm;
  setForm: (f: SiteForm) => void;
  species: SpeciesOption[];
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
}) {
  const set = <K extends keyof SiteForm>(key: K, val: SiteForm[K]) => setForm({ ...form, [key]: val });
  const toggleSpecies = (slug: string) =>
    set(
      "species_slugs",
      form.species_slugs.includes(slug) ? form.species_slugs.filter((s) => s !== slug) : [...form.species_slugs, slug]
    );
  const slugPreview = form.slug.trim() || slugify(form.name) || "saha-adi";

  return (
    <SiteDialog title={mode === "add" ? "Yeni Saha Ekle" : "Sahayı Düzenle"} busy={saving} onClose={onClose}>
        <h2 id="site-modal-title" className="text-lg font-bold text-white mb-1">
          {mode === "add" ? "Yeni Saha Ekle" : "Sahayı Düzenle"}
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Buradaki bilgiler vitrindeki saha kartında ve saha sayfasında görünür. Boş bıraktığınız alan vitrinde gizlenir.
        </p>

        <fieldset disabled={saving || blocked} className="space-y-7">
          {/* 1 · Temel */}
          <Section disabled={!caps.edit} title="Temel bilgiler">
            <Input
              label="Saha adı"
              required
              placeholder="örn. Çanakkale Proje Uygulama Sahası"
              value={form.name}
              maxLength={SITE_LIMITS.name.max}
              onChange={(e) => set("name", e.target.value)}
              error={fieldErrors.name}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Select label="İl" value={form.province} onChange={(e) => set("province", e.target.value)} error={fieldErrors.province}>
                <option value="">İl seçin</option>
                {/* Listede olmayan eski bir değer kayıtlıysa kaybolmasın */}
                {form.province && !TR_ILLER_ALFABETIK.some((il) => il.ad === form.province) && (
                  <option value={form.province}>{form.province}</option>
                )}
                {TR_ILLER_ALFABETIK.map((il) => (
                  <option key={il.kod} value={il.ad}>{il.ad}</option>
                ))}
              </Select>
              <Input
                label="İlçe"
                placeholder="örn. Eceabat"
                value={form.district}
                maxLength={SITE_LIMITS.place}
                onChange={(e) => set("district", e.target.value)}
                error={fieldErrors.district}
              />
            </div>
            <Input
              label="Sayfa adresi"
              placeholder="boş bırakılırsa addan üretilir"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              error={fieldErrors.slug}
              helperText={
                mode === "edit"
                  ? `skytechgreen.com/sahalar/${slugPreview} — adresi değiştirirseniz eski bağlantılar çalışmaz.`
                  : `skytechgreen.com/sahalar/${slugPreview}`
              }
            />
          </Section>

          {/* 2 · Saha bilgisi */}
          <Section disabled={!caps.edit} title="Saha bilgisi">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Alan (hektar)"
                inputMode="decimal"
                placeholder="örn. 42,5"
                value={form.area_hectares}
                onChange={(e) => set("area_hectares", e.target.value)}
                error={fieldErrors.area_hectares}
                helperText="1 hektar = 10 dekar = 10.000 m². Vitrinde gösterilir."
              />
              <Select
                label="Çalışma türü"
                value={form.work_type}
                onChange={(e) => set("work_type", e.target.value as WorkType)}
                error={fieldErrors.work_type}
              >
                {WORK_TYPES.map((w) => (
                  <option key={w} value={w}>{WORK_TYPE_LABELS[w]}</option>
                ))}
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 items-start">
              <Toggle
                label="Yangın Sahası"
                desc="Vitrinde “Yangın Sahası” rozeti çıkar."
                checked={form.is_fire_affected}
                onChange={(v) => setForm({ ...form, is_fire_affected: v, fire_year: v ? form.fire_year : "" })}
              />
              {form.is_fire_affected && (
                <Input
                  label="Yangın yılı"
                  inputMode="numeric"
                  placeholder="örn. 2023 (isteğe bağlı)"
                  value={form.fire_year}
                  onChange={(e) => set("fire_year", e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                  error={fieldErrors.fire_year}
                />
              )}
            </div>

            <div>
              <p className="block text-sm font-medium text-slate-300 mb-1.5">Sahaya bırakılan tür(ler)</p>
              {species.length === 0 ? (
                <p className="text-xs text-slate-500">Katalogda tür bulunamadı; önce Katalog ekranından tür ekleyin.</p>
              ) : (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Sahaya bırakılan türler">
                  {species.map((s) => {
                    const active = form.species_slugs.includes(s.slug);
                    return (
                      <button
                        key={s.slug}
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        onClick={() => toggleSpecies(s.slug)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                          active
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                            : "bg-white/[0.03] border-white/[0.08] text-slate-300 hover:border-white/[0.16]"
                        }`}
                      >
                        {s.name}
                        {s.latinName && <span className="ml-1.5 italic text-slate-500">{s.latinName}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {fieldErrors.species_slugs ? (
                <p className="text-xs text-red-400 mt-1.5">{fieldErrors.species_slugs}</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1.5">
                  Müşteri tür seçmez; burada işaretlediğiniz tür(ler) saha kartında ve sipariş sırasında bilgi olarak gösterilir.
                </p>
              )}
            </div>
          </Section>

          {/* 3 · Yayın ve kapasite */}
          <Section title="Yayın ve kapasite">
            <div className="grid sm:grid-cols-3 gap-4">
              <Select
                disabled={!caps.edit && !caps.publish}
                label="Evre"
                value={form.status}
                onChange={(e) => set("status", e.target.value as LandStatus)}
                error={fieldErrors.status}
                helperText="Yalnız “Katılıma açık” sahalar talep alır."
              >
                {LAND_STATUSES.map((s) => (
                  <option key={s} value={s} disabled={!!original && !statusAllowed(original, s)}>{LAND_STATUS_LABELS[s]}</option>
                ))}
              </Select>
              <Input
                disabled={!caps.capacity}
                label="Kapasite (tohum topu)"
                required
                inputMode="numeric"
                placeholder="örn. 50000"
                value={form.capacity_seeds}
                onChange={(e) => set("capacity_seeds", e.target.value.replace(/[^\d]/g, ""))}
                error={fieldErrors.capacity_seeds}
                helperText="Vitrinde gösterilmez; doluluk denetimi içindir."
              />
              <Input
                disabled={!caps.edit}
                label="Sıra"
                inputMode="numeric"
                value={form.sort_order}
                onChange={(e) => set("sort_order", e.target.value.replace(/[^\d-]/g, ""))}
                error={fieldErrors.sort_order}
                helperText="Küçük sayı önce listelenir."
              />
            </div>
            <Toggle
              disabled={!caps.publish}
              label="Yayında"
              desc="Kapalıysa saha vitrinde listelenmez ve talep alınmaz."
              checked={form.is_public}
              onChange={(v) => set("is_public", v)}
            />
          </Section>

          {/* 4 · Tanıtım ve çeviriler */}
          <Section disabled={!caps.edit} title="Tanıtım ve çeviriler" hint="Boş bırakılan dilde Türkçe ad gösterilir; tanıtım yoksa o bölüm hiç çıkmaz.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="İngilizce ad"
                placeholder="örn. Çanakkale Project Site"
                value={form.name_en}
                maxLength={SITE_LIMITS.name.max}
                onChange={(e) => set("name_en", e.target.value)}
                error={fieldErrors.name_en}
              />
              <Input
                label="Rusça ad"
                placeholder="örn. Проектный участок Чанаккале"
                value={form.name_ru}
                maxLength={SITE_LIMITS.name.max}
                onChange={(e) => set("name_ru", e.target.value)}
                error={fieldErrors.name_ru}
              />
            </div>
            {(["tr", "en", "ru"] as const).map((lang) => {
              const key = `summary_${lang}` as const;
              return (
                <Textarea
                  key={lang}
                  label={`Kısa tanıtım — ${lang === "tr" ? "Türkçe" : lang === "en" ? "İngilizce" : "Rusça"}`}
                  rows={3}
                  maxLength={SITE_LIMITS.summary}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  error={fieldErrors[key]}
                  helperText={`${form[key].length}/${SITE_LIMITS.summary} · Sayısal vaat (çimlenme oranı, ağaç sayısı, karbon) yazmayın.`}
                />
              );
            })}
          </Section>

          {/* 5 · Görsel ve video */}
          <Section disabled={!caps.edit} title="Görsel ve video">
            <Input
              label="Kapak görseli"
              placeholder="/images/sahalar/canakkale.webp ya da https://…"
              value={form.cover_image}
              onChange={(e) => set("cover_image", e.target.value)}
              error={fieldErrors.cover_image}
              helperText="Görsel dosyası siteye eklendikten sonra yolunu yazın. Boşsa marka dokulu yer tutucu gösterilir."
            />
            <Input
              label="Çalışma videosu (YouTube)"
              placeholder="https://www.youtube.com/watch?v=…"
              value={form.video_url}
              onChange={(e) => set("video_url", e.target.value)}
              error={fieldErrors.video_url}
              helperText="Bırakmadan yaklaşık altı ay sonra yayımlanan herkese açık video."
            />
          </Section>
        </fieldset>

        {error && (
          <div role="alert" className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        {blocked && <Recovery onReload={onReload} />}
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" disabled={saving} onClick={onClose} className="flex-1">
            İptal
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saving || blocked || !form.name.trim() || !form.capacity_seeds} className="flex-1">
            {saving ? "Kaydediliyor…" : mode === "add" ? "Sahayı Ekle" : "Değişiklikleri Kaydet"}
          </Button>
        </div>
    </SiteDialog>
  );
}

function Section({ title, hint, children, disabled }: { title: string; hint?: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400/80 mb-1">{title}</h3>
      {hint && <p className="text-xs text-slate-500 mb-3">{hint}</p>}
      <div className={`space-y-4 ${hint ? "" : "mt-3"}`}>{children}</div>
    </fieldset>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange, disabled,
}: {
  label: string;
  desc: string;
  disabled?: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
          checked ? "bg-emerald-500" : "bg-slate-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ── Silme Onayı ───────────────────────────────────────────────────────────────
function DeleteModal({
  land,
  onConfirm,
  onClose,
  saving,
  error, blocked, onReload,
}: {
  blocked: boolean; onReload: () => void;
  land: Land;
  onConfirm: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const hasRecords = land.capacity.filled > 0 || land.capacity.reserved > 0;

  return (
    <SiteDialog title="Sahayı Sil" busy={saving} onClose={onClose}>
        <div className="flex items-start gap-4">
          <span className="text-3xl shrink-0">🗑️</span>
          <div>
            <h2 className="text-lg font-bold text-white">Sahayı Sil</h2>
            <p className="text-sm text-slate-400 mt-1">
              <span className="text-white font-medium">{land.name}</span> kaydını kalıcı olarak silmek istediğinizden emin misiniz?
              Saha sayfası da yayından kalkar.
            </p>

            {hasRecords && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                ⚠️ Bu sahada {fmt(land.capacity.filled)} bırakılmış ve {fmt(land.capacity.reserved)} ayrılmış tohum topu kaydı var; silinemez.
                Bunun yerine “Yayından al” düğmesini kullanın.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        {blocked && <Recovery onReload={onReload} />}
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" disabled={saving} onClick={onClose} className="flex-1">
            Vazgeç
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={saving || blocked || hasRecords} className="flex-1">
            {saving ? "Siliniyor…" : "Evet, Sil"}
          </Button>
        </div>
    </SiteDialog>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function SahalarPage() {
  const { me } = useAdmin();
  return (
    <RoleGuard path="/admin/araziler">
      <SahalarContent key={siteAccessKey(me)} />
    </RoleGuard>
  );
}

function Recovery({ onReload }: { onReload: () => void }) { return <div className="space-y-3 border border-amber-400/30 rounded-xl p-3 my-4 text-sm text-amber-100"><p>İşlem otomatik tekrarlanmayacak. Yeniden doğrulama gerekiyorsa hesap güvenliğini açın; ardından güncel kayıtları yükleyip işlemi yeniden seçin.</p><Link href="/admin/guvenlik" target="_blank" rel="noopener noreferrer" className="underline">Hesap güvenliği (yeni sekme)</Link><Button variant="secondary" onClick={onReload}>Güncel kayıtları yükle</Button></div>; }
function SiteDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: React.ReactNode }) {
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => { const el=ref.current, previous=document.activeElement instanceof HTMLElement ? document.activeElement : null; el?.showModal(); return () => { el?.close(); if(previous?.isConnected)previous.focus(); }; }, []);
 return <dialog ref={ref} aria-label={title} aria-busy={busy} onKeyDown={containDialogTab} onCancel={e => { if(busy)e.preventDefault();else onClose(); }} className="m-auto w-[calc(100%-1rem)] max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-[#0b1410] border border-white/15 p-4 sm:p-6 text-white backdrop:bg-black/70">{children}</dialog>;
}
