"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface CertData {
  id: string;
  recipient_name: string;
  tree_count: number;
  forest_name: string;
  created_at: string;
}

// ── Animated tree SVG ─────────────────────────────────────────────────────────
function Tree({ x, height, delay, opacity }: { x: number; height: number; delay: number; opacity: number }) {
  return (
    <g style={{ animation: `treeGrow 1.2s cubic-bezier(0.34,1.56,0.64,1) ${delay}s both` }}
      transform={`translate(${x}, 0)`}>
      {/* Trunk */}
      <rect x="-4" y={-height * 0.28} width="8" height={height * 0.28}
        rx="3" fill="#064e3b" opacity={opacity * 0.8} />
      {/* Canopy layers */}
      <polygon points={`0,${-height} ${-height * 0.38},${-height * 0.55} ${height * 0.38},${-height * 0.55}`}
        fill="#10b981" opacity={opacity} />
      <polygon points={`0,${-height * 0.75} ${-height * 0.44},${-height * 0.28} ${height * 0.44},${-height * 0.28}`}
        fill="#059669" opacity={opacity} />
      <polygon points={`0,${-height * 0.48} ${-height * 0.5},0 ${height * 0.5},0`}
        fill="#047857" opacity={opacity} />
    </g>
  );
}

function ForestScene({ count }: { count: number }) {
  const trees = Array.from({ length: Math.min(count, 18) }, (_, i) => ({
    x: 30 + (i * (740 / Math.min(count, 18))),
    height: 28 + Math.sin(i * 1.7) * 10,
    delay: i * 0.08,
    opacity: 0.5 + Math.sin(i * 0.9) * 0.3,
  }));

  return (
    <svg viewBox="0 0 800 80" className="w-full" style={{ height: 80 }}>
      <defs>
        <style>{`
          @keyframes treeGrow {
            from { transform: scaleY(0) translateX(0); transform-origin: bottom center; opacity: 0; }
            to   { transform: scaleY(1) translateX(0); transform-origin: bottom center; opacity: 1; }
          }
        `}</style>
      </defs>
      {trees.map((t, i) => (
        <g key={i} transform={`translate(0, 70)`}>
          <Tree {...t} />
        </g>
      ))}
    </svg>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
        copied
          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
          : "bg-white/[0.05] border-white/[0.1] text-slate-400 hover:text-white hover:bg-white/[0.08]"
      }`}>
      {copied ? "✓ Kopyalandı!" : "🔗 Linki Kopyala"}
    </button>
  );
}

// ── PDF download ──────────────────────────────────────────────────────────────
function DownloadPdfButton({ certRef, fileName }: { certRef: React.RefObject<HTMLDivElement | null>; fileName: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!certRef.current || downloading) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#022c22",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(fileName);
    } catch (err) {
      console.error("PDF oluşturulamadı:", err);
    } finally {
      setDownloading(false);
    }
  }, [certRef, fileName, downloading]);

  return (
    <button onClick={handleDownload} disabled={downloading}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 disabled:opacity-50 transition-all">
      {downloading ? (
        <span className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
      {downloading ? "Hazırlanıyor..." : "PDF İndir"}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SertifikaPage() {
  const { id } = useParams<{ id: string }>();
  const [cert, setCert] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/public/sertifika/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setCert(data);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = cert
    ? `🌱 ${cert.recipient_name} adına ${cert.tree_count.toLocaleString("tr-TR")} tohum ekildi! Skytech Green ile birlikte doğaya katkıda bulunduk. #SkytechGreen #Orman`
    : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="w-12 h-12 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !cert) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <span className="text-6xl">📜</span>
        <h1 className="text-2xl font-bold text-white">Sertifika Bulunamadı</h1>
        <p className="text-slate-400 text-sm">Bu sertifika mevcut değil veya kaldırılmış olabilir.</p>
        <Link href="/" className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all">
          Ana Sayfaya Dön
        </Link>
      </div>
    );
  }

  const date = new Date(cert.created_at).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const certNo = cert.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-12 px-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <Link href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            ← skytech.green
          </Link>
        </div>

        {/* ── The Certificate ── */}
        <div ref={certRef}
          className="relative overflow-hidden rounded-3xl animate-scale-in"
          style={{
            background: "linear-gradient(135deg, #022c22 0%, #064e3b 40%, #065f46 70%, #047857 100%)",
            boxShadow: "0 0 0 1px rgba(16,185,129,0.3), 0 32px 64px -12px rgba(0,0,0,0.8), 0 0 80px rgba(16,185,129,0.08)",
          }}>

          {/* Background texture / radial glows */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)" }} />
            <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(5,150,105,0.08) 0%, transparent 70%)" }} />
            {/* Decorative dots grid */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
          </div>

          {/* Content */}
          <div className="relative z-10 p-8 sm:p-12 space-y-8">

            {/* Top: Logo + title */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-white/[0.08] border border-white/[0.12] rounded-full px-4 py-1.5">
                <span className="text-emerald-400 text-sm">🌲</span>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">Skytech Green</span>
                <span className="text-emerald-400 text-sm">🌲</span>
              </div>
              <h1 className="text-xl font-black uppercase tracking-[0.2em] text-white/90"
                style={{ textShadow: "0 0 30px rgba(16,185,129,0.3)" }}>
                Dijital Ekim Sertifikası
              </h1>
              <div className="w-24 h-px mx-auto bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
            </div>

            {/* Main: Recipient */}
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-widest text-emerald-400/60">Bu belge</p>
              <h2 className="text-4xl sm:text-5xl font-black text-white"
                style={{ textShadow: "0 2px 20px rgba(16,185,129,0.25)" }}>
                {cert.recipient_name}
              </h2>
              <p className="text-xs uppercase tracking-widest text-emerald-400/60">adına düzenlenmiştir</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.06] border border-white/[0.1] rounded-2xl p-4 text-center space-y-1">
                <p className="text-xs text-emerald-400/60 uppercase tracking-wider">Ekilen Tohum</p>
                <p className="text-3xl font-black text-white">
                  {cert.tree_count.toLocaleString("tr-TR")}
                </p>
                <p className="text-xs text-emerald-400/50">adet</p>
              </div>
              <div className="bg-white/[0.06] border border-white/[0.1] rounded-2xl p-4 text-center space-y-1">
                <p className="text-xs text-emerald-400/60 uppercase tracking-wider">Arazi</p>
                <p className="text-sm font-bold text-white leading-tight">{cert.forest_name}</p>
                <p className="text-xs text-emerald-400/50">ekim bölgesi</p>
              </div>
            </div>

            {/* CO₂ impact estimate */}
            <div className="bg-emerald-900/40 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">🌍</span>
              <div>
                <p className="text-xs font-semibold text-emerald-300">Tahmini İklim Etkisi</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  Bu ekim, büyüdüğünde yılda yaklaşık{" "}
                  <strong className="text-emerald-300">
                    {((cert.tree_count / 100) * 1.5).toFixed(1)} ton
                  </strong>{" "}
                  CO₂ emecektir.
                </p>
              </div>
            </div>

            {/* Forest illustration */}
            <ForestScene count={Math.min(cert.tree_count, 18)} />

            {/* Footer: date + cert number */}
            <div className="flex items-end justify-between pt-2">
              <div>
                <p className="text-xs text-emerald-400/40 uppercase tracking-wider">Ekim Tarihi</p>
                <p className="text-sm font-semibold text-white/80">{date}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-emerald-400/40 uppercase tracking-wider">Sertifika No</p>
                <p className="font-mono text-sm font-bold text-white/80">{certNo}</p>
              </div>
            </div>

            {/* Bottom seal */}
            <div className="flex justify-center">
              <div className="text-center border border-emerald-500/20 rounded-full px-6 py-2 bg-white/[0.04]">
                <p className="text-xs text-emerald-400/60">Doğrulandı · skytech.green</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Share section ── */}
        <div className="glass border border-white/[0.06] rounded-2xl p-5 space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white text-center">Bu sertifikayı paylaş 🌱</h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 transition-all">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>

            {/* Twitter/X */}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-sky-600/20 border border-sky-500/30 text-sky-400 hover:bg-sky-600/30 transition-all">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              X (Twitter)
            </a>

            {/* LinkedIn */}
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 transition-all">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </a>

            <CopyButton text={shareUrl} />

            <DownloadPdfButton
              certRef={certRef}
              fileName={`Skytech-Sertifika-${certNo}.pdf`}
            />
          </div>
        </div>

        {/* Back to platform */}
        <p className="text-center text-xs text-slate-600">
          <a href="https://skytech.green" className="hover:text-slate-400 transition-colors">
            🌱 skytech.green — Türkiye&apos;nin yeşil geleceği
          </a>
        </p>
      </div>
    </div>
  );
}
