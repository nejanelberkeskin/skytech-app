/**
 * Saha çalışma günlüğü — SUNUCU tarafı veri erişimi (service role).
 * Yalnız TAMAMLANMIŞ bırakmalar (release_batches.released_on dolu) döner; planlanan partiler,
 * adetler ve siparişler dışarı verilmez. Video yalnız yayımlandıysa (video_published_at) görünür.
 */
import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { trToday } from "@/lib/orders/schedule";
import { SITE_RELEASE_FIXTURES, SITE_RELEASE_SAMPLE_PARAM, youtubeIdFrom, type SiteRelease } from "./releases";

export interface SiteReleasesOptions {
  /** Sayfanın `?ornek=` sorgu değeri; geliştirmede "calisma" ise örnek kayıtlar döner. */
  sample?: string | null;
}

export const getSiteReleases = cache(async (landId: string, options: SiteReleasesOptions = {}): Promise<SiteRelease[]> => {
  if (process.env.NODE_ENV !== "production" && options.sample === SITE_RELEASE_SAMPLE_PARAM) return SITE_RELEASE_FIXTURES;
  try {
    const { data, error } = await createServiceRoleClient()
      .from("release_batches")
      .select("id, season_label, title, released_on, video_url, video_published_at, monitoring_report_url")
      .eq("land_id", landId)
      .not("released_on", "is", null)
      .order("released_on", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((b) => {
      const url = b.video_published_at && typeof b.video_url === "string" ? b.video_url : null;
      const youtubeId = youtubeIdFrom(url);
      return {
        id: b.id as string,
        releasedOn: b.released_on as string,
        seasonLabel: b.season_label as string,
        title: (b.title as string | null)?.trim() || null,
        video: url && youtubeId ? { url, youtubeId, publishedOn: trToday(new Date(b.video_published_at as string)) } : null,
        reportUrl: typeof b.monitoring_report_url === "string" && /^https:\/\//.test(b.monitoring_report_url) ? b.monitoring_report_url : null,
      };
    });
  } catch (e) {
    console.error("[sites] çalışma günlüğü okunamadı:", e instanceof Error ? e.message : e);
    return [];
  }
});
