/**
 * Hukuk sayfalarında ve örnek PDF'lerde kullanılan ÖRNEK bağlam.
 *
 * Herkese açık "Mesafeli Satış Sözleşmesi" ve "Ön Bilgilendirme Formu" sayfaları,
 * siparişte kullanılan AYNI şablondan üretilir; kişiye özel alanlar köşeli
 * ayraçlı yer tutucularla doldurulur. Böylece sitede yayımlanan örnek metin ile
 * müşteriye giden sözleşme birbirinden ayrışamaz.
 */
import { UNIT_PRICE_KURUS } from "@/lib/pricing";
import { DEFAULT_PREP_DAYS, scheduleFor, trToday } from "@/lib/orders/schedule";
import type { LegalContext } from "./types";
import { LEGAL_DOCUMENTS_VERSION } from "./version";

const SAMPLE_QUANTITY = 100;

/** Örnekteki bedel, KDV ve takvim satış ayarlarından gelir (çağıran okur); verilmezse varsayılanlar. */
export interface SampleTerms {
  unitPriceKurus: number;
  vatRate: number;
  prepDays: number;
}

const DEFAULT_TERMS: SampleTerms = { unitPriceKurus: UNIT_PRICE_KURUS, vatRate: 20, prepDays: DEFAULT_PREP_DAYS };

export function sampleLegalContext(now: Date = new Date(), terms: SampleTerms = DEFAULT_TERMS): LegalContext {
  const { unitPriceKurus, vatRate } = terms;
  const totalKurus = SAMPLE_QUANTITY * unitPriceKurus;
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
    unitPriceKurus,
    totalKurus,
    vatRate,
    vatKurus: Math.round((totalKurus * vatRate) / (100 + vatRate)),
    certificateName: "[Alıcının belirlediği ad]",
    schedule: scheduleFor(now, terms.prepDays),
  };
}

export const SAMPLE_NOTICE =
  "Bu sayfa örnek metindir. Köşeli ayraç içindeki alanlar ile adet, tutar ve tarihler; siparişiniz sırasında sizin bilgilerinizle doldurulur. Siparişinize özel belge, onayınızdan önce ekranda gösterilir ve sipariş teyidiyle birlikte e-posta adresinize gönderilir.";
