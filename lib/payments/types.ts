/**
 * Ödeme sağlayıcı katmanı — sipariş çekirdeği sağlayıcıdan bağımsız kalsın diye.
 *
 * Akış: init() → müşteri sağlayıcının barındırdığı sayfaya gider → dönüşte sunucu
 * retrieve() ile sonucu SAĞLAYICIDAN KENDİSİ sorgular ve tutarı siparişle
 * karşılaştırır. İstemciden gelen "başarılı" bilgisine hiçbir zaman güvenilmez.
 * Kart verisi sunucumuza gelmez; saklanan yalnız sağlayıcı kimlikleridir.
 */
export interface PaymentInitInput {
  orderId: string;
  orderNo: string;
  amountKurus: number;
  locale: "tr" | "en" | "ru";
  /** Sağlayıcıya bildirilen alıcı kimliği: üye kimliği ya da misafir için siparişten türetilmiş değer */
  buyerId: string;
  buyer: { firstName: string; lastName: string; email: string; phone: string; ip: string | null };
  /** Fatura adresindeki ad: kurumsalda şirket unvanı; null ise alıcının adı soyadı */
  billingName: string | null;
  /** Fatura adresi (sağlayıcılar zorunlu tutar) */
  address: { line: string; district: string; province: string; postalCode: string | null };
  description: string;
  /** Sağlayıcının sonucu bildireceği mutlak adres */
  callbackUrl: string;
}

export type PaymentInitResult =
  | { ok: true; token: string; redirectUrl: string }
  | { ok: false; error: string };

export type PaymentOutcome =
  | {
      ok: true;
      status: "success";
      paymentId: string;
      paidKurus: number;
      /** Sağlayıcının bildirdiği sipariş referansı (bizim sipariş numaramız); varsa siparişle karşılaştırılır */
      reference?: string;
      meta: Record<string, unknown>;
    }
  | { ok: true; status: "failure"; reason: string; meta: Record<string, unknown> }
  | { ok: false; error: string };

export interface RefundInput {
  paymentId: string;
  /** Her zaman siparişin TAMAMI (kısmi iade yok) */
  amountKurus: number;
  orderNo: string;
  /** Ödeme anında saklanan `payment_meta` — sağlayıcı gereken kimlikleri buradan okur */
  meta: Record<string, unknown> | null;
  ip: string | null;
}

export type RefundResult =
  | { ok: true; refundId: string; /** iade mi, aynı gün iptali mi */ method: "refund" | "cancel" }
  | { ok: false; error: string };

export interface PaymentProvider {
  readonly name: "mock" | "iyzico";
  /** Bu sağlayıcıyla oluşan siparişler deneme siparişi mi? (test kipi / deneme anahtarları) */
  readonly isTest: boolean;
  init(input: PaymentInitInput): Promise<PaymentInitResult>;
  retrieve(token: string): Promise<PaymentOutcome>;
  refund(input: RefundInput): Promise<RefundResult>;
}
