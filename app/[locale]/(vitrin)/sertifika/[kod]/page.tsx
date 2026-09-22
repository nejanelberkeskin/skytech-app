import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPublicCertificate } from "@/lib/certificates/data";
import { SITES_HREF, siteDetailHref } from "@/lib/sites/links";
import { buildPageMetadata, localeUrl } from "@/lib/seo";
import CertificateActions from "@/components/vitrin/sertifika/CertificateActions";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; kod: string }> };
const imageHref = (code: string, locale: string, format: "dikey" | "yatay") =>
  `/api/public/katilim-sertifikasi/${encodeURIComponent(code)}/gorsel?b=${format}&dil=${locale}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, kod } = await params;
  const cert = await getPublicCertificate(kod);
  if (!cert) notFound();
  const t = await getTranslations({ locale, namespace: "certificatePage" });
  return buildPageMetadata(
    {
      title: `${t("title")} — ${cert.displayName}`,
      description: t(cert.status === "valid" ? "valid" : "cancelled"),
      path: `/sertifika/${cert.code}`,
      noindex: true,
      keywords: [],
      image: {
        url: imageHref(cert.code, locale, "yatay"),
        width: 1200,
        height: 630,
        alt: t("imageAlt", { name: cert.displayName }),
      },
    },
    locale,
  );
}

export default async function CertificatePage({ params }: Props) {
  const { locale, kod } = await params;
  setRequestLocale(locale);
  const cert = await getPublicCertificate(kod);
  if (!cert) notFound();
  const [t, seeds] = await Promise.all([
    getTranslations({ locale, namespace: "certificatePage" }),
    getTranslations({ locale, namespace: "ourSeeds" }),
  ]);
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  const quantity = new Intl.NumberFormat(locale).format(cert.quantity);
  const facts = [
    ...(cert.province
      ? [{ label: t("facts.province"), value: cert.province }]
      : []),
    { label: t("facts.released"), value: date(cert.releasedOn) },
    { label: t("facts.issued"), value: date(cert.issuedOn) },
    {
      label: t("facts.species"),
      value: cert.species
        .map((s) =>
          seeds.has(`seeds.${s.slug}.name`)
            ? seeds(`seeds.${s.slug}.name`)
            : s.name,
        )
        .join(" · "),
    },
    { label: t("facts.workType"), value: t(`workTypes.${cert.workType}`) },
    { label: t("facts.quantity"), value: t("quantity", { quantity }) },
    { label: t("facts.code"), value: cert.code },
  ];
  return (
    <div className="vitrin-container pb-20 pt-32 sm:pt-40">
      <header className="mb-10 max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#1B6B3A]">
          {t("verification")}
        </p>
        <h1 className="display-headline text-3xl font-semibold text-[#0e2519] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 break-words text-xl text-[#3d5a3d]">
          {cert.displayName}
        </p>
      </header>
      <div
        className={`mb-8 rounded-2xl border px-5 py-4 ${cert.status === "valid" ? "border-[#1B6B3A]/20 bg-[#edf4e9] text-[#1B6B3A]" : "border-[#e7cfb4] bg-[#fff7ed] text-[#633a17]"}`}
      >
        <p className="font-semibold">
          {t(cert.status === "valid" ? "valid" : "cancelled")}
        </p>
        {cert.status === "cancelled" && (
          <p className="mt-2 text-sm">{t("cancelledDescription")}</p>
        )}
      </div>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0">
          <Image
            src={imageHref(cert.code, locale, "dikey")}
            alt={t("imageAlt", { name: cert.displayName })}
            width={1080}
            height={1350}
            unoptimized
            priority
            className="h-auto w-full rounded-2xl shadow-lg"
          />
          {cert.status === "valid" && (
            <CertificateActions
              imageUrl={imageHref(cert.code, locale, "dikey")}
              pageUrl={localeUrl(`/sertifika/${cert.code}`, locale)}
              filename={`${cert.code}-${locale}.png`}
              text={t("shareText", { site: cert.siteName, quantity })}
            />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-[#0e2519]">
            {t("details")}
          </h2>
          <dl className="mt-6 divide-y divide-[#1B6B3A]/15">
            <div className="pb-4">
              <dt className="text-sm text-[#3d5a3d]">{t("facts.site")}</dt>
              <dd className="mt-1 break-words font-medium text-[#0e2519]">
                {cert.siteSlug ? (
                  <Link
                    href={siteDetailHref({ slug: cert.siteSlug })}
                    className="text-[#1B6B3A] underline underline-offset-4"
                  >
                    {cert.siteName}
                  </Link>
                ) : (
                  cert.siteName
                )}
              </dd>
            </div>
            {facts.map((f) => (
              <div key={f.label} className="py-4">
                <dt className="text-sm text-[#3d5a3d]">{f.label}</dt>
                <dd className="mt-1 break-words font-medium text-[#0e2519]">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
          <section className="mt-8 rounded-3xl bg-[#f8faf5] p-6">
            <h2 className="text-xl font-semibold text-[#0e2519]">
              {t("meaning")}
            </h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-[#3d5a3d]">
              <li>{t("records")}</li>
              <li>{t("notes.document")}</li>
              <li>
                {t("notes.nature")} {t("monitoring")}
              </li>
            </ul>
          </section>
          {cert.videoUrl && /^https:\/\//i.test(cert.videoUrl) && (
            <a
              href={cert.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block text-[#1B6B3A] underline underline-offset-4"
            >
              {t("video")} ↗
            </a>
          )}
          <div className="mt-8">
            <Link
              href={SITES_HREF}
              className="text-sm font-semibold text-[#1B6B3A] underline underline-offset-4"
            >
              {t("sites")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
