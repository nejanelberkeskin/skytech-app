import type { AdminMe } from "../access/types";
import type { SalesSettingsMutationDto } from "@/lib/sales/admin-dto";
export const salesAccessKey=(me:AdminMe|null)=>JSON.stringify(me&&{user:me.admin.userId,active:me.admin.isActive,permissions:me.permissions,mfa:me.mfa});
export function validSalesResult(data:SalesSettingsMutationDto|null) {
 return !!data&&typeof data.state?.ordersPaused==="boolean"&&typeof data.state.accepting==="boolean"&&typeof data.state.repairRequired==="boolean"&&typeof data.state.updatedAt==="string"&&Number.isFinite(Date.parse(data.state.updatedAt))&&Array.isArray(data.changed)&&typeof data.quoteChanged==="boolean";
}
