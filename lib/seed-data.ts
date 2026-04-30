import type { SeedProduct } from "./types";

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

// ── DB → SeedType converter ─────────────────────────────────────────────────
export function dbProductToSeedType(p: SeedProduct): SeedType {
  return {
    id: p.slug,
    name: p.name,
    latinName: p.latin_name,
    price: Number(p.price),
    maxQty: p.max_order_qty,
    emoji: p.emoji,
    color: p.color,
    description: p.description,
  };
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
    id: "mese",
    name: "Meşe",
    latinName: "Quercus robur",
    price: 18,
    maxQty: 500,
    emoji: "🌳",
    color: "from-amber-600 to-amber-800",
    description: "Uzun ömürlü, güçlü kök yapısıyla toprağı koruyan yaprak ağacı.",
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
    id: "kayin",
    name: "Kayın",
    latinName: "Fagus orientalis",
    price: 15,
    maxQty: 500,
    emoji: "🍂",
    color: "from-orange-500 to-red-700",
    description: "Karadeniz ormanlarının vazgeçilmezi, gölge seven tür.",
  },
];

// Backward compatible export — KULLANIMI:
// Sayfalarda artık `useSeedCatalog()` hook'u kullanılmalı.
// Bu export sadece sync gerektiren yerlerde fallback olarak kullanılır.
export const SEED_TYPES = SEED_TYPES_FALLBACK;

// ── Fetch active catalog from API ───────────────────────────────────────────
export async function fetchSeedCatalog(): Promise<SeedType[]> {
  try {
    const res = await fetch("/api/public/catalog");
    if (!res.ok) return SEED_TYPES_FALLBACK;
    const products: SeedProduct[] = await res.json();
    if (!Array.isArray(products) || products.length === 0) return SEED_TYPES_FALLBACK;
    return products.map(dbProductToSeedType);
  } catch {
    return SEED_TYPES_FALLBACK;
  }
}

// ── Fetch system settings from API ──────────────────────────────────────────
export interface AppSettings {
  reservationTtlMinutes: number;
  maintenanceMode: boolean;
  overflowTolerancePct: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  reservationTtlMinutes: 5,
  maintenanceMode: false,
  overflowTolerancePct: 10,
};

export async function fetchSystemSettings(): Promise<AppSettings> {
  try {
    const res = await fetch("/api/public/settings");
    if (!res.ok) return DEFAULT_SETTINGS;
    const data = await res.json();
    return {
      reservationTtlMinutes: data.reservation_ttl_minutes ?? 5,
      maintenanceMode: data.maintenance_mode ?? false,
      overflowTolerancePct: data.overflow_tolerance_pct ?? 10,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ── Cart Item ────────────────────────────────────────────────────────────────
export interface CartItem {
  type: "seed" | "reservation";
  seedType?: SeedType;
  pricePerSeed?: number;
  quantity: number;
  landId?: string;
  landName?: string;
  totalPrice: number;
  addedAt: number;
}

// ── Region → Seed recommendation ────────────────────────────────────────────
export interface SeedRecommendation {
  seedId: string;
  reason: string;
}

export const REGION_SEED_MAP: Record<string, SeedRecommendation> = {
  "Bolu":    { seedId: "kayin",    reason: "Bolu'nun nemli orman iklimi kayın için idealdir; doğal yayılım alanı içindedir." },
  "Antalya": { seedId: "kizilcam", reason: "Akdeniz kıyı şeridi kızılçamın doğal yayılım alanıdır, kurak yaza dayanır." },
  "Mersin":  { seedId: "kizilcam", reason: "Akdeniz iklimi ve kalkerli topraklar kızılçama uygundur." },
  "Kastamonu": { seedId: "kayin",  reason: "Karadeniz nemli ormanlarında kayın baskın türdür." },
  "Trabzon": { seedId: "kayin",    reason: "Yüksek yağışlı Karadeniz kuşağı kayın ormanları için idealdir." },
  "Konya":   { seedId: "mese",     reason: "İç Anadolu step geçiş zonu, kurak dayanımlı meşe için uygundur." },
  "Ankara":  { seedId: "mese",     reason: "Karasal iklim ve derin topraklar meşe yetiştiriciliğine elverişlidir." },
  "Isparta": { seedId: "sedir",    reason: "Toros Sediri'nin ana yetişme alanı; yüksek rakım ve kireçli topraklar idealdir." },
  "Kahramanmaraş": { seedId: "sedir", reason: "Torosların iç kesimlerinde sedir doğal olarak yayılır." },
};

/**
 * Bölgeye göre tohum önerisi.
 * `seedTypes` parametresi ile DB'den gelen dinamik katalog verilebilir.
 * Verilmezse fallback kullanır.
 */
export function getRecommendedSeed(
  region: string | null,
  seedTypes?: SeedType[]
): { seed: SeedType; reason: string } {
  const catalog = seedTypes && seedTypes.length > 0 ? seedTypes : SEED_TYPES_FALLBACK;
  const fallback = { seed: catalog[0], reason: "Bu bölge için kızılçam dayanıklılığı ve adaptasyon kolaylığı nedeniyle önerilmektedir." };
  if (!region) return fallback;

  const rec = REGION_SEED_MAP[region];
  if (!rec) return fallback;

  const seed = catalog.find((s) => s.id === rec.seedId);
  if (!seed) return fallback;

  return { seed, reason: rec.reason };
}
