/**
 * Saha haber ve video bağlantıları (`lands.media_links`, 041). Yönetimden girilir, saha sayfasında kart olarak gösterilir.
 * Bağlantılar yeni sekmede açılır; sayfaya gömülü oynatıcı yoktur (üçüncü taraf çerezi ve içerik güvenliği politikası).
 * Bağımlılığı yalnız zod: hem sunucu şeması hem vitrin okuyucusu buradan.
 */
import { z } from "zod";

export const MEDIA_KINDS = ["news", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface SiteMediaLink {
  kind: MediaKind;
  title: string;
  source: string;
  url: string;
  /** Yayın tarihi (YYYY-AA-GG); bilinmiyorsa null. */
  date: string | null;
}

export const MEDIA_LIMITS = { items: 12, title: 200, source: 80, url: 500 } as const;

const HTTPS_RE = /^https:\/\/[^\s/$.?#][^\s]*$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const mediaLinkSchema = z.object({
  kind: z.enum(MEDIA_KINDS, "Tür seçin."),
  title: z.string().trim().min(3, "Başlık en az 3 karakter olmalı.").max(MEDIA_LIMITS.title, "Başlık çok uzun."),
  source: z.string().trim().min(2, "Kaynak girin (ör. AA, TRT Haber).").max(MEDIA_LIMITS.source, "Kaynak çok uzun."),
  url: z
    .string()
    .trim()
    .max(MEDIA_LIMITS.url, "Adres çok uzun.")
    .refine((v) => HTTPS_RE.test(v), "Adres https:// ile başlamalı."),
  date: z
    .string()
    .trim()
    .refine((v) => v === "" || DAY_RE.test(v), "Tarih YYYY-AA-GG olmalı.")
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

export const mediaLinksSchema = z
  .array(mediaLinkSchema)
  .max(MEDIA_LIMITS.items, `En çok ${MEDIA_LIMITS.items} bağlantı eklenebilir.`)
  .default([]);

/** Veritabanından gelen değeri güvenle okur: bozuk öğe atlanır, yalnız https bağlantılar döner. */
export function readMediaLinks(value: unknown): SiteMediaLink[] {
  if (!Array.isArray(value)) return [];
  const out: SiteMediaLink[] = [];
  for (const item of value.slice(0, MEDIA_LIMITS.items)) {
    const parsed = mediaLinkSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
