import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Public endpoint — Aktif tohum kataloğunu döner (login gerekmez).
 * Bireysel satın al sayfaları bu endpoint'i kullanır.
 */
export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("seed_catalog")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Catalog fetch error:", error.message);
      return NextResponse.json([], { status: 200 }); // Fallback: boş array → client fallback kullanır
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
