import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionHeading from "@/components/vitrin/SectionHeading";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import { SiteBadges } from "@/components/vitrin/sahalar/SiteCard";
import SeasonTimeline from "@/components/vitrin/shared/SeasonTimeline";
import { getProjectSiteBySlug } from "@/lib/sites/data";
import { SITES_HREF, siteDetailHref, siteOrderHref } from "@/lib/sites/links";
import type { SiteLocale } from "@/lib/sites/types";
import { buildPageMetadata } from "@/lib/seo";

export const revalidate = 300;
type Props = { params: Promise<{ locale: SiteLocale; slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const site = await getProjectSiteBySlug(slug, locale);
  if (!site) notFound();
  const t = await getTranslations({ locale, namespace: "siteDetail" });
  return buildPageMetadata(
    {
      title: site.name,
      description: t("meta", { name: site.name }),
      path: siteDetailHref(site),
    },
    locale,
  );
}
export default async function SiteDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const site = await getProjectSiteBySlug(slug, locale);
  if (!site) notFound();
  const [t, shared, seeds] = await Promise.all([
    getTranslations({ locale, namespace: "siteDetail" }),
    getTranslations({ locale, namespace: "sitesPage" }),
    getTranslations({ locale, namespace: "ourSeeds" }),
  ]);
  const location = [site.district, site.province].filter(Boolean).join(", ");
  const facts = [
    ...(location ? [{ label: t("location"), value: location }] : []),
    ...(site.areaHectares !== null
      ? [
          {
            label: t("area"),
            value: shared("hectares", {
              value: new Intl.NumberFormat(locale).format(site.areaHectares),
            }),
          },
        ]
      : []),
    { label: t("workType"), value: shared(`workTypes.${site.workType}`) },
    { label: t("phase"), value: shared(`phases.${site.phase}`) },
  ];
  return (
    <div className="[&_nav]:flex-wrap [&_nav>span]:min-w-0 [&_h1]:break-words [&_h1]:[overflow-wrap:anywhere]">
      <BreadCrumb
        title={site.name}
        items={[
          { label: shared("title"), href: SITES_HREF },
          { label: site.name },
        ]}
      />
      <SectionWrapper>
        <SiteBadges site={site} locale={locale} />
        <dl className="my-8 grid grid-cols-1 gap-6 rounded-3xl border border-[#1B6B3A]/15 bg-[#f8faf5] p-6 sm:grid-cols-2 lg:grid-cols-4 lg:p-8">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wider text-[#3d5a3d]">
                {fact.label}
              </dt>
              <dd className="mt-2 break-words text-lg font-semibold text-[#0e2519]">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        {site.coverImage && (
          <div className="relative mb-12 aspect-[4/3] overflow-hidden rounded-3xl sm:aspect-[16/7]">
            <Image
              src={site.coverImage}
              unoptimized={/^https?:\/\//i.test(site.coverImage)}
              alt={[site.name, site.province].filter(Boolean).join(" — ")}
              fill
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
            />
          </div>
        )}
        {site.summary && (
          <section className="mb-14 max-w-3xl">
            <h2 className="display-headline text-2xl font-semibold text-[#0e2519]">
              {t("about")}
            </h2>
            <p className="mt-4 leading-relaxed text-[#3d5a3d]">
              {site.summary}
            </p>
          </section>
        )}
        {site.species.length > 0 && (
          <section className="mb-14">
            <SectionHeading
              title={t("speciesTitle")}
              subtitle={t("speciesNote")}
              align="left"
              className="!mb-8 [&_h2]:!text-3xl sm:[&_h2]:!text-4xl"
            />
            <div className="grid gap-5 md:grid-cols-2">
              {site.species.map((species) => (
                <article
                  key={species.slug}
                  className="flex flex-col gap-5 rounded-3xl border border-[#1B6B3A]/15 p-5 sm:flex-row sm:p-6"
                >
                  {species.image && (
                    <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-2xl bg-[#f8faf5]">
                      <Image
                        src={species.image}
                        unoptimized={/^https?:\/\//i.test(species.image)}
                        alt={
                          seeds.has(`seeds.${species.slug}.name`)
                            ? seeds(`seeds.${species.slug}.name`)
                            : species.name
                        }
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-[#0e2519]">
                      {seeds.has(`seeds.${species.slug}.name`)
                        ? seeds(`seeds.${species.slug}.name`)
                        : species.name}
                    </h3>
                    <p className="mt-1 text-sm italic text-[#3d5a3d]">
                      {species.latinName}
                    </p>
                    {t.has(`reasons.${species.slug}`) && (
                      <p className="mt-4 text-sm leading-relaxed text-[#3d5a3d]">
                        {t(`reasons.${species.slug}`)}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {site.gallery.length > 0 && (
          <section className="mb-14">
            <h2 className="mb-6 text-2xl font-semibold text-[#0e2519]">
              {t("gallery")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {site.gallery.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className="relative aspect-[4/3] overflow-hidden rounded-2xl"
                >
                  <Image
                    src={src}
                    unoptimized={/^https?:\/\//i.test(src)}
                    alt={t("galleryAlt", {
                      name: site.name,
                      location,
                      number: i + 1,
                    })}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
        {site.lat !== null && site.lng !== null && location && (
          <section className="mb-10 flex items-center gap-4 rounded-2xl bg-[#f8faf5] p-5">
            <svg
              aria-hidden="true"
              className="h-8 w-8 shrink-0 text-[#1B6B3A]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
              <circle cx="12" cy="10" r="2" />
            </svg>
            <div>
              <h2 className="text-sm text-[#3d5a3d]">{t("location")}</h2>
              <p className="font-semibold text-[#0e2519]">{location}</p>
            </div>
          </section>
        )}
        <SeasonTimeline
          locale={locale}
          currentMonth={new Date().getUTCMonth()}
        />
        {site.videoUrl && /^https:\/\//i.test(site.videoUrl) && (
          <a
            href={site.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex text-[#1B6B3A] underline underline-offset-4"
          >
            {t("video")} ↗
          </a>
        )}
        <section className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#edf4e9] p-6 sm:p-8 lg:flex-row lg:items-center">
          {site.acceptsOrders ? (
            <Link
              href={siteOrderHref(site)}
              className="vitrin-cta-primary !whitespace-normal !text-center"
            >
              {t("order")}
            </Link>
          ) : (
            <p className="max-w-xl font-medium text-[#0e2519]">
              {t(`phaseInfo.${site.phase}`)}
            </p>
          )}
          <Link
            href={SITES_HREF}
            className="text-sm font-semibold text-[#1B6B3A] underline underline-offset-4"
          >
            {t("back")}
          </Link>
        </section>
      </SectionWrapper>
    </div>
  );
}
