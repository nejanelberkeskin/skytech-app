"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import FAQSchema from "../../seo/FAQSchema";
import SectionWrapper from "../SectionWrapper";
import SectionHeading from "../SectionHeading";

const FAQS = [
  {
    q: "Tohum topu nedir, nasıl çalışır?",
    a: "Tohum topu; kil, organik gübre ve seçilmiş tohumların belirli oranlarda karıştırılıp küçük küre haline getirilmiş halidir. Toprağa düştüğünde dış kabuk koruyucu görev görür, yağmurla birlikte tohum çimlenir. Hayvan ve kuş yemesini engelleyerek çimlenme oranını %65+ seviyesine çıkarır.",
  },
  {
    q: "Tohumlar nereden tedarik ediliyor?",
    a: "Tüm tohumlarımız Türkiye genelindeki İl Orman Müdürlükleri'nin üretim tesislerinden, parti numarası, üretim tarihi ve tür bilgisi kayıtlı şekilde tedarik edilir. Tedarik zinciri uçtan uca şeffaftır ve müşterilerimiz istedikleri an kayıtlara erişebilir.",
  },
  {
    q: "Drone ile ekim ne kadar verimli?",
    a: "Bir drone uçuşunda 200+ tohum dağıtılabilir — geleneksel yöntemlere kıyasla 10 kat hız. GPS hassasiyetli koordinatlarla insan ayağının ulaşamadığı eğimli, yangın sonrası tahribat görmüş alanlara bile erişebiliriz.",
  },
  {
    q: "Ekilen tohumların büyümesini nasıl takip edebilirim?",
    a: "Yıllık periyodik drone uçuşlarıyla bölge yeniden taranır, büyüme verisi kurumsal panonuza işlenir. Bireysel kullanıcılar dijital sertifikalarındaki QR kodla bölge görsellerine erişebilir. Kurumsal partnerler API ile gerçek zamanlı veriye ulaşır.",
  },
  {
    q: "Karbon sertifikası ne için geçerli?",
    a: "Sertifikalar; ESG raporlarında, GRI ve CDP gönderimlerinde, kurumsal sürdürülebilirlik beyanlarında kullanılabilir. Türkiye'de İl Orman Müdürlükleriyle koordineli yasal projeler olarak %100 doğrulanabilir bir izleme zinciri sunarız.",
  },
  {
    q: "Minimum sipariş miktarı var mı?",
    a: "Bireysel kullanıcılar için minimum 10 tohum, kurumsal partnerler için minimum 1.000 tohum başlangıç limiti vardır. 50 tohum ve üzeri bireysel siparişlerde kargo ücretsizdir. Kurumsal projelerde teklif fiyatlandırması yapılır.",
  },
  {
    q: "B2B kurumsal entegrasyon nasıl çalışır?",
    a: "Kurumsal panelimiz; çalışan listesi yükleme, otomatik PDF sertifika üretimi, e-ticaret \"sepete tohum ekle\" entegrasyonu, ESG raporlama API'si gibi modüller içerir. Özel hesap yöneticisi atanır ve kurum ihtiyaçlarına göre özelleştirme yapılır.",
  },
  {
    q: "Hediye olarak gönderebilir miyim?",
    a: "Evet — bireysel sipariş akışında \"hediye et\" seçeneği vardır. Alıcı, dijital sertifikayı e-posta ile alır. Üyelik kazandığında, gönderici otomatik tohum bonusu kazanır (viral büyüme programımız).",
  },
];

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <SectionWrapper variant="light" className="relative overflow-hidden">
      <FAQSchema items={FAQS.map((f) => ({ question: f.q, answer: f.a }))} />
      <div aria-hidden className="absolute inset-0 mesh-gradient opacity-40 pointer-events-none" />

      <div className="relative">
        <SectionHeading
          badge="Sıkça Sorulanlar"
          title={
            <>
              Aklınızdaki
              <br />
              <span className="text-gradient-aurora">Tüm Sorular</span>
            </>
          }
          subtitle="Tohum topundan dronlu ekime, karbon sertifikasından kurumsal entegrasyona — her şey burada."
        />

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
          className="max-w-3xl mx-auto space-y-3"
        >
          {FAQS.map((item, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              <FAQItem
                item={item}
                isOpen={openIdx === idx}
                onToggle={() => setOpenIdx(openIdx === idx ? null : idx)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function FAQItem({
  item,
  isOpen,
  onToggle,
}: {
  item: { q: string; a: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      animate={{
        boxShadow: isOpen
          ? "0 12px 32px rgba(27, 107, 58, 0.10), 0 0 0 1px rgba(34, 137, 74, 0.18)"
          : "0 1px 2px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 lg:p-6 text-left text-base lg:text-[17px] font-bold text-[#0e2519] hover:text-[#1B6B3A] transition-colors tracking-tight"
        aria-expanded={isOpen}
      >
        <span className="pr-4">{item.q}</span>
        <motion.span
          animate={{
            backgroundColor: isOpen ? "#1B6B3A" : "rgba(27, 107, 58, 0.08)",
            color: isOpen ? "#ffffff" : "#1B6B3A",
            rotate: isOpen ? 45 : 0,
          }}
          transition={{ duration: 0.3 }}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          >
            <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
            <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 lg:px-6 pb-5 lg:pb-6 text-sm lg:text-[15px] text-[#3d5a3d] leading-relaxed">
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
