import type { Scope } from "@/lib/admin/permission-keys";
export const globalOnly = new Set<string>([
  "staff.invite",
  "staff.manage",
  "roles.manage",
]);
export function requiresFullScope(permissions: readonly string[] = []) {
  return permissions.some((p) => globalOnly.has(p));
}
export function invalidRoleScope(
  permissions: readonly string[] | undefined,
  scope: Scope,
) {
  return requiresFullScope(permissions) && scope.kind !== "all";
}
type RoleContent = {
  label: string;
  description: string;
  permissions: readonly string[];
};
export function sameRoleContent(a: RoleContent, b: RoleContent) {
  const left = new Set(a.permissions),
    right = new Set(b.permissions);
  return (
    a.label.trim() === b.label.trim() &&
    a.description.trim() === b.description.trim() &&
    left.size === right.size &&
    [...left].every((p) => right.has(p))
  );
}
export function copiedRoleLabel(label: string) {
  const suffix = " kopyası";
  // Keep UTF-16 length within the form/API limit without splitting a surrogate pair.
  let prefix = "";
  for (const char of label.trim()) {
    if (prefix.length + char.length + suffix.length > 80) break;
    prefix += char;
  }
  return prefix.trimEnd() + suffix;
}
