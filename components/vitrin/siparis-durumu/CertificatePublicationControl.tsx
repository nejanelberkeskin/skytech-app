"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function CertificatePublicationControl({ orderNo, initiallyPublic }: { orderNo: string; initiallyPublic: boolean }) {
  const t = useTranslations("orderStatusPage.certificate.publication");
  const [isPublic, setPublic] = useState(initiallyPublic);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function revoke() {
    setPending(true); setError(false);
    try {
      const result = await fetch(`/api/public/siparis/${encodeURIComponent(orderNo)}/yayin-izni`, { method: "POST", credentials: "same-origin" });
      if (!result.ok) throw new Error("revoke_failed");
      setPublic(false);
    } catch { setError(true); }
    finally { setPending(false); }
  }
  return <div className="mt-5 border-t border-[#14261a]/12 pt-4 text-sm leading-relaxed">
    <p role="status">{t(isPublic ? "visible" : "hidden")}</p>
    {isPublic && <button type="button" disabled={pending} onClick={revoke} className="mt-3 min-h-11 rounded-[10px] border border-[#14261a]/25 px-4 py-2 font-semibold text-[#14261a] transition-colors hover:border-[#1B6B3A] hover:text-[#1B6B3A] disabled:opacity-60">{t(pending ? "pending" : "revoke")}</button>}
    {error && <p role="alert" className="mt-2">{t("error")}</p>}
  </div>;
}
