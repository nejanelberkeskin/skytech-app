"use client";
import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Select } from "@/components/ui";
import type { ApiWarning } from "@/lib/api/envelope";
import type { JobHealth, JobScope } from "@/lib/jobs/runs";
import { AdminApiError, adminRequest, errorText, istanbulDate } from "./client";

const STATUS = { ok: "Zamanlanmış iş sağlıklı", stale: "Başarılı çalışma gecikti", failing: "Son çalışma başarısız", never_run: "Henüz tamamlanan çalışma yok", not_configured: "Zamanlanmış iş kapalı" };
const REPORT_FIELDS: Record<string, string> = { expired: "Süresi dolan", confirmed: "Kesinleşen", monitoring: "İzlemeye alınan", certificateEmails: "Sertifika bildirimleri", videoEmails: "Video bildirimleri" };
function RunReport({ report }: { report: Record<string, unknown> }) {
  return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">{Object.entries(report).map(([key, value]) => <div key={key}><dt className="text-slate-400">{REPORT_FIELDS[key] ?? key}</dt><dd className="text-slate-100 break-words">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>;
}
export default function JobsHealth({ canRun }: { canRun: boolean }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobHealth[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [denied, setDenied] = useState(false);
  const [scope, setScope] = useState<JobScope>("status");
  const [selected, setSelected] = useState<JobHealth | null>(null);
  const [result, setResult] = useState<{ runId: string | null; report: Record<string, unknown> } | null>(null);
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const lock = useRef(false);
  const latest = useRef({ value: 0 });
  const feedback = useRef<HTMLDivElement>(null);
  const confirmHeading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const load = useCallback(async () => {
    const generation = ++latest.current.value;
    try {
      const response = await adminRequest<{ jobs: JobHealth[] }>("/api/admin/jobs");
      if (generation !== latest.current.value) return;
      setJobs(response.data.jobs); setStale(false); setError(null);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) router.replace("/admin/giris");
      if (generation !== latest.current.value) return;
      setError(errorText(e)); setStale(true);
      if (e instanceof AdminApiError && [401,403].includes(e.status)) { setJobs(null); setDenied(true); }
    } finally { if (generation === latest.current.value) setLoading(false); }
  }, [router]);
  useEffect(() => { const token = latest.current; void load(); return () => { token.value++; }; }, [load]);
  useEffect(() => { if (selected) confirmHeading.current?.focus(); }, [selected]);
  const run = async () => {
    if (lock.current || !selected || !canRun || denied || stale || selected.running) return;
    lock.current = true; setBusy(true); setError(null); setResult(null);
    try {
      const response = await adminRequest<{ runId: string | null; report: Record<string, unknown>; health: JobHealth | null }>(`/api/admin/jobs/${selected.job}/run`, { scope });
      setResult(response.data);
      setWarnings(prev => [...prev, ...response.warnings.filter(w => !prev.some(p => p.code === w.code && p.message === w.message))]);
      if (response.data.health) setJobs(prev => prev?.map(j => j.job === selected.job ? response.data.health! : j) ?? [response.data.health!]);
      else setStale(true);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) router.replace("/admin/giris");
      setError(errorText(e)); setStale(true);
      if (e instanceof AdminApiError && e.status === 403) setDenied(true);
      if (e instanceof AdminApiError && typeof e.details?.runId === "string") setError(`${errorText(e)} Çalışma kimliği: ${e.details.runId}`);
    } finally { setSelected(null); lock.current = false; setBusy(false); feedback.current?.focus(); }
  };
  return <section aria-label="Zamanlanmış iş sağlığı" className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-4 md:p-6 space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold text-white">Zamanlanmış iş sağlığı</h2><Button variant="secondary" disabled={busy || loading} onClick={() => { setLoading(true); setSelected(null); void load(); }}>İş sağlığını yenile</Button></div>
    <div ref={feedback} tabIndex={-1} className="space-y-3 outline-none">
      {error && <p role="alert" className="text-sm text-red-200 break-words">{error}</p>}
      {warnings.map((w,i) => <p role="alert" key={i} className="text-sm text-amber-200">{w.message}</p>)}
      {result && <div role="status" className="rounded-xl border border-emerald-400/30 p-4 space-y-3"><p className="text-emerald-200">İş çalıştırıldı. Çalışma kimliği: <span className="break-all">{result.runId ?? "Alınamadı"}</span></p><RunReport report={result.report} /></div>}
    </div>
    {loading && <p role="status" className="text-slate-300 text-sm">İş sağlığı yükleniyor…</p>}
    {stale && jobs && <p className="text-sm text-amber-200">Aşağıda son görülen durum var. Yeniden çalıştırmadan önce iş sağlığını yenileyin.</p>}
    {jobs?.map(job => <div key={job.job} className="space-y-3">
      <h3 className="text-white font-medium">{job.label}</h3>
      <p className={`rounded-xl border p-3 text-sm ${job.status === "ok" ? "border-emerald-400/30 text-emerald-200" : job.status === "failing" ? "border-red-400/40 text-red-200" : "border-amber-400/30 text-amber-200"}`}>{STATUS[job.status]}{job.running ? " · Şu anda çalışıyor" : ""}</p>
      <p className="text-sm text-slate-300">{job.scheduleText}</p>
      <dl className="grid sm:grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-400">Son başarılı çalışma</dt><dd className="text-slate-200">{istanbulDate(job.lastSuccessAt)}</dd></div><div><dt className="text-slate-400">Son başarısız çalışma</dt><dd className="text-slate-200">{istanbulDate(job.lastFailureAt)}</dd></div></dl>
      {!job.cronConfigured && <p className="text-sm text-amber-200">Otomatik çalışma yapılandırılmamış. Yetkili sistem sorumlusu zamanlamayı etkinleştirmeli. Elle çalıştırmak otomatik çalışmayı açmaz.</p>}
      {job.listViewSideEffects && <p className="text-sm text-slate-300">Geçiş döneminde sipariş listesini açmak da süre dolumu ve kesinleşme işlemlerini tetikliyor.</p>}
      {job.lastRun && <details className="text-sm text-slate-300"><summary className="min-h-11 cursor-pointer">Son çalışmanın ayrıntıları</summary><div className="space-y-2"><p className="break-all">{job.lastRun.id} · {job.lastRun.trigger === "cron" ? "Zamanlanmış" : "Yönetici başlattı"} · {job.lastRun.scope === "all" ? "E-posta bildirimleri dâhil" : "Yalnız durum işlemleri"}</p><p>{istanbulDate(job.lastRun.startedAt)} → {istanbulDate(job.lastRun.finishedAt)}</p>{job.lastRun.error && <p className="text-red-200 break-words">{job.lastRun.error}</p>}{job.lastRun.report && <RunReport report={job.lastRun.report} />}</div></details>}
      {job.status === "failing" && job.lastRun?.error && <p role="alert" className="text-sm text-red-200 break-words">{job.lastRun.error}</p>}
      {canRun && !denied && <div className="space-y-3 border-t border-white/10 pt-4">
        <Select label="Elle çalıştırma kapsamı" value={scope} onChange={e => { setScope(e.target.value as JobScope); setSelected(null); }} disabled={busy}>
          <option value="status">Yalnız durum işlemleri — e-posta göndermez</option><option value="all">Tüm işler — müşterilere e-posta gönderebilir</option>
        </Select>
        {selected?.job === job.job ? <div className="rounded-xl border border-amber-400/40 p-4 space-y-3"><h4 ref={confirmHeading} tabIndex={-1} className="font-semibold text-white outline-none">{job.label} şimdi çalıştırılsın mı?</h4><p className="text-sm text-slate-200">Sipariş süre dolumu, kesinleşme ve izleme dönemi işlemleri çalışacak. {scope === "all" ? <strong className="text-amber-200">Müşterilere sertifika ve video bildirim e-postaları da gönderilebilir.</strong> : "Bu kapsam e-posta göndermez."}</p><div className="flex flex-wrap gap-2"><Button loading={busy} disabled={stale || job.running} onClick={() => void run()}>Onayla ve çalıştır</Button><Button variant="ghost" disabled={busy} onClick={() => { setSelected(null); trigger.current?.focus(); }}>Vazgeç</Button></div></div> : <Button ref={trigger} disabled={busy || loading || stale || job.running} onClick={() => setSelected(job)}>Şimdi çalıştır</Button>}
      </div>}
      <p className="text-xs text-slate-400">Kontrol: {istanbulDate(job.checkedAt)} · Türkiye saati</p>
    </div>)}
  </section>;
}
