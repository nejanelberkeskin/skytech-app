"use client";
import { Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useAdmin } from "@/lib/admin-context";
import Requests from "@/components/admin/requests/Requests";
import AccessDenialNotice from "@/components/admin/access/AccessDenialNotice";
import { REQUESTS_SCOPE, requestAccessKey } from "@/components/admin/requests/view";
export default function TaleplerPage() {
  const { me } = useAdmin();
  return <><AccessDenialNotice scope={REQUESTS_SCOPE} /><RoleGuard path={REQUESTS_SCOPE}><Suspense fallback={<p role="status" className="p-6">Yükleniyor…</p>}><Requests key={requestAccessKey(me)} /></Suspense></RoleGuard></>;
}
