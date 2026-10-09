import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/envelope";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const guard=await requirePermission(request,"finance.read");
  if(guard.error) return guard.error;
  const raw=new URL(request.url).searchParams.get("page")??"0";
  if(!/^\d{1,5}$/.test(raw))return fail(400,"invalid_page","Geçersiz sayfa.");
  const page=Number(raw);
  const db=createServiceRoleClient();
  const {data,error}=await db.from("payments").select("id,order_id,amount,currency,status,created_at,metadata").eq("metadata->>checkout_type","b2b").order("created_at",{ascending:false}).order("id",{ascending:false}).range(page*50,page*50+50);
  if(error||!data)return fail(503,"unavailable","Kurumsal ödeme kayıtları alınamadı.");
  const ids=data.slice(0,50).map(p=>p.id);
  const holds=ids.length?await db.from("b2b_payment_holds").select("payment_id,reason").in("payment_id",ids).is("resolved_at",null):{data:[],error:null};
  if(holds.error)return fail(503,"unavailable","Ödeme inceleme durumu alınamadı.");
  return ok({hasMore:data.length>50,items:data.slice(0,50).map(p=>({id:p.id,orderId:p.order_id,quoteId:typeof p.metadata?.quote_id==="string"?p.metadata.quote_id:null,amount:p.amount,currency:p.currency,status:p.status,createdAt:p.created_at,reviewRequired:p.metadata?.payment_review_required===true,hold:(holds.data??[]).some(h=>h.payment_id===p.id),released:p.metadata?.retry_release==="verified",linked:typeof p.metadata?.iyzico_token==="string"}))});
}
