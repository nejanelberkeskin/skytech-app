/**
 * Katılım Sertifikası — SUNUCU tarafı okuma.
 *
 * Kaynak: `release_orders` (sertifika kodu bırakma tamamlanınca verilir — lib/orders/certificates.ts).
 * Herkese açık sayfaya yalnız alıcının seçtiği görünen ad, saha ve bırakma bilgisi çıkar; e-posta,
 * telefon, fatura ve sipariş numarası ASLA çıkmaz. İade edilmiş siparişin sertifikası "iptal" görünür.
 * Canlı sitede deneme siparişlerinin sertifikaları gösterilmez. Geliştirmede iki ÖRNEK kod da çalışır.
 */
import { publicCertificateName } from "./publication";
import type { OrderConsents } from "@/lib/orders/types";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { trToday } from "@/lib/orders/schedule";
import type { SiteSnapshot } from "@/lib/orders/types";
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
    const sample = FIXTURES.find((c) => c.code === code);
    if (sample) return sample;
  }

  try {
    const supabase = createServiceRoleClient();
    let query = supabase
      .from("release_orders")
      .select("certificate_code, certificate_name, consents, buyer_first_name, buyer_last_name, certificate_issued_at, certificate_cancelled_at, quantity, site_snapshot, land_id, batch_id, released_at, is_test")
      .eq("certificate_code", code);
    if (process.env.VERCEL_ENV === "production") query = query.eq("is_test", false);
    const { data: order, error } = await query.maybeSingle();
    if (error || !order || !order.certificate_issued_at) return null;

    const [batch, land] = await Promise.all([
      order.batch_id
        ? supabase.from("release_batches").select("released_on, video_url, video_published_at").eq("id", order.batch_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("lands").select("slug, is_public").eq("id", order.land_id).maybeSingle(),
    ]);
    const site = order.site_snapshot as SiteSnapshot;
    const batchRow = batch.data as { released_on: string | null; video_url: string | null; video_published_at: string | null } | null;
    const landRow = land.data as { slug: string | null; is_public: boolean | null } | null;
    const releasedOn = batchRow?.released_on ?? (order.released_at ? trToday(new Date(order.released_at as string)) : null);
    if (!releasedOn) return null;

    return {
      code,
      status: order.certificate_cancelled_at ? "cancelled" : "valid",
      displayName: publicCertificateName({ certificate_name: order.certificate_name as string, buyer_first_name: order.buyer_first_name as string, buyer_last_name: order.buyer_last_name as string, consents: order.consents as OrderConsents }),
      quantity: order.quantity as number,
      siteName: site.name,
      siteSlug: landRow?.is_public && landRow.slug ? landRow.slug : null,
      province: site.province,
      workType: site.workType,
      species: site.species.map((sp) => ({ slug: sp.slug, name: sp.name, latinName: sp.latinName })),
      releasedOn,
      issuedOn: trToday(new Date(order.certificate_issued_at as string)),
      videoUrl: batchRow?.video_published_at && batchRow.video_url ? batchRow.video_url : null,
    };
  } catch (e) {
    console.error("[sertifika] okunamadı:", e instanceof Error ? e.message : e);
    return null;
  }
}
