/**
 * Saha sayfasındaki "çalışma günlüğü" — herkese açık veri sözleşmesi (saf tipler + örnekler).
 *
 * Bir sahada tamamlanan her bırakma çalışması (bırakma partisi) için tarih, varsa başlık,
 * çalışma videosu ve izleme raporu gösterilir. TOHUM TOPU ADEDİ, sipariş sayısı ya da
 * alıcı bilgisi BURADA YOKTUR: sahalarda adet gösterilmez (müşteri kuralı).
 */

export interface SiteReleaseVideo {
  /** Herkese açık YouTube bağlantısı (izleme sayfası) */
  url: string;
  /** Gömme için 11 karakterlik video kimliği */
  youtubeId: string;
  /** Yayımlanma tarihi — YYYY-MM-DD (İstanbul) */
  publishedOn: string;
}

export interface SiteRelease {
  id: string;
  /** Bırakma tarihi — YYYY-MM-DD */
  releasedOn: string;
  /** "2026-2027" */
  seasonLabel: string;
  /** Yönetimin verdiği kısa başlık (ör. "Kasım çalışması"); yoksa null */
  title: string | null;
  /** Çalışma videosu yayımlandıysa; yoksa null (bırakmadan yaklaşık altı ay sonra gelir) */
  video: SiteReleaseVideo | null;
  /** İzleme / faaliyet raporu (PDF, https) yayımlandıysa; yoksa null */
  reportUrl: string | null;
}

const YOUTUBE_ID = "([A-Za-z0-9_-]{11})";
const YOUTUBE_PATTERNS = [
  new RegExp(`^https://(?:www\\.|m\\.)?youtube\\.com/watch\\?(?:[^#\\s]*&)?v=${YOUTUBE_ID}(?:[&#].*)?$`),
  new RegExp(`^https://youtu\\.be/${YOUTUBE_ID}(?:[?#].*)?$`),
  new RegExp(`^https://(?:www\\.)?youtube\\.com/(?:embed|shorts|live)/${YOUTUBE_ID}(?:[?#/].*)?$`),
  new RegExp(`^https://(?:www\\.)?youtube-nocookie\\.com/embed/${YOUTUBE_ID}(?:[?#/].*)?$`),
];

/** YouTube bağlantısından video kimliğini çıkarır; tanınmayan biçimde null (gömme yapılmaz, bağlantı verilir). */
export function youtubeIdFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  const clean = url.trim();
  for (const re of YOUTUBE_PATTERNS) {
    const m = re.exec(clean);
    if (m) return m[1];
  }
  return null;
}

/** Çerezsiz gömme adresi (YouTube'un gizlilik kipinde). Yalnız kullanıcı "oynat"a bastıktan SONRA yüklenir. */
export const youtubeEmbedUrl = (youtubeId: string) => `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`;

/* ── Geliştirme örnekleri (yalnız geliştirmede, `?ornek=calisma` ile) ──────── */

export const SITE_RELEASE_SAMPLE_PARAM = "calisma";

export const SITE_RELEASE_FIXTURES: SiteRelease[] = [
  {
    id: "00000000-0000-4000-8000-0000000000c3",
    releasedOn: "2027-02-18",
    seasonLabel: "2026-2027",
    title: "Şubat çalışması",
    video: null, // henüz yayımlanmadı
    reportUrl: null,
  },
  {
    id: "00000000-0000-4000-8000-0000000000c2",
    releasedOn: "2026-12-09",
    seasonLabel: "2026-2027",
    title: null, // başlıksız çalışma
    video: { url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", youtubeId: "aqz-KE-bpKQ", publishedOn: "2027-06-10" },
    reportUrl: null,
  },
  {
    id: "00000000-0000-4000-8000-0000000000c1",
    releasedOn: "2026-11-12",
    seasonLabel: "2026-2027",
    title: "Kasım çalışması",
    video: { url: "https://youtu.be/aqz-KE-bpKQ", youtubeId: "aqz-KE-bpKQ", publishedOn: "2027-05-14" },
    reportUrl: "https://example.com/ornek-izleme-raporu.pdf",
  },
];
