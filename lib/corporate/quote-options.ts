/**
 * Kurumsal teklif formu seçenekleri. `value` veritabanına (`corporate_quotes.seed_count`, `budget_range`, `timeline`)
 * yazılan değerdir ve DEĞİŞMEZ: yönetim ekranı, panel ve `extractSeedCount` bu metni okur. `key` yalnız gösterilen
 * etiketin çeviri anahtarıdır (`corporatePages.quoteOptions.<grup>.<key>`). Saf veri; istemcide ve sunucuda kullanılabilir.
 */
export const SEED_OPTIONS = [
  { value: "1.000 – 5.000", key: "r1" },
  { value: "5.000 – 10.000", key: "r2" },
  { value: "10.000 – 25.000", key: "r3" },
  { value: "25.000 – 50.000", key: "r4" },
  { value: "50.000+", key: "r5" },
  { value: "Henüz karar vermedim", key: "undecided" },
] as const;

export const BUDGET_OPTIONS = [
  { value: "₺50.000 altı", key: "b1" },
  { value: "₺50.000 – ₺150.000", key: "b2" },
  { value: "₺150.000 – ₺500.000", key: "b3" },
  { value: "₺500.000+", key: "b4" },
  { value: "Teklif bekliyorum", key: "awaiting" },
] as const;

export const TIMELINE_OPTIONS = [
  { value: "1 ay içinde", key: "m1" },
  { value: "3 ay içinde", key: "m3" },
  { value: "6 ay içinde", key: "m6" },
  { value: "Yıl sonuna kadar", key: "yearEnd" },
  { value: "Esnek", key: "flexible" },
] as const;

/** Kayıtlı `seed_count` değerinin etiket anahtarı; bilinmeyen (eski/serbest) değerde null — çağıran ham değeri gösterir. */
export function seedRangeLabelKey(value: string | null | undefined): string | null {
  return SEED_OPTIONS.find((o) => o.value === value)?.key ?? null;
}
