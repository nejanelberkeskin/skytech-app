/**
 * Katılım Sertifikası — SUNUCU tarafı okuma.
 *
 * Yeni sipariş tabloları (migration 016) gelene kadar gerçek kaynak yoktur:
 * geliştirmede iki ÖRNEK sertifika döner, canlıda hiçbir kod bulunmaz (→ 404).
 * Sipariş çekirdeği yayına girince yalnız bu dosyanın içi değişir; sözleşme
 * (`PublicCertificate`) ve çağıranlar aynı kalır.
 */
import { CERTIFICATE_CODE_RE, type PublicCertificate } from "./types";

const FIXTURES: PublicCertificate[] = [
  {
    code: "SG-RNEK-2345",
    status: "valid",
    displayName: "Örnek Ad Soyad",
    quantity: 200,
    siteName: "ÖRNEK · Çanakkale Proje Uygulama Sahası",
    siteSlug: "ornek-canakkale-proje-uygulama-sahasi",
    province: "Çanakkale",
    workType: "ormanlastirma_genclestirme",
    species: [{ slug: "kizilcam", name: "Kızılçam", latinName: "Pinus brutia" }],
    releasedOn: "2026-11-14",
    issuedOn: "2026-11-16",
    videoUrl: null,
  },
  {
    code: "SG-RNEK-6789",
    status: "cancelled",
    displayName: "Örnek Şirket Sürdürülebilirlik Ekibi — İstanbul Genel Müdürlük",
    quantity: 5000,
    siteName: "ÖRNEK · İzmir Proje Uygulama Sahası",
    siteSlug: null,
    province: "İzmir",
    workType: "genclestirme",
    species: [
      { slug: "kizilcam", name: "Kızılçam", latinName: "Pinus brutia" },
      { slug: "sedir", name: "Sedir (Toros Sediri)", latinName: "Cedrus libani" },
    ],
    releasedOn: "2027-01-22",
    issuedOn: "2027-01-25",
    videoUrl: "https://www.youtube.com/watch?v=ornek",
  },
];

export function normalizeCertificateCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CERTIFICATE_CODE_RE.test(code) ? code : null;
}

export async function getPublicCertificate(rawCode: string): Promise<PublicCertificate | null> {
  const code = normalizeCertificateCode(rawCode);
  if (!code) return null;
  if (process.env.NODE_ENV !== "production") {
    return FIXTURES.find((c) => c.code === code) ?? null;
  }
  // Canlı kaynak migration 016 ile bağlanacak.
  return null;
}
