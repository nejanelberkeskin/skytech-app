import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServiceRoleClient, createSupabaseServer } from "@/lib/supabase/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { sendServiceRequestConfirmation, sendServiceRequestNotification } from "@/lib/mail";
import { ACCOUNTS_ENABLED, REQUESTS_ENABLED } from "@/lib/site-config";
import {
  CONSENT_VERSION,
  MIN_FILL_MS,
  issuesToFieldErrors,
  requestPayloadSchema,
  type RequestPayload,
} from "@/lib/requests/schema";
import { generateRequestNo, hashIp, sanitizeUserAgent } from "@/lib/requests/server";
import type { ServiceRequest, ServiceRequestSeedItem } from "@/lib/types";

/**
 * POST /api/public/talep — ödeme almadan talep oluşturur (kimlik gerekmez).
 *
 * Gövde: { contact, details, website?, elapsedMs?, sourcePath?, clientToken? }
 *        (şema: lib/requests/schema.ts — istemciyle ortak)
 * Yanıt: 201 { ok, requestNo, requestId } · 400 { error:"validation", fields }
 *        · 413 · 429 · 503
 *
 * Güvenlik katmanları:
 *  1. CSRF — middleware /api/* POST için Origin === site origin şartı koyar.
 *  2. Boyut — gövde 20 KB üstüyse 413 (JSON.parse'tan önce).
 *  3. Rate limit — bellek içi (instance başına) + DB (ip_hash, son 1 saat).
 *  4. Bot sinyalleri — honeypot doluysa DB'ye yazılmadan "ok" döner (bota
 *     fark ettirmeden); form MIN_FILL_MS'den hızlı doldurulmuşsa kayıt
 *     status='spam' ile yazılır, e-posta gitmez (kayıp olmaz, admin görür).
 *  5. Doğrulama — zod şeması; tohum slug'ları aktif katalogla, arazi
 *     açık/public sahalarla sunucuda doğrulanır. Adetler sınırlı.
 *  6. Idempotency — clientToken tekrar gelirse mevcut kayıt döner, çift
 *     kayıt ve çift e-posta oluşmaz.
 *  7. Kimlik — user_id yalnız oturum çerezinden; gövdeden asla alınmaz.
 *  8. Gizlilik — IP ham saklanmaz (tuzlu hash), PII loglanmaz, yanıt yalnız
 *     talep numarası/kimliği döner.
 *  9. Dayanıklılık — e-postalar `after()` ile yanıt sonrasında gönderilir;
 *     mail hatası talebi düşürmez.
 */

const MAX_BODY_BYTES = 20_000;
const IP_DB_LIMIT_PER_HOUR = 10;

export async function POST(req: NextRequest) {
  if (!REQUESTS_ENABLED) {
    return NextResponse.json({ error: "closed" }, { status: 503 });
  }

  const ip = getClientIP(req);
  const limited = rateLimit(`talep:${ip}`, 6, 10 * 60_000);
  if (limited) return limited;

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // ── Honeypot: sessizce "başarılı" dön, hiçbir şey yazma ─────────────────
  const probe = raw as { website?: unknown; elapsedMs?: unknown } | null;
  if (typeof probe?.website === "string" && probe.website.trim().length > 0) {
    return NextResponse.json(
      { ok: true, requestNo: generateRequestNo(), requestId: crypto.randomUUID() },
      { status: 201 }
    );
  }
  const tooFast =
    typeof probe?.elapsedMs === "number" && probe.elapsedMs >= 0 && probe.elapsedMs < MIN_FILL_MS;

  // ── Şema doğrulaması ─────────────────────────────────────────────────────
  const parsed = requestPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", fields: issuesToFieldErrors(parsed.error.issues) },
      { status: 400 }
    );
  }
  const payload: RequestPayload = parsed.data;
  const { contact, details } = payload;

  const supabase = createServiceRoleClient();

  // ── Idempotency: aynı token daha önce kaydedildiyse onu döndür ───────────
  if (payload.clientToken) {
    const { data: existing } = await supabase
      .from("service_requests")
      .select("id, request_no")
      .eq("client_token", payload.clientToken)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { ok: true, requestNo: existing.request_no, requestId: existing.id },
        { status: 201 }
      );
    }
  }

  // ── Türe özel sunucu doğrulaması (katalog / saha varlığı) ────────────────
  let seedItems: ServiceRequestSeedItem[] = [];
  let totalSeeds: number | null = null;
  let landId: string | null = null;
  let landName: string | null = null;
  let storedDetails: Record<string, unknown> = {};

  if (details.type === "seed_purchase") {
    const { data: catalog, error } = await supabase
      .from("seed_catalog")
      .select("slug, name")
      .eq("is_active", true);
    if (error) return dbError("catalog");
    const bySlug = new Map((catalog ?? []).map((c) => [c.slug as string, c.name as string]));
    if (details.seedItems.some((i) => !bySlug.has(i.slug))) {
      return NextResponse.json(
        { error: "validation", fields: { "details.seedItems": "seedInvalid" } },
        { status: 400 }
      );
    }
    seedItems = details.seedItems.map((i) => ({ slug: i.slug, name: bySlug.get(i.slug)!, quantity: i.quantity }));
    totalSeeds = seedItems.reduce((s, i) => s + i.quantity, 0);
    storedDetails = {
      deliveryProvince: details.deliveryProvince,
      deliveryDistrict: details.deliveryDistrict ?? null,
      purpose: details.purpose ?? null,
    };
  } else if (details.type === "open_land_seeding") {
    const { data: land, error } = await supabase
      .from("lands")
      .select("id, name, region, is_public, status")
      .eq("id", details.landId)
      .maybeSingle();
    if (error) return dbError("land");
    if (!land || !land.is_public || land.status !== "open") {
      return NextResponse.json(
        { error: "validation", fields: { "details.landId": "landInvalid" } },
        { status: 400 }
      );
    }
    landId = land.id as string;
    landName = land.region ? `${land.name} (${land.region})` : (land.name as string);
    totalSeeds = details.quantity;
    storedDetails = { quantity: details.quantity, dedication: details.dedication ?? null, landName };
  } else {
    storedDetails = {
      province: details.province,
      district: details.district ?? null,
      areaValue: details.areaValue,
      areaUnit: details.areaUnit,
      conditions: details.conditions,
      ownership: details.ownership,
      timing: details.timing,
      mapLink: details.mapLink ?? null,
      accessNotes: details.accessNotes ?? null,
    };
  }

  // ── Oturum (varsa) — user_id yalnız çerezden ─────────────────────────────
  let userId: string | null = null;
  try {
    const auth = await createSupabaseServer();
    const { data: { user } } = await auth.auth.getUser();
    if (user) userId = user.id;
  } catch {
    // oturum okunamadı → misafir
  }

  // ── DB tabanlı IP limiti (instance'lar arası tutarlı) ────────────────────
  const ipHash = hashIp(ip);
  if (ipHash) {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count, error } = await supabase
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if (!error && (count ?? 0) >= IP_DB_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }
  }

  // ── Kayıt (talep no çakışırsa yeniden dene) ──────────────────────────────
  const row = {
    client_token: payload.clientToken ?? null,
    type: details.type,
    status: tooFast ? "spam" : "new",
    user_id: userId,
    contact_name: contact.contactName,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    company: contact.company ?? null,
    locale: contact.locale,
    land_id: landId,
    total_seeds: totalSeeds,
    seed_items: seedItems,
    details: storedDetails,
    message: contact.message ?? null,
    consent_at: new Date().toISOString(),
    consent_version: CONSENT_VERSION,
    ip_hash: ipHash,
    user_agent: sanitizeUserAgent(req.headers.get("user-agent")),
    source_path: normalizeSourcePath(payload.sourcePath),
  };

  let saved: ServiceRequest | null = null;
  for (let attempt = 0; attempt < 5 && !saved; attempt++) {
    const { data, error } = await supabase
      .from("service_requests")
      .insert({ ...row, request_no: generateRequestNo() })
      .select("*")
      .single();

    if (!error && data) {
      saved = data as ServiceRequest;
      break;
    }
    if (error?.code === "23505") {
      // Aynı token eşzamanlı ikinci kez geldiyse mevcut kaydı döndür
      if (payload.clientToken && /client_token/.test(error.message ?? "")) {
        const { data: existing } = await supabase
          .from("service_requests")
          .select("id, request_no")
          .eq("client_token", payload.clientToken)
          .maybeSingle();
        if (existing) {
          return NextResponse.json(
            { ok: true, requestNo: existing.request_no, requestId: existing.id },
            { status: 201 }
          );
        }
      }
      continue; // request_no çakıştı → yeni numarayla tekrar
    }
    console.error("[talep] kayıt hatası:", error?.code);
    return dbError("insert");
  }
  if (!saved) return dbError("insert");

  // ── E-postalar — yanıt gönderildikten sonra; spam işaretli kayda gitmez ──
  if (saved.status !== "spam") {
    const request = saved;
    after(async () => {
      const results = await Promise.allSettled([
        sendServiceRequestNotification({ request, landName }),
        sendServiceRequestConfirmation({ request, landName, accountLink: ACCOUNTS_ENABLED && !request.user_id }),
      ]);
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(`[talep] ${i === 0 ? "bildirim" : "onay"} e-postası gönderilemedi (${request.request_no})`);
        }
      });
    });
  }

  return NextResponse.json(
    { ok: true, requestNo: saved.request_no, requestId: saved.id },
    { status: 201 }
  );
}

function dbError(stage: string) {
  console.error(`[talep] veritabanı hatası (${stage})`);
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}

/** Yalnız site içi yol saklanır ("/talep/tohum?utm=…" → "/talep/tohum"). */
function normalizeSourcePath(v: string | undefined): string | null {
  if (!v) return null;
  const path = v.startsWith("/") && !v.startsWith("//") ? v.split("?")[0].split("#")[0] : null;
  return path ? path.slice(0, 200) : null;
}
