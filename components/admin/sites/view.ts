import type { AdminMe } from "../access/types";
import type { SiteAdminItem } from "@/lib/sites/admin-dto";
import type { LandStatus } from "@/lib/sites/admin";
export const siteAccessKey = (me: AdminMe | null) => JSON.stringify(me && {user:me.admin.userId,active:me.admin.isActive,role:me.admin.legacyRole,permissions:me.permissions});
/** Contract 30: transitions affecting listing or order intake require publish. */
export function statusAllowed(site: SiteAdminItem, next: LandStatus) {
 if (next === site.status) return true;
 const publication = site.isPublic && ((site.status === "closed") !== (next === "closed") || (site.status === "open") !== (next === "open"));
 return publication ? site.capabilities.publish : site.capabilities.edit;
}
