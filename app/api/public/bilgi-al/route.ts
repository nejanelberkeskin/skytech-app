import { NextRequest, NextResponse } from "next/server";
import { sendContactFormNotification } from "@/lib/mail";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
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
  if (name.length > 200 || subject.length > 200 || message.length > 5000) {
    return NextResponse.json({ error: "Girilen metin çok uzun." }, { status: 400 });
  }

  // Honeypot dolu → bot. Sessizce "başarılı" dön, mail gönderme.
  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  try {
    await sendContactFormNotification({ name, email, phone, company, subject, message });
  } catch (e) {
    console.error("[bilgi-al] mail gönderilemedi:", e);
    return NextResponse.json(
      { error: "Mesajınız alınamadı, lütfen daha sonra tekrar deneyin." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
