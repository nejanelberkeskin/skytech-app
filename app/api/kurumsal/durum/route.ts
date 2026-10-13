import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/kurumsal/durum — oturumdaki kullanıcının kurumsal başvuru durumu.
 * { signedIn, status: "none" | "pending" | "approved" | "rejected", companyTitle?, reviewNote? }
 * Kullanıcı yalnız kendi satırını okur (043 RLS); servis anahtarı kullanılmaz.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ signedIn: false, status: "none" });
  const { data, error } = await supabase
    .from("corporate_accounts")
    .select("status, company_title, review_note")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!data) return NextResponse.json({ signedIn: true, status: "none" });
  return NextResponse.json({
    signedIn: true,
    status: data.status,
    companyTitle: data.company_title,
    reviewNote: data.status === "rejected" ? data.review_note : null,
  });
}
