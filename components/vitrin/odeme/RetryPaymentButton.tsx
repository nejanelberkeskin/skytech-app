"use client";

import { useState } from "react";

/* Ödemesi tamamlanmamış siparişte ödemeyi yeniden başlatır (yeni sipariş oluşturmaz). */

type ErrorKey = "expired" | "closed" | "rate_limited" | "generic";

interface Props {
  orderNo: string;
  /** Sayfaya gelinen imzalı belirteç; üye oturumuyla gelindiyse null */
  token: string | null;
  labels: { retry: string; retrying: string; errors: Record<ErrorKey, string> };
}

export default function RetryPaymentButton({ orderNo, token, labels }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/siparis/${encodeURIComponent(orderNo)}/odeme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { t: token } : {}),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; redirectUrl?: string; error?: string } | null;
      if (res.ok && data?.ok && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      const code = res.status === 429 ? "rate_limited" : data?.error;
      setError(labels.errors[code === "expired" || code === "closed" || code === "rate_limited" ? code : "generic"]);
    } catch {
      setError(labels.errors.generic);
    }
    setBusy(false);
  }

  return (
    <div className="mt-8">
      <button type="button" onClick={retry} disabled={busy} className="vitrin-cta-primary w-full sm:w-auto disabled:opacity-60">
        {busy ? labels.retrying : labels.retry}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#b91c1c]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
