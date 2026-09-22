import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { financeSummary, type FinanceOrder, type FinanceRefund, type B2bPayment } from "@/lib/admin/finance";
import { readPages } from "@/lib/admin/read-pages";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request, ["SUPER_ADMIN", "FINANCE"]);
  if (error) return error;
  try {
    const db = createServiceRoleClient();
    const [orders, refunds, b2b, quotes, invoices] = await Promise.all([
      readPages<FinanceOrder>((a,b) => db.from("release_orders").select("id, order_no, buyer_email, quantity, total_kurus, status, paid_at, created_at, is_test").eq("is_test",false).order("id").range(a,b)),
      readPages<FinanceRefund>((a,b) => db.from("order_refunds").select("order_id, amount_kurus, completed_at").eq("status","succeeded").order("id").range(a,b)),
      readPages<B2bPayment>((a,b) => db.from("payments").select("id, amount, status, updated_at, created_at, orders(buyer_email,total_seeds)").eq("metadata->>checkout_type","b2b").order("id").range(a,b) as unknown as PromiseLike<{data:B2bPayment[]|null;error:unknown}>),
      db.from("corporate_quotes").select("id",{count:"exact",head:true}).in("status",["PENDING","QUOTED","pending","quoted"]),
      db.from("order_invoices").select("id, release_orders!inner(is_test)",{count:"exact",head:true}).eq("status","pending").eq("release_orders.is_test",false),
    ]);
    if (quotes.error || invoices.error) throw new Error("report_unavailable");
    return NextResponse.json({ ...financeSummary(orders,refunds,b2b), activeQuotes:quotes.count ?? 0, pendingInvoices:invoices.count ?? 0 }, { headers:{"Cache-Control":"private, no-store"} });
  } catch {
    return NextResponse.json({error:"Finans verileri alınamadı. Lütfen yeniden deneyin."},{status:503});
  }
}
