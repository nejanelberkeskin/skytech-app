import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin, getClientIP } from "@/lib/admin-auth";
import { auditLog } from "@/lib/admin/audit";
import {
  sendOrderPreparingEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
} from "@/lib/mail";
import type { ShippingStatus } from "@/lib/types";

/**
 * Admin Lojistik / Kargo Güncelleme API
 *
 * PUT — Fiziksel sipariş kargo durumunu güncelle, müşteriye otomatik e-posta gönder.
 *
 * Body: {
 *   orderId:          string          — zorunlu
 *   shipping_status:  ShippingStatus  — "PREPARING" | "SHIPPED" | "DELIVERED"
 *   courier_company?: string          — "SHIPPED" durumunda zorunlu
 *   tracking_number?: string          — "SHIPPED" durumunda zorunlu
 *   tracking_url?:    string          — opsiyonel, kargo firması takip linki
 * }
 *
 * RBAC: Sadece SUPER_ADMIN ve OPERATIONS rolleri erişebilir.
 */

const VALID_STATUSES: ShippingStatus[] = ["PREPARING", "SHIPPED", "DELIVERED"];

// Kargo durumu → siparişin `status` kolonu eşleşmesi
const STATUS_MAP: Record<ShippingStatus, string> = {
  PENDING:   "pending",
  PREPARING: "preparing",
  SHIPPED:   "shipped",
  DELIVERED: "delivered",
};

export async function PUT(req: NextRequest) {
  // ── RBAC guard ────────────────────────────────────────────────────────────
  const { admin, error: authError } = await requireAdmin(req, ["SUPER_ADMIN", "OPERATIONS"]);
  if (authError) return authError;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    orderId?: string;
    shipping_status?: string;
    courier_company?: string;
    tracking_number?: string;
    tracking_url?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { orderId, shipping_status, courier_company, tracking_number, tracking_url } = body;

  if (!orderId) {
    return NextResponse.json({ error: "orderId zorunludur." }, { status: 400 });
  }

  const shippingStatus = (shipping_status ?? "").toUpperCase() as ShippingStatus;
  if (!VALID_STATUSES.includes(shippingStatus)) {
    return NextResponse.json(
      { error: `Geçersiz shipping_status. İzin verilenler: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // SHIPPED durumunda kargo firması ve takip no zorunlu
  if (shippingStatus === "SHIPPED") {
    if (!courier_company?.trim()) {
      return NextResponse.json({ error: "Kargo firması (courier_company) zorunludur." }, { status: 400 });
    }
    if (!tracking_number?.trim()) {
      return NextResponse.json({ error: "Takip numarası (tracking_number) zorunludur." }, { status: 400 });
    }
  }

  const supabase = createServiceRoleClient();

  // ── Siparişi getir — var mı ve fiziksel mi kontrol et ────────────────────
  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, buyer_email, order_type, status, total_seeds")
    .eq("id", orderId)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  if (order.order_type !== "physical") {
    return NextResponse.json(
      { error: "Kargo durumu yalnızca fiziksel siparişler için güncellenebilir." },
      { status: 422 }
    );
  }

  // ── DB update payload ────────────────────────────────────────────────────
  const now = new Date().toISOString();

  const updatePayload: Record<string, string | null | undefined> = {
    shipping_status: shippingStatus,
    status: STATUS_MAP[shippingStatus],
    ...(shippingStatus === "SHIPPED" && {
      courier_company:  courier_company?.trim(),
      tracking_number:  tracking_number?.trim(),
      tracking_url:     tracking_url?.trim() || null,
      shipped_at:       now,
    }),
    ...(shippingStatus === "DELIVERED" && {
      delivered_at: now,
    }),
  };

  const { error: updateErr } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updateErr) {
    console.error("[shipping] DB update error:", updateErr);
    return NextResponse.json({ error: "Veritabanı güncellemesi başarısız." }, { status: 500 });
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  await auditLog(supabase, {
    admin: admin!,
    action: "UPDATE",
    entity: "shipping",
    entityId: orderId,
    details: { shipping_status: shippingStatus, courier_company, tracking_number, tracking_url },
    ip: getClientIP(req),
  });

  // ── E-posta gönderimi — asenkron, yanıtı bloklamaz ───────────────────────
  // Fire-and-forget: hata olursa loglanır ama 200 dönmeyi engellemez
  const buyerEmail = order.buyer_email;

  void (async () => {
    try {
      if (shippingStatus === "PREPARING") {
        await sendOrderPreparingEmail(buyerEmail, orderId);
      } else if (shippingStatus === "SHIPPED") {
        await sendOrderShippedEmail(
          buyerEmail,
          orderId,
          undefined,
          courier_company!.trim(),
          tracking_number!.trim(),
          tracking_url?.trim()
        );
      } else if (shippingStatus === "DELIVERED") {
        await sendOrderDeliveredEmail(buyerEmail, orderId);
      }
    } catch (mailErr) {
      console.error("[shipping] Email send failed (non-blocking):", mailErr);
    }
  })();

  return NextResponse.json({
    ok: true,
    orderId,
    shipping_status: shippingStatus,
    order_status: STATUS_MAP[shippingStatus],
    email_triggered: buyerEmail,
  });
}
