/**
 * Hukuki belgeler — ortak veri modeli.
 *
 * Bir belge, düz metin bloklarının sıralı listesidir. AYNI blok listesi hem
 * HTML'i (render-html.ts) hem PDF'i (render-pdf.ts) üretir; iki çıktı bu yüzden
 * her zaman aynı metni taşır. Satır içi biçimlendirme (kalın, bağlantı) bilinçli
 * olarak yoktur: tanımlı terimler sözleşme geleneğindeki gibi BÜYÜK HARFLE yazılır.
 *
 * Şablonlar (templates/*) saf işlevlerdir: aynı girdi → aynı çıktı. İçlerinde
 * `new Date()` ya da ortam okuması yoktur; böylece siparişe özel kopyanın
 * SHA-256 özeti yeniden üretilebilir.
 */
import type { OrderSchedule } from "@/lib/orders/schedule";
import type { BuyerType, DocumentKind } from "@/lib/orders/types";

export type LegalBlock =
  | { type: "heading"; text: string }
  /** Bölüm içi alt başlık (ör. "2.1. Siteyi ziyaret ettiğinizde"). */
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; rows: [label: string, value: string][] }
  | { type: "note"; text: string }
  /** Elle doldurulacak satırlar (Cayma Formu). */
  | { type: "fields"; labels: string[] };

export interface LegalDocument {
  kind: DocumentKind;
  title: string;
  /** Başlığın altındaki künye satırı: sipariş no, tarih, belge sürümü. */
  meta: string[];
  version: string;
  blocks: LegalBlock[];
}

export interface LegalBuyer {
  type: BuyerType;
  /** Bireysel: ad soyad · Kurumsal: ticaret unvanı */
  name: string;
  /** Kurumsalda siparişi veren yetkili; bireyselde null */
  authorizedPerson: string | null;
  /** Kurumsalda "Vergi dairesi / VKN"; bireyselde null (T.C. kimlik no belgeye YAZILMAZ) */
  taxLine: string | null;
  address: string;
  email: string;
  phone: string;
}

export interface LegalSite {
  name: string;
  location: string | null;
  /** "42,5 hektar" */
  area: string | null;
  /** "Yangın Sahası (2023)" */
  fire: string | null;
  workType: string;
  species: string[];
}

export interface LegalContext {
  version: string;
  /** Önizlemede null (sipariş onaylanınca atanır). */
  orderNo: string | null;
  /** Sipariş tarihi — YYYY-MM-DD (İstanbul) */
  orderDate: string;
  buyer: LegalBuyer;
  site: LegalSite;
  quantity: number;
  unitPriceKurus: number;
  totalKurus: number;
  vatRate: number;
  vatKurus: number;
  certificateName: string;
  schedule: OrderSchedule;
}
