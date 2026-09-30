"use client";
import { Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import OrderManagement from "@/components/admin/orders/OrderManagement";
import AccessDenialNotice from "@/components/admin/access/AccessDenialNotice";
import { ORDERS_SCOPE, orderAccessKey } from "@/components/admin/orders/view";
import { useAdmin } from "@/lib/admin-context";

export default function SiparislerPage() {
  const { me } = useAdmin();
  return <>
    <AccessDenialNotice scope={ORDERS_SCOPE} />
    <RoleGuard path={ORDERS_SCOPE}>
      <Suspense fallback={<p role="status" className="p-6">Yükleniyor…</p>}>
        <OrderManagement key={orderAccessKey(me)} />
      </Suspense>
    </RoleGuard>
  </>;
}
