/**
 * Katılım Sertifikası — herkese açık veri sözleşmesi.
 *
 * Sertifika bir HİZMETİN yapıldığını belgeler; bağış makbuzu, karbon belgesi ya
 * da sahada ad/mülkiyet hakkı değildir. Herkese açık sayfada yalnız alıcının
 * kendi seçtiği görünen ad yer alır; e-posta, telefon, fatura bilgisi ASLA çıkmaz.
 */
import type { ProductType } from "@/lib/products";
import type { WorkType } from "@/lib/sites/types";

export type CertificateStatus = "valid" | "cancelled";

/** Biçim: SG-XXXX-XXXX (karıştırılan karakterler yok: 0/O, 1/I/L). */
export const CERTIFICATE_CODE_RE = /^SG-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

/** Sertifikada görünen ad: 2–60 karakter. */
export const CERTIFICATE_NAME = { min: 2, max: 60 } as const;

export interface CertificateSpecies {
  slug: string;
  name: string;
  latinName: string;
}

export interface PublicCertificate {
  code: string;
  status: CertificateStatus;
  /** Alıcının seçtiği, sertifikada görünen ad. */
  displayName: string;
  /** Bırakılan adet (birim ürün tipine göre: tohum ya da tohum topu). */
  quantity: number;
  siteName: string;
  /** Saha sayfası varsa slug'ı; yoksa null. */
  siteSlug: string | null;
  province: string | null;
  workType: WorkType;
  /** Bırakılan ürün (sipariş anındaki saha kopyasından). */
  productType: ProductType;
  species: CertificateSpecies[];
  /** Bırakma tarihi — ISO (YYYY-MM-DD). */
  releasedOn: string;
  /** Sertifikanın düzenlenme tarihi — ISO (YYYY-MM-DD). */
  issuedOn: string;
  /** Çalışma videosu yayımlandıysa bağlantısı. */
  videoUrl: string | null;
}
