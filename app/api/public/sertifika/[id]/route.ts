import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Build sırasında env değişkenleri olmayabilir; client'ı lazy oluştur.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env değişkenleri tanımlı değil.");
  }
  return createClient(url, key);
}

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("certificates")
    .select("id, tree_count, forest_name, created_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Sertifika bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ ...data, recipient_name: "Ad paylaşılmıyor" }, {
    headers: {
      // Yayın izni olmayan eski kayıtların kişisel adı çıkmaz.
      "Cache-Control": "private, no-store",
    },
  });
}
