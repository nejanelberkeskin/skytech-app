import type { AdminMe } from "../access/types";
import type { BatchSummary } from "@/lib/batches/admin-dto";
export const batchAccessKey=(me:AdminMe|null)=>JSON.stringify(me&&{user:me.admin.userId,active:me.admin.isActive,permissions:me.permissions,mfa:me.mfa});
export function batchPatch(batch:BatchSummary,edit:{title:string;plannedOn:string;notes:string;reportUrl:string}) {
 const values={title:edit.title.trim()||null,plannedOn:edit.plannedOn||null,notes:edit.notes.trim()||null,monitoringReportUrl:edit.reportUrl.trim()||null};
 return Object.fromEntries(Object.entries(values).filter(([key,value])=>value!==batch[key as keyof typeof values]));
}
export function validBatchResult(method:string,action:unknown,value:Record<string,unknown>|null,id:string) {
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 if(method==="DELETE")return value.deleted===true&&value.id===id;
 if(method==="PATCH")return (value.batch as BatchSummary|undefined)?.id===id&&Array.isArray(value.changed);
 if(action==="assign")return Number.isInteger(value.assigned)&&Number(value.assigned)>=0;
 if(action==="unassign")return Object.keys(value).length===0;
 if(action==="release")return Number.isInteger(value.released)&&Number(value.released)>=0&&Array.isArray(value.skipped);
 if(action==="publish_video")return value.published===true&&typeof value.firstPublication==="boolean";
 return false;
}
