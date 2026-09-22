/**
 * Satıcı künyesi — TEK KAYNAK.
 *
 * Ön bilgilendirme formu, mesafeli hizmet sözleşmesi, fatura dipnotları,
 * e-posta altlıkları ve "İletişim" sayfasındaki zorunlu bilgiler buradan okunur.
 * `null` alanlar müşteriden bekleniyor; açılış kontrol listesinde (plan §10)
 * hepsinin dolu olması şarttır — `missingCompanyFields()` bunu denetler.
 */
export const COMPANY = {
  brand: "Skytech Green",
  legalName: "SKYTECH HAVACILIK VE TEKNOLOJİ SANAYİ TİCARET ANONİM ŞİRKETİ",
  /** Kullanıcı teyidi: 22 Eylül 2026. */
  taxOffice: "Kahramankazan",
  taxId: "7721661218",
  /**
   * Şirket adresi — kullanıcı teyidi, 22 Eylül 2026. Sözleşmeler ve hukuki metinlerin yanında sitenin alt
   * bilgisi, İletişim sayfası ve yapısal veri de buradan okur (`lib/seo.ts → ORG_ADDRESS`). Değişirse yalnız
   * burası güncellenir; sözleşme metni değiştiği için belge sürümü de artırılır. Harita noktası: `ORG_GEO`.
   */
  address: {
    line: "Macun Mah. Batı Bulvarı ATB İş Merkezi I Blok No: 244",
    district: "Yenimahalle",
    province: "Ankara",
    country: "Türkiye",
  },
  email: "info@skytechgreen.com",
  website: "https://skytechgreen.com",
  phone: "0850 308 2600" as string | null,
  /** Sicil bilgileri (22 Eylül 2026, hukuk paketiyle bildirildi) — yayımdan önce sicil belgesiyle karşılaştırılmalı. */
  mersis: "0772166121800001" as string | null,
  tradeRegistryNo: "510174" as string | null,
  tradeRegistryOffice: "Ankara Ticaret Sicili Müdürlüğü" as string | null,
  /** Ulusal Elektronik Tebligat Sistemi adresi — resmî tebligat içindir; KEP değildir, müşteri kanalı olarak GÖSTERİLMEZ. */
  uets: "25838-72218-78313" as string | null,
  /** Bekleniyor — mesafeli sözleşme ve "İletişim" sayfası için zorunlu. */
  kep: null as string | null,
  /** Mensubu olunan meslek odası (6563 sayılı Kanun gereği sitede belirtilir) — bekleniyor. */
  chamber: null as string | null,
} as const;

export function companyAddressLine(): string {
  const a = COMPANY.address;
  return `${a.line}, ${a.district} / ${a.province}`;
}

/** Açılıştan önce doldurulması gereken alanlar. */
export function missingCompanyFields(): string[] {
  return (["mersis", "kep", "phone", "tradeRegistryNo", "tradeRegistryOffice", "chamber"] as const).filter((k) => !COMPANY[k]);
}

/** Ticaret sicil satırı: "Ankara Ticaret Sicili Müdürlüğü / 510174" (müdürlük teyit edilince eklenir). */
export function tradeRegistryLine(): string | null {
  return COMPANY.tradeRegistryNo ? [COMPANY.tradeRegistryOffice, COMPANY.tradeRegistryNo].filter(Boolean).join(" / ") : null;
}
