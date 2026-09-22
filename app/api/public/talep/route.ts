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
import { PRICING_VISIBLE, quantityRangeError } from "@/lib/pricing";
import { getSalesSettings } from "@/lib/orders/settings";
import type { ServiceRequest } from "@/lib/types";

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
 *  5. Doğrulama — zod şeması; saha, yayındaki ve katılıma açık sahalarla
 *     sunucuda doğrulanır. Adet alt/üst sınırı lib/pricing.ts'ten gelir.
 *     Tahmini tutar istemciden ALINMAZ; burada yeniden hesaplanır.
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

  // ── Türe özel sunucu doğrulaması (saha varlığı) ──────────────────────────
  let totalSeeds: number | null = null;
  let landId: string | null = null;
  let landName: string | null = null;
  let storedDetails: Record<string, unknown> = {};

  if (details.type === "open_land_seeding") {
    // Talep de siparişle aynı adet sınırlarına ve birim bedele bağlıdır (satış ayarları).
    const settings = await getSalesSettings();
    const range = quantityRangeError(details.quantity, settings);
    if (range) {
      return NextResponse.json(
        { error: "validation", fields: { "details.quantity": range } },
        { status: 400 }
      );
    }
    const { data: land, error } = await supabase
      .from("lands")
      .select("id, name, region, is_public, status, species_slugs")
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
    storedDetails = {
      quantity: details.quantity,
      // null → sertifikaya talep sahibinin adı yazılır (formdaki ipucu böyle söyler).
      certificateName: details.certificateName ?? null,
      landName,
      // Talep anında sahada bırakılan tür(ler) — bilgi amaçlı anlık kopya.
      speciesSlugs: Array.isArray(land.species_slugs) ? land.species_slugs : [],
      // Müşterinin gördüğü birim bedel ve tahmini tutar (kuruş). Bağlayıcı değil.
      ...(PRICING_VISIBLE
        ? { unitPriceKurus: settings.unitPriceKurus, estimatedTotalKurus: details.quantity * settings.unitPriceKurus }
        : {}),
    };
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
    seed_items: [],
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

/** Yalnız site içi yol saklanır ("/talep/acik-arazi?saha=…" → "/talep/acik-arazi"). */
function normalizeSourcePath(v: string | undefined): string | null {
  if (!v) return null;
  const path = v.startsWith("/") && !v.startsWith("//") ? v.split("?")[0].split("#")[0] : null;
  return path ? path.slice(0, 200) : null;
}
