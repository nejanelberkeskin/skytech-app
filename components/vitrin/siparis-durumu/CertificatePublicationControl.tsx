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
  return <div className="mt-5 border-t border-[#1B6B3A]/15 pt-4 text-sm leading-relaxed">
    <p role="status">{t(isPublic ? "visible" : "hidden")}</p>
    {isPublic && <button type="button" disabled={pending} onClick={revoke} className="mt-3 min-h-11 rounded-xl border border-[#1B6B3A]/40 px-4 py-2 font-semibold disabled:opacity-60">{t(pending ? "pending" : "revoke")}</button>}
    {error && <p role="alert" className="mt-2">{t("error")}</p>}
  </div>;
}
