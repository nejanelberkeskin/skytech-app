/**
 * Hukuk sayfalarında ve örnek PDF'lerde kullanılan ÖRNEK bağlam.
 *
 * Herkese açık "Mesafeli Satış Sözleşmesi" ve "Ön Bilgilendirme Formu" sayfaları,
 * siparişte kullanılan AYNI şablondan üretilir; kişiye özel alanlar köşeli
 * ayraçlı yer tutucularla doldurulur. Böylece sitede yayımlanan örnek metin ile
 * müşteriye giden sözleşme birbirinden ayrışamaz.
 */
import { UNIT_PRICE_KURUS } from "@/lib/pricing";
import { scheduleFor, trToday } from "@/lib/orders/schedule";
import type { LegalContext } from "./types";
import { LEGAL_DOCUMENTS_VERSION } from "./version";

const SAMPLE_QUANTITY = 100;
const VAT_RATE = 20;

export function sampleLegalContext(now: Date = new Date()): LegalContext {
  const totalKurus = SAMPLE_QUANTITY * UNIT_PRICE_KURUS;
  return {
    version: LEGAL_DOCUMENTS_VERSION,
    orderNo: null,
    orderDate: trToday(now),
    buyer: {
      type: "individual",
      name: "[Alıcının adı soyadı / unvanı]",
      authorizedPerson: null,
      taxLine: null,
      address: "[Alıcının fatura adresi]",
      email: "[Alıcının e-posta adresi]",
      phone: "[Alıcının telefon numarası]",
    },
    site: {
      name: "[Alıcının seçtiği Proje Uygulama Sahası]",
      location: "[İlçe, il]",
      area: "[Sahanın alanı, hektar]",
      fire: null,
      workType: "Ormanlaştırma – Gençleştirme",
      species: ["[Sahaya bırakılan tür]"],
    },
    quantity: SAMPLE_QUANTITY,
    unitPriceKurus: UNIT_PRICE_KURUS,
    totalKurus,
    vatRate: VAT_RATE,
    vatKurus: Math.round((totalKurus * VAT_RATE) / (100 + VAT_RATE)),
    certificateName: "[Alıcının belirlediği ad]",
    schedule: scheduleFor(now),
  };
}

export const SAMPLE_NOTICE =
  "Bu sayfa örnek metindir. Köşeli ayraç içindeki alanlar ile adet, tutar ve tarihler; siparişiniz sırasında sizin bilgilerinizle doldurulur. Siparişinize özel belge, onayınızdan önce ekranda gösterilir ve sipariş teyidiyle birlikte e-posta adresinize gönderilir.";
