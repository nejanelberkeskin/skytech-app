/**
 * GET /api/embed/rozet/[company-slug]
 *
 * Returns a standalone HTML page for embedding as an iframe widget.
 * 320×130px Carbon Neutral badge — transparent background, no layout deps.
 * Revalidation: max-age=1800 (30 min via CDN)
 */

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

// Bu route'un build sırasında değil, isteğe gelince çalışmasını garantile.
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ "company-slug": string }> }
) {
  const { "company-slug": slug } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skytechgreen.com";

  const supabase = getSupabase();

  // Fetch company profile
  const { data: profile } = await supabase
    .from("company_profiles")
    .select("id, company_name, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!profile) {
    return new NextResponse(notFoundHtml(), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Aggregate seeds from PAID quotes
  const { data: quotes } = await supabase
    .from("corporate_quotes")
    .select("approved_seed_count")
    .eq("user_id", profile.id)
    .eq("status", "PAID");

  const totalSeeds = (quotes ?? []).reduce(
    (sum, q) => sum + (q.approved_seed_count ?? 0),
    0
  );
  const co2Tons = ((totalSeeds / 100) * 1.5).toFixed(1);
  const seedsFormatted = totalSeeds.toLocaleString("tr-TR");
  const forestUrl = `${appUrl}/orman/${slug}`;

  const html = badgeHtml({
    companyName: profile.company_name,
    seedsFormatted,
    co2Tons,
    forestUrl,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
    },
  });
}

// ── HTML templates ────────────────────────────────────────────────────────────

function notFoundHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}body{width:320px;height:130px;background:transparent;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif}</style></head><body><p style="color:#94a3b8;font-size:12px">Firma bulunamadı</p></body></html>`;
}

interface BadgeData {
  companyName: string;
  seedsFormatted: string;
  co2Tons: string;
  forestUrl: string;
}

function badgeHtml(d: BadgeData): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=320">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: 320px;
      height: 130px;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }

    a.badge {
      display: flex;
      width: 320px;
      height: 130px;
      align-items: center;
      padding: 0 20px;
      gap: 16px;
      background: linear-gradient(135deg, #052e16 0%, #064e3b 50%, #065f46 100%);
      border-radius: 16px;
      border: 1px solid rgba(52,211,153,0.25);
      box-shadow:
        0 0 0 1px rgba(16,185,129,0.10),
        0 4px 24px rgba(0,0,0,0.40),
        inset 0 1px 0 rgba(255,255,255,0.04);
      text-decoration: none;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: box-shadow 0.2s;
    }
    a.badge:hover {
      box-shadow:
        0 0 0 1px rgba(52,211,153,0.35),
        0 8px 32px rgba(0,0,0,0.5),
        0 0 40px rgba(16,185,129,0.12),
        inset 0 1px 0 rgba(255,255,255,0.06);
    }
    a.badge::before {
      content: '';
      position: absolute;
      top: -40px; right: -40px;
      width: 140px; height: 140px;
      background: radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    .icon {
      width: 52px; height: 52px;
      background: rgba(16,185,129,0.15);
      border: 1px solid rgba(52,211,153,0.30);
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
      flex-shrink: 0;
      box-shadow: 0 0 20px rgba(16,185,129,0.20);
    }

    .content { flex: 1; min-width: 0; }

    .badge-label {
      font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: rgba(52,211,153,0.70);
      margin-bottom: 3px;
    }

    .name {
      font-size: 14px; font-weight: 800;
      color: #ffffff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      line-height: 1.2;
    }

    .stats {
      display: flex; align-items: center;
      gap: 12px; margin-top: 6px;
    }

    .stat { display: flex; flex-direction: column; gap: 1px; }

    .stat-val {
      font-size: 16px; font-weight: 900;
      color: rgba(52,211,153,0.95);
      line-height: 1; font-variant-numeric: tabular-nums;
    }

    .stat-lbl {
      font-size: 9px;
      color: rgba(148,163,184,0.70);
      white-space: nowrap;
    }

    .divider {
      width: 1px; height: 28px;
      background: rgba(52,211,153,0.12);
      flex-shrink: 0;
    }

    .verified {
      position: absolute; top: 10px; right: 12px;
      display: flex; align-items: center; gap: 4px;
    }
    .dot {
      width: 6px; height: 6px;
      background: #10b981; border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
      box-shadow: 0 0 6px rgba(16,185,129,0.60);
    }
    .vtext { font-size: 8px; font-weight: 600; color: rgba(52,211,153,0.60); }

    .powered {
      position: absolute; bottom: 8px; right: 12px;
      font-size: 8px; color: rgba(100,116,139,0.50); font-weight: 500;
    }

    @keyframes pulse {
      0%,100% { opacity:0.6; transform:scale(1); }
      50%      { opacity:1;   transform:scale(1.3); }
    }
  </style>
</head>
<body>
  <a href="${d.forestUrl}" target="_blank" rel="noreferrer" class="badge">
    <div class="verified">
      <div class="dot"></div>
      <span class="vtext">Doğrulandı</span>
    </div>

    <div class="icon">🌱</div>

    <div class="content">
      <div class="badge-label">Carbon Neutral Partner</div>
      <div class="name">${escapeHtml(d.companyName)}</div>
      <div class="stats">
        <div class="stat">
          <span class="stat-val">${escapeHtml(d.seedsFormatted)}</span>
          <span class="stat-lbl">Tohum Ekildi</span>
        </div>
        <div class="divider"></div>
        <div class="stat">
          <span class="stat-val">${escapeHtml(d.co2Tons)}</span>
          <span class="stat-lbl">Ton CO₂/Yıl</span>
        </div>
      </div>
    </div>

    <div class="powered">Skytech Green</div>
  </a>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
