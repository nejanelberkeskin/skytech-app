"use client";

import { useState } from "react";

/* Deneme ödeme sayfasının düğmeleri: seçilen sonucu (imzasıyla) dönüş ucuna bildirir,
   gelen adrese gider. Gerçek sağlayıcıda bu adımı sanal POS'un kendi sayfası yapar. */

type Outcome = "success" | "failure";

export default function MockPaymentActions({ token, signatures }: { token: string; signatures: Record<Outcome, string> }) {
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function complete(outcome: Outcome) {
    if (busy) return;
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch("/api/public/odeme/deneme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, outcome, signature: signatures[outcome] }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; redirectUrl?: string; error?: string } | null;
      if (res.ok && data?.ok && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      setError(`İşlenemedi (${data?.error ?? res.status}).`);
    } catch {
      setError("Bağlantı kurulamadı.");
    }
    setBusy(null);
  }

  return (
    <div className="mt-7 space-y-3">
      <button
        type="button"
        onClick={() => complete("success")}
        disabled={busy !== null}
        className="w-full rounded-xl bg-[#1B6B3A] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#22894a] disabled:opacity-60"
      >
        {busy === "success" ? "İşleniyor…" : "Ödemeyi onayla (başarılı)"}
      </button>
      <button
        type="button"
        onClick={() => complete("failure")}
        disabled={busy !== null}
        className="w-full rounded-xl border border-black/10 bg-white px-5 py-3.5 text-sm font-bold text-[#0e2519] transition hover:bg-black/[0.03] disabled:opacity-60"
      >
        {busy === "failure" ? "İşleniyor…" : "Ödemeyi reddet (başarısız)"}
      </button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-[#b91c1c]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
