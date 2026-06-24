"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import Navbar from "@/components/Navbar";

interface LiveStats {
  totalSeeds: number;
  carbonTons: number;
  partners: number;
  certificates: number;
}

function fmtStat(n: number): string {
  if (n >= 1000) return Math.floor(n / 1000).toLocaleString("tr-TR") + ".000+";
  return n.toLocaleString("tr-TR");
}

const SERVICES = [
  {
    title: "Markanıza Özel Orman",
    desc: "Markanız adına özel bir orman alanı tahsis edin. Çalışanlarınız ve müşterileriniz için yaşayan bir miras bırakın.",
    icon: "🌲",
    glow: "rgba(16,185,129,0.1)",
  },
  {
    title: "Karbon Denkleştirme",
    desc: "Şirketinizin karbon ayak izini hesaplayın ve ağaçlandırma ile nötrleyin. ESG raporlarınıza entegre edin.",
    icon: "♻️",
    glow: "rgba(20,184,166,0.1)",
  },
  {
    title: "Dijital Sertifikalar",
    desc: "Müşterilerinize ve çalışanlarınıza kişiselleştirilmiş dijital sertifikalar hediye edin. Toplu üretim destekli.",
    icon: "🎖️",
    glow: "rgba(139,92,246,0.1)",
  },
  {
    title: "Etkinlik Paketleri",
    desc: "Lansman, kongre veya şirket etkinlikleriniz için özel tohum hediye paketleri hazırlayın.",
    icon: "🎁",
    glow: "rgba(236,72,153,0.08)",
  },
];

const TRUST_BADGES = [
  "ISO 14001 Uyumlu Raporlama",
  "ESG Entegrasyonu",
  "Blockchain Takip",
  "Kurumsal Fatura & Proforma",
];

const MOCK_LOGOS = ["TechBank", "GreenCorp", "EcoFinans", "NovaBuild", "AltınSigorta", "YeşilEnerji"];

export default function CorporateLanding() {
  const [stats, setStats] = useState<LiveStats>({
    totalSeeds: 128000, carbonTons: 3200, partners: 47, certificates: 85000,
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: seedRows } = await supabase
          .from("orders")
          .select("total_seeds")
          .eq("payment_status", "paid");
        const totalSeeds = seedRows?.reduce((s, r) => s + (r.total_seeds ?? 0), 0) ?? 0;

        const { data: partnerRows } = await supabase
          .from("corporate_quotes")
          .select("company_name")
          .eq("status", "PAID");
        const partners = new Set(partnerRows?.map((r) => r.company_name)).size;

        const { count: certCount } = await supabase
          .from("certificates")
          .select("id", { count: "exact", head: true });

        setStats({
          totalSeeds: totalSeeds || 128000,
          carbonTons: Math.round((totalSeeds || 128000) * 0.025),
          partners: partners || 47,
          certificates: certCount ?? 85000,
        });
      } catch {
        // Varsayılan değerler kalır
      }
    })();
  }, []);

  const STATS = [
    { label: "Dikilen Ağaç", value: fmtStat(stats.totalSeeds), icon: "🌳" },
    { label: "Nötrlenen Karbon", value: `${stats.carbonTons.toLocaleString("tr-TR")} Ton`, icon: "💨" },
    { label: "Kurumsal Partner", value: String(stats.partners), icon: "🏢" },
    { label: "Oluşturulan Sertifika", value: fmtStat(stats.certificates), icon: "📜" },
  ];

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
        <div className="nature-orb nature-orb-3" />
      </div>

      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-20">
        <div className="max-w-3xl animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-subtle rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-300 font-medium">{stats.partners} Kurum Skytech ile Çalışıyor</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            Şirketinizin Geleceğini{" "}
            <span className="text-gradient-eco">Yeşertin</span>
          </h1>
          <p className="text-lg text-emerald-100/40 leading-relaxed mb-10 max-w-2xl">
            Karbon ayak izinizi sıfırlayın, ESG hedeflerinize ulaşın ve markanız adına yaşayan bir orman bırakın.
            Skytech kurumsal çözümleriyle sürdürülebilirlik stratejinizi somut eyleme dönüştürün.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/kurumsal/teklif-al"
              className="glass-btn px-8 py-4 rounded-2xl text-white font-semibold transition-all"
            >
              Ücretsiz Teklif Alın →
            </Link>
            <a
              href="#hizmetler"
              className="px-8 py-4 border border-white/[0.08] hover:border-white/[0.15] text-emerald-200/50 hover:text-white font-medium rounded-2xl transition-all"
            >
              Hizmetleri İncele
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────────── */}
      <section className="relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="liquid-glass rounded-3xl py-10 px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <span className="text-3xl block mb-2">{s.icon}</span>
                <p className="text-2xl md:text-3xl font-bold text-white">{s.value}</p>
                <p className="text-sm text-emerald-200/30 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ─────────────────────────────────────────── */}
      <section id="hizmetler" className="relative z-10 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Kurumsal <span className="text-gradient-eco">Çözümlerimiz</span></h2>
            <p className="text-emerald-100/40 max-w-xl mx-auto">
              Her ölçekteki kurum için özelleştirilebilir sürdürülebilirlik paketleri.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 stagger-children">
            {SERVICES.map((s) => (
              <div
                key={s.title}
                className="liquid-glass liquid-glass-hover relative rounded-3xl p-8 overflow-hidden group"
              >
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ boxShadow: `inset 0 0 40px ${s.glow}` }} />
                <div className="relative z-10">
                  <span className="text-4xl block mb-4 group-hover:scale-110 transition-transform duration-300">{s.icon}</span>
                  <h3 className="text-xl font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-emerald-100/40 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Section ────────────────────────────────────── */}
      <section className="relative z-10 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-3">Güvenilir Altyapı</h2>
            <p className="text-emerald-200/30 text-sm">Kurumsal standartlara uygun, şeffaf ve ölçülebilir.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {TRUST_BADGES.map((b) => (
              <div key={b} className="flex items-center gap-2 px-4 py-2.5 glass-subtle rounded-full">
                <span className="text-emerald-400">✓</span>
                <span className="text-sm text-emerald-200/60">{b}</span>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-xs text-emerald-200/20 uppercase tracking-widest mb-6">Bize Güvenen Kurumlar</p>
            <div className="flex flex-wrap justify-center gap-4">
              {MOCK_LOGOS.map((name) => (
                <div key={name} className="glass-subtle rounded-2xl w-28 h-12 flex items-center justify-center">
                  <span className="text-sm font-medium text-emerald-200/30">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="relative z-10 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="liquid-glass rounded-3xl p-12 overflow-hidden relative"
            style={{ boxShadow: "0 0 60px rgba(16,185,129,0.06)" }}>
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-white mb-4">Kurumsal Ormanınızı Bugün Başlatın</h2>
              <p className="text-emerald-100/40 mb-10">
                Size özel bir teklif hazırlamamız sadece 24 saat sürer. Hiçbir taahhüt yok.
              </p>
              <Link
                href="/kurumsal/teklif-al"
                className="inline-flex glass-btn px-10 py-4 rounded-2xl text-white font-semibold transition-all"
              >
                Ücretsiz Teklif Alın →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="relative z-10 py-10" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>🌱</span>
            <span className="text-sm font-semibold text-emerald-200/40">SkytechGreen</span>
          </div>
          <p className="text-xs text-emerald-200/20">© 2026 SkytechGreen. Tüm hakları saklıdır.</p>
          <div className="flex gap-6 text-sm text-emerald-200/30">
            <Link href="/bireysel/satin-al" className="hover:text-white transition-colors">Bireysel</Link>
            <Link href="/kurumsal/teklif-al" className="hover:text-white transition-colors">Teklif Al</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
