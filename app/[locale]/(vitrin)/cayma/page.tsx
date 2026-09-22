import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { COMPANY } from "@/lib/company";
import { buildPageMetadata } from "@/lib/seo";
import type { PriceLocale } from "@/lib/pricing";
import WithdrawalForm from "@/components/vitrin/cayma/WithdrawalForm";
import { OrderAccessPrivacy } from "@/components/vitrin/siparis-durumu/OrderControls";

type Props = {
  params: Promise<{ locale: PriceLocale }>;
  searchParams: Promise<{ no?: string | string[] }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "withdrawalPage" });
  return {
    ...buildPageMetadata(
      {
        title: t("title"),
        description: t("description"),
        path: "/cayma",
        noindex: true,
      },
      locale,
    ),
    referrer: "no-referrer",
  };
}
export default async function WithdrawalPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "withdrawalPage" });
  const { no } = await searchParams;
  const initialOrderNo =
    typeof no === "string" && no.length <= 40 ? no.trim().toUpperCase() : "";
  // The receipt dates only exist after submission. This presentation-only server
  // action formats them here; it reads/writes no order and receives no identity data.
  async function formatReceipt(receivedAt: string, refundDueOn: string) {
    "use server";
    if (
      typeof receivedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(
        receivedAt,
      ) ||
      typeof refundDueOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(refundDueOn)
    )
      throw new Error("Invalid receipt dates");
    const options = {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Istanbul",
    } as const;
    const language = locale === "en" ? "en-GB" : locale;
    return {
      receivedAt: new Intl.DateTimeFormat(language, {
        ...options,
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(receivedAt)),
      refundDueOn: new Intl.DateTimeFormat(language, options).format(
        new Date(`${refundDueOn}T12:00:00Z`),
      ),
    };
  }
  const emailLink = (
    <a
      href={`mailto:${COMPANY.email}`}
      rel="noreferrer"
      className="break-all font-semibold text-[#1B6B3A] underline underline-offset-4"
    >
      {COMPANY.email}
    </a>
  );
  return (
    <div className="vitrin-container pb-20 pt-32 sm:pt-40">
      <OrderAccessPrivacy />
      <div className="mx-auto max-w-2xl space-y-7">
        <header>
          <h1 className="display-headline text-3xl font-semibold text-[#0e2519] sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#526352]">
            {t("description")}
          </p>
        </header>
        <WithdrawalForm
          locale={locale}
          initialOrderNo={initialOrderNo}
          formatReceipt={formatReceipt}
        />
        <section
          aria-labelledby="written-notice-title"
          className="border-t border-[#1B6B3A]/15 pt-6"
        >
          <h2 id="written-notice-title" className="text-lg font-semibold">
            {t("contact.title")}
          </h2>
          <address className="mt-3 space-y-2 text-sm not-italic leading-relaxed text-[#526352]">
            <p>{COMPANY.legalName}</p>
            <p>
              {COMPANY.address.line}
              <br />
              {COMPANY.address.district} / {COMPANY.address.province},{" "}
              {COMPANY.address.country}
            </p>
            <p>{emailLink}</p>
          </address>
          <Link
            href="/cayma-ve-iade"
            prefetch={false}
            rel="noreferrer"
            className="mt-4 inline-block min-h-11 py-3 text-sm font-semibold text-[#1B6B3A] underline underline-offset-4"
          >
            {t("contact.terms")}
          </Link>
        </section>
      </div>
    </div>
  );
}
