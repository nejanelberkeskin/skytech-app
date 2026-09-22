/**
 * Tür (tohum) kataloğunun istemciye dönük biçimi ve veritabanına ulaşılamazsa kullanılan yedek liste.
 * Proje Uygulama Sahaları sayfası tür adlarını buradan tamamlar (`lib/sites/data.ts`).
 * Eski bireysel tohum satışının sepet, fiyat/katalog ve bölge önerisi kodları Faz 8'de kaldırıldı.
 */

// ── SeedType: Client-facing interface (backward compatible) ──────────────────
export interface SeedType {
  id: string;       // slug from DB
  name: string;
  latinName: string;
  price: number;
  maxQty: number;
  emoji: string;
  color: string;
  description: string;
}

// ── Hardcoded fallback (DB erişilemezse) ─────────────────────────────────────
export const SEED_TYPES_FALLBACK: SeedType[] = [
  {
    id: "kizilcam",
    name: "Kızılçam",
    latinName: "Pinus brutia",
    price: 12,
    maxQty: 500,
    emoji: "🌲",
    color: "from-green-600 to-green-800",
    description: "Akdeniz iklimine dayanıklı, hızlı büyüyen çam türü.",
  },
  {
    id: "karacam",
    name: "Karaçam",
    latinName: "Pinus nigra",
    price: 14,
    maxQty: 500,
    emoji: "🌲",
    color: "from-slate-600 to-emerald-900",
    description: "Anadolu'nun yüksek kesimlerine dayanıklı, kuraklığa ve soğuğa toleranslı yerli çam türü.",
  },
  {
    id: "sedir",
    name: "Sedir (Toros Sediri)",
    latinName: "Cedrus libani",
    price: 25,
    maxQty: 500,
    emoji: "🏔️",
    color: "from-emerald-700 to-teal-800",
    description: "Anadolu'nun simgesi, yüzyıllarca yaşayan asil ağaç.",
  },
  {
    id: "ardic",
    name: "Ardıç",
    latinName: "Juniperus",
    price: 16,
    maxQty: 500,
    emoji: "🌿",
    color: "from-emerald-600 to-emerald-800",
    description: "Anadolu'nun sarp ve kurak yamaçlarına uyum sağlayan dayanıklı tür. Erozyon kontrolünde kritik rol oynar.",
  },
];
