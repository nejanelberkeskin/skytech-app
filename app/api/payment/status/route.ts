import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { maskEmail, isValidUUID } from "@/lib/utils/format";

export async function GET(request: NextRequest) {
  // ── Rate Limit: 30 status checks per IP per minute ──────────────────
  const rateLimitError = rateLimit(`payment-status:${getClientIP(request)}`, 30, 60_000);
  if (rateLimitError) return rateLimitError;

  const supabase = createServiceRoleClient();

  try {
    const paymentId = request.nextUrl.searchParams.get("paymentId");
    const orderId = request.nextUrl.searchParams.get("order_id");

    // Validate ID format
    if (paymentId && !isValidUUID(paymentId)) {
      return NextResponse.json({ error: "Geçersiz paymentId formatı." }, { status: 400 });
    }
    if (orderId && !isValidUUID(orderId)) {
      return NextResponse.json({ error: "Geçersiz order_id formatı." }, { status: 400 });
    }

    // Query by payment ID
    if (paymentId) {
      const { data: payment, error } = await supabase
        .from("payments")
        .select("id, status, amount, iyzico_payment_id, created_at")
        .eq("id", paymentId)
        .single();

      if (error) {
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }

      return NextResponse.json({
        status: "success",
        payment: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          createdAt: payment.created_at,
          // Don't expose iyzicoPaymentId to avoid information leakage
        },
      });
    }

    // Query by order ID (for checkout success page)
    if (orderId) {
      const { data: order, error } = await supabase
        .from("orders")
        .select("id, buyer_email, status, payment_status, total_seeds")
        .eq("id", orderId)
        .single();

      if (error) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      // Pull buyer_name from payment metadata (stored during guest-checkout)
      let buyerName: string | null = null;
      const { data: payment } = await supabase
        .from("payments")
        .select("metadata")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (payment?.metadata) {
        buyerName = (payment.metadata as Record<string, unknown>).buyer_name as string | null ?? null;
      }

      return NextResponse.json({
        order_id: order.id,
        buyer_email: order.buyer_email, // Needed for guest registration flow
        buyer_email_masked: maskEmail(order.buyer_email),
        buyer_name: buyerName,           // Needed for signUp options.data.full_name
        status: order.status,
        payment_status: order.payment_status,
        total_seeds: order.total_seeds,
      });
    }

    return NextResponse.json({ error: "paymentId veya order_id gerekli." }, { status: 400 });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
