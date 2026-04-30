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
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = getSupabase();

  // 1. Fetch company profile by slug
  const { data: profile, error: profileErr } = await supabase
    .from("company_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Firma bulunamadı." }, { status: 404 });
  }

  // 2. Aggregate paid quotes for this company
  const { data: quotes } = await supabase
    .from("corporate_quotes")
    .select("id, approved_seed_count, approved_price, order_id, paid_at")
    .eq("user_id", profile.id)
    .eq("status", "PAID");

  const totalSeeds = (quotes ?? []).reduce(
    (sum, q) => sum + (q.approved_seed_count ?? 0),
    0
  );
  const totalInvested = (quotes ?? []).reduce(
    (sum, q) => sum + (q.approved_price ?? 0),
    0
  );

  // 3. Collect order_ids from paid quotes (for land/region lookup)
  const orderIds = (quotes ?? [])
    .map((q) => q.order_id)
    .filter(Boolean) as string[];

  // 4. Fetch land regions via order_allocations
  let regions: Record<string, number> = {};
  if (orderIds.length > 0) {
    const { data: allocations } = await supabase
      .from("order_allocations")
      .select("seeds_allocated, lands(region)")
      .in("order_id", orderIds);

    for (const alloc of allocations ?? []) {
      const region =
        (alloc.lands as any)?.region ?? "Bilinmeyen Bölge";
      regions[region] = (regions[region] ?? 0) + (alloc.seeds_allocated ?? 0);
    }
  }

  // 5. Environmental calculations
  const co2Tons = parseFloat(((totalSeeds / 100) * 1.5).toFixed(2));   // ~1.5 tons per 100 seeds
  const o2Tons = parseFloat(((totalSeeds / 100) * 0.5).toFixed(2));    // ~0.5 tons per 100 seeds
  const landHa = parseFloat((totalSeeds * 0.0005).toFixed(2));          // 0.0005 ha per seed

  // 6. Latest planting date
  const latestPaidAt =
    (quotes ?? [])
      .map((q) => q.paid_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;

  return NextResponse.json(
    {
      profile: {
        id: profile.id,
        company_name: profile.company_name,
        slug: profile.slug,
        logo_url: profile.logo_url,
        website_url: profile.website_url,
        sector: profile.sector,
        employee_count: profile.employee_count,
        carbon_goal: profile.carbon_goal,
      },
      stats: {
        total_seeds: totalSeeds,
        total_invested: totalInvested,
        co2_tons: co2Tons,
        o2_tons: o2Tons,
        land_ha: landHa,
        quote_count: (quotes ?? []).length,
        latest_paid_at: latestPaidAt,
      },
      regions, // { "Marmara": 500, "Ege": 300, ... }
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    }
  );
}
