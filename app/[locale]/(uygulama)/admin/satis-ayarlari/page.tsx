"use client";

import { useAdmin } from "@/lib/admin-context";
import { salesAccessKey } from "@/components/admin/sales/view";
import RoleGuard from "@/components/RoleGuard";
import SalesSettingsForm from "@/components/admin/SalesSettingsForm";

/** Satış ayarları — form ve kurallar `components/admin/SalesSettingsForm.tsx`'te. */
export default function SatisAyarlariPage() {
  const { me } = useAdmin();
  return (
    <RoleGuard path="/admin/satis-ayarlari">
      <SalesSettingsForm key={salesAccessKey(me)} />
    </RoleGuard>
  );
}
