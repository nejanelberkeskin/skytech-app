"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/browser";

interface CertRow {
  id: string;
  recipient_name: string;
  tree_count: number;
  forest_name: string;
  certificate_url: string | null;
  created_at: string;
}

function CopyLinkButton({ certId }: { certId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/sertifika/${certId}`;
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-300 ${
        copied
          ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
          : "border-white/[0.08] text-emerald-200/40 hover:text-white hover:border-white/[0.15]"
      }`}>
      {copied ? "✓ Kopyalandı" : "🔗 Linki Kopyala"}
    </button>
  );
}

export default function SertifikalarPage() {
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
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Sertifikalarım</h1>
        <p className="text-sm text-emerald-200/40 mt-1">
          Doğaya katkılarınız için oluşturulan dijital sertifikalar
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      ) : certs.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-12 text-center">
          <span className="text-5xl block mb-4 animate-float">📜</span>
          <p className="text-emerald-200/50 mb-2">Henüz sertifikanız bulunmuyor.</p>
          <p className="text-sm text-emerald-200/30">
            Tohum satın alıp ektiğinizde dijital sertifikanız otomatik oluşturulacaktır.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {certs.map((c) => (
            <div
              key={c.id}
              className="liquid-glass rounded-3xl p-5 overflow-hidden relative group"
              style={{ boxShadow: "0 0 30px rgba(16,185,129,0.06)" }}
            >
              {/* Premium glow on hover */}
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 40px rgba(16,185,129,0.1)" }} />

              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  {/* Certificate icon */}
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.1))",
                      border: "1px solid rgba(52,211,153,0.2)",
                      boxShadow: "0 0 20px rgba(16,185,129,0.1)",
                    }}>
                    <span className="text-2xl">🏆</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{c.recipient_name}</p>
                    <p className="text-xs text-emerald-200/30 mt-0.5">{c.forest_name}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm font-bold text-emerald-400">
                        🌱 {c.tree_count.toLocaleString("tr-TR")} Tohum
                      </span>
                      <span className="text-xs text-emerald-200/15">|</span>
                      <span className="text-xs text-emerald-200/25">
                        {new Date(c.created_at).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {/* View certificate */}
                  <Link href={`/sertifika/${c.id}`} target="_blank"
                    className="flex-1 py-2.5 glass-btn rounded-xl text-sm text-center font-medium text-white min-w-[100px] transition-all">
                    🌐 Görüntüle
                  </Link>

                  {/* Copy share link */}
                  <CopyLinkButton certId={c.id} />

                  {/* WhatsApp share */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `🌱 ${c.recipient_name} adına ${c.tree_count.toLocaleString("tr-TR")} tohum ekildi! Sertifikayı görmek için: ${typeof window !== "undefined" ? window.location.origin : ""}/sertifika/${c.id}`
                    )}`}
                    target="_blank" rel="noreferrer"
                    className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "rgb(74,222,128)" }}>
                    WhatsApp
                  </a>

                  {/* Download PDF if available */}
                  {c.certificate_url && (
                    <a href={c.certificate_url} target="_blank" rel="noreferrer"
                      className="px-3 py-2 rounded-xl text-xs font-medium border border-white/[0.08] text-emerald-200/40 hover:text-white hover:border-white/[0.15] transition-all">
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
