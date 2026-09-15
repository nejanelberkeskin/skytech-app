import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import { buildPageMetadata } from "@/lib/seo";
import { ACCOUNTS_ENABLED, REQUEST_ROUTES } from "@/lib/site-config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "requestsHub" });
  return buildPageMetadata(
    { title: t("meta.title"), description: t("meta.description"), path: REQUEST_ROUTES.hub },
    locale
  );
}

const CARDS = [
  { key: "seed", href: REQUEST_ROUTES.seed, image: "/images/tohumlar/kizilcam.webp", Icon: SeedIcon },
  { key: "land", href: REQUEST_ROUTES.land, image: "/images/steps/02-analiz.webp", Icon: LandIcon },
  { key: "openLand", href: REQUEST_ROUTES.openLand, image: "/images/steps/03-dagitim.webp", Icon: DroneIcon },
] as const;

export default async function TalepHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("requestsHub");
  const steps = t.raw("how.steps") as { title: string; desc: string }[];

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumb.label"), path: REQUEST_ROUTES.hub }]} />
      <BreadCrumb
        title={t("breadcrumb.title")}
        subtitle={t("breadcrumb.subtitle")}
        items={[{ label: t("breadcrumb.label") }]}
      />

      <SectionWrapper variant="light">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] text-xs font-bold uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B3A]" />
              {t("badge")}
            </span>
          </div>

          {/* Üç talep türü */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CARDS.map(({ key, href, image, Icon }) => (
              <Link key={key} href={href} className="group block vitrin-card overflow-hidden">
                <div className="relative h-44 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e2519]/80 via-[#0e2519]/20 to-transparent" />
                  <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/90 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1B6B3A]">
                    {t(`cards.${key}.tag`)}
                  </span>
                  <span className="absolute bottom-4 left-4 w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                    <Icon className="w-6 h-6" />
                  </span>
                </div>
                <div className="p-6 lg:p-7">
                  <h2 className="text-xl font-bold text-[#0e2519] mb-2 group-hover:text-[#1B6B3A] transition-colors">
                    {t(`cards.${key}.title`)}
                  </h2>
                  <p className="text-sm text-[#3d5a3d] leading-relaxed mb-5">{t(`cards.${key}.desc`)}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-[#1B6B3A]">
                    {t(`cards.${key}.cta`)}
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper variant="tinted">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Nasıl işler */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl lg:text-3xl font-bold text-[#0e2519] mb-8">{t("how.title")}</h2>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {steps.map((s, i) => (
                <li key={i} className="vitrin-card p-6">
                  <span className="w-9 h-9 rounded-xl bg-[#1B6B3A] text-white text-sm font-bold flex items-center justify-center mb-4">
                    {i + 1}
                  </span>
                  <p className="font-bold text-[#0e2519] mb-1.5">{s.title}</p>
                  <p className="text-sm text-[#3d5a3d] leading-relaxed">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Notlar */}
          <div className="space-y-5">
            <div className="vitrin-card p-6">
              <p className="text-base font-bold text-[#0e2519] mb-1.5">{t("note.title")}</p>
              <p className="text-sm text-[#3d5a3d] leading-relaxed">{t("note.desc")}</p>
            </div>
            {ACCOUNTS_ENABLED && (
              <div className="vitrin-card p-6">
                <p className="text-base font-bold text-[#0e2519] mb-1.5">{t("account.title")}</p>
                <p className="text-sm text-[#3d5a3d] leading-relaxed mb-4">{t("account.desc")}</p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/auth/register" className="vitrin-cta-primary !py-2.5 !px-5 !text-sm">
                    {t("account.cta")}
                  </Link>
                  <Link href="/auth/login" className="vitrin-cta-secondary !py-2.5 !px-5 !text-sm">
                    {t("account.login")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}

function SeedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21c-4-3-7-6.5-7-10a7 7 0 0 1 14 0c0 3.5-3 7-7 10z" />
      <path d="M12 21V11" />
      <path d="M12 14c-1.5-.5-2.5-1.7-3-3.5 1.8.2 3 1.2 3 3.5z" />
      <path d="M12 12c1.5-.5 2.5-1.7 3-3.5-1.8.2-3 1.2-3 3.5z" />
    </svg>
  );
}
function LandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l5-9 4 6 3-4 6 7z" />
      <path d="M3 21h18" />
      <circle cx="17" cy="6" r="2" />
    </svg>
  );
}
function DroneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="6" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <path d="M7.5 6h9" />
      <path d="M9 9l3 3 3-3" />
      <path d="M12 12v3" />
      <path d="M8 21l4-6 4 6" />
    </svg>
  );
}
