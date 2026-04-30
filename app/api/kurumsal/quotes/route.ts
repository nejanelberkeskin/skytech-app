import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Kurumsal kullanıcının kendi tekliflerini getiren API.
 * Auth: Cookie-based session — user can only see their OWN quotes.
 */
export async function GET(request: NextRequest) {
  try {
    // ── Auth Guard ──────────────────────────────────────────────────────
    const supabaseAuth = await createSupabaseServer();
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    // Use session user ID — ignore any user_id query param to prevent IDOR
    const userId = session.user.id;

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
