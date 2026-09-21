/**
 * DENEME ödeme sağlayıcısı — sanal POS başvurusu sonuçlanmadan akışı uçtan uca
 * sınamak için. Gerçek para hareketi yoktur; oluşan siparişler `is_test=true` olur.
 *
 * Güvenlik: canlı dağıtımda (VERCEL_ENV=production) HİÇBİR KOŞULDA çalışmaz —
 * `getPaymentProvider()` onu seçmez, bu dosyadaki işlevler de ayrıca reddeder.
 * "Barındırılan ödeme sayfası" yerine `/odeme/deneme/<belirteç>` sayfası açılır;
 * orada seçilen sonuç sunucuda bellek dışı bir yerde tutulmaz: belirtecin kendisi
 * imzalıdır ve sonuç, dönüş ucuna imzalı olarak taşınır.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PaymentInitInput, PaymentInitResult, PaymentOutcome, PaymentProvider, RefundResult } from "./types";

export const mockAllowed = () => process.env.VERCEL_ENV !== "production";

function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "yerel-deneme";
  return createHash("sha256").update(`mock-pay:${key}`).digest("hex");
}
const sign = (text: string) => createHmac("sha256", secret()).update(text).digest("base64url").slice(0, 24);

/** Belirteç: <rastgele>.<tutar>.<imza> — tutar belirtecin içinde, imzayla korunur. */
function makeToken(amountKurus: number): string {
  const nonce = randomBytes(12).toString("base64url");
  const body = `${nonce}.${amountKurus}`;
  return `${body}.${sign(body)}`;
}

export function parseMockToken(token: string): { amountKurus: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const amountKurus = Number(parts[1]);
  return Number.isInteger(amountKurus) && amountKurus > 0 ? { amountKurus } : null;
}

/** Deneme sayfasında seçilen sonucun imzası — dönüş ucunda doğrulanır. */
export function signMockOutcome(token: string, outcome: "success" | "failure"): string {
  return sign(`${token}:${outcome}`);
}

export function verifyMockOutcome(token: string, outcome: string, signature: string): outcome is "success" | "failure" {
  if (outcome !== "success" && outcome !== "failure") return false;
  const expected = Buffer.from(signMockOutcome(token, outcome));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** retrieve() sonucu: dönüş ucu, doğruladığı sonucu bu haritaya yazar (istek ömrü kadar). */
const outcomes = new Map<string, "success" | "failure">();
export function recordMockOutcome(token: string, outcome: "success" | "failure") {
  outcomes.set(token, outcome);
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  isTest: true,

  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    if (!mockAllowed()) return { ok: false, error: "mock_disabled" };
    const token = makeToken(input.amountKurus);
    const prefix = input.locale === "tr" ? "" : `/${input.locale}`;
    return { ok: true, token, redirectUrl: `${prefix}/odeme/deneme/${encodeURIComponent(token)}` };
  },

  async retrieve(token: string): Promise<PaymentOutcome> {
    if (!mockAllowed()) return { ok: false, error: "mock_disabled" };
    const parsed = parseMockToken(token);
    if (!parsed) return { ok: false, error: "invalid_token" };
    const outcome = outcomes.get(token);
    outcomes.delete(token);
    if (!outcome) return { ok: false, error: "no_outcome" };
    return outcome === "success"
      ? {
          ok: true,
          status: "success",
          paymentId: `MOCK-${token.slice(0, 10)}`,
          paidKurus: parsed.amountKurus,
          meta: { provider: "mock", threeDS: "simulated", cardLast4: "0000" },
        }
      : { ok: true, status: "failure", reason: "Deneme: ödeme reddedildi", meta: { provider: "mock" } };
  },

  async refund(): Promise<RefundResult> {
    if (!mockAllowed()) return { ok: false, error: "mock_disabled" };
    return { ok: true, refundId: `MOCK-REFUND-${randomBytes(6).toString("hex")}`, method: "refund" };
  },
};
