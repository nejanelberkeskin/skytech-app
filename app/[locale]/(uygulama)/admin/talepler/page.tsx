"use client";
import { Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useAdmin } from "@/lib/admin-context";
import Requests from "@/components/admin/requests/Requests";
import { requestAccessKey } from "@/components/admin/requests/view";
export default function TaleplerPage() {
  const { me } = useAdmin();
  return <RoleGuard path="/admin/talepler"><Suspense fallback={<p role="status" className="p-6">Yükleniyor…</p>}><Requests key={requestAccessKey(me)} /></Suspense></RoleGuard>;
}
