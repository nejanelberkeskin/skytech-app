/** Saklı belge/onay hazırlığı: eksik veya okunamayan kayıt ödeme izni değildir. */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DOCUMENT_KINDS, type ReleaseOrderRow } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === "string");

function validBlock(value: unknown): boolean {
  if (!record(value)) return false;
  switch (value.type) {
    case "heading": case "subheading": case "paragraph": case "note": return typeof value.text === "string";
    case "list": return strings(value.items);
    case "fields": return strings(value.labels);
    case "table": return Array.isArray(value.rows) && value.rows.every(row => strings(row) && row.length === 2);
    default: return false;
  }
}

/**
 * Yalnız değişmez, saklı kaynak kontrol edilir; güncel şablon/CSS ile eski belge
 * yeniden üretilmez. Ödeme durumu, süre ve satış kapısı çağıranın sorumluluğudur.
 */
export async function isOrderPrepared(
  supabase: SupabaseClient,
  order: Pick<ReleaseOrderRow, "id" | "documents_version" | "consents" | "buyer_type">,
): Promise<boolean> {
  try {
    const [documents, events] = await Promise.all([
      supabase.from("order_documents").select("kind, template_version, locale, title, html, sha256").eq("order_id", order.id),
      supabase.from("order_events").select("type, data").eq("order_id", order.id)
        .in("type", ["order_created", "consent_recorded", "documents_generated"]),
    ]);
    if (documents.error || events.error || !Array.isArray(documents.data) || !Array.isArray(events.data)) return false;
    if (documents.data.length !== DOCUMENT_KINDS.length || !order.documents_version || !record(order.consents)) return false;
    const storedEvents = events.data as { type: string; data: unknown }[];
    const oneEvent = (type: string) => {
      const found = storedEvents.filter(event => event.type === type);
      return found.length === 1 && record(found[0].data) ? found[0].data : null;
    };
    if (!oneEvent("order_created")) return false;
    const consentEvent = oneEvent("consent_recorded");
    const snapshot = oneEvent("documents_generated");
    if (!consentEvent || !record(consentEvent.consents) || !snapshot || snapshot.version !== order.documents_version
      || !Array.isArray(snapshot.documents) || snapshot.documents.length !== DOCUMENT_KINDS.length) return false;
    const required = ["preInfo", "contract", "kvkkRead", ...(order.buyer_type === "corporate" ? ["corporateAuthority"] : [])];
    for (const key of required) {
      const consent = (order.consents as Record<string, unknown>)[key];
      const saved = consentEvent.consents[key];
      if (!record(consent) || !record(saved) || consent.granted !== true || saved.granted !== true
        || consent.version !== order.documents_version || saved.version !== consent.version
        || typeof consent.at !== "string" || !Number.isFinite(Date.parse(consent.at)) || saved.at !== consent.at) return false;
    }
    for (const kind of DOCUMENT_KINDS) {
      const copies = documents.data.filter(row => row.kind === kind);
      const sources = snapshot.documents.filter((source: unknown) => record(source) && source.kind === kind);
      if (copies.length !== 1 || sources.length !== 1) return false;
      const doc = copies[0], source = sources[0];
      if (!record(source) || doc.template_version !== order.documents_version || doc.locale !== "tr"
        || typeof doc.title !== "string" || !doc.title || source.title !== doc.title
        || typeof doc.html !== "string" || !doc.html || typeof doc.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(doc.sha256)
        || createHash("sha256").update(doc.html, "utf8").digest("hex") !== doc.sha256 || source.sha256 !== doc.sha256
        || !strings(source.meta) || !Array.isArray(source.blocks) || !source.blocks.length || !source.blocks.every(validBlock)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
