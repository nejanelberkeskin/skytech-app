import { after, NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { paymentResultPath } from "@/lib/orders/access";
import { sendPaidOrderEmails } from "@/lib/orders/after-payment";
import { completePayment } from "@/lib/orders/payment-flow";
import { getPaymentProvider } from "@/lib/payments";

/**
 * POST /api/payment/donus — iyzico Ödeme Formu'nun dönüş adresi (tohum topu bıraktırma siparişleri).
 *
 * iyzico, müşterinin tarayıcısını buraya BAŞKA KAYNAKTAN bir form POST'uyla gönderir; gövdede
 * yalnız `token` vardır. Bu yüzden uç CSRF denetiminden muaftır (middleware) — güvenlik gövdeye
 * değil şuna dayanır: sonuç o belirteçle iyzico'dan SUNUCUDAN sorgulanır, tahsil edilen tutar ve
 * sipariş numarası siparişle karşılaştırılır, durum koşullu UPDATE ile yalnız bir kez değişir.
 * Uydurma ya da yinelenen bir istek hiçbir siparişi "ödendi" yapamaz.
 *
 * Yanıt her zaman 303 yönlendirmedir: sonuç sayfası ya da (sipariş bulunamadıysa) genel hata sayfası.
 * Oturum çerezi bu istekte gelmez (SameSite); gerekmez de — sonuç sayfasına imzalı belirteçle gidilir.
 */
export const runtime = "nodejs";

const TOKEN_RE = /^[A-Za-z0-9._~-]{8,200}$/;

const to = (req: NextRequest, path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin), 303);

export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider || provider.name !== "iyzico") return to(req, "/odeme/hata");

  const limited = rateLimit(`odeme-donus:${getClientIP(req)}`, 60, 10 * 60_000);
  if (limited) return to(req, "/odeme/hata");

  const form = await req.formData().catch(() => null);
  const raw = form?.get("token");
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!TOKEN_RE.test(token)) return to(req, "/odeme/hata");

  try {
    const result = await completePayment(token, provider);
    if (!result.ok) {
      // Ayrıntı denetim izinde; burada kişisel veri ya da belirteç loglanmaz.
      console.error("[odeme] dönüş işlenemedi:", result.error);
      return to(req, "/odeme/hata");
    }
    const order = result.order;
    if (result.outcome === "paid") {
      const origin = req.nextUrl.origin;
      after(() => sendPaidOrderEmails(order, origin));
    }
    return to(req, paymentResultPath(order.order_no, order.id, order.locale));
  } catch (e) {
    console.error("[odeme] dönüş hatası:", e instanceof Error ? e.message : e);
    return to(req, "/odeme/hata");
  }
}

/** Adres elle açılırsa (GET) ödeme bilgisi yoktur. */
export function GET(req: NextRequest) {
  return to(req, "/sahalar");
}
