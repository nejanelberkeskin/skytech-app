"use client";
import { useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAdmin } from "@/lib/admin-context";
import { Button } from "@/components/ui";
import type { ApiWarning } from "@/lib/api/envelope";
import { AdminApiError } from "../operations/client";
import { accessRequest } from "./transport";
import { canVisit } from "./policy";
import SecurityPanel from "./SecurityPanel";
export function AccessTabs() {
  const { me } = useAdmin();
  const path = usePathname();
  return (
    <nav aria-label="Ekip yönetimi" className="flex flex-wrap gap-2">
      {[
        ["/admin/kullanicilar", "Personel"],
        ["/admin/davetler", "Davetler"],
        ["/admin/roller", "Roller"],
        ["/admin/islem-kaydi", "İşlem geçmişi"],
        ["/admin/guvenlik", "Güvenlik"],
      ]
        .filter(([href]) => canVisit(me, href))
        .map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            className={`min-h-11 px-4 py-3 rounded-xl border text-sm ${path === href ? "border-emerald-400/40 text-emerald-200" : "border-white/10 text-slate-300"}`}
          >
            {label}
          </Link>
        ))}
    </nav>
  );
}
export function AccessPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-slate-300 text-sm">{description}</p>
      </header>
      <AccessTabs />
      {children}
    </div>
  );
}
export function useAccessCommand() {
  const { refresh } = useAdmin();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  async function run<T>(
    url: string,
    method: string,
    body: object,
    onFailure?: (error: Error) => void,
  ): Promise<T | undefined> {
    if (lock.current || uncertain) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await accessRequest<T>(url, method, body);
      setWarnings((prev) => [
        ...prev,
        ...response.warnings.filter(
          (w) =>
            !prev.some((p) => p.code === w.code && p.message === w.message),
        ),
      ]);
      return response.data;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("İşlem tamamlanamadı.");
      setError(err);
      onFailure?.(err);
      if (
        !(err instanceof AdminApiError) ||
        err.status === 0 ||
        err.status >= 500
      )
        setUncertain(true);
      if (
        err instanceof AdminApiError &&
        (err.status === 401 ||
          (err.status === 403 && err.code !== "mfa_required"))
      )
        void refresh();
      return;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    warnings,
    uncertain,
    result,
    run,
    setError,
    setResult,
    reset: () => {
      setUncertain(false);
      setError(null);
    },
  };
}
export function Feedback({
  command,
}: {
  command: ReturnType<typeof useAccessCommand>;
}) {
  return (
    <div className="space-y-3">
      {command.error && (
        <p
          role="alert"
          className="border border-red-400/40 rounded-xl p-4 text-sm text-red-200"
        >
          {command.error.message}
        </p>
      )}
      {command.warnings.map((w, i) => (
        <p
          key={i}
          role="alert"
          className="border border-amber-400/40 rounded-xl p-4 text-sm text-amber-200"
        >
          {w.message}
        </p>
      ))}
      {command.result && (
        <p role="status" className="text-emerald-200">
          {command.result}
        </p>
      )}
      {command.uncertain && (
        <p className="text-amber-200 text-sm">
          Sonuç belirsiz. Yeniden işlem yapmadan önce üstteki yenile düğmesiyle
          güncel kayıtları alın.
        </p>
      )}
      {command.error instanceof AdminApiError &&
        command.error.code === "mfa_required" && <SecurityPanel />}
    </div>
  );
}
export function LoadError({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  return (
    <div className="space-y-3">
      <p role="alert" className="text-red-200">
        {error}
      </p>
      <Button variant="secondary" onClick={retry}>
        Yeniden dene
      </Button>
    </div>
  );
}
