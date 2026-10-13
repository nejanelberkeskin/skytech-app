"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "none" }
  | { kind: "pending"; company: string }
  | { kind: "rejected"; company: string; note: string | null }
  | { kind: "approved" };

/**
 * Kurumsal panel ve teklif formu yalnız onaylı kurumsal hesapla açılır (043). Oturum yoksa girişe, başvuru yoksa başvuru
 * sayfasına yönlendirir; bekleyen ya da reddedilen başvuruda durumu gösterir. Veritabanı politikası aynı kuralı ayrıca uygular.
 */
export default function ApprovalGate({ children }: { children: ReactNode }) {
  const t = useTranslations("corporatePages.gate");
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    fetch("/api/kurumsal/durum", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!alive) return;
        if (!d.signedIn) return router.replace("/kurumsal/giris");
        if (d.status === "approved") setState({ kind: "approved" });
        else if (d.status === "pending") setState({ kind: "pending", company: d.companyTitle ?? "" });
        else if (d.status === "rejected") setState({ kind: "rejected", company: d.companyTitle ?? "", note: d.reviewNote ?? null });
        else setState({ kind: "none" });
      })
      .catch(() => alive && setState({ kind: "error" }));
    return () => {
      alive = false;
    };
  }, [router]);

  if (state.kind === "approved") return <>{children}</>;
  if (state.kind === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div role="status" aria-label={t("loading")} className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
      </div>
    );
  }
  const box = (title: string, body: ReactNode, action?: ReactNode) => (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div role="status" className="liquid-glass max-w-lg rounded-3xl p-8 text-center space-y-3">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <div className="text-sm leading-relaxed text-emerald-100/70">{body}</div>
        {action}
      </div>
    </div>
  );
  const link = (href: string, label: string) => (
    <Link href={href} className="inline-block mt-3 rounded-2xl glass-btn px-5 py-3 text-sm font-medium text-white">{label}</Link>
  );
  if (state.kind === "pending") return box(t("pending.title"), t("pending.body", { company: state.company }));
  if (state.kind === "rejected")
    return box(t("rejected.title"), <>{t("rejected.body")}{state.note && <p className="mt-2 text-emerald-100/90">{state.note}</p>}</>);
  if (state.kind === "none") return box(t("none.title"), t("none.body"), link("/kurumsal/basvuru", t("none.cta")));
  return box(t("error.title"), t("error.body"));
}
