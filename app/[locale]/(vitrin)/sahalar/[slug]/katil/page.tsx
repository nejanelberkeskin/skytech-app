import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { SALES_ENABLED, REQUESTS_ENABLED } from "@/lib/site-config";
import { getProjectSiteBySlug } from "@/lib/sites/data";
import { siteDetailHref, siteOrderHref } from "@/lib/sites/links";
import { formatHectares, formatSiteLocation } from "@/lib/sites/format";
import type { PriceLocale } from "@/lib/pricing";
import { scheduleFor } from "@/lib/orders/schedule";
import { buildPageMetadata } from "@/lib/seo";
import SeasonTimeline from "@/components/vitrin/shared/SeasonTimeline";
import OrderWizard from "@/components/vitrin/siparis/OrderWizard";

type Props = { params: Promise<{ locale: PriceLocale; slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "orderWizard" });
  return buildPageMetadata(
    {
      title: t("title"),
      description: t("description"),
      path: siteOrderHref({ slug }),
      noindex: true,
    },
    locale,
  );
}
export default async function ParticipatePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const site = await getProjectSiteBySlug(slug, locale);
  if (!site) notFound();
  if (!site.acceptsOrders) redirect({ href: siteDetailHref(site), locale });
  if (!SALES_ENABLED && !REQUESTS_ENABLED)
    redirect({ href: "/yakinda", locale });
  const [t, sites, seeds] = await Promise.all([
    getTranslations({ locale, namespace: "orderWizard" }),
    getTranslations({ locale, namespace: "sitesPage" }),
    getTranslations({ locale, namespace: "ourSeeds" }),
  ]);
  const now = new Date();
  const schedule = scheduleFor(now);
  const formatter = new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : locale,
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );
  // Format on the server, including adjacent seasons if the live preview rolls over.
  const firstYear = Number(schedule.season.label.slice(0, 4));
  const dateLabels: Record<string, string> = {};
  for (let y = firstYear - 1; y <= firstYear + 3; y++) {
    for (const day of [`${y}-10-01`, `${y + 1}-03-31`])
      dateLabels[day] = formatter.format(new Date(`${day}T12:00:00Z`));
  }
  return (
    <div className="vitrin-container pb-12 pt-32 sm:pt-40">
      <header className="mb-8 max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#1B6B3A]">
          {t(SALES_ENABLED ? "orderMode" : "requestMode")}
        </p>
        <h1 className="display-headline text-3xl font-semibold text-[#0e2519] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-relaxed text-[#3d5a3d]">
          {t("description")}
        </p>
      </header>
      <OrderWizard
        locale={locale}
        mode={SALES_ENABLED ? "order" : "request"}
        site={{
          id: site.id,
          slug: site.slug,
          name: site.name,
          location: formatSiteLocation(site),
          hectares:
            site.areaHectares === null
              ? null
              : sites("hectares", {
                  value: formatHectares(site.areaHectares, locale),
                }),
          fire: site.isFireAffected
            ? `${sites("fire")}${site.fireYear === null ? "" : ` · ${site.fireYear}`}`
            : null,
          workType: sites(`workTypes.${site.workType}`),
          species: site.species.map((s) =>
            seeds.has(`seeds.${s.slug}.name`)
              ? seeds(`seeds.${s.slug}.name`)
              : s.name,
          ),
          cover: site.coverImage,
        }}
        schedule={schedule}
        dateLabels={dateLabels}
        timeline={
          <SeasonTimeline
            locale={locale}
            currentMonth={now.getUTCMonth()}
            variant="compact"
          />
        }
      />
    </div>
  );
}
