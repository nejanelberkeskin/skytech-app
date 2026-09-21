/**
 * Sipariş önizlemesi — SUNUCU tarafı (service role).
 *
 * 4. adımda gösterilen KESİN tutar, takvim ve siparişe özel hukuki metinler
 * burada hazırlanır. Tutar her zaman sunucuda hesaplanır; belgeler sipariş
 * anında saklanacak kopyayla AYNI şablondan çıkar (lib/legal/documents.ts).
 */
import { createServiceRoleClient } from "@/lib/supabase/server";
import { UNIT_PRICE_KURUS } from "@/lib/pricing";
import { getProjectSites } from "@/lib/sites/data";
import { buildLegalContext, buildOrderDocuments } from "@/lib/legal/documents";
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/version";
import type { OrderPreview } from "./client";
import { scheduleFor, trToday } from "./schedule";
import type { OrderPreviewPayload } from "./schema";
import type { SiteSnapshot } from "./types";

/** [MM] teyitli: KDV %20. Sipariş çekirdeği bağlanınca sales_settings.vat_rate'ten okunacak. */
const VAT_RATE = 20;

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
      .select("id, is_public, status, capacity_seeds, filled_seeds, reserved_seeds")
      .eq("id", landId)
      .maybeSingle();
    if (error) return { ok: false, error: "unavailable" };
    if (!land || !land.is_public || land.status !== "open") return { ok: false, error: "site_unavailable" };
    const free = (land.capacity_seeds ?? 0) - (land.filled_seeds ?? 0) - (land.reserved_seeds ?? 0);
    if (free < quantity) return { ok: false, error: "capacity" };

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
      },
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export function totalsFor(quantity: number): OrderPreview["totals"] {
  const totalKurus = quantity * UNIT_PRICE_KURUS;
  // KDV dâhil tutarın içindeki vergi: toplam × oran / (100 + oran), kuruşa yuvarlanır.
  const vatKurus = Math.round((totalKurus * VAT_RATE) / (100 + VAT_RATE));
  return { quantity, unitPriceKurus: UNIT_PRICE_KURUS, totalKurus, vatKurus, vatRate: VAT_RATE };
}

export function buildPreview(input: OrderPreviewPayload, site: SiteSnapshot, now: Date = new Date()): OrderPreview {
  const totals = totalsFor(input.quantity);
  const schedule = scheduleFor(now);
  const context = buildLegalContext({ input, site, totals, schedule, orderDate: trToday(now) });
  return {
    version: LEGAL_DOCUMENTS_VERSION,
    totals,
    schedule,
    documents: buildOrderDocuments(context).map((d) => ({ kind: d.kind, title: d.title, html: d.html })),
  };
}
