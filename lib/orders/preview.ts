/**
 * Sipariş önizlemesi — SUNUCU tarafı (service role).
 *
 * 4. adımda gösterilen KESİN tutar, takvim ve siparişe özel hukuki metinler
 * burada hazırlanır. Tutar her zaman sunucuda hesaplanır; belgeler sipariş
 * anında saklanacak kopyayla AYNI şablondan çıkar (lib/legal/documents.ts).
 */
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getProjectSites } from "@/lib/sites/data";
import { buildLegalContext, buildOrderDocuments } from "@/lib/legal/documents";
import type { OrderPreview } from "./client";
import { scheduleFor, trToday, type OrderSchedule } from "./schedule";
import type { OrderPreviewPayload } from "./schema";
import { orderTotals, quoteVersion, type SalesSettings } from "./settings";
import type { SiteSnapshot } from "./types";

export type SiteCheck =
  | { ok: true; site: SiteSnapshot }
  | { ok: false; error: "site_unavailable" | "capacity" | "unavailable" };

/**
 * Saha yayında ve katılıma açık mı, istenen adet karşılanabiliyor mu? Uygunsa
 * sahanın müşteriye gösterilen hâlinin anlık görüntüsünü döner. (Kapasite
 * sayıları dışarı verilmez; kesin ayırma sipariş anında satır kilidiyle yapılır.)
 */
export async function checkSite(landId: string, quantity: number): Promise<SiteCheck> {
  try {
    const supabase = createServiceRoleClient();
    const { data: land, error } = await supabase
      .from("lands")
      .select("id, is_public, status, capacity_seeds, filled_seeds, reserved_seeds, certificate_month, monitoring_month, permit_status, permit_reference, permit_valid_until, permit_verified_at")
      .eq("id", landId)
      .maybeSingle();
    if (error) return { ok: false, error: "unavailable" };
    if (!land || !land.is_public || land.status !== "open") return { ok: false, error: "site_unavailable" };
    const free = (land.capacity_seeds ?? 0) - (land.filled_seeds ?? 0) - (land.reserved_seeds ?? 0);
    if (free < quantity) return { ok: false, error: "capacity" };
    const month = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 4 && v <= 9 ? v : null);
    const certificateMonth = month(land.certificate_month);
    const monitoringMonth = month(land.monitoring_month);
    const validUntil = /^\d{4}-\d{2}-\d{2}/.test(String(land.permit_valid_until ?? "")) ? String(land.permit_valid_until).slice(0, 10) : null;
    const permit =
      land.permit_status === "verified" && validUntil && land.permit_verified_at
        ? { reference: String(land.permit_reference ?? ""), validUntil, verifiedAt: String(land.permit_verified_at) }
        : null;

    // Hukuki metinler Türkçe düzenlenir; saha ve tür adları da Türkçe alınır.
    const site = (await getProjectSites("tr")).find((s) => s.id === landId);
    if (!site || !site.acceptsOrders) return { ok: false, error: "site_unavailable" };
    return {
      ok: true,
      site: {
        id: site.id,
        slug: site.slug,
        name: site.name,
        province: site.province,
        district: site.district,
        areaHectares: site.areaHectares,
        isFireAffected: site.isFireAffected,
        fireYear: site.fireYear,
        workType: site.workType,
        species: site.species.map((s) => ({ slug: s.slug, name: s.name, latinName: s.latinName })),
        certificateMonth,
        monitoringMonth,
        permit,
      },
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

/**
 * Sahanın satış koşulları (sunucu kuralı; önizleme ve sipariş aynı işlevi kullanır):
 *  • sertifika ve izleme teslim ayı seçilmiş (Nisan–Eylül; sertifika izlemeden sonra değil),
 *  • bırakma izni yetkili kişice DOĞRULANMIŞ ve geçerliliği siparişin bırakma son tarihini kapsıyor.
 * Belge numarası girilmiş olması onay sayılmaz (migration 040).
 */
export function siteTermsProblem(site: SiteSnapshot, schedule: OrderSchedule): "delivery_unset" | "permit" | null {
  const c = site.certificateMonth ?? null;
  const m = site.monitoringMonth ?? null;
  if (c === null || m === null || c > m) return "delivery_unset";
  if (!site.permit || site.permit.validUntil < schedule.performanceDeadline) return "permit";
  return null;
}

/** Teklif anahtarının saha kısmı: sezon ve teslim ayları değişirse müşteri önizlemeyi yeniden onaylar. */
export function siteTermsKey(site: SiteSnapshot, schedule: OrderSchedule): string {
  return `${schedule.season.label}.${site.certificateMonth ?? 0}.${site.monitoringMonth ?? 0}`;
}

/** Ödeme öncesi gösterilen, siparişe yazılan ve belgeye basılan teklif sürümü — üçü de bu işlevden. */
export function offerVersion(settings: SalesSettings, site: SiteSnapshot, schedule: OrderSchedule): string {
  return `${quoteVersion(settings)}~${siteTermsKey(site, schedule)}`;
}

/**
 * Tutar ve takvim, sipariş kaydının kullandığı AYNI ayarlardan (sales_settings) hesaplanır;
 * dönen `version` bu ayarları da kapsar (bkz. quoteVersion).
 */
export function buildPreview(input: OrderPreviewPayload, site: SiteSnapshot, settings: SalesSettings, now: Date = new Date()): OrderPreview {
  const totals = orderTotals(input.quantity, settings);
  const schedule = scheduleFor(now, settings.prepDays);
  const context = buildLegalContext({ input, site, totals, schedule, orderDate: trToday(now) });
  return {
    version: offerVersion(settings, site, schedule),
    totals,
    schedule,
    deliveries: context.deliveries,
    documents: buildOrderDocuments(context).map((d) => ({ kind: d.kind, title: d.title, html: d.html })),
  };
}
