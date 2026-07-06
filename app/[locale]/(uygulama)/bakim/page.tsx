import Link from "next/link";

export default function MaintenancePage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-6">
      {/* Background */}
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
      </div>

      <div className="relative z-10 text-center max-w-md space-y-6 animate-fade-in-up">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <span className="text-5xl">🚧</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Bakım Çalışması</h1>
        <p className="text-emerald-200/40">
          Skytech Green şu anda bakım çalışması nedeniyle geçici olarak hizmet verememektedir.
          Kısa süre içinde tekrar açılacağız.
        </p>
        <div className="liquid-glass rounded-3xl p-5 space-y-2 overflow-hidden relative">
          <div className="relative z-10">
            <p className="text-sm text-emerald-200/40">
              Kurumsal müşterilerimiz panellerine erişmeye devam edebilir.
            </p>
            <Link href="/kurumsal/giris" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors">
              Kurumsal Giriş →
            </Link>
          </div>
        </div>
        <Link href="/" className="text-sm text-emerald-200/25 hover:text-white transition-colors inline-block">
          ← Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
