import { NextRequest, NextResponse } from "next/server";
import { SKIPPED_ID, sendContactFormNotification } from "@/lib/mail";

/**
 * Public Bilgi-Al formu — Kimlik doğrulama gerektirmez.
 *
 * POST /api/public/bilgi-al
 * Body: { name, email, phone?, company?, subject, message, website? }
 *
 * Güvenlik:
 *  - Zorunlu alanlar + e-posta format doğrulaması sunucu tarafında tekrarlanır
 *  - `website` alanı honeypot — botlar doldurur, gerçek kullanıcılar görmez.
 *    Doluysa mail GÖNDERİLMEZ ama client'a normal başarı yanıtı dönülür
 *    (bot'a yakalandığını belli etmemek için).
 *  - CSRF: middleware zaten /api/public/* için Origin header kontrolü yapıyor.
 */

import { getClientIP } from "@/lib/admin-auth";
import { hashIp } from "@/lib/requests/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).length > 24_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const company = typeof body.company === "string" ? body.company.trim() : undefined;
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const honeypot = typeof body.website === "string" ? body.website.trim() : "";

  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { error: "Ad, e-posta, konu ve mesaj alanları zorunludur." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  }
  if (name.length > 200 || email.length > 254 || (phone?.length ?? 0) > 40 || (company?.length ?? 0) > 200 || subject.length > 200 || message.length > 5000) {
    return NextResponse.json({ error: "Girilen metin çok uzun." }, { status: 400 });
  }

  // Honeypot dolu → bot. Sessizce "başarılı" dön, mail gönderme.
  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  if (body.noticeRead !== true) return NextResponse.json({ error: "notice_required" }, { status: 400 });
  try {
    const ipKey = hashIp(getClientIP(req)) ?? "unknown";
    const quota = await createServiceRoleClient().rpc("consume_contact_quota", { p_key: ipKey });
    if (quota.error || typeof quota.data !== "number") return NextResponse.json({ error: "unavailable" }, { status: 503 });
    if (quota.data > 0) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(quota.data) } });
    const result = await sendContactFormNotification({ name, email, phone, company, subject, message });
    if (!result.id || result.id === SKIPPED_ID) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
  } catch (e) {
    console.error("[bilgi-al] mail gönderilemedi:", e);
    return NextResponse.json(
      { error: "Mesajınız alınamadı, lütfen daha sonra tekrar deneyin." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
