/**
 * Resend E-posta Servisi — REST API ile çalışır (SDK bağımlılığı yok).
 *
 * Env: RESEND_API_KEY, RESEND_FROM_EMAIL (ör: "Skytech Green <noreply@skytechgreen.com>")
 *
 * Şablonlar:
 *  - Satış modeli v2 (bırakma siparişi): teyit, bildirim, cayma, satıcı iptali, iade, sertifika, video.
 *  - Talep formları ve iletişim formu bildirimleri.
 *  - B2B: sendB2BQuoteReadyEmail (teklif hazır), sendEmployeeCertificateEmail (çalışan sertifikası).
 * Eski bireysel tohum satışının şablonları (sipariş onayı, ekildi, kargo, teslim) Faz 8'de kaldırıldı.
 */

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ServiceRequest } from "@/lib/types";
import {
  REQUEST_TYPE_LABELS,
  requestSummaryRows,
  type LabelLocale,
  type SummaryRow,
} from "@/lib/requests/labels";

// ── Resend REST wrapper ──────────────────────────────────────────────

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Resend ekleri: içerik base64 (ör. sözleşme PDF'leri). */
  attachments?: { filename: string; content: string }[];
}

interface ResendResponse {
  id?: string;
  statusCode?: number;
  message?: string;
}

/** RESEND_API_KEY yokken sendEmail'in döndürdüğü kimlik: e-posta GÖNDERİLMEDİ demektir. */
export const SKIPPED_ID = "skipped-no-api-key";

async function sendEmail(params: SendEmailParams): Promise<ResendResponse> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Skytech Green <noreply@skytechgreen.com>";

  if (!apiKey) {
    console.warn("[mail] RESEND_API_KEY not set — skipping email send");
    return { id: SKIPPED_ID };
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
      ...(params.attachments?.length ? { attachments: params.attachments } : {}),
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
  // Anahtar yokken (yerel geliştirme) hiçbir şey gönderilmez; "gönderildi" diye kayıt düşme.
  if (resendId === SKIPPED_ID) return;
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

// ── Hata mesajı (unknown → string) ───────────────────────────────────

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
// B2B QUOTE READY — Kurumsal teklif hazır
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
  } catch (e: unknown) {
    await logEmail("b2b_quote_ready", data.email, subject, data.quoteId, null, errorMessage(e));
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// B2B EMPLOYEE CERTIFICATE — çalışan sertifikası
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
  } catch (e: unknown) {
    await logEmail(
      "employee_certificate",
      data.recipientEmail,
      subject,
      data.allocationId,
      null,
      errorMessage(e)
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
  } catch (e: unknown) {
    await logEmail("contact_form", notifyTo, subject, null, null, errorMessage(e));
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// 8. SERVICE REQUEST — talep bildirimi (şirkete) + alındı onayı (talep sahibine)
// ═════════════════════════════════════════════════════════════════════

/** Talep e-postalarının hedef adresi — bilgi-al formuyla aynı kutu. */
export function requestNotifyEmail(): string {
  return process.env.REQUEST_NOTIFY_EMAIL || process.env.CONTACT_NOTIFY_EMAIL || "info@skytechgreen.com";
}

/** Yönetim panelinde siparişi doğrudan açan bağlantı (oturum gerektirir). */
const adminOrderUrl = (orderNo: string) => `${appUrl()}/admin/birakma-siparisleri?no=${encodeURIComponent(orderNo)}`;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://skytechgreen.com";
}

function summaryTable(rows: SummaryRow[]): string {
  if (rows.length === 0) return "";
  return `
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">
        ${rows
          .map((r) => {
            const value = r.href
              ? `<a href="${esc(r.href)}" style="color:#059669;word-break:break-all;">${esc(r.value)}</a>`
              : r.multiline
                ? `<span style="white-space:pre-wrap;">${esc(r.value)}</span>`
                : esc(r.value);
            return `<tr>
              <td style="padding:7px 12px 7px 0;color:#6b8f6b;vertical-align:top;width:150px;">${esc(r.label)}</td>
              <td style="padding:7px 0;font-weight:600;color:#1e293b;vertical-align:top;">${value}</td>
            </tr>`;
          })
          .join("")}
      </table>`;
}

/** Talep sahibinin dilinde (ru → en) sabit metinler. */
const CONFIRM_TEXT = {
  tr: {
    subject: (no: string) => `Talebiniz alındı — ${no}`,
    title: "Talebiniz Alındı",
    sub: "Skytech Green ekibi en kısa sürede sizinle iletişime geçecek",
    hello: (name: string) => `Merhaba <strong>${name}</strong>,`,
    intro: (type: string, no: string) =>
      `Talebiniz bize ulaştı: <strong>${type}</strong>. Talep numaranız: <strong style="font-family:monospace;font-size:16px;color:#059669;">${no}</strong>. Yazışmalarınızda bu numarayı belirtmeniz süreci hızlandırır.`,
    summaryTitle: "Talep özeti",
    next: "Ekibimiz talebinizi inceleyip bir iş günü içinde bıraktığınız iletişim bilgisi üzerinden size dönüş yapacak. Ayrıntılar ve takvim bu görüşmede netleştirilir; şu an sizden herhangi bir ödeme istenmemektedir.",
    account: (url: string) =>
      `Talebinizin durumunu takip etmek için <a href="${url}" class="btn">ücretsiz hesap oluşturabilirsiniz</a>.`,
    contact: "Sorularınız için bu e-postayı yanıtlayabilir veya info@skytechgreen.com adresine yazabilirsiniz.",
  },
  en: {
    subject: (no: string) => `We received your request — ${no}`,
    title: "Request Received",
    sub: "The Skytech Green team will get back to you shortly",
    hello: (name: string) => `Hello <strong>${name}</strong>,`,
    intro: (type: string, no: string) =>
      `Your <strong>${type}</strong> has reached us. Your request number is <strong style="font-family:monospace;font-size:16px;color:#059669;">${no}</strong>. Quoting it in your correspondence speeds things up.`,
    summaryTitle: "Request summary",
    next: "Our team will review your request and contact you within one business day using the details you provided. Details and scheduling are clarified in that conversation; no payment is requested at this stage.",
    account: (url: string) =>
      `To track the status of your request you can <a href="${url}" class="btn">create a free account</a>.`,
    contact: "For questions, reply to this e-mail or write to info@skytechgreen.com.",
  },
} as const;

type MailLocale = keyof typeof CONFIRM_TEXT;
const mailLocale = (l: LabelLocale): MailLocale => (l === "tr" ? "tr" : "en");

interface RequestMailInput {
  request: ServiceRequest;
  landName?: string | null;
  /** Hesap oluşturma bağlantısı gösterilsin mi (ACCOUNTS_ENABLED) */
  accountLink?: boolean;
}

/**
 * Şirkete yeni talep bildirimi. replyTo talep sahibinin e-postası (varsa) —
 * "Yanıtla" doğrudan ona gider. Konu satırı talep numarası ile başlar;
 * posta kutusunda arama/filtreleme kolaylaşır.
 */
export async function sendServiceRequestNotification({ request, landName }: RequestMailInput) {
  const notifyTo = requestNotifyEmail();
  const typeLabel = REQUEST_TYPE_LABELS.tr[request.type];
  const subject = `[Talep] ${request.request_no} · ${typeLabel} — ${request.contact_name}`;
  const rows = requestSummaryRows(request, "tr", landName);
  const adminUrl = `${appUrl()}/admin/talepler?no=${encodeURIComponent(request.request_no)}`;
  const createdAt = new Date(request.created_at).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });

  const html = emailLayout(subject, `
    <div class="header">
      <h1>Yeni Talep: ${esc(typeLabel)}</h1>
      <p>${esc(request.request_no)} · ${esc(createdAt)}</p>
    </div>
    <div class="body">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b8f6b;width:150px;">Ad Soyad</td><td style="padding:6px 0;font-weight:600;">${esc(request.contact_name)}</td></tr>
        ${request.company ? `<tr><td style="padding:6px 0;color:#6b8f6b;">Şirket / Kurum</td><td style="padding:6px 0;">${esc(request.company)}</td></tr>` : ""}
        ${request.email ? `<tr><td style="padding:6px 0;color:#6b8f6b;">E-posta</td><td style="padding:6px 0;"><a href="mailto:${esc(request.email)}" style="color:#059669;">${esc(request.email)}</a></td></tr>` : ""}
        ${request.phone ? `<tr><td style="padding:6px 0;color:#6b8f6b;">Telefon</td><td style="padding:6px 0;"><a href="tel:${esc(request.phone)}" style="color:#059669;">${esc(request.phone)}</a></td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#6b8f6b;">Dil</td><td style="padding:6px 0;">${esc(request.locale.toUpperCase())}${request.user_id ? " · üye hesabıyla" : " · misafir"}</td></tr>
      </table>
      <p style="margin:18px 0 4px;color:#6b8f6b;font-size:13px;font-weight:600;">TALEP DETAYI</p>
      ${summaryTable(rows)}
      ${request.message ? `
      <p style="margin:16px 0 4px;color:#6b8f6b;font-size:13px;">Mesaj</p>
      <p style="white-space:pre-wrap;background:#f8faf5;border-radius:8px;padding:14px;font-size:14px;">${esc(request.message)}</p>` : ""}
      <p style="text-align:center;margin-top:24px;">
        <a href="${adminUrl}" class="btn">Yönetim panelinde aç</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Kayıt kimliği: ${esc(request.id)} · KVKK onayı: ${esc(request.consent_version)}</p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: notifyTo, subject, html, replyTo: request.email ?? undefined });
    await logEmail("service_request_notify", notifyTo, subject, request.id, result.id || null);
    return result;
  } catch (e: unknown) {
    await logEmail("service_request_notify", notifyTo, subject, request.id, null, errorMessage(e));
    throw e;
  }
}

/** Talep sahibine alındı onayı — e-posta bırakmışsa. Fiyat içermez. */
export async function sendServiceRequestConfirmation({ request, landName, accountLink }: RequestMailInput) {
  if (!request.email) return { id: "skipped-no-email" } as ResendResponse;

  const loc = mailLocale(request.locale);
  const t = CONFIRM_TEXT[loc];
  const typeLabel = REQUEST_TYPE_LABELS[loc][request.type];
  const subject = t.subject(request.request_no);
  const rows = requestSummaryRows(request, loc, landName);
  const registerUrl = `${appUrl()}/auth/register?talep=${encodeURIComponent(request.id)}`;

  const html = emailLayout(subject, `
    <div class="header">
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.sub)}</p>
    </div>
    <div class="body">
      <p>${t.hello(esc(request.contact_name))}</p>
      <p>${t.intro(esc(typeLabel), esc(request.request_no))}</p>
      <div class="info-box">
        <p style="margin:0 0 6px;color:#166534;font-size:13px;font-weight:700;">${esc(t.summaryTitle)}</p>
        ${summaryTable(rows)}
      </div>
      <p>${esc(t.next)}</p>
      ${accountLink ? `<p style="text-align:center;margin-top:20px;">${t.account(registerUrl)}</p>` : ""}
      <p style="color:#64748b;font-size:13px;margin-top:20px;">${esc(t.contact)}</p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: request.email, subject, html });
    await logEmail("service_request_confirm", request.email, subject, request.id, result.id || null);
    return result;
  } catch (e: unknown) {
    await logEmail("service_request_confirm", request.email, subject, request.id, null, errorMessage(e));
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// SİPARİŞ TEYİDİ — tohum topu bıraktırma siparişi (satış modeli v2)
// ═════════════════════════════════════════════════════════════════════
// İşlemsel e-postadır (izin gerektirmez, tanıtım içermez). Ödeme onaylanınca gider;
// Ön Bilgilendirme Formu, Mesafeli Hizmet Sözleşmesi ve Cayma Formu PDF olarak eklenir —
// mevzuatın aradığı "kalıcı veri saklayıcısı" budur.

export interface OrderConfirmationInput {
  orderId: string;
  orderNo: string;
  locale: "tr" | "en" | "ru";
  email: string;
  firstName: string;
  siteName: string;
  quantity: number;
  totalText: string;
  certificateName: string;
  /** "31 Mart 2027" biçiminde, hazır metin */
  performanceDeadlineText: string;
  withdrawalLastDayText: string;
  /** Belirteçli sipariş sayfası (mutlak adres) */
  orderUrl: string;
  isTest: boolean;
  attachments: { filename: string; content: string }[];
}

const ORDER_TEXT = {
  tr: {
    subject: (no: string) => `Siparişiniz alındı — ${no}`,
    title: "Siparişiniz Alındı",
    sub: "Ödemeniz onaylandı; sözleşmeniz kuruldu",
    hello: (n: string) => `Merhaba <strong>${n}</strong>,`,
    intro: (no: string) =>
      `Tohum topu bıraktırma siparişiniz kesinleşti. Sipariş numaranız: <strong style="font-family:monospace;font-size:16px;color:#059669;">${no}</strong>.`,
    rows: { site: "Proje Uygulama Sahası", quantity: "Tohum topu adedi", total: "Toplam bedel (KDV dâhil)", certificate: "Sertifikadaki ad", deadline: "En geç bırakılacağı tarih", withdrawal: "Cayma hakkının son günü" },
    next: "Tohum topu bırakma, cayma süresi dolduktan sonra ve yukarıdaki son tarihi aşmadan yapılır. Bırakma tamamlandığında Katılım Sertifikanız ve faturanız e-postayla gönderilir; çalışmanın görüntüleri izleme döneminde paylaşılır.",
    docs: "Ön Bilgilendirme Formu, Mesafeli Hizmet Sözleşmesi, Cayma Formu ve KVKK Aydınlatma Metni bu e-postanın ekindedir. Lütfen saklayın.",
    withdraw: (d: string) => `Cayma hakkınızı ${d} günü sonuna kadar, hiçbir gerekçe göstermeden kullanabilirsiniz; bedelin tamamı 14 gün içinde ödemede kullandığınız araca iade edilir.`,
    cta: "Siparişimi görüntüle",
    contact: "Sorularınız için bu e-postayı yanıtlayabilir veya info@skytechgreen.com adresine yazabilirsiniz.",
    test: "DENEME SİPARİŞİ — gerçek bir ödeme alınmamıştır.",
  },
  en: {
    subject: (no: string) => `Your order is confirmed — ${no}`,
    title: "Order Confirmed",
    sub: "Your payment is approved and your contract is concluded",
    hello: (n: string) => `Hello <strong>${n}</strong>,`,
    intro: (no: string) =>
      `Your seed ball release order is confirmed. Your order number is <strong style="font-family:monospace;font-size:16px;color:#059669;">${no}</strong>.`,
    rows: { site: "Project Site", quantity: "Seed balls", total: "Total (VAT included)", certificate: "Name on certificate", deadline: "Released no later than", withdrawal: "Last day to withdraw" },
    next: "The seed balls are released after the withdrawal period ends and no later than the date above. Once the release is completed, your Certificate of Participation and invoice are sent by e-mail; footage of the work is shared during the monitoring period.",
    docs: "The Preliminary Information Form, the Distance Service Agreement, the Withdrawal Form and the Personal Data Notice (KVKK) are attached (issued in Turkish). Please keep them.",
    withdraw: (d: string) => `You may withdraw without giving any reason until the end of ${d}; the full amount is refunded to your payment method within 14 days.`,
    cta: "View my order",
    contact: "For questions, reply to this e-mail or write to info@skytechgreen.com.",
    test: "TEST ORDER — no real payment has been taken.",
  },
} as const;

export async function sendOrderConfirmation(input: OrderConfirmationInput) {
  const t = ORDER_TEXT[input.locale === "tr" ? "tr" : "en"];
  const subject = (input.isTest ? "[DENEME] " : "") + t.subject(input.orderNo);
  const rows: [string, string][] = [
    [t.rows.site, input.siteName],
    [t.rows.quantity, String(input.quantity)],
    [t.rows.total, input.totalText],
    [t.rows.certificate, input.certificateName],
    [t.rows.deadline, input.performanceDeadlineText],
    [t.rows.withdrawal, input.withdrawalLastDayText],
  ];
  const html = emailLayout(subject, `
    <div class="header">
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.sub)}</p>
    </div>
    <div class="body">
      ${input.isTest ? `<p style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:10px 14px;border-radius:8px;font-weight:600;">${esc(t.test)}</p>` : ""}
      <p>${t.hello(esc(input.firstName))}</p>
      <p>${t.intro(esc(input.orderNo))}</p>
      <div class="info-box">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows
            .map(
              ([k, v]) => `<tr>
            <td style="padding:7px 12px 7px 0;color:#6b8f6b;vertical-align:top;width:190px;">${esc(k)}</td>
            <td style="padding:7px 0;font-weight:600;color:#1e293b;vertical-align:top;">${esc(v)}</td>
          </tr>`
            )
            .join("")}
        </table>
      </div>
      <p>${esc(t.next)}</p>
      <p>${esc(t.withdraw(input.withdrawalLastDayText))}</p>
      <p style="text-align:center;margin:24px 0;"><a href="${esc(input.orderUrl)}" class="btn">${esc(t.cta)}</a></p>
      <p style="color:#64748b;font-size:13px;">${esc(t.docs)}</p>
      <p style="color:#64748b;font-size:13px;margin-top:20px;">${esc(t.contact)}</p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: input.email, subject, html, attachments: input.attachments });
    await logEmail("release_order_confirm", input.email, subject, input.orderId, result.id || null);
    return result;
  } catch (e: unknown) {
    await logEmail("release_order_confirm", input.email, subject, input.orderId, null, errorMessage(e));
    throw e;
  }
}

/** Şirkete yeni sipariş bildirimi (kişisel veri asgari: ad, tutar, saha). */
export async function sendOrderNotification(input: Pick<OrderConfirmationInput, "orderId" | "orderNo" | "siteName" | "quantity" | "totalText" | "isTest"> & { buyerName: string; buyerType: string }) {
  const to = requestNotifyEmail();
  const subject = `${input.isTest ? "[DENEME] " : ""}[Sipariş] ${input.orderNo} · ${input.siteName} — ${input.quantity} adet`;
  const html = emailLayout(subject, `
    <div class="header"><h1>Yeni Sipariş</h1><p>${esc(input.orderNo)}</p></div>
    <div class="body">
      <p><strong>${esc(input.buyerName)}</strong> (${esc(input.buyerType === "corporate" ? "kurumsal" : "bireysel")}) — ${esc(input.siteName)} sahasına <strong>${input.quantity}</strong> tohum topu, toplam <strong>${esc(input.totalText)}</strong>.</p>
      <p style="text-align:center;margin:24px 0;"><a href="${esc(adminOrderUrl(input.orderNo))}" class="btn">Yönetim panelinde aç</a></p>
    </div>
  `);
  try {
    const result = await sendEmail({ to, subject, html });
    await logEmail("release_order_notify", to, subject, input.orderId, result.id || null);
    return result;
  } catch (e: unknown) {
    await logEmail("release_order_notify", to, subject, input.orderId, null, errorMessage(e));
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// CAYMA BİLDİRİMİ TEYİDİ
// ═════════════════════════════════════════════════════════════════════
// Mevzuat gereği cayma bildirimi ulaştığında tüketiciye DERHAL teyit gönderilir.
// Vazgeçirmeye yönelik hiçbir ifade içermez.

export interface WithdrawalReceiptInput {
  orderId: string;
  orderNo: string;
  locale: "tr" | "en" | "ru";
  email: string;
  firstName: string;
  totalText: string;
  /** "5 Kasım 2026" biçiminde, hazır metin */
  receivedOnText: string;
  refundDueOnText: string;
  isTest: boolean;
}

const WITHDRAWAL_TEXT = {
  tr: {
    subject: (no: string) => `Cayma bildiriminiz alındı — ${no}`,
    title: "Cayma Bildiriminiz Alındı",
    sub: "İade süreci başlatıldı",
    hello: (n: string) => `Merhaba <strong>${n}</strong>,`,
    intro: (no: string, d: string) =>
      `<strong style="font-family:monospace;">${no}</strong> numaralı siparişiniz için cayma bildiriminiz <strong>${d}</strong> tarihinde tarafımıza ulaşmıştır. Bildiriminiz geçerlidir; sizden başka bir işlem beklenmez.`,
    rows: { total: "İade edilecek tutar", due: "İadenin en geç yapılacağı tarih" },
    refund: "Bedelin tamamı, ödemede kullandığınız araca tek seferde ve masrafsız olarak iade edilir. İadenin hesabınıza yansıma süresi bankanıza göre değişebilir.",
    contact: "Sorularınız için bu e-postayı yanıtlayabilir veya info@skytechgreen.com adresine yazabilirsiniz.",
    test: "DENEME SİPARİŞİ — gerçek bir ödeme alınmamıştır.",
  },
  en: {
    subject: (no: string) => `Your withdrawal notice has been received — ${no}`,
    title: "Withdrawal Notice Received",
    sub: "The refund process has started",
    hello: (n: string) => `Hello <strong>${n}</strong>,`,
    intro: (no: string, d: string) =>
      `We received your withdrawal notice for order <strong style="font-family:monospace;">${no}</strong> on <strong>${d}</strong>. Your notice is valid; no further action is required from you.`,
    rows: { total: "Amount to be refunded", due: "Refund will be made no later than" },
    refund: "The full amount is refunded in a single payment, free of charge, to the payment method you used. The time it takes to appear in your account may vary by bank.",
    contact: "For questions, reply to this e-mail or write to info@skytechgreen.com.",
    test: "TEST ORDER — no real payment has been taken.",
  },
} as const;

export async function sendWithdrawalReceipt(input: WithdrawalReceiptInput) {
  const t = WITHDRAWAL_TEXT[input.locale === "tr" ? "tr" : "en"];
  const subject = (input.isTest ? "[DENEME] " : "") + t.subject(input.orderNo);
  const rows: [string, string][] = [
    [t.rows.total, input.totalText],
    [t.rows.due, input.refundDueOnText],
  ];
  const html = emailLayout(subject, `
    <div class="header">
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.sub)}</p>
    </div>
    <div class="body">
      ${input.isTest ? `<p style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:10px 14px;border-radius:8px;font-weight:600;">${esc(t.test)}</p>` : ""}
      <p>${t.hello(esc(input.firstName))}</p>
      <p>${t.intro(esc(input.orderNo), esc(input.receivedOnText))}</p>
      <div class="info-box">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows
            .map(
              ([k, v]) => `<tr>
            <td style="padding:7px 12px 7px 0;color:#6b8f6b;vertical-align:top;width:220px;">${esc(k)}</td>
            <td style="padding:7px 0;font-weight:600;color:#1e293b;vertical-align:top;">${esc(v)}</td>
          </tr>`
            )
            .join("")}
        </table>
      </div>
      <p>${esc(t.refund)}</p>
      <p style="color:#64748b;font-size:13px;margin-top:20px;">${esc(t.contact)}</p>
    </div>
  `);

  try {
    const result = await sendEmail({ to: input.email, subject, html });
    await logEmail("release_withdrawal_receipt", input.email, subject, input.orderId, result.id || null);
    return result;
  } catch (e: unknown) {
    await logEmail("release_withdrawal_receipt", input.email, subject, input.orderId, null, errorMessage(e));
    throw e;
  }
}

/** Şirkete cayma bildirimi: iade 14 gün içinde yapılmalı. */
export async function sendWithdrawalNotification(input: {
  orderId: string;
  orderNo: string;
  buyerName: string;
  siteName: string;
  totalText: string;
  refundDueOnText: string;
  isTest: boolean;
}) {
  const to = requestNotifyEmail();
  const subject = `${input.isTest ? "[DENEME] " : ""}[Cayma] ${input.orderNo} — iade en geç ${input.refundDueOnText}`;
  const html = emailLayout(subject, `
    <div class="header"><h1>Cayma Bildirimi</h1><p>${esc(input.orderNo)}</p></div>
    <div class="body">
      <p><strong>${esc(input.buyerName)}</strong>, ${esc(input.siteName)} sahasındaki siparişinden caydı. İade edilecek tutar: <strong>${esc(input.totalText)}</strong>.</p>
      <p>Bedelin tamamı <strong>en geç ${esc(input.refundDueOnText)}</strong> tarihine kadar, ödemede kullanılan araca tek seferde iade edilmelidir. Sipariş için ayrılan kapasite iade tamamlanınca serbest kalır.</p>
      <p>Müşteriye teyit e-postası gönderildi. İade, yönetim panelindeki sipariş ekranından yapılır.</p>
      <p style="text-align:center;margin:24px 0;"><a href="${esc(adminOrderUrl(input.orderNo))}" class="btn">Yönetim panelinde aç</a></p>
    </div>
  `);
  try {
    const result = await sendEmail({ to, subject, html });
    await logEmail("release_withdrawal_notify", to, subject, input.orderId, result.id || null);
    return result;
  } catch (e: unknown) {
    await logEmail("release_withdrawal_notify", to, subject, input.orderId, null, errorMessage(e));
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════
// SATICI KAYNAKLI İPTAL ve İADE TAMAMLANDI — müşteri bildirimleri
// ═════════════════════════════════════════════════════════════════════

export interface OrderNoticeInput {
  orderId: string;
  orderNo: string;
  locale: "tr" | "en" | "ru";
  email: string;
  firstName: string;
  totalText: string;
  /** "5 Kasım 2026" biçiminde, hazır metin */
  dateText: string;
  isTest: boolean;
}

const NOTICE_TEXT = {
  cancelled: {
    tr: {
      subject: (no: string) => `Siparişiniz iptal edildi — ${no}`,
      title: "Siparişiniz İptal Edildi",
      sub: "Bedelin tamamı iade edilecek",
      intro: (no: string) =>
        `<strong style="font-family:monospace;">${no}</strong> numaralı siparişinize konu tohum topu bırakma hizmetini sözleşmede belirtilen koşullarda ifa edemeyeceğimiz için siparişiniz tarafımızca iptal edilmiştir. Bu durum için özür dileriz.`,
      rows: { total: "İade edilecek tutar", date: "İadenin en geç yapılacağı tarih" },
      note: "Bedelin tamamı, ödemede kullandığınız araca tek seferde ve masrafsız olarak iade edilir. Sizden herhangi bir işlem beklenmez.",
    },
    en: {
      subject: (no: string) => `Your order has been cancelled — ${no}`,
      title: "Your Order Has Been Cancelled",
      sub: "The full amount will be refunded",
      intro: (no: string) =>
        `As we are unable to perform the seed ball release service under order <strong style="font-family:monospace;">${no}</strong> on the terms set out in the contract, we have cancelled your order. We apologise for this.`,
      rows: { total: "Amount to be refunded", date: "Refund will be made no later than" },
      note: "The full amount is refunded in a single payment, free of charge, to the payment method you used. No action is required from you.",
    },
  },
  refunded: {
    tr: {
      subject: (no: string) => `İadeniz yapıldı — ${no}`,
      title: "İadeniz Yapıldı",
      sub: "Bedelin tamamı iade edildi",
      intro: (no: string) => `<strong style="font-family:monospace;">${no}</strong> numaralı siparişinizin bedeli, ödemede kullandığınız araca iade edilmiştir.`,
      rows: { total: "İade edilen tutar", date: "İade tarihi" },
      note: "İadenin hesabınıza ya da kart ekstrenize yansıma süresi bankanıza göre değişebilir.",
    },
    en: {
      subject: (no: string) => `Your refund has been made — ${no}`,
      title: "Your Refund Has Been Made",
      sub: "The full amount has been refunded",
      intro: (no: string) => `The amount for order <strong style="font-family:monospace;">${no}</strong> has been refunded to the payment method you used.`,
      rows: { total: "Amount refunded", date: "Refund date" },
      note: "The time it takes for the refund to appear in your account or card statement may vary by bank.",
    },
  },
} as const;

const NOTICE_COMMON = {
  tr: {
    hello: (n: string) => `Merhaba <strong>${n}</strong>,`,
    contact: "Sorularınız için bu e-postayı yanıtlayabilir veya info@skytechgreen.com adresine yazabilirsiniz.",
    test: "DENEME SİPARİŞİ — gerçek bir ödeme alınmamıştır.",
  },
  en: {
    hello: (n: string) => `Hello <strong>${n}</strong>,`,
    contact: "For questions, reply to this e-mail or write to info@skytechgreen.com.",
    test: "TEST ORDER — no real payment has been taken.",
  },
} as const;

async function sendOrderNotice(kind: keyof typeof NOTICE_TEXT, template: string, input: OrderNoticeInput) {
  const lang = input.locale === "tr" ? "tr" : "en";
  const t = NOTICE_TEXT[kind][lang];
  const c = NOTICE_COMMON[lang];
  const subject = (input.isTest ? "[DENEME] " : "") + t.subject(input.orderNo);
  const rows: [string, string][] = [
    [t.rows.total, input.totalText],
    [t.rows.date, input.dateText],
  ];
  const html = emailLayout(subject, `
    <div class="header">
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.sub)}</p>
    </div>
    <div class="body">
      ${input.isTest ? `<p style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:10px 14px;border-radius:8px;font-weight:600;">${esc(c.test)}</p>` : ""}
      <p>${c.hello(esc(input.firstName))}</p>
      <p>${t.intro(esc(input.orderNo))}</p>
      <div class="info-box">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows
            .map(
              ([k, v]) => `<tr>
            <td style="padding:7px 12px 7px 0;color:#6b8f6b;vertical-align:top;width:220px;">${esc(k)}</td>
            <td style="padding:7px 0;font-weight:600;color:#1e293b;vertical-align:top;">${esc(v)}</td>
          </tr>`
            )
            .join("")}
        </table>
      </div>
      <p>${esc(t.note)}</p>
      <p style="color:#64748b;font-size:13px;margin-top:20px;">${esc(c.contact)}</p>
    </div>
  `);
  try {
    const result = await sendEmail({ to: input.email, subject, html });
    await logEmail(template, input.email, subject, input.orderId, result.id || null);
    return result;
  } catch (e: unknown) {
    await logEmail(template, input.email, subject, input.orderId, null, errorMessage(e));
    throw e;
  }
}

/** Satıcı siparişi ifa edemeyecekse müşteriye bildirim (iade en geç bildirimden 14 gün sonra). */
export const sendSellerCancellationNotice = (input: OrderNoticeInput) => sendOrderNotice("cancelled", "release_seller_cancel", input);

/** İade sağlayıcıdan yapıldığında müşteriye bildirim. */
export const sendRefundCompleted = (input: OrderNoticeInput) => sendOrderNotice("refunded", "release_refund_done", input);

// ═════════════════════════════════════════════════════════════════════
// BIRAKMA TAMAMLANDI (Katılım Sertifikası) ve ÇALIŞMA VİDEOSU — müşteri bildirimleri
// ═════════════════════════════════════════════════════════════════════
// Sonuç vaadi içermez: yapılan iş bildirilir (tohum topları bırakıldı / görüntüler yayımlandı).

export interface ReleaseCertificateInput {
  orderId: string;
  orderNo: string;
  locale: "tr" | "en" | "ru";
  email: string;
  firstName: string;
  certificateName: string;
  siteName: string;
  /** Biçimlendirilmiş adet ("1.000") */
  quantityText: string;
  /** "12 Kasım 2026" biçiminde, hazır metin */
  releasedOnText: string;
  certificateUrl: string;
  orderUrl: string;
  isTest: boolean;
}

const RELEASE_TEXT = {
  tr: {
    subject: (no: string) => `Tohum toplarınız bırakıldı — Katılım Sertifikanız hazır (${no})`,
    title: "Tohum Toplarınız Bırakıldı",
    sub: "Katılım Sertifikanız düzenlendi",
    hello: (n: string) => `Merhaba <strong>${n}</strong>,`,
    intro: (no: string) => `<strong style="font-family:monospace;">${no}</strong> numaralı siparişinize konu tohum topları, seçtiğiniz Proje Uygulama Sahasına dronla bırakılmıştır.`,
    rows: { site: "Proje Uygulama Sahası", quantity: "Bırakılan tohum topu", date: "Bırakma tarihi", name: "Sertifikadaki ad" },
    certificate: "Katılım Sertifikanız çevrim içi olarak düzenlendi. Bağlantıyı dilediğiniz kişilerle paylaşabilirsiniz; sertifikada yalnız seçtiğiniz ad görünür.",
    cta: "Sertifikamı görüntüle",
    next: "Faturanız ayrıca e-postayla gönderilir. Saha, izleme döneminde incelenir; çalışmanın görüntüleri yayımlandığında size haber veririz.",
    order: "Sipariş ayrıntıları",
    contact: "Sorularınız için bu e-postayı yanıtlayabilir veya info@skytechgreen.com adresine yazabilirsiniz.",
    test: "DENEME SİPARİŞİ — gerçek bir bırakma yapılmamıştır.",
  },
  en: {
    subject: (no: string) => `Your seed balls have been released — your certificate is ready (${no})`,
    title: "Your Seed Balls Have Been Released",
    sub: "Your Certificate of Participation has been issued",
    hello: (n: string) => `Hello <strong>${n}</strong>,`,
    intro: (no: string) => `The seed balls under order <strong style="font-family:monospace;">${no}</strong> have been released by drone at the Project Site you chose.`,
    rows: { site: "Project Site", quantity: "Seed balls released", date: "Release date", name: "Name on certificate" },
    certificate: "Your Certificate of Participation has been issued online. You can share the link with anyone you wish; only the name you chose appears on the certificate.",
    cta: "View my certificate",
    next: "Your invoice is sent separately by e-mail. The site is inspected during the monitoring period; we will let you know when footage of the work is published.",
    order: "Order details",
    contact: "For questions, reply to this e-mail or write to info@skytechgreen.com.",
    test: "TEST ORDER — no actual release has taken place.",
  },
} as const;

export async function sendReleaseCertificate(input: ReleaseCertificateInput) {
  const t = RELEASE_TEXT[input.locale === "tr" ? "tr" : "en"];
  const subject = (input.isTest ? "[DENEME] " : "") + t.subject(input.orderNo);
  const rows: [string, string][] = [
    [t.rows.site, input.siteName],
    [t.rows.quantity, input.quantityText],
    [t.rows.date, input.releasedOnText],
    [t.rows.name, input.certificateName],
  ];
  const html = emailLayout(subject, `
    <div class="header">
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.sub)}</p>
    </div>
    <div class="body">
      ${input.isTest ? `<p style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:10px 14px;border-radius:8px;font-weight:600;">${esc(t.test)}</p>` : ""}
      <p>${t.hello(esc(input.firstName))}</p>
      <p>${t.intro(esc(input.orderNo))}</p>
      <div class="info-box">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows
            .map(
              ([k, v]) => `<tr>
            <td style="padding:7px 12px 7px 0;color:#6b8f6b;vertical-align:top;width:190px;">${esc(k)}</td>
            <td style="padding:7px 0;font-weight:600;color:#1e293b;vertical-align:top;">${esc(v)}</td>
          </tr>`
            )
            .join("")}
        </table>
      </div>
      <p>${esc(t.certificate)}</p>
      <p style="text-align:center;margin:24px 0;"><a href="${esc(input.certificateUrl)}" class="btn">${esc(t.cta)}</a></p>
      <p>${esc(t.next)}</p>
      <p style="font-size:13px;"><a href="${esc(input.orderUrl)}" style="color:#059669;">${esc(t.order)}</a></p>
      <p style="color:#64748b;font-size:13px;margin-top:20px;">${esc(t.contact)}</p>
    </div>
  `);
  try {
    const result = await sendEmail({ to: input.email, subject, html });
    await logEmail("release_certificate", input.email, subject, input.orderId, result.id || null);
    return result;
  } catch (e: unknown) {
    await logEmail("release_certificate", input.email, subject, input.orderId, null, errorMessage(e));
    throw e;
  }
}

export interface VideoPublishedInput {
  orderId: string;
  orderNo: string;
  locale: "tr" | "en" | "ru";
  email: string;
  firstName: string;
  siteName: string;
  releasedOnText: string;
  videoUrl: string;
  /** Saha sayfası (yayındaysa); yoksa null */
  siteUrl: string | null;
  orderUrl: string;
  isTest: boolean;
}

const VIDEO_TEXT = {
  tr: {
    subject: (site: string) => `Çalışmanın görüntüleri yayımlandı — ${site}`,
    title: "Çalışmanın Görüntüleri Yayımlandı",
    sub: "Katıldığınız bırakma çalışmasının videosu",
    hello: (n: string) => `Merhaba <strong>${n}</strong>,`,
    intro: (site: string, d: string) => `<strong>${site}</strong> sahasında <strong>${d}</strong> tarihinde yapılan ve sizin de katıldığınız tohum topu bırakma çalışmasının görüntüleri yayımlandı.`,
    cta: "Videoyu izle",
    note: "Video YouTube'da herkese açık yayımlanmıştır; bağlantıyı dilediğiniz kişilerle paylaşabilirsiniz.",
    site: "Saha sayfası",
    order: "Sipariş ayrıntıları",
    contact: "Sorularınız için bu e-postayı yanıtlayabilir veya info@skytechgreen.com adresine yazabilirsiniz.",
    test: "DENEME SİPARİŞİ.",
  },
  en: {
    subject: (site: string) => `Footage of the work has been published — ${site}`,
    title: "Footage of the Work Has Been Published",
    sub: "Video of the release operation you took part in",
    hello: (n: string) => `Hello <strong>${n}</strong>,`,
    intro: (site: string, d: string) => `Footage of the seed ball release carried out at <strong>${site}</strong> on <strong>${d}</strong>, in which you took part, has been published.`,
    cta: "Watch the video",
    note: "The video is published publicly on YouTube; you can share the link with anyone you wish.",
    site: "Site page",
    order: "Order details",
    contact: "For questions, reply to this e-mail or write to info@skytechgreen.com.",
    test: "TEST ORDER.",
  },
} as const;

export async function sendVideoPublished(input: VideoPublishedInput) {
  const t = VIDEO_TEXT[input.locale === "tr" ? "tr" : "en"];
  const subject = (input.isTest ? "[DENEME] " : "") + t.subject(input.siteName);
  const html = emailLayout(subject, `
    <div class="header">
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.sub)}</p>
    </div>
    <div class="body">
      ${input.isTest ? `<p style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:10px 14px;border-radius:8px;font-weight:600;">${esc(t.test)}</p>` : ""}
      <p>${t.hello(esc(input.firstName))}</p>
      <p>${t.intro(esc(input.siteName), esc(input.releasedOnText))}</p>
      <p style="text-align:center;margin:24px 0;"><a href="${esc(input.videoUrl)}" class="btn">${esc(t.cta)}</a></p>
      <p>${esc(t.note)}</p>
      <p style="font-size:13px;">
        ${input.siteUrl ? `<a href="${esc(input.siteUrl)}" style="color:#059669;">${esc(t.site)}</a> · ` : ""}<a href="${esc(input.orderUrl)}" style="color:#059669;">${esc(t.order)}</a>
      </p>
      <p style="color:#64748b;font-size:13px;margin-top:20px;">${esc(t.contact)}</p>
    </div>
  `);
  try {
    const result = await sendEmail({ to: input.email, subject, html });
    await logEmail("release_video", input.email, subject, input.orderId, result.id || null);
    return result;
  } catch (e: unknown) {
    await logEmail("release_video", input.email, subject, input.orderId, null, errorMessage(e));
    throw e;
  }
}

/** Müşteriye giden e-postalardaki bağlantıların kökü: canlıda her zaman asıl alan adı. */
export function publicOrigin(requestOrigin?: string | null): string {
  if (process.env.VERCEL_ENV === "production" || !requestOrigin) return appUrl();
  return requestOrigin;
}
