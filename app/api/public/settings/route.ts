import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Public endpoint — Sistem ayarlarını döner (login gerekmez).
 * Cart timer, maintenance mode vs. client tarafında kullanılır.
 * Hassas olmayan ayarları filtreler.
 */
export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("reservation_ttl_minutes, maintenance_mode, overflow_tolerance_pct")
      .limit(1)
      .single();

    if (error) {
      // Fallback defaults
      return NextResponse.json({
        reservation_ttl_minutes: 5,
        maintenance_mode: false,
        overflow_tolerance_pct: 10,
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      reservation_ttl_minutes: 5,
      maintenance_mode: false,
      overflow_tolerance_pct: 10,
    });
  }
}
