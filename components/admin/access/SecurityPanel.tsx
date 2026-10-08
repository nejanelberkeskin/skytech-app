"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/browser";
import { useAdmin } from "@/lib/admin-context";
import { Button, Input } from "@/components/ui";
import { istanbulDate } from "../operations/client";
export default function SecurityPanel() {
  const { me, refresh } = useAdmin();
  const [factor, setFactor] = useState<{
    id: string;
    qr?: string;
    secret?: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const start = async (enroll: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      if (enroll) {
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Skytech ${new Date().toISOString()}`,
        });
        if (error) throw error;
        setFactor({
          id: data.id,
          qr: data.totp.qr_code,
          secret: data.totp.secret,
        });
      } else {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const found = data.totp.find((f) => f.status === "verified");
        if (!found)
          throw new Error(
            "Doğrulanmış uygulama bulunamadı. Önce kurulum yapın.",
          );
        setFactor({ id: found.id });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Doğrulama başlatılamadı.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const verify = async () => {
    if (lock.current || !factor) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Uygulamadaki 6 haneli kodu girin.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });
      if (error) throw error;
      setCode("");
      setFactor(null);
      setDone(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kod doğrulanamadı.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="İki aşamalı doğrulama"
      className="rounded-2xl border border-white/15 p-4 md:p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-white">
        İki aşamalı doğrulama
      </h2>
      <p className="text-sm text-slate-300">
        {me?.mfa.enrolled
          ? "Doğrulama uygulaması kayıtlı."
          : "Henüz doğrulama uygulaması kayıtlı değil."}{" "}
        {me?.mfa.enforced
          ? "Hassas işlemlerde ek doğrulama zorunlu."
          : "Ek doğrulama zorunluluğu henüz etkin değil."}
      </p>
      <p className="text-sm text-slate-400">
        Son doğrulama: {istanbulDate(me?.mfa.verifiedAt)} · Türkiye saati
      </p>
      {error && (
        <p role="alert" className="text-red-200">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-emerald-200">
          Doğrulama tamamlandı. Bekleyen işlem otomatik gönderilmedi; tekrar
          inceleyip onaylayın.
        </p>
      )}
      {!factor ? (
        <Button
          disabled={busy || !me}
          loading={busy}
          onClick={() => void start(!me?.mfa.enrolled)}
        >
          {me?.mfa.enrolled
            ? "Kimliğimi yeniden doğrula"
            : "Doğrulama uygulaması kur"}
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
          className="space-y-4 max-w-md"
        >
          {factor.qr && (
            <>
              <p className="text-sm text-slate-300">
                Kodu kendi doğrulama uygulamanızla tarayın. Kurulum anahtarını
                kimseyle paylaşmayın.
              </p>
              <Image
                unoptimized
                src={factor.qr}
                width={192}
                height={192}
                alt="Doğrulama uygulaması kurulum kodu"
              />
              <details>
                <summary className="min-h-11 text-slate-300 cursor-pointer">
                  Elle kurulum anahtarı
                </summary>
                <code className="break-all text-white">{factor.secret}</code>
              </details>
            </>
          )}
          <Input
            label="Doğrulama kodu"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            disabled={busy}
          />
          <Button type="submit" loading={busy}>
            Kodu doğrula
          </Button>
        </form>
      )}
      <p className="text-xs text-slate-400">
        Uygulamaya erişiminizi kaybettiyseniz başka bir yetkili sistem
        sahibinden kurtarma isteyin. Kurulum anahtarı bu sayfadan ayrılınca
        tutulmaz.
      </p>
    </section>
  );
}
