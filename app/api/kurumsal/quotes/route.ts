import { NextResponse } from "next/server";
import { createSupabaseServer, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Kurumsal kullanıcının kendi tekliflerini getiren API.
 * Auth: çerezdeki oturum kimlik sunucusunda doğrulanır (`getUser`); kullanıcı yalnız KENDİ tekliflerini görür.
 * `getSession()` sunucuda belirteci doğrulamaz: sahte çerezle başka kullanıcının kimliği verilebilirdi.
 */
export async function GET() {
  try {
    // ── Auth Guard ──────────────────────────────────────────────────────
    const supabaseAuth = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    // Doğrulanmış kullanıcı kimliği — sorgudaki user_id yok sayılır (IDOR'a karşı)
    const userId = user.id;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("corporate_quotes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
