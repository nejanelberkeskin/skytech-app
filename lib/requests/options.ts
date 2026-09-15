/**
 * Talep sayfalarının seçenek verisi — SUNUCU tarafı (service role).
 * Sayfalar ISR (revalidate) ile üretilir; DB erişilemezse sayfa düşmez,
 * bilinen yedek liste kullanılır. Gönderimde API zaten canlı doğrular.
 */
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SEED_TYPES_FALLBACK } from "@/lib/seed-data";

export interface SeedOption {
  slug: string;
  name: string;
  latinName: string;
  description: string;
  image: string | null;
}

export interface LandOption {
  id: string;
  name: string;
  region: string | null;
}

/** Görseli bulunan türler — public/images/tohumlar/{slug}.webp */
const SEED_IMAGES = new Set(["kizilcam", "karacam", "sedir", "ardic"]);

export function seedImage(slug: string): string | null {
  return SEED_IMAGES.has(slug) ? `/images/tohumlar/${slug}.webp` : null;
}

export async function getActiveSeeds(): Promise<SeedOption[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("seed_catalog")
      .select("slug, name, latin_name, description")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error || !data || data.length === 0) throw error ?? new Error("empty");
    return data.map((s) => ({
      slug: s.slug as string,
      name: s.name as string,
      latinName: (s.latin_name as string) ?? "",
      description: (s.description as string) ?? "",
      image: seedImage(s.slug as string),
    }));
  } catch {
    return SEED_TYPES_FALLBACK.map((s) => ({
      slug: s.id,
      name: s.name,
      latinName: s.latinName,
      description: s.description,
      image: seedImage(s.id),
    }));
  }
}

export async function getOpenPublicLands(): Promise<LandOption[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("lands")
      .select("id, name, region")
      .eq("is_public", true)
      .eq("status", "open")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((l) => ({
      id: l.id as string,
      name: l.name as string,
      region: (l.region as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}
