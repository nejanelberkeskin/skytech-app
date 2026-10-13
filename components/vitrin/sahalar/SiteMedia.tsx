import { getTranslations } from "next-intl/server";
import SectionHeading from "@/components/vitrin/SectionHeading";
import { formatLongDay } from "@/lib/orders/dates";
import type { SiteMediaLink } from "@/lib/sites/media-links";

/**
 * Saha sayfası: sahayla ilgili haber ve video bağlantıları (ör. yangının haberleri). Gömülü oynatıcı yok; bağlantı
 * yeni sekmede açılır (üçüncü taraf çerezi yok). Bağlantı yoksa bölüm hiç gösterilmez.
 */
export default async function SiteMedia({ links, locale }: { links: SiteMediaLink[]; locale: string }) {
  if (links.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "siteDetail.media" });
  const ordered = [...links].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return (
    <section className="mt-12">
      <SectionHeading
        title={t("title")}
        subtitle={t("subtitle")}
        align="left"
        className="!mb-8 [&_h2]:!text-3xl sm:[&_h2]:!text-4xl"
      />
      <ul className=" grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              referrerPolicy="no-referrer"
              className="group flex h-full flex-col rounded-2xl border border-[#1B6B3A]/15 bg-white p-5 transition-colors hover:border-[#1B6B3A]/40"
            >
              <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#edf4e9] px-2.5 py-1 text-xs font-semibold text-[#1B6B3A]">
                {link.kind === "video" ? "▶ " : ""}
                {t(link.kind)}
              </span>
              <span className="font-semibold leading-snug text-[#0e2519] group-hover:text-[#1B6B3A]">{link.title}</span>
              <span className="mt-auto pt-4 text-xs text-[#3d5a3d]">
                {[link.source, link.date ? formatLongDay(link.date, locale) : null].filter(Boolean).join(" · ")}
              </span>
              <span className="mt-2 text-sm font-semibold text-[#1B6B3A]">
                {t(link.kind === "video" ? "watch" : "read")} ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
