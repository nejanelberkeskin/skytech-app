/**
 * Denetim kaydı okuma yardımcıları. Hassas alanlar ekrana ve dışa aktarmaya çıkmaz:
 * parola, belirteç, anahtar, kart verisi ve tam kimlik/vergi numarası maskelenir (web-brifler/19 §8).
 */
const SECRET_KEYS = /(password|passwd|secret|token|apikey|api_key|authorization|cookie|session|card|cvv|iban)/i;
const IDENTITY_KEYS = /(tckn|tc_kimlik|identity|vkn|tax_?(no|number)|vergi)/i;

const maskIdentity = (value: string) => (value.length <= 4 ? "••••" : `${"•".repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`);

/** Derinliği sınırlı, tipi korunan maskeleme. Bilinmeyen yapı olduğu gibi bırakılmaz, dizeye çevrilir. */
export function maskAuditDetails(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.length > 2_000 ? `${value.slice(0, 2_000)}…` : value;
  if (Array.isArray(value)) return depth >= 4 ? "[…]" : value.slice(0, 100).map((v) => maskAuditDetails(v, depth + 1));
  if (typeof value === "object") {
    if (depth >= 4) return "{…}";
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.test(key)) out[key] = "••••";
      else if (IDENTITY_KEYS.test(key)) out[key] = typeof raw === "string" ? maskIdentity(raw) : "••••";
      else out[key] = maskAuditDetails(raw, depth + 1);
    }
    return out;
  }
  return null;
}
