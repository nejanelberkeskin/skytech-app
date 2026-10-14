"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui";
import { accessRequest } from "../access/transport";
import { errorText } from "./client";
import type { SalesSettingsDto, SalesSettingsMutationDto } from "@/lib/sales/admin-dto";

/**
 * Genel Bakış: acil durumda sipariş ve ödeme alımını tek düğmeyle durdurma. Satış Ayarları'ndaki aynı uç
 * (PUT /api/admin/sales-settings { ordersPaused }) kullanılır: durdurma `sales.pause` ister ve yeniden doğrulama
 * gerektirmez; yeniden açma `sales.resume` (MFA). Yetkisi olmayan kişide kutu hiç görünmez. Her değişiklik işlem
 * geçmişine yazılır.
 */
export default function SalesSwitch() {
  const [data, setData] = useState<SalesSettingsDto | null>(null);
  const [confirming, setConfirming] = useState<null | "pause" | "resume">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await accessRequest<SalesSettingsDto>("/api/admin/sales-settings");
      setData(data);
    } catch {
      setData(null);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const state = data?.state;
  if (!data || !state || !(data.capabilities.pause || data.capabilities.resume)) return null;

  const apply = async (pause: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { data: result } = await accessRequest<SalesSettingsMutationDto>("/api/admin/sales-settings", "PUT", {
        ordersPaused: pause,
        expectedUpdatedAt: state.updatedAt,
      });
      setData({ ...data, state: result.state });
      setConfirming(null);
    } catch (e) {
      setError(errorText(e));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const paused = state.ordersPaused;
  return (
    <section
      aria-label="Ödeme ve sipariş alımı"
      className={`rounded-xl border p-4 sm:p-5 ${paused ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${paused ? "bg-red-600" : "bg-[#1B6B3A]"}`} />
            {paused ? "Ödemeler ve sipariş alımı durduruldu" : "Ödemeler ve sipariş alımı açık"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {paused
              ? "Müşteriler şu an sipariş veremez ve ödeme yapamaz. Başlamış ödemeler etkilenmez."
              : state.accepting
                ? "Bir sorun görürseniz ödemeleri buradan tek tıkla geçici olarak durdurabilirsiniz."
                : "Panel açık, ancak diğer koşullar (ödeme sağlayıcısı, satış bayrağı) nedeniyle şu an sipariş alınmıyor."}
          </p>
        </div>
        {confirming === null && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {!paused && data.capabilities.pause && (
              <Button variant="danger" disabled={busy || state.repairRequired} onClick={() => setConfirming("pause")}>
                Ödemeleri durdur
              </Button>
            )}
            {paused && data.capabilities.resume && (
              <Button disabled={busy || state.repairRequired} onClick={() => setConfirming("resume")}>
                Yeniden aç
              </Button>
            )}
          </div>
        )}
      </div>
      {confirming && (
        <div role="alertdialog" aria-label="Onay" className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-800">
            {confirming === "pause"
              ? "Yeni sipariş ve ödemeler hemen durdurulacak. Emin misiniz?"
              : "Sipariş ve ödeme alımı yeniden açılacak. Emin misiniz? (Yeniden açma, iki adımlı doğrulama zorunluysa doğrulama ister.)"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant={confirming === "pause" ? "danger" : "primary"}
              loading={busy}
              onClick={() => void apply(confirming === "pause")}
            >
              {confirming === "pause" ? "Evet, durdur" : "Evet, yeniden aç"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(null)}>
              Vazgeç
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}{" "}
          <Link href="/admin/satis-ayarlari" className="underline">
            Satış Ayarları
          </Link>
        </p>
      )}
    </section>
  );
}
