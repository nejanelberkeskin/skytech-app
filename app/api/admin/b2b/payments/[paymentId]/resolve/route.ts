import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireB2bResolution } from "@/lib/b2b/resolution-access";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { iyzicoConfig } from "@/lib/payments/iyzico-config";
import { callIyzico } from "@/lib/payments/iyzico";
import { b2bPaymentResult } from "@/lib/b2b/payment-result";
import { fail, ok } from "@/lib/api/envelope";

export const dynamic = "force-dynamic";
const schema = z.object({ action:z.enum(["refresh","release"]), evidence:z.string().trim().min(10).max(500), sessionClosed:z.boolean() }).strict();
export async function POST(request: NextRequest, { params }: {params:Promise<{paymentId:string}>}) {
  const guard = await requireB2bResolution(request);
  if (guard.error) return guard.error;
  const { paymentId } = await params;
  if (!z.string().uuid().safeParse(paymentId).success) return fail(404,"not_found","Ödeme kaydı bulunamadı.");
  const parsed = schema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return fail(422,"invalid_body","İşlemi seçin ve 10–500 karakterlik kanıt referansı girin.");
  const input = parsed.data;
  if(input.action==="release" && !input.sessionClosed) return fail(422,"terminal_evidence_required","Eski ödeme oturumunun kapandığını doğrulayın.");
  const config = iyzicoConfig();
  if(!config) return fail(503,"unavailable","Ödeme sağlayıcısı yapılandırılmamış.");
  const db = createServiceRoleClient();
  try {
    const started = await db.rpc("begin_b2b_resolution", {p_payment:paymentId,p_actor:guard.admin!.user_id,p_verified_at:guard.assurance!.verifiedAt,p_action:input.action,p_evidence:input.evidence,p_session_closed:input.sessionClosed,p_is_test:config.isTest});
    if(started.error) return fail(503,"unavailable","İnceleme işlemi başlatılamadı.");
    if(started.data?.status!=="started") return fail(409,"state_changed","Ödeme durumu değişti veya başka bir inceleme sürüyor. Görünümü yenileyin.");
    const job=started.data;
    // No SQL transaction/row lock remains open while waiting for the provider.
    const result = typeof job.token==="string" && /^[A-Za-z0-9._~-]{8,200}$/.test(job.token)
      ? await callIyzico("checkoutForm","retrieve",{locale:"tr",token:job.token,conversationId:paymentId})
      : await callIyzico("payment","retrieve",{locale:"tr",paymentConversationId:paymentId});
    // Permissions and MFA can change during the external read. Recheck before applying.
    const fresh = await requireB2bResolution(request);
    if(fresh.error) return fresh.error;
    const finished=await db.rpc("finish_b2b_resolution",{p_operation:job.operationId,p_actor:fresh.admin!.user_id,p_verified_at:fresh.assurance!.verifiedAt,p_is_test:config.isTest,p_result:b2bPaymentResult(result)});
    if(finished.error) return fail(503,"unavailable","İşlem sonucu doğrulanamadı. Yeniden göndermeden görünümü yenileyin.");
    const status=finished.data?.status;
    if(!["released","paid","already_paid","review","closed"].includes(status)) return fail(409,"state_changed","İnceleme sırasında ödeme değişti. Güncel durumu yenileyin.");
    return ok({status}); // Never expose token, SDK response, evidence, recipient or operation snapshot.
  } catch { return fail(503,"unavailable","İnceleme sonucu alınamadı. Yeniden göndermeden görünümü yenileyin."); }
}
