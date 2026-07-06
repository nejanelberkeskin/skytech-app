/**
 * Lokalize SEO anahtar kelimeleri — sayfa yolu × dil.
 *
 * Google meta keywords'ü büyük ölçüde yok sayar ama Yandex (Rusça pazar için
 * kritik) ve bazı AI/GEO crawler'ları hâlâ sinyal olarak okur. Bu yüzden
 * her vitrin sayfası için üç dilde ayrı küme tutuyoruz.
 *
 * Kullanım (generateMetadata içinde):
 *   keywords: seoKeywords("/tohum-topu", locale)
 */

type KeywordMap = Record<string, Record<string, string[]>>;

const KEYWORDS: KeywordMap = {
  "/": {
    tr: [
      "drone ağaçlandırma",
      "tohum topu",
      "karbon nötrleme",
      "ESG",
      "kurumsal ormanlaştırma",
      "kurumsal sürdürülebilirlik",
      "Türkiye ağaçlandırma",
      "ekosistem restorasyonu",
    ],
    en: [
      "drone reforestation",
      "seed balls",
      "carbon neutralization",
      "ESG solutions",
      "corporate afforestation",
      "corporate sustainability",
      "reforestation Türkiye",
      "ecosystem restoration",
    ],
    ru: [
      "лесовосстановление дронами",
      "семенные шары",
      "углеродная нейтрализация",
      "ESG решения",
      "корпоративное лесонасаждение",
      "корпоративная устойчивость",
      "посадка деревьев Турция",
      "восстановление экосистем",
    ],
  },
  "/tohum-topu": {
    tr: [
      "tohum topu",
      "tohum topu nedir",
      "kil tohum topu",
      "ağaçlandırma tohum topu",
      "tohum topu üretimi",
      "yerli tohum",
    ],
    en: [
      "seed ball",
      "what is a seed ball",
      "clay seed ball",
      "seed balls for reforestation",
      "seed ball production",
      "native seeds",
    ],
    ru: [
      "семенной шар",
      "что такое семенной шар",
      "глиняный семенной шар",
      "семенные шары для лесовосстановления",
      "производство семенных шаров",
      "местные семена",
    ],
  },
  "/tohumlarimiz": {
    tr: [
      "yerli ağaç türleri",
      "kızılçam tohumu",
      "karaçam tohumu",
      "sedir tohumu",
      "ardıç tohumu",
      "Türkiye ormancılık",
      "endemik türler",
    ],
    en: [
      "native tree species Türkiye",
      "Pinus brutia seeds",
      "Pinus nigra seeds",
      "Cedrus libani seeds",
      "Juniperus seeds",
      "Turkish forestry",
      "endemic species",
    ],
    ru: [
      "местные виды деревьев Турции",
      "семена сосны калабрийской",
      "семена сосны чёрной",
      "семена ливанского кедра",
      "семена можжевельника",
      "лесное хозяйство Турции",
      "эндемичные виды",
    ],
  },
  "/dron-teknolojisi": {
    tr: [
      "drone ağaçlandırma",
      "dron ile tohum ekimi",
      "RTK GPS tarım drone",
      "tarımsal drone Türkiye",
      "otonom uçuş ağaçlandırma",
    ],
    en: [
      "drone reforestation technology",
      "drone seeding",
      "RTK GPS agricultural drone",
      "autonomous drone planting",
      "precision reforestation",
    ],
    ru: [
      "дроны для лесовосстановления",
      "посев семян дроном",
      "аграрный дрон RTK GPS",
      "автономная посадка дронами",
      "точное лесовосстановление",
    ],
  },
  "/karbon-programi": {
    tr: [
      "karbon nötrleme programı",
      "kurumsal karbon ayak izi",
      "karbon sertifikası",
      "ESG raporlama",
      "karbon dengeleme Türkiye",
    ],
    en: [
      "carbon neutralization program",
      "corporate carbon footprint",
      "carbon certificate",
      "ESG reporting",
      "carbon offset Türkiye",
    ],
    ru: [
      "программа углеродной нейтрализации",
      "корпоративный углеродный след",
      "углеродный сертификат",
      "ESG отчётность",
      "компенсация выбросов Турция",
    ],
  },
  "/projeler": {
    tr: [
      "ağaçlandırma projeleri Türkiye",
      "pilot ağaçlandırma",
      "drone ekim projeleri",
      "Çanakkale İzmir Bursa ağaçlandırma",
      "Orman Genel Müdürlüğü ağaçlandırma",
    ],
    en: [
      "reforestation projects Türkiye",
      "pilot reforestation sites",
      "drone planting projects",
      "Çanakkale İzmir Bursa reforestation",
      "General Directorate of Forestry projects",
    ],
    ru: [
      "проекты лесовосстановления Турция",
      "пилотные участки лесовосстановления",
      "проекты посадки дронами",
      "лесовосстановление Чанаккале Измир Бурса",
      "проекты лесного хозяйства Турции",
    ],
  },
  "/kurumsal-cozumler": {
    tr: [
      "kurumsal ağaçlandırma",
      "kurumsal ormanlaştırma",
      "ESG çözümleri",
      "çalışan karbon sertifikası",
      "kurumsal sürdürülebilirlik partneri",
      "B2B karbon nötrleme",
      "API tohum entegrasyonu",
    ],
    en: [
      "corporate tree planting",
      "corporate afforestation",
      "ESG solutions",
      "employee carbon certificate",
      "corporate sustainability partner",
      "B2B carbon neutralization",
      "tree planting API integration",
    ],
    ru: [
      "корпоративная посадка деревьев",
      "корпоративное лесонасаждение",
      "ESG решения",
      "углеродный сертификат для сотрудников",
      "партнёр по корпоративной устойчивости",
      "B2B углеродная нейтрализация",
      "API интеграция посадки деревьев",
    ],
  },
  "/hakkimizda": {
    tr: [
      "Skytech Green hakkında",
      "ekibimiz",
      "vizyon misyon",
      "ağaçlandırma şirketi Türkiye",
      "Eco-Tech",
    ],
    en: [
      "about Skytech Green",
      "our team",
      "vision mission",
      "reforestation company Türkiye",
      "Eco-Tech",
    ],
    ru: [
      "о Skytech Green",
      "наша команда",
      "видение миссия",
      "компания по лесовосстановлению Турция",
      "Eco-Tech",
    ],
  },
  "/iletisim": {
    tr: ["Skytech Green iletişim", "Ankara ofis", "Kahramankazan", "ağaçlandırma firması iletişim"],
    en: ["Skytech Green contact", "Ankara office", "Kahramankazan", "reforestation company contact"],
    ru: ["Skytech Green контакты", "офис Анкара", "Кахраманказан", "контакты компании по лесовосстановлению"],
  },
  "/bilgi-al": {
    tr: ["bilgi al", "ağaçlandırma bilgi formu", "kurumsal teklif", "tohum topu bilgi"],
    en: ["get information", "reforestation inquiry form", "corporate quote", "seed ball information"],
    ru: ["получить информацию", "форма запроса лесовосстановления", "корпоративное предложение", "информация о семенных шарах"],
  },
};

/** Sayfa + dil için keyword listesi; yoksa TR'ye, o da yoksa boşa düşer. */
export function seoKeywords(path: string, locale: string): string[] {
  const page = KEYWORDS[path];
  if (!page) return [];
  return page[locale] ?? page.tr ?? [];
}
