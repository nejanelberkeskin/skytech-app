import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteDetailHref } from "@/lib/sites/links";
import type { ProjectSite } from "@/lib/sites/types";

export async function SiteBadges({
  site,
  locale,
}: {
  site: ProjectSite;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "sitesPage" });
  return (
    <div className="flex flex-wrap gap-2 text-xs font-medium">
      {site.isFireAffected && (
        <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1.5 text-[#9a3412]">
          {t("fire")}
          {site.fireYear !== null ? ` · ${site.fireYear}` : ""}
        </span>
      )}
      <span className="rounded-full border border-[#1B6B3A]/15 bg-[#edf4e9] px-3 py-1.5 text-[#1B6B3A]">
        {t(`phases.${site.phase}`)}
      </span>
    </div>
  );
}

export default async function SiteCard({
  site,
  locale,
}: {
  site: ProjectSite;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "sitesPage" });
  const seeds = await getTranslations({ locale, namespace: "ourSeeds" });
  const location = [site.district, site.province].filter(Boolean).join(", ");
  return (
    <Link
      href={siteDetailHref(site)}
      className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-[#1B6B3A]/15 bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B6B3A]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#e7eee1]">
        {site.coverImage ? (
          <Image
            src={site.coverImage}
            unoptimized={/^https?:\/\//i.test(site.coverImage)}
            alt={[site.name, site.province].filter(Boolean).join(" — ")}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,#a7c4a1,transparent_70%)]"
          >
            <svg
              className="h-full w-full text-[#1B6B3A]/25"
              viewBox="0 0 400 300"
              fill="none"
              stroke="currentColor"
            >
              <path d="M-40 280Q70 100 180 230T450 130M-40 250Q70 70 180 200T450 100M-40 220Q70 40 180 170T450 70M-40 190Q70 10 180 140T450 40" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <SiteBadges site={site} locale={locale} />
        <h2 className="mt-5 break-words text-xl font-semibold leading-snug text-[#0e2519]">
          {site.name}
        </h2>
        {location && <p className="mt-2 text-sm text-[#3d5a3d]">{location}</p>}
        <div className="my-5 space-y-2 border-y border-[#1B6B3A]/10 py-4 text-sm text-[#3d5a3d]">
          {site.areaHectares !== null && (
            <p className="font-semibold text-[#0e2519]">
              {t("hectares", {
                value: new Intl.NumberFormat(locale).format(site.areaHectares),
              })}
            </p>
          )}
          <p>{t(`workTypes.${site.workType}`)}</p>
          {site.species.length > 0 && (
            <p>
              {site.species
                .map((s) =>
                  seeds.has(`seeds.${s.slug}.name`)
                    ? seeds(`seeds.${s.slug}.name`)
                    : s.name,
                )
                .join(" · ")}
            </p>
          )}
        </div>
        <span className="mt-auto flex items-center justify-between gap-4 text-sm font-semibold text-[#1B6B3A]">
          {t(site.acceptsOrders ? "participate" : "details")}
          <span aria-hidden="true">↗</span>
        </span>
      </div>
    </Link>
  );
}
