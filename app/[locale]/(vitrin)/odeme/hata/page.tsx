import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import { COMPANY } from "@/lib/company";
import { SITES_HREF } from "@/lib/sites/links";

/* Ödeme dönüşü bir siparişe bağlanamadığında gösterilen genel sayfa (belirteç tanınmadı,
   sağlayıcıya ulaşılamadı, tutar uyuşmadı). Sipariş bilgisi içermez; dizine eklenmez. */

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paymentErrorPage" });
  return { title: t("meta.title"), robots: { index: false, follow: false } };
}

export default async function PaymentErrorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("paymentErrorPage");

  return (
    <SectionWrapper variant="light" className="!py-20 lg:!py-28">
      <div className="mx-auto max-w-2xl rounded-3xl border border-black/5 bg-white p-7 shadow-sm sm:p-10">
        <p className="inline-flex rounded-full bg-[#b45309]/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#92400e]">
          {t("badge")}
        </p>
        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-[#0e2519] sm:text-4xl">{t("title")}</h1>
        <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-[#3d5a3d]">
          <p>{t("body")}</p>
          <p>{t("charged")}</p>
          <p>
            {t("contact")}{" "}
            <a href={`mailto:${COMPANY.email}`} className="whitespace-nowrap font-semibold text-[#1B6B3A] underline underline-offset-4">
              {COMPANY.email}
            </a>
          </p>
        </div>
        <div className="mt-8">
          <Link href={SITES_HREF} className="vitrin-cta-primary text-center">
            {t("cta")}
          </Link>
        </div>
      </div>
    </SectionWrapper>
  );
}
