import { getTranslations } from "next-intl/server";
import type { SiteRelease } from "@/lib/sites/releases";
import YouTubeLite from "@/components/vitrin/shared/YouTubeLite";

interface Props {
  releases: SiteRelease[];
  dates: Record<string, string>;
  locale: string;
}

export default async function SiteReleases({ releases, dates, locale }: Props) {
  if (releases.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "siteReleases" });

  return (
    <section aria-labelledby="site-releases-title" className="mt-14 sm:mt-20">
      <div className="mb-8 max-w-3xl">
        <h2
          id="site-releases-title"
          className="display-headline break-words text-3xl font-semibold text-[#14261a] sm:text-4xl"
        >
          {t("title")}
        </h2>
        <p className="mt-4 leading-relaxed text-[#3d5a3d]">{t("intro")}</p>
      </div>
      <ol className="space-y-6">
        {releases.map((release) => (
          <li key={release.id}>
            <article className="grid gap-6 rounded-xl border border-[#14261a]/12 bg-[#f6f6f1] p-5 sm:p-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.65fr)] lg:gap-10">
              <header className="min-w-0">
                <h3 className="break-words text-xl font-semibold text-[#14261a] [overflow-wrap:anywhere] sm:text-2xl">
                  <time dateTime={release.releasedOn}>
                    {dates[release.releasedOn]}
                  </time>
                </h3>
                <p className="mt-3 inline-block max-w-full break-words rounded-md border border-[#14261a]/12 bg-white px-2.5 py-1 text-xs font-medium text-[#3d5a3d]">
                  {t("season", { season: release.seasonLabel })}
                </p>
                {release.title && (
                  <p className="mt-5 break-words text-base font-medium text-[#14261a] [overflow-wrap:anywhere]">
                    {release.title}
                  </p>
                )}
              </header>
              <div className="min-w-0">
                {release.video ? (
                  <>
                    <YouTubeLite
                      youtubeId={release.video.youtubeId}
                      title={t("videoTitle", {
                        date: dates[release.releasedOn],
                      })}
                      playLabel={{
                        text: t("play"),
                        accessibleName: t("playNamed", {
                          date: dates[release.releasedOn],
                        }),
                      }}
                      note={t("consentNote")}
                    />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-sm">
                      <p className="text-[#3d5a3d]">
                        {t("publishedOn", {
                          date: dates[release.video.publishedOn],
                        })}
                      </p>
                      <a
                        href={release.video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 py-2 font-semibold text-[#1B6B3A] underline underline-offset-4"
                      >
                        {t("openOnYouTube")} <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-[#3d5a3d]">
                    {t("videoPending")}
                  </p>
                )}
                {release.reportUrl && (
                  <a
                    href={release.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center gap-2 py-2 text-sm font-semibold text-[#1B6B3A] underline underline-offset-4"
                  >
                    {t("report")} <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
