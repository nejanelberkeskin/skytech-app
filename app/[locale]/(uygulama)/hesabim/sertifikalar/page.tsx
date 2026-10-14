"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase/browser";
import { intlLocale } from "@/lib/utils/locale";

interface CertRow {
  id: string;
  recipient_name: string;
  tree_count: number;
  forest_name: string;
  certificate_url: string | null;
  created_at: string;
}

function CopyLinkButton({ certId }: { certId: string }) {
  const t = useTranslations("accountPages.certificates");
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/sertifika/${certId}`;
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" onClick={copy}
      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-300 ${
        copied
          ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-700"
          : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-200"
      }`}>
      {copied ? t("copied") : t("copyLink")}
    </button>
  );
}

export default function SertifikalarPage() {
  const t = useTranslations("accountPages.certificates");
  const tPages = useTranslations("accountPages");
  const locale = useLocale();
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const userId = session.session.user.id;

      const { data } = await supabase
        .from("certificates")
        .select("id, recipient_name, tree_count, forest_name, certificate_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (data) setCerts(data);
      setLoading(false);

      /* ── Realtime: Yeni sertifika oluştuğunda otomatik yenile ────────── */
      channel = supabase
        .channel("certs-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "certificates", filter: `user_id=eq.${userId}` },
          () => { load(); }
        )
        .subscribe();
    };
    load();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div role="status" aria-label={tPages("loading")} className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      ) : certs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">{t("empty")}</p>
          <p className="text-sm text-slate-500">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {certs.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-slate-200 rounded-xl p-5 overflow-hidden relative group"
              
            >
              {/* Premium glow on hover */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                 />

              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  {/* Certificate icon */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{c.recipient_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.forest_name}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm font-bold text-emerald-700">{t("seeds", { count: c.tree_count })}
                      </span>
                      <span className="text-xs text-slate-500">|</span>
                      <span className="text-xs text-slate-500">
                        {new Date(c.created_at).toLocaleDateString(intlLocale(locale))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {/* View certificate */}
                  <Link href={`/sertifika/${c.id}`} target="_blank"
                    className="flex-1 py-2.5 bg-[#1B6B3A] hover:bg-[#165c31] rounded-xl text-sm text-center font-medium text-white min-w-[100px] transition-all">
                    {t("view")}
                  </Link>

                  {/* Copy share link */}
                  <CopyLinkButton certId={c.id} />

                  {/* WhatsApp share */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      t("shareText", { name: c.recipient_name, count: c.tree_count, url: `${typeof window !== "undefined" ? window.location.origin : ""}/sertifika/${c.id}` })
                    )}`}
                    target="_blank" rel="noreferrer"
                    className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
>
                    WhatsApp
                  </a>

                  {/* Download PDF if available */}
                  {c.certificate_url && (
                    <a href={c.certificate_url} target="_blank" rel="noreferrer"
                      className="px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-200 transition-all">
                      ⬇ PDF
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
