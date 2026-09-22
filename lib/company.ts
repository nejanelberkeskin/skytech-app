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
  /** Kullanıcının 21 Eylül 2026 bildirimi. Adres Yenimahalle olduğundan vergi levhasıyla teyit edilmeli. */
  taxOffice: "Kahramankazan",
  taxId: "7721661218",
  /**
   * Şirketin sözleşmelerde ve hukuki metinlerde kullanılan adresi — kullanıcı teyidi, 22 Eylül 2026.
   * Sitenin alt bilgisi ve İletişim sayfasındaki "Saray Mah. 60 Cad. No: 22, Kahramankazan" adresi
   * (Google İşletme kaydı) bundan FARKLIDIR. Değişirse yalnız burası güncellenir (ve belge sürümü artırılır).
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
  return (["mersis", "kep", "phone", "tradeRegistryNo", "chamber"] as const).filter((k) => !COMPANY[k]);
}

/** Ticaret sicil satırı: "Ankara Ticaret Sicili Müdürlüğü / 510174" (müdürlük teyit edilince eklenir). */
export function tradeRegistryLine(): string | null {
  return COMPANY.tradeRegistryNo ? `Ankara / ${COMPANY.tradeRegistryNo}` : null;
}
