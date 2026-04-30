/**
 * TR sözlüğü — vitrin metinleri.
 * Refactor'da: bileşenlerdeki hardcode metinleri buradaki anahtarlara taşıyabiliriz.
 * Şu anki sürüm: yapı + ana navigasyon + footer + temel CTA + paylaşılan kelimeler.
 */
const tr = {
  meta: {
    siteName: "Skytech Green",
    siteTagline: "Tohum Toplarıyla Geleceği Ekin",
  },
  nav: {
    home: "Ana Sayfa",
    services: "Hizmetler",
    seedBall: "Tohum Topu",
    droneTech: "Dron Teknolojisi",
    carbonProgram: "Karbon Programı",
    projects: "Projeler",
    corporate: "Kurumsal",
    about: "Hakkımızda",
    contact: "İletişim",
  },
  cta: {
    orderSeed: "Tohum Sipariş Et",
    corporateSolutions: "Kurumsal Çözümler",
    login: "Giriş Yap",
    requestQuote: "Teklif Al",
    contactUs: "Bize Ulaşın",
    discover: "Keşfet",
    learnMore: "Daha Fazla",
  },
  badges: {
    carbonNeutral: "Karbon Nötrleme · Şeffaf · Ölçülebilir",
    coordinated: "İl Orman Müdürlükleri ile koordineli",
    annualReporting: "Yıllık drone raporlama",
    carbonCertificate: "Karbon sertifikası",
    comingSoon: "Yakında",
  },
  hero: {
    line1: "Tohum Toplarıyla",
    line2: "Geleceği Ekin",
    description:
      "Yangın sonrası alanlardan erozyon bölgelerine — dron teknolojisiyle hızlı, ölçülebilir ve şeffaf ağaçlandırma.",
  },
  footer: {
    services: "Hizmetler",
    quickLinks: "Hızlı Linkler",
    newsletter: "Bültenimize Katılın",
    newsletterDesc: "Yeni projeler ve karbon nötrleme haberleri için.",
    subscribe: "Abone Ol",
    rights: "Tüm hakları saklıdır.",
    company: "Skytech Green Teknoloji A.Ş.",
    legal: {
      privacy: "Gizlilik Politikası",
      terms: "Kullanım Koşulları",
      kvkk: "KVKK",
      cookies: "Çerez Politikası",
    },
  },
  status: {
    active: "Aktif",
    pilot: "Pilot",
    completed: "Tamamlandı",
  },
  developer: {
    badge: "Geliştiriciler & API",
    title: "1 Satır Tohum Eklentisi",
    earlyAccess: "Erken erişim listesine katıl",
  },
} as const;

export default tr;
export type Dictionary = typeof tr;
