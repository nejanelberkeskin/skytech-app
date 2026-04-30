"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function SatinAlPage() {
  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="nature-bg">
        <div className="nature-orb nature-orb-1" />
        <div className="nature-orb nature-orb-2" />
        <div className="nature-orb nature-orb-3" />
      </div>

      <Navbar />

      {/* Hero */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-32 pb-12 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 animate-fade-in leading-tight">
          Nasıl katkıda bulunmak
          <br />
          <span className="text-gradient-eco">istersiniz?</span>
        </h2>
        <p className="text-emerald-100/40 max-w-xl mx-auto animate-fade-in-up">
          Tohumlarınızı adresinize kargo ile alabilir veya Skytech arazilerine
          drone ile ekilmesini sağlayabilirsiniz.
        </p>
      </div>

      {/* 2 Option Cards */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
        {/* Kart 1: Fiziksel kargo */}
        <Link href="/bireysel/satin-al/siparis" className="group block">
          <div className="liquid-glass relative rounded-3xl p-10 overflow-hidden liquid-glass-hover h-full flex flex-col items-center text-center">
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-5xl mb-6 group-hover:scale-110 group-hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] transition-all duration-500">
                📦
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Tohum Sipariş Verin</h3>
              <p className="text-emerald-100/40 mb-8 leading-relaxed">
                Adresinize gelsin, kendiniz ekin. İstediğiniz türden tohum seçin,
                kapınıza kadar gelsin.
              </p>
              <span className="mt-auto glass-btn px-6 py-3 rounded-2xl text-sm font-medium text-white">
                Tohum Seçin →
              </span>
            </div>
          </div>
        </Link>

        {/* Kart 2: Arazi rezervasyon */}
        <Link href="/bireysel/satin-al/arazi" className="group block">
          <div className="liquid-glass relative rounded-3xl p-10 overflow-hidden liquid-glass-hover h-full flex flex-col items-center text-center">
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-teal-500/10 border border-teal-500/15 flex items-center justify-center text-5xl mb-6 group-hover:scale-110 group-hover:shadow-[0_0_40px_rgba(20,184,166,0.15)] transition-all duration-500">
                🚁
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Sizin Yerinize Ekelim</h3>
              <p className="text-emerald-100/40 mb-8 leading-relaxed">
                Skytech arazilerine drone ile ekilsin. Arazi seçin, tohum adedini
                belirleyin, gerisini bize bırakın.
              </p>
              <span className="mt-auto px-6 py-3 rounded-2xl text-sm font-medium text-white bg-teal-500/15 border border-teal-500/20 hover:bg-teal-500/25 transition-all">
                Arazi Seçin →
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
