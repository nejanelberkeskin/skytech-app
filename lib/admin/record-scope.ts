/**
 * Kayıt kapsamı yardımcıları — YALNIZ SUNUCU. Sözleşmeler: web-brifler/19 §1, 27, 29.
 *
 * Kural: yalnız aynı iznin açık `all` kaydı kapsamı kaldırır; farklı izinlerin kapsamları birbirine
 * kopyalanmaz. `assigned` için gerçek atama veri modeli olmayan modüllerde `assigned` hiçbir kayda erişim
 * vermez ve `all`'a yükseltilmez: yalnız `assigned` olan izin `null` (desteklenmiyor) döner.
 * Sahası olmayan kayıt (`land_id = NULL`) yalnız `all` kapsamında açılır.
 */
import { accessibleScope, type EffectiveAccess, type Permission } from "@/lib/admin/permissions";

export type RecordScope = { kind: "all" } | { kind: "sites"; siteIds: string[] };

const unique = (ids: string[]) => [...new Set(ids)].sort();

/** İznin kayıt kapsamı. `null`: izin yok ya da yalnız `assigned` (bu modülde desteklenmiyor). */
export function permissionScope(access: EffectiveAccess, permission: Permission): RecordScope | null {
  const s = accessibleScope(access, permission);
  if (s.all) return { kind: "all" };
  const siteIds = unique(s.siteIds);
  return siteIds.length ? { kind: "sites", siteIds } : null;
}

export function intersectScopes(a: RecordScope | null, b: RecordScope | null): RecordScope | null {
  if (!a || !b) return null;
  if (a.kind === "all") return b;
  if (b.kind === "all") return a;
  const siteIds = a.siteIds.filter((id) => b.siteIds.includes(id));
  return siteIds.length ? { kind: "sites", siteIds } : null;
}

/** Kayıt kapsamda mı? Sahasız kayıt yalnız `all` ile. */
export const scopeCovers = (scope: RecordScope | null, landId: string | null | undefined): boolean =>
  !!scope && (scope.kind === "all" || (!!landId && scope.siteIds.includes(landId)));

/** `inner` kapsamı `outer`ın bütün kayıtlarını kapsıyor mu? (ör. iletişim alanıyla arama) */
export function coversScope(inner: RecordScope | null, outer: RecordScope): boolean {
  if (!inner) return false;
  if (inner.kind === "all") return true;
  return outer.kind === "sites" && outer.siteIds.every((id) => inner.siteIds.includes(id));
}

/** İzin var ama yalnız `assigned` mı? (403 scope_unsupported ile 403 forbidden ayrımı için) */
export const onlyAssigned = (access: EffectiveAccess, permission: Permission): boolean => {
  const s = accessibleScope(access, permission);
  return !s.all && s.siteIds.length === 0 && s.assigned;
};
