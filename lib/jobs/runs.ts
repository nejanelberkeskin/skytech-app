/**
 * Zamanlanmış işlerin kaydı ve sağlığı — YALNIZ SUNUCU (web-brifler/18).
 *
 * Her çalışma `job_runs`a yazılır (020): kim/ne zaman/sonuç. Aynı iş aynı anda bir kez çalışır (tek satırlık
 * kilit). Cron'da kayıt tutulamazsa (ör. 020 henüz uygulanmadı) iş YİNE çalışır; elle çalıştırmada kilit
 * alınamazsa çalışmaz. Sipariş listesi açıldığında yapılan süre dolumu/kesinleşme (GET yan etkisi) cron
 * sağlığı doğrulanana kadar yerinde kalır; bu modül onu kaldırmaz.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const JOBS = {
  "siparis-isleri": {
    label: "Sipariş işleri",
    schedule: "0 3 * * *",
    scheduleText: "Her gün 03:00 UTC (06:00 Türkiye saati)",
    staleAfterHours: 26,
  },
} as const;

export type JobName = keyof typeof JOBS;
export type JobTrigger = "cron" | "admin";
/** all: bütün iş (bildirim e-postaları dahil) · status: yalnız durum işleri (süre dolumu, kesinleşme, izleme) */
export type JobScope = "all" | "status";

export const isJobName = (name: string): name is JobName => Object.prototype.hasOwnProperty.call(JOBS, name);

export type JobRunStatus = "ok" | "stale" | "failing" | "never_run" | "not_configured";

export interface JobRunView {
  id: string;
  trigger: JobTrigger;
  scope: JobScope;
  actorId: string | null;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  error: string | null;
  report: Record<string, unknown> | null;
}

export interface JobHealth {
  job: JobName;
  label: string;
  schedule: string;
  scheduleText: string;
  cronConfigured: boolean;
  status: JobRunStatus;
  running: boolean;
  lastRun: JobRunView | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  /** Sipariş listesi GET'i hâlâ süre dolumu/kesinleşme yapıyor (cron doğrulanınca kaldırılacak). */
  listViewSideEffects: boolean;
  checkedAt: string;
}

interface JobRunRow {
  id: string;
  trigger: JobTrigger;
  scope: JobScope;
  actor: string | null;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  error: string | null;
  report: Record<string, unknown> | null;
}

const RUNNING_WINDOW_MS = 10 * 60_000;

export type RecordedRun<T> =
  | { status: "done"; runId: string | null; recorded: boolean; report: T }
  | { status: "failed"; runId: string | null; error: string }
  | { status: "running" }
  | { status: "unavailable" };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

/** İşi kayıt ve tek çalışma kilidiyle çalıştırır. */
export async function runRecorded<T extends Record<string, unknown>>(
  db: SupabaseClient,
  job: JobName,
  trigger: JobTrigger,
  scope: JobScope,
  actor: string | null,
  fn: () => Promise<T>,
  log: (text: string, data?: unknown) => void = console.error
): Promise<RecordedRun<T>> {
  const start = await db.rpc("start_job_run", { p_job: job, p_trigger: trigger, p_scope: scope, p_actor: actor });
  if (start.error) {
    if (String(start.error.message).trim() === "job_running") return { status: "running" };
    if (trigger === "admin") return { status: "unavailable" };
    log(`[is] ${job}: çalışma kaydı açılamadı, iş kayıtsız çalışıyor`, start.error.code);
    try {
      return { status: "done", runId: null, recorded: false, report: await fn() };
    } catch (e) {
      return { status: "failed", runId: null, error: message(e) };
    }
  }
  const runId = String(start.data);
  try {
    const report = await fn();
    const done = await db.rpc("finish_job_run", { p_id: runId, p_ok: true, p_report: report, p_error: null });
    if (done.error) log(`[is] ${job}: çalışma sonucu kaydedilemedi`, done.error.code);
    return { status: "done", runId, recorded: !done.error, report };
  } catch (e) {
    const done = await db.rpc("finish_job_run", { p_id: runId, p_ok: false, p_report: null, p_error: message(e) });
    if (done.error) log(`[is] ${job}: hata sonucu kaydedilemedi`, done.error.code);
    return { status: "failed", runId, error: message(e) };
  }
}

const view = (r: JobRunRow): JobRunView => ({
  id: r.id,
  trigger: r.trigger,
  scope: r.scope,
  actorId: r.actor,
  startedAt: new Date(r.started_at).toISOString(),
  finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
  ok: r.ok,
  error: r.error,
  report: r.report,
});

/** Son çalışmalardan sağlık durumu. Gizli değer döndürmez; yalnız CRON_SECRET tanımlı mı. */
export function healthFrom(job: JobName, runs: JobRunRow[], cronConfigured: boolean, now: Date): JobHealth {
  const meta = JOBS[job];
  const sorted = [...runs].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const lastSuccess = sorted.find((r) => r.ok === true && r.finished_at);
  const lastFailure = sorted.find((r) => r.ok === false && r.finished_at);
  const latestFinished = sorted.find((r) => r.finished_at);
  const running = sorted.some((r) => !r.finished_at && Date.parse(r.started_at) > now.getTime() - RUNNING_WINDOW_MS);
  let status: JobRunStatus;
  if (!cronConfigured) status = "not_configured";
  else if (!latestFinished) status = "never_run";
  else if (latestFinished.ok === false) status = "failing";
  else if (!lastSuccess || Date.parse(lastSuccess.finished_at as string) < now.getTime() - meta.staleAfterHours * 3_600_000) status = "stale";
  else status = "ok";
  return {
    job,
    label: meta.label,
    schedule: meta.schedule,
    scheduleText: meta.scheduleText,
    cronConfigured,
    status,
    running,
    lastRun: sorted[0] ? view(sorted[0]) : null,
    lastSuccessAt: lastSuccess?.finished_at ? new Date(lastSuccess.finished_at).toISOString() : null,
    lastFailureAt: lastFailure?.finished_at ? new Date(lastFailure.finished_at).toISOString() : null,
    listViewSideEffects: true,
    checkedAt: now.toISOString(),
  };
}

/** Okuma hatasında FIRLATIR: sağlık "hiç çalışmadı" gibi gösterilmez. */
export async function jobHealth(db: SupabaseClient, job: JobName, env: Record<string, string | undefined> = process.env, now = new Date()): Promise<JobHealth> {
  const { data, error } = await db
    .from("job_runs")
    .select("id, trigger, scope, actor, started_at, finished_at, ok, error, report")
    .eq("job", job)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("job_health_unavailable");
  return healthFrom(job, (data ?? []) as JobRunRow[], Boolean(env.CRON_SECRET), now);
}
