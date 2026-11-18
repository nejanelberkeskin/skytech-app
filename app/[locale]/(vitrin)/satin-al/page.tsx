import { siteZoomCover } from "@/lib/sites/boundary";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo";
import type { PriceLocale } from "@/lib/pricing";
import { formatHectares } from "@/lib/sites/format";
import { getProjectSites } from "@/lib/sites/data";
import { siteOrderHref, SITES_HREF } from "@/lib/sites/links";
import { getSalesSettings } from "@/lib/orders/settings";
import { publicPricing } from "@/lib/orders/settings-schema";
import { REQUESTS_ENABLED, SALES_ENABLED } from "@/lib/site-config";
import QuickBuy, { type QuickBuySite } from "@/components/vitrin/satin-al/QuickBuy";

/**
 * Hızlı satın alma: saha ve adet tek ekranda seçilir, sahanın sihirbazı (`/sahalar/<slug>/katil`) seçilen
 * adetle açılır. Bağlayıcı tutar burada HESAPLANMAZ; gösterilen bedel tahminidir, kesin tutar sihirbazın
 * son adımında sunucudan gelir.
 */
type Props = { params: Promise<{ locale: PriceLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quickBuy" });
  return buildPageMetadata({ title: t("metaTitle"), description: t("metaDescription"), path: "/satin-al" }, locale);
}

export default async function QuickBuyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!REQUESTS_ENABLED && !SALES_ENABLED) redirect({ href: "/yakinda", locale });
  const [sites, settings, t, shared, products] = await Promise.all([
    getProjectSites(locale),
    getSalesSettings(),
    getTranslations({ locale, namespace: "quickBuy" }),
    getTranslations({ locale, namespace: "sitesPage" }),
    getTranslations({ locale, namespace: "products" }),
  ]);
  const open: QuickBuySite[] = sites
    .filter((site) => site.acceptsOrders)
    .map((site) => {
      const pricing = publicPricing(settings, site.productType);
      return {
        slug: site.slug,
        name: site.name,
        location: [site.district, site.province].filter(Boolean).join(", "),
        hectares: site.areaHectares === null ? null : shared("hectares", { value: formatHectares(site.areaHectares, locale) }),
        fire: site.isFireAffected ? `${shared("fire")}${site.fireYear === null ? "" : ` · ${site.fireYear}`}` : null,
        cover: siteZoomCover(site.slug)?.wide ?? site.coverImage,
        product: products(`${site.productType}.name`),
        unit: products(`${site.productType}.unitSingular`),
        orderHref: siteOrderHref(site),
        pricing,
      };
    });

  return (
    <div className="bg-[#f6f6f1]">
      <div className="vitrin-container py-10 lg:py-14">
        <header className="mb-8 max-w-2xl">
          <p className="mb-4 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1B6B3A]">
            <span aria-hidden className="h-px w-8 bg-current" />
            {t("eyebrow")}
          </p>
          <h1 className="display-headline text-3xl font-bold text-[#14261a] sm:text-4xl lg:text-5xl">{t("title")}</h1>
          <p className="mt-4 text-base leading-relaxed text-[#3d5a3d] sm:text-lg">{t("intro")}</p>
        </header>
        {open.length > 0 ? (
          <QuickBuy sites={open} locale={locale} sitesHref={SITES_HREF} />
        ) : (
          // Saha listesi okunamadıysa ya da açık saha yoksa: yönlendirme yerine açık bir ileti (geçici hata döngüye girmesin).
          <div className="max-w-xl rounded-xl border border-[#14261a]/12 bg-white p-6">
            <p className="text-[#3d5a3d]">{t("empty")}</p>
            <Link href={SITES_HREF} className="vitrin-cta-secondary mt-5">{t("inspectSites")}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
