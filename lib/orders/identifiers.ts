/**
 * Sipariş numarası ve sertifika kodu üretimi — YALNIZ SUNUCU (node:crypto).
 * TCKN / VKN denetimi istemcide de gerektiği için ayrı: ./tax-ids.ts
 *
 * Numaralarda karıştırılan karakterler (0/O, 1/I/L) kullanılmaz: telefonda
 * okunur, elle yazılır. Benzersizlik veritabanı kısıtıyla güvence altındadır;
 * çakışmada çağıran yeniden üretir.
 */
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 karakter

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** SG-2026-XXXXXX — yıl, siparişin oluşturulduğu (İstanbul) yılıdır. */
export const ORDER_NO_RE = /^SG-\d{4}-[A-HJKMNP-Z2-9]{6}$/;

export function generateOrderNo(at: Date = new Date()): string {
  const year = new Date(at.getTime() + 3 * 60 * 60 * 1000).getUTCFullYear();
  return `SG-${year}-${randomCode(6)}`;
}

/** SG-XXXX-XXXX — biçim lib/certificates/types.ts → CERTIFICATE_CODE_RE ile aynıdır. */
export function generateCertificateCode(): string {
  return `SG-${randomCode(4)}-${randomCode(4)}`;
}
