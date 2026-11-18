import Image from "next/image";
import { coverImageCredit } from "@/lib/sites/image-credit";
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
        <span className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-800">
          {t("fire")}
          {site.fireYear !== null ? ` · ${site.fireYear}` : ""}
        </span>
      )}
      <span className="rounded-md border border-[#14261a]/12 bg-white px-2.5 py-1 text-[#1B6B3A]">
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
  const products = await getTranslations({ locale, namespace: "products" });
  const location = [site.district, site.province].filter(Boolean).join(", ");
  return (
    <Link
      href={siteDetailHref(site)}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#14261a]/12 bg-white transition-colors hover:border-[#1B6B3A]/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B6B3A]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#e9ebe2]">
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
            className="absolute inset-0"
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
        {coverImageCredit(site.coverImage) && (
          <span className="absolute bottom-1.5 right-2 rounded bg-black/45 px-1.5 py-0.5 text-[9px] text-white/90">
            {coverImageCredit(site.coverImage)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <SiteBadges site={site} locale={locale} />
        <h2 className="mt-5 break-words text-xl font-semibold leading-snug text-[#14261a]">
          {site.name}
        </h2>
        {location && <p className="mt-2 text-sm text-[#3d5a3d]">{location}</p>}
        <div className="my-5 space-y-2 border-y border-[#14261a]/10 py-4 text-sm text-[#3d5a3d]">
          {site.areaHectares !== null && (
            <p className="font-semibold text-[#14261a]">
              {t("hectares", {
                value: new Intl.NumberFormat(locale).format(site.areaHectares),
              })}
            </p>
          )}
          <p>{t(`workTypes.${site.workType}`)}</p>
          <p className="font-semibold text-[#1B6B3A]">{products(`${site.productType}.name`)}</p>
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
