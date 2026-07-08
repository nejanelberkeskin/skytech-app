/**
 * Resend E-posta Servisi — REST API ile çalışır (SDK bağımlılığı yok).
 *
 * Env: RESEND_API_KEY, RESEND_FROM_EMAIL (ör: "Skytech Green <noreply@skytechgreen.com>")
 *
 * 3 template:
 *  1. sendOrderConfirmationEmail  — B2C sipariş onayı
 *  2. sendB2BQuoteReadyEmail      — Kurumsal teklif hazır
 *  3. sendSeedPlantedEmail        — Tohum ekildi bildirimi
 */

import { createServiceRoleClient } from "@/lib/supabase/server";

// ── Resend REST wrapper ──────────────────────────────────────────────

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

interface ResendResponse {
  id?: string;
  statusCode?: number;
  message?: string;
}

async function sendEmail(params: SendEmailParams): Promise<ResendResponse> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Skytech Green <noreply@skytechgreen.com>";

  if (!apiKey) {
    console.warn("[mail] RESEND_API_KEY not set — skipping email send");
    return { id: "skipped-no-api-key" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[mail] Resend error:", data);
    throw new Error(data.message || "Email send failed");
  }

  return data as ResendResponse;
}

// ── Email log helper ────────────────────────────────────────────────

async function logEmail(
  template: string,
  recipientEmail: string,
  subject: string,
  relatedId: string | null,
  resendId: string | null,
  error: string | null = null
) {
  try {
    const supabase = createServiceRoleClient();
    await supabase.from("email_logs").insert({
      template,
      recipient_email: recipientEmail,
      subject,
      related_id: relatedId,
      resend_id: resendId,
      status: error ? "failed" : "sent",
      error_message: error,
    });
  } catch (e) {
    console.error("[mail] Failed to log email:", e);
  }
}

// ── HTML escape helper (XSS koruması) ────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Shared HTML wrapper ─────────────────────────────────────────────

function emailLayout(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f8fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #059669, #0d9488); padding: 32px 28px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.8); font-size: 13px; margin: 8px 0 0; }
    .body { padding: 28px; }
    .body p { color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dcfce7; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-size: 13px; }
    .info-value { color: #1e293b; font-size: 14px; font-weight: 600; }
    .btn { display: inline-block; background: #059669; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 8px 0; }
    .footer { text-align: center; padding: 24px 28px; border-top: 1px solid #f1f5f9; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
    .price-tag { font-size: 28px; font-weight: 800; color: #059669; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${content}
      <div class="footer">
        <p>Skytech Green — Doğaya Yatırım, Geleceğe Miras</p>
        <p style="margin-top: 4px;">Bu e-posta otomatik olarak gönderilmiştir.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ═════════════════════════════════════════════════════════════════════
// 1. ORDER CONFIRMATION — B2C sipariş onayı
// ═════════════════════════════════════════════════════════════════════

interface OrderConfirmationData {
  email: string;
  orderId: string;
  totalSeeds: number;
  totalPrice: number;
  orderType: string;       // "physical" | "reservation"
  buyerName?: string;
}

export async function sendOrderConfirmationEmail(data: OrderConfirmationData) {
  const subject = `Siparişiniz Alındı! (#${data.orderId.slice(0, 8)})`;

  const html = emailLayout(subject, `
    <div class="header">
      <h1>Siparişiniz Onaylandı!</h1>
      <p>Doğaya katkınız için teşekkür ederiz</p>
    </div>
    <div class="body">
      <p>Merhaba${data.buyerName ? ` <strong>${esc(data.buyerName)}</strong>` : ""},</p>
      <p>Siparişiniz başarıyla alındı ve işleme konuldu.</p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Sipariş No</span>
          <span class="info-value">#${data.orderId.slice(0, 8).toUpperCase()}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tohum Sayısı</span>
          <span class="info-value">${data.totalSeeds.toLocaleString("tr-TR")} adet</span>
        </div>
        <div class="info-row">
          <span class="info-label">Toplam Tutar</span>
          <span class="info-value">${data.totalPrice.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Sipariş Türü</span>
          <span class="info-value">${data.orderType === "physical" ? "Fiziksel Tohum" : "Arazi Rezervasyonu"}</span>
        </div>
      </div>

      <p>Siparişinizin durumunu hesabınız üzerinden takip edebilirsiniz.</p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://skytechgreen.com"}/hesabim" class="btn">
          Siparişimi Takip Et
        </a>
      </p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: data.email, subject, html });
    await logEmail("order_confirmation", data.email, subject, data.orderId, result.id || null);
    return result;
  } catch (e: any) {
    await logEmail("order_confirmation", data.email, subject, data.orderId, null, e.message);
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// 2. B2B QUOTE READY — Kurumsal teklif hazır
// ═════════════════════════════════════════════════════════════════════

interface B2BQuoteReadyData {
  email: string;
  companyName: string;
  contactPerson: string;
  quoteId: string;
  approvedPrice: number;
  approvedSeedCount: number;
  adminNote?: string;
  pricePerSeed: number;
}

export async function sendB2BQuoteReadyEmail(data: B2BQuoteReadyData) {
  const subject = `Teklifiniz Hazır — ${data.companyName}`;

  const html = emailLayout(subject, `
    <div class="header">
      <h1>Teklifiniz Hazırlandı!</h1>
      <p>${esc(data.companyName)} için özel fiyatlandırma</p>
    </div>
    <div class="body">
      <p>Sayın <strong>${esc(data.contactPerson)}</strong>,</p>
      <p><strong>${esc(data.companyName)}</strong> adına gönderdiğiniz teklif talebimiz incelendi ve özel fiyatlandırmanız hazırlandı.</p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Teklif No</span>
          <span class="info-value">#${data.quoteId.slice(0, 8).toUpperCase()}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tohum Sayısı</span>
          <span class="info-value">${data.approvedSeedCount.toLocaleString("tr-TR")} adet</span>
        </div>
        <div class="info-row">
          <span class="info-label">Birim Fiyat</span>
          <span class="info-value">${data.pricePerSeed.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })} / tohum</span>
        </div>
        <div style="padding: 16px 0; text-align: center; border-bottom: none;">
          <span class="info-label">Toplam Tutar</span><br />
          <span class="price-tag">${data.approvedPrice.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</span>
        </div>
      </div>

      ${data.adminNote ? `
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p style="color: #1e40af; font-size: 13px; margin: 0 0 4px; font-weight: 600;">Admin Notu:</p>
        <p style="color: #1e40af; font-size: 14px; margin: 0;">${esc(data.adminNote)}</p>
      </div>
      ` : ""}

      <p>Teklifi onaylamak ve ödeme yapmak için kurumsal panelinize giriş yapın.</p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://skytechgreen.com"}/kurumsal/panel/odeme" class="btn">
          Teklifi Onayla & Öde
        </a>
      </p>

      <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
        Bu teklif 30 gün geçerlidir. Sorularınız için bize ulaşmaktan çekinmeyin.
      </p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: data.email, subject, html });
    await logEmail("b2b_quote_ready", data.email, subject, data.quoteId, result.id || null);
    return result;
  } catch (e: any) {
    await logEmail("b2b_quote_ready", data.email, subject, data.quoteId, null, e.message);
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// 3. SEED PLANTED — Tohum ekildi bildirimi
// ═════════════════════════════════════════════════════════════════════


interface SeedPlantedData {
  email: string;
  buyerName?: string;
  orderId: string;
  totalSeeds: number;
  landName: string;
  region: string;
  plantedDate: string;    // ISO date
}

export async function sendSeedPlantedEmail(data: SeedPlantedData) {
  const subject = `Tohumlarınız Ekildi! — ${data.landName}`;
  const dateStr = new Date(data.plantedDate).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = emailLayout(subject, `
    <div class="header">
      <h1>Tohumlarınız Toprakla Buluştu!</h1>
      <p>${esc(data.landName)} — ${esc(data.region)}</p>
    </div>
    <div class="body">
      <p>Merhaba${data.buyerName ? ` <strong>${esc(data.buyerName)}</strong>` : ""},</p>
      <p>Harika haberlerimiz var! Siparişinize ait tohumlar başarıyla ekildi.</p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Sipariş No</span>
          <span class="info-value">#${data.orderId.slice(0, 8).toUpperCase()}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Ekilen Tohum</span>
          <span class="info-value">${data.totalSeeds.toLocaleString("tr-TR")} adet</span>
        </div>
        <div class="info-row">
          <span class="info-label">Orman Alanı</span>
          <span class="info-value">${esc(data.landName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Bölge</span>
          <span class="info-value">${esc(data.region)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Ekim Tarihi</span>
          <span class="info-value">${dateStr}</span>
        </div>
      </div>

      <p>Sertifikanız hesabınız üzerinden indirilebilir durumda. Her tohum, doğaya bıraktığınız kalıcı bir izdir.</p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://skytechgreen.com"}/hesabim" class="btn">
          Sertifikamı Görüntüle
        </a>
      </p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: data.email, subject, html });
    await logEmail("seed_planted", data.email, subject, data.orderId, result.id || null);
    return result;
  } catch (e: any) {
    await logEmail("seed_planted", data.email, subject, data.orderId, null, e.message);
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// 4. ORDER PREPARING — Kargo hazırlık bildirimi
// ═════════════════════════════════════════════════════════════════════

export async function sendOrderPreparingEmail(
  email: string,
  orderId: string,
  name?: string
) {
  const shortId = orderId.slice(0, 8).toUpperCase();
  const subject = `#${shortId} Siparişiniz Hazırlanıyor 📦`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skytechgreen.com";

  const html = emailLayout(subject, `
    <div class="header" style="background: linear-gradient(135deg, #0369a1, #0284c7);">
      <h1>Siparişiniz Hazırlanıyor</h1>
      <p>Tohumlarınız özenle paketleniyor…</p>
    </div>
    <div class="body">
      <p>Merhaba${name ? ` <strong>${esc(name)}</strong>` : ""},</p>
      <p>
        Harika bir seçim yaptınız! <strong>#${shortId}</strong> numaralı siparişinizdeki
        tohumlar şu anda ekibimiz tarafından titizlikle seçilerek paketleniyor.
      </p>

      <div class="info-box" style="background: #eff6ff; border-color: #bfdbfe;">
        <div class="info-row">
          <span class="info-label">Sipariş No</span>
          <span class="info-value">#${shortId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Durum</span>
          <span class="info-value" style="color: #0369a1;">📦 Hazırlanıyor</span>
        </div>
      </div>

      <p>
        Kargoya verildiğinde size bir takip numarası ile birlikte ikinci bir bildirim
        göndereceğiz. Sabırsızlıkla beklediğiniz için teşekkürler!
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/hesabim/siparisler" class="btn" style="background: #0369a1;">
          Siparişimi Takip Et
        </a>
      </p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: email, subject, html });
    await logEmail("order_preparing", email, subject, orderId, result.id || null);
    return result;
  } catch (e: any) {
    await logEmail("order_preparing", email, subject, orderId, null, e.message);
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// 5. ORDER SHIPPED — Kargoya verildi + Magic Link takip butonu
// ═════════════════════════════════════════════════════════════════════

export async function sendOrderShippedEmail(
  email: string,
  orderId: string,
  name: string | undefined,
  courierCompany: string,
  trackingNumber: string,
  trackingUrl?: string
) {
  const shortId = orderId.slice(0, 8).toUpperCase();
  const subject = `#${shortId} Siparişiniz Kargoya Verildi! 🚀`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skytechgreen.com";

  // Magic Link — misafir kullanıcı şifresiz kargo takip sayfasına ulaşır
  const magicLink = `${appUrl}/kargo-takip?orderId=${orderId}&email=${encodeURIComponent(email)}`;

  const html = emailLayout(subject, `
    <div class="header" style="background: linear-gradient(135deg, #059669, #0d9488);">
      <h1>Siparişiniz Yola Çıktı! 🚀</h1>
      <p>${esc(courierCompany)} ile kargoya verildi</p>
    </div>
    <div class="body">
      <p>Merhaba${name ? ` <strong>${esc(name)}</strong>` : ""},</p>
      <p>
        <strong>#${shortId}</strong> numaralı siparişinizdeki tohumlar <strong>${esc(courierCompany)}</strong>
        aracılığıyla kargoya verildi. Doğayla buluşmak için yola çıktılar!
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Kargo Firması</span>
          <span class="info-value">${esc(courierCompany)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Takip Numarası</span>
          <span class="info-value" style="font-family: monospace; font-size: 16px; color: #059669; letter-spacing: 0.05em;">${esc(trackingNumber)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Durum</span>
          <span class="info-value" style="color: #059669;">🚀 Kargoda</span>
        </div>
      </div>

      ${trackingUrl ? `
      <p style="text-align: center; margin: 8px 0 4px;">
        <a href="${trackingUrl}" style="color: #059669; font-size: 13px;">
          ${courierCompany} sitesinde takip et →
        </a>
      </p>
      ` : ""}

      <!-- Magic Link — büyük, göz alıcı CTA butonu -->
      <div style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px solid #86efac; border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #166534; font-size: 13px; font-weight: 700; margin: 0 0 6px;">
          🕵️ Anlık Kargo Takibi
        </p>
        <p style="color: #15803d; font-size: 13px; margin: 0 0 20px;">
          Hesap açmanıza gerek yok — tek tıkla kargo durumunuzu izleyin.
        </p>
        <a href="${magicLink}"
          style="display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(16,185,129,0.35); letter-spacing: 0.02em;">
          📦 Kargomu Takip Et
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 0;">
        Bu bağlantı yalnızca size özeldir. Lütfen başkalarıyla paylaşmayın.
      </p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: email, subject, html });
    await logEmail("order_shipped", email, subject, orderId, result.id || null);
    return result;
  } catch (e: any) {
    await logEmail("order_shipped", email, subject, orderId, null, e.message);
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// 6. ORDER DELIVERED — Teslim edildi bildirimi
// ═════════════════════════════════════════════════════════════════════

export async function sendOrderDeliveredEmail(
  email: string,
  orderId: string,
  name?: string
) {
  const shortId = orderId.slice(0, 8).toUpperCase();
  const subject = `#${shortId} Tohumlarınız Teslim Edildi! ✅`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skytechgreen.com";

  const html = emailLayout(subject, `
    <div class="header" style="background: linear-gradient(135deg, #065f46, #059669);">
      <h1>Tohumlarınız Teslim Edildi! ✅</h1>
      <p>Doğayla buluşturma vakti geldi!</p>
    </div>
    <div class="body">
      <p>Merhaba${name ? ` <strong>${esc(name)}</strong>` : ""},</p>
      <p>
        Harika haber! <strong>#${shortId}</strong> numaralı siparişinizdeki tohumlar
        başarıyla teslim edildi. Artık onları doğaya kavuşturma vakti! 🌱
      </p>

      <div style="background: linear-gradient(135deg, rgba(5,150,105,0.06), rgba(6,78,59,0.04)); border: 1px solid rgba(52,211,153,0.25); border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="font-size: 42px; margin: 0 0 8px;">🌳</p>
        <p style="color: #059669; font-size: 17px; font-weight: 800; margin: 0 0 6px;">
          Her tohum bir ağaca, her ağaç bir geleceğe dönüşür.
        </p>
        <p style="color: #64748b; font-size: 13px; margin: 0;">
          Skytech Green ailesi olarak yanınızdayız.
        </p>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Sipariş No</span>
          <span class="info-value">#${shortId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Durum</span>
          <span class="info-value" style="color: #059669;">✅ Teslim Edildi</span>
        </div>
      </div>

      <p>
        Tohumlarınızı ektiğinizde elde ettiğiniz fotoğraf veya deneyimi bizimle paylaşmaktan
        çekinmeyin. Sizi sosyal medyada etiketleyerek katkınızı dünyayla paylaşabiliriz!
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/hesabim" class="btn">
          Hesabımı Görüntüle
        </a>
      </p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: email, subject, html });
    await logEmail("order_delivered", email, subject, orderId, result.id || null);
    return result;
  } catch (e: any) {
    await logEmail("order_delivered", email, subject, orderId, null, e.message);
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// 7. EMPLOYEE CERTIFICATE — B2B çalışan sertifikası
// ═════════════════════════════════════════════════════════════════════

interface EmployeeCertificateData {
  recipientEmail: string;
  recipientName: string;
  companyName: string;
  seedCount: number;
  certificateId: string | null;
  allocationId: string;
}

export async function sendEmployeeCertificateEmail(data: EmployeeCertificateData) {
  const subject = `${data.companyName} adına ${data.seedCount.toLocaleString("tr-TR")} Tohum Ekildi!`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skytechgreen.com";
  const certLink = data.certificateId
    ? `${appUrl}/sertifika/${data.certificateId}`
    : `${appUrl}/hesabim/sertifikalar`;

  const co2 = ((data.seedCount / 100) * 1.5).toFixed(1);

  const html = emailLayout(subject, `
    <div class="header" style="background: linear-gradient(135deg, #059669, #0f766e);">
      <h1>🌱 Sizin Adınıza Tohum Ekildi!</h1>
      <p>${esc(data.companyName)}'in doğaya katkısının bir parçasısınız</p>
    </div>
    <div class="body">
      <p>Sayın <strong>${esc(data.recipientName)}</strong>,</p>
      <p>
        <strong>${esc(data.companyName)}</strong> çalışan sürdürülebilirlik programı kapsamında
        <strong> ${data.seedCount.toLocaleString("tr-TR")} tohum</strong> Türkiye'nin ormanlarına ekildi.
        Bu ekimin bir parçası olarak kişisel sertifikanız hazırlandı.
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Adınıza Ekilen Tohum</span>
          <span class="info-value">🌱 ${data.seedCount.toLocaleString("tr-TR")} adet</span>
        </div>
        <div class="info-row">
          <span class="info-label">Firma</span>
          <span class="info-value">${esc(data.companyName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Yıllık CO₂ Tutulumu</span>
          <span class="info-value">~${co2} ton</span>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, rgba(5,150,105,0.08), rgba(6,78,59,0.05)); border: 1px solid rgba(52,211,153,0.2); border-radius: 14px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="color: #059669; font-size: 13px; font-weight: 700; margin: 0 0 4px;">🏆 Kişisel Sertifikanız Hazır</p>
        <p style="color: #475569; font-size: 13px; margin: 0;">Dijital sertifikanızı görüntüleyebilir, sosyal medyada paylaşabilirsiniz.</p>
      </div>

      <p style="text-align: center; margin-top: 24px;">
        <a href="${certLink}" class="btn">
          🌐 Sertifikamı Görüntüle
        </a>
      </p>

      <p style="text-align: center; margin-top: 12px;">
        <a href="https://wa.me/?text=${encodeURIComponent(
          `🌱 ${data.companyName} adına ${data.seedCount.toLocaleString("tr-TR")} tohum ektim! Sertifikamı görmek için: ${certLink}`
        )}"
          style="color: #059669; font-size: 13px; text-decoration: none;">
          WhatsApp'ta Paylaş
        </a>
      </p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: data.recipientEmail, subject, html });
    await logEmail(
      "employee_certificate",
      data.recipientEmail,
      subject,
      data.allocationId,
      result.id || null
    );
    return result;
  } catch (e: any) {
    await logEmail(
      "employee_certificate",
      data.recipientEmail,
      subject,
      data.allocationId,
      null,
      e.message
    );
    throw e;
  }
}

// ── Bilgi-al formu bildirimi ──────────────────────────────────────────

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
}

/**
 * /bilgi-al formu gönderiminde info@'ya bildirim gönderir.
 * replyTo submitter'ın kendi e-postası — doğrudan "Yanıtla" ile cevap gider.
 */
export async function sendContactFormNotification(data: ContactFormData) {
  const notifyTo = process.env.CONTACT_NOTIFY_EMAIL || "info@skytechgreen.com";
  const subject = `[Bilgi Al] ${esc(data.subject)} — ${esc(data.name)}`;

  const html = emailLayout(
    "Yeni Bilgi Talebi",
    `
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b8f6b;width:120px;">Ad Soyad</td><td style="padding:6px 0;font-weight:600;">${esc(data.name)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b8f6b;">E-posta</td><td style="padding:6px 0;font-weight:600;">${esc(data.email)}</td></tr>
        ${data.phone ? `<tr><td style="padding:6px 0;color:#6b8f6b;">Telefon</td><td style="padding:6px 0;">${esc(data.phone)}</td></tr>` : ""}
        ${data.company ? `<tr><td style="padding:6px 0;color:#6b8f6b;">Şirket</td><td style="padding:6px 0;">${esc(data.company)}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#6b8f6b;">Konu</td><td style="padding:6px 0;font-weight:600;">${esc(data.subject)}</td></tr>
      </table>
      <p style="margin:16px 0 4px;color:#6b8f6b;font-size:13px;">Mesaj</p>
      <p style="white-space:pre-wrap;background:#f8faf5;border-radius:8px;padding:14px;font-size:14px;">${esc(data.message)}</p>
    `
  );

  try {
    const result = await sendEmail({ to: notifyTo, subject, html, replyTo: data.email });
    await logEmail("contact_form", notifyTo, subject, null, result.id || null);
    return result;
  } catch (e: any) {
    await logEmail("contact_form", notifyTo, subject, null, null, e.message);
    throw e;
  }
}
