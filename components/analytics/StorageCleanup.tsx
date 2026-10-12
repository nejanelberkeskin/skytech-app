"use client";

import { useEffect } from "react";
import { CONSENT_STORAGE_KEY, parseStoredConsent } from "@/lib/analytics";
import { readPendingClaim } from "@/lib/requests/client";

/**
 * Yerel depo temizliği: süresi dolmuş (6 ay) ya da tarihsiz çerez tercihi ve 7 günü geçmiş bekleyen talep eşleştirmesi,
 * ziyaretçi o sayfaları açmasa da ilk sayfa yüklemesinde silinir. Hiçbir ağ isteği yapmaz.
 */
export default function StorageCleanup() {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (raw !== null && parseStoredConsent(raw) === null) window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      /* depolama kapalı */
    }
    readPendingClaim(); // süresi dolmuşsa siler, tarihsiz eski kaydı 7 günlük ömre bağlar
  }, []);
  return null;
}
