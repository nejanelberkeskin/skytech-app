import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SiteCard from "@/components/vitrin/sahalar/SiteCard";
import SeasonTimeline from "@/components/vitrin/shared/SeasonTimeline";
import { getProjectSites } from "@/lib/sites/data";
import { OWN_LAND_HREF, SITES_HREF } from "@/lib/sites/links";
import type { SiteLocale } from "@/lib/sites/types";
import { buildPageMetadata } from "@/lib/seo";

export const revalidate = 300;
type Props = { params: Promise<{ locale: SiteLocale }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sitesPage" });
  return buildPageMetadata(
    { title: t("title"), description: t("intro"), path: SITES_HREF },
    locale,
  );
}
export default async function SitesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, sites] = await Promise.all([
    getTranslations({ locale, namespace: "sitesPage" }),
    getProjectSites(locale),
  ]);
  return (
    <div className="[&_nav]:flex-wrap [&_nav>span]:min-w-0 [&_h1]:break-words [&_h1]:[overflow-wrap:anywhere]">
      <BreadCrumb
        title={t("title")}
        subtitle={t("intro")}
        items={[{ label: t("title") }]}
      />
      <SectionWrapper>
        <div className="mb-10 flex flex-col justify-between gap-5 border-b border-[#1B6B3A]/15 pb-6 lg:flex-row lg:items-center">
          <p className="max-w-xl text-[#3d5a3d]">{t("description")}</p>
          <Link
            href={OWN_LAND_HREF}
            className="max-w-md text-sm font-medium text-[#1B6B3A] underline decoration-[#1B6B3A]/30 underline-offset-4 focus-visible:outline-2"
          >
            {t("ownLand")} <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {sites.length ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-[#1B6B3A]/15 bg-[#f8faf5] p-7 sm:p-12">
            <h2 className="text-2xl font-semibold text-[#0e2519]">
              {t("empty.title")}
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-[#3d5a3d]">
              {t("empty.description")}
            </p>
            <div className="mt-6 flex flex-wrap gap-5">
              <Link
                href={OWN_LAND_HREF}
                className="text-sm font-semibold text-[#1B6B3A] underline underline-offset-4"
              >
                {t("ownLand")}
              </Link>
              <Link
                href="/bilgi-al"
                className="text-sm font-semibold text-[#1B6B3A] underline underline-offset-4"
              >
                {t("info")}
              </Link>
            </div>
          </div>
        )}
        <div className="mt-16">
          <SeasonTimeline
            locale={locale}
            currentMonth={new Date().getUTCMonth()}
          />
        </div>
      </SectionWrapper>
    </div>
  );
}
