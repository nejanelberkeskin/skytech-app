"use client";

/**
 * DavetCard — Davet landing page interaktif kartı.
 *
 * - Cookie `ref_code` ayarlar (30 gün, path=/)
 * - `/bireysel/satin-al` sayfasına yönlendirir
 * - Arka planda CSS animasyonlu partikül orman efekti
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
  code:                 string;
  referrerFirstName:    string;
  referrerDisplayName:  string;
  found:                boolean;
}

export default function DavetCard({ code, referrerFirstName, referrerDisplayName, found }: Props) {
  const router = useRouter();

  // Sayfa yüklenince kodu localStorage'a da yaz (cookie fallback)
  useEffect(() => {
    if (found) {
      localStorage.setItem("ref_code", code);
    }
  }, [code, found]);

  const handleJoin = () => {
    if (found) {
      // Cookie: 30 gün, tüm yollar
      document.cookie = `ref_code=${code}; path=/; max-age=2592000; SameSite=Lax`;
      localStorage.setItem("ref_code", code);
    }
    router.push("/bireysel/satin-al");
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.12) 0%, #050810 60%)" }}
    >
      {/* ── Arka plan: yüzen partiküller ──────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width:  `${4 + (i % 5) * 3}px`,
              height: `${4 + (i % 5) * 3}px`,
              left:   `${(i * 37 + 11) % 100}%`,
              top:    `${(i * 53 + 7)  % 100}%`,
              background: i % 3 === 0
                ? "rgba(16,185,129,0.35)"
                : i % 3 === 1
                ? "rgba(52,211,153,0.2)"
                : "rgba(110,231,183,0.15)",
              animation: `float-seed ${6 + (i % 5) * 1.5}s ease-in-out infinite`,
              animationDelay: `${(i * 0.4).toFixed(1)}s`,
            }}
          />
        ))}
      </div>

      {/* ── Büyük arka plan logosu ─────────────────────────────────────────── */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-hidden
        style={{ opacity: 0.03 }}
      >
        <span style={{ fontSize: "40vw", lineHeight: 1 }}>🌳</span>
      </div>

      {/* ── Ana glassmorphic kart ──────────────────────────────────────────── */}
      <div
        className="relative z-10 w-full max-w-lg mx-4 rounded-3xl overflow-hidden"
        style={{
          background:   "rgba(255,255,255,0.04)",
          border:       "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(24px)",
          boxShadow:    "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Üst yeşil ışık şeridi */}
        <div
          className="h-1 w-full"
          style={{ background: "linear-gradient(90deg, transparent, #10b981, #34d399, transparent)" }}
        />

        <div className="px-8 py-10 space-y-7 text-center">
          {/* Rozet */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase"
            style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}
          >
            <span className="animate-pulse">🌱</span>
            Skytech Green · Davet Programı
          </div>

          {/* Başlık */}
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white leading-tight">
              {found ? (
                <>
                  <span
                    className="block"
                    style={{ background: "linear-gradient(135deg, #34d399, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                  >
                    🎉 {referrerFirstName}
                  </span>
                  <span className="block text-white mt-1">sizi geleceği inşa</span>
                  <span className="block text-white">etmeye çağırıyor!</span>
                </>
              ) : (
                <span className="block text-white">Skytech Green&apos;e Hoş Geldiniz!</span>
              )}
            </h1>

            {found && (
              <p className="text-sm text-slate-400 leading-relaxed">
                <span className="font-semibold text-emerald-400">{referrerDisplayName}</span>{" "}
                tarafından özel olarak davet edildiniz.
              </p>
            )}
          </div>

          {/* Teşvik kutusu */}
          <div
            className="rounded-2xl p-5 text-left space-y-3"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.18)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(52,211,153,0.2)" }}
              >
                🎁
              </div>
              <div>
                <p className="text-sm font-bold text-white">Hoş Geldin Hediyesi</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Bu davet linkiyle yapacağınız{" "}
                  <strong className="text-emerald-400">ilk doğa operasyonunda</strong>{" "}
                  (tohum alımında) ekstra{" "}
                  <span
                    className="font-black text-base"
                    style={{ color: "#34d399", textShadow: "0 0 12px rgba(52,211,153,0.6)" }}
                  >
                    +5 tohum
                  </span>{" "}
                  hesabınıza hediye edilecektir.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(52,211,153,0.2)" }}
              >
                🌳
              </div>
              <div>
                <p className="text-sm font-bold text-white">Sizi Davet Eden de Kazanıyor</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {found ? referrerFirstName : "Davet eden"} de{" "}
                  <strong className="text-emerald-400">+5 tohum</strong>{" "}
                  kazanacak. Birlikte ormanı büyütüyorsunuz.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Butonu */}
          <button
            onClick={handleJoin}
            className="w-full min-h-[52px] flex items-center justify-center gap-2.5 rounded-2xl text-base font-bold text-white transition-all active:scale-[0.98]"
            style={{
              background:  "linear-gradient(135deg, #10b981, #059669)",
              boxShadow:   "0 6px 24px rgba(16,185,129,0.4), 0 0 0 1px rgba(52,211,153,0.2)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget).style.boxShadow = "0 8px 32px rgba(16,185,129,0.55), 0 0 0 1px rgba(52,211,153,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget).style.boxShadow = "0 6px 24px rgba(16,185,129,0.4), 0 0 0 1px rgba(52,211,153,0.2)";
            }}
          >
            <span className="text-xl">🌱</span>
            Hemen Katıl ve Tohumlarını Ek
          </button>

          {/* Küçük güven metni */}
          <p className="text-xs text-slate-600">
            Ücretsiz kayıt · Kredi kartı gerektirmez · Anlık aktivasyon
          </p>
        </div>

        {/* Alt yeşil ışık şeridi */}
        <div
          className="h-px w-full"
          style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.4), transparent)" }}
        />
      </div>

      {/* Animasyon CSS */}
      <style>{`
        @keyframes float-seed {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.6; }
          33%       { transform: translateY(-18px) rotate(120deg); opacity: 1; }
          66%       { transform: translateY(-8px) rotate(240deg); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
