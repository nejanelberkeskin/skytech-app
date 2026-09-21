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
  taxOffice: "Kahramankazan",
  taxId: "7721661218",
  address: {
    line: "Macun Mahallesi Batı Bulvarı ATB İş Merkezi I Blok No: 244",
    district: "Yenimahalle",
    province: "Ankara",
    country: "Türkiye",
  },
  email: "info@skytechgreen.com",
  website: "https://skytechgreen.com",
  /** Bekleniyor — mesafeli sözleşme ve "İletişim" sayfası için zorunlu. */
  mersis: null as string | null,
  kep: null as string | null,
  phone: null as string | null,
  tradeRegistryNo: null as string | null,
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
