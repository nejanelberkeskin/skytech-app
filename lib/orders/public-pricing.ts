/**
 * Herkese açık sayfaların (ana sayfa SSS'si, hizmet kartları, örnek sözleşme) gördüğü fiyat ve adet
 * kuralları — önbellekli. Önbellek 5 dakikada bir tazelenir; yönetimden ayar kaydedilince
 * `revalidateTag(SALES_SETTINGS_TAG, { expire: 0 })` ile hemen geçersiz kılınır.
 *
 * Bağlayıcı hesaplar (önizleme, sipariş, ödeme) bunu KULLANMAZ; `getSalesSettings()` ile her
 * seferinde güncel satırı okur. Next dışı betikler de bu dosyayı içe aktarmamalı (next/cache).
 */
import { unstable_cache } from "next/cache";
import { DEFAULT_PUBLIC_PRICING, type PublicPricing } from "@/lib/pricing";
import { loadSalesSettings, SALES_SETTINGS_TAG, DEFAULT_SALES_SETTINGS, type SalesSettings } from "./settings";
import { publicPricing } from "./settings-schema";

/** Hata önbelleğe yazılmaz: okuma başarısızsa fırlatır, dıştaki çağrı varsayılana düşer. */
const cachedSettings = unstable_cache(
  async (): Promise<SalesSettings> => (await loadSalesSettings()).settings,
  ["sales-settings-v1"],
  { revalidate: 300, tags: [SALES_SETTINGS_TAG] },
);

export async function getPublicSalesSettings(): Promise<SalesSettings> {
  try {
    return await cachedSettings();
  } catch {
    return DEFAULT_SALES_SETTINGS;
  }
}

export async function getPublicPricing(): Promise<PublicPricing> {
  try {
    return publicPricing(await cachedSettings());
  } catch {
    return DEFAULT_PUBLIC_PRICING;
  }
}
