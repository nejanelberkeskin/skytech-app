"use client";
import { useEffect, useRef } from "react";
import { useAdmin } from "@/lib/admin-context";
import { AdminApiError } from "../operations/client";

/** Yetki reddi mi? MFA isteği ayrı akıştır (doğrulama yönergesi); açıklama olarak taşınmaz. */
export const isAccessDenial = (e: unknown): e is AdminApiError =>
  e instanceof AdminApiError && e.status === 403 && e.code !== "mfa_required";

/**
 * Yetki değişince yeniden kurulan ekranın son ret açıklaması. Ekran erişim anahtarıyla yeniden kurulduğu için eski
 * veri ve eylemler temizlenir; açıklama yeniden kurulan alt ağacın dışında, bu kutuda kalır. Kullanıcı kapatana ya da
 * sayfadan çıkana kadar görünür. Yalnız bellekte tutulur ve yalnız reddi alan oturum sahibine gösterilir.
 */
export default function AccessDenialNotice({ scope }: { scope: string }) {
  const { me, denial, clearDenial } = useAdmin();
  const box = useRef<HTMLDivElement>(null);
  const visible = denial && me && denial.scope === scope && denial.userId === me.admin.userId ? denial : null;
  useEffect(() => {
    if (visible) box.current?.focus();
  }, [visible]);
  useEffect(() => () => clearDenial(scope), [clearDenial, scope]);
  if (!visible) return null;
  return (
    <div ref={box} tabIndex={-1} role="alert" className="mx-4 mt-4 md:mx-8 md:mt-8 space-y-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
      <p className="font-semibold">Yetkiniz değişti; ekran güncel yetkinize göre yenilendi.</p>
      <p className="break-words">{visible.message}</p>
      <button type="button" onClick={() => clearDenial(scope)} className="min-h-11 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-300">
        Bildirimi kapat
      </button>
    </div>
  );
}
