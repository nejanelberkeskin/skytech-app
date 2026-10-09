import type { NextRequest } from "next/server";
import { requireAdminAccess } from "@/lib/admin/permissions";
import { evaluatePermissionSet, permissionSetResponse } from "@/lib/admin/permission-set";
import { fail } from "@/lib/api/envelope";

/** Both permissions must cover all records. MFA is mandatory even during rollout. */
export async function requireB2bResolution(request: NextRequest) {
  const guard = await requireAdminAccess(request);
  if (guard.error) return guard;
  const denial = evaluatePermissionSet(guard.access, guard.assurance, [
    { permission: "finance.read", target: "all" },
    { permission: "finance.b2b_payment.resolve", target: "all" },
  ], true);
  if (denial) return { ...guard, error: permissionSetResponse(denial) };
  const at = Date.parse(guard.assurance.verifiedAt ?? "");
  if (!Number.isFinite(at) || at > Date.now() + 30_000 || Date.now() - at > 15 * 60_000) {
    return { ...guard, error: fail(403, "mfa_required", "Bu işlem için iki aşamalı doğrulamayı yenileyin.") };
  }
  return guard;
}
