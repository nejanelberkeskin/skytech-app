"use client";

import RoleGuard from "@/components/RoleGuard";
import SalesSettingsForm from "@/components/admin/SalesSettingsForm";

/** Satış ayarları — form ve kurallar `components/admin/SalesSettingsForm.tsx`'te. */
export default function SatisAyarlariPage() {
  return (
    <RoleGuard path="/admin/satis-ayarlari">
      <SalesSettingsForm />
    </RoleGuard>
  );
}
