import { permissionLabel } from "./labels";
// Only the public contract's actionable fields may be displayed; never dump an error payload.
export function accessErrorDetails(code: string, details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details))
    return [];
  const d = details as Record<string, unknown>;
  const strings = (key: string) =>
    Array.isArray(d[key])
      ? [
          ...new Set(
            (d[key] as unknown[]).filter(
              (v): v is string => typeof v === "string" && v.length > 0,
            ),
          ),
        ]
      : [];
  const list = (key: string, title: string, permissions = true) => {
    const values = strings(key);
    return values.length
      ? [
          `${title}: ${values.map((v) => (permissions ? permissionLabel(v) : v)).join(", ")}`,
        ]
      : [];
  };
  if (code === "escalation_blocked")
    return list("missing", "Verilemeyen izinler");
  if (code === "invalid_permissions")
    return list("unknown", "Bilinmeyen izinler");
  if (code === "invalid_scope")
    return list("missingSiteIds", "Bulunamayan saha kimlikleri", false);
  if (code === "global_scope_conflict") {
    const lines = list(
      "permissions",
      "Tüm kayıtlar kapsamı gerektiren izinler",
    );
    for (const [key, title] of [
      ["assignments", "Dar kapsamlı atama sayısı"],
      ["invitations", "Dar kapsamlı davet sayısı"],
    ]) {
      const value = d[key];
      if (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0
      )
        lines.push(`${title}: ${value}`);
    }
    return lines;
  }
  return [];
}
