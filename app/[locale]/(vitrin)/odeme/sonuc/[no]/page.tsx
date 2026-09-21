import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import RetryPaymentButton from "@/components/vitrin/odeme/RetryPaymentButton";
import { createSupabaseServer } from "@/lib/supabase/server";
import { orderPagePath, signOrderToken } from "@/lib/orders/access";
import { formatLongDay, formatTrClock } from "@/lib/orders/dates";
import { trToday } from "@/lib/orders/schedule";
import { getAuthorizedOrder } from "@/lib/orders/view-data";
import { formatCount, formatTry, type PriceLocale } from "@/lib/pricing";
import { SITES_HREF, siteDetailHref } from "@/lib/sites/links";

/* Ödeme sonucu — sanal POS'tan dönen müşterinin gördüğü sayfa.
   Üç hâl: ödeme onaylandı · ödeme tamamlanamadı (yeniden denenebilir) · süre doldu.
   Erişim sipariş sayfasıyla aynı: imzalı belirteç (`?t=`) ya da sipariş sahibinin oturumu.
   Kişisel veri asgari: ad, e-posta ve tutar dışında bir şey gösterilmez; dizine eklenmez. */

export const dynamic = "force-dynamic";

type Params = { locale: string; no: string };
type Search = { t?: string | string[] };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paymentResultPage" });
  return { title: t("meta.title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function PaymentResultPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const [{ locale, no }, search] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const priceLocale: PriceLocale = locale === "en" || locale === "ru" ? locale : "tr";
  const token = typeof search.t === "string" ? search.t : null;

  let userId: string | null = null;
  if (!token) {
    try {
      const auth = await createSupabaseServer();
      userId = (await auth.auth.getUser()).data.user?.id ?? null;
    } catch {
      userId = null;
    }
  }
  const order = await getAuthorizedOrder(no, { token, userId });
  if (!order) notFound();

  // Sözleşmesi kurulmuş ve yoluna devam etmiş sipariş: asıl yeri sipariş sayfasıdır.
  if (order.paid_at && order.status !== "paid") redirect(orderPagePath(order.order_no, order.id, locale));

  const t = await getTranslations("paymentResultPage");
  const orderToken = signOrderToken(order.id);
  const site = order.site_snapshot;
  const expired =
    !order.paid_at && (order.status === "expired" || (order.payment_expires_at ? new Date(order.payment_expires_at).getTime() <= Date.now() : false));
  const view = order.paid_at ? "success" : expired ? "expired" : order.status === "payment_failed" ? "failed" : "pending";

  return (
    <SectionWrapper variant="light" className="!py-20 lg:!py-28">
      <div className="mx-auto max-w-2xl">
        {order.is_test ? (
          <p className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{t("test")}</p>
        ) : null}

        <div className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm sm:p-10">
          <p
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${
              view === "success" ? "bg-[#1B6B3A]/10 text-[#1B6B3A]" : "bg-[#b45309]/10 text-[#92400e]"
            }`}
          >
            {t(`${view}.badge`)}
          </p>
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-[#0e2519] sm:text-4xl">{t(`${view}.title`)}</h1>

          <dl className="mt-7 divide-y divide-black/5 rounded-2xl border border-black/5 bg-[#f7faf7] px-5 text-sm">
            <Row label={t("rows.orderNo")} value={<span className="whitespace-nowrap font-mono tracking-wide">{order.order_no}</span>} />
            <Row label={t("rows.site")} value={site.name} />
            <Row label={t("rows.quantity")} value={formatCount(order.quantity, priceLocale)} />
            <Row label={t("rows.total")} value={formatTry(order.total_kurus, priceLocale)} />
          </dl>

          {view === "success" ? (
            <>
              <div className="mt-7 space-y-3 text-[15px] leading-relaxed text-[#3d5a3d]">
                <p>{t("success.body")}</p>
                <p>{t("success.email", { email: order.buyer_email })}</p>
                {order.performance_deadline ? <p>{t("success.deadline", { date: formatLongDay(order.performance_deadline, locale) })}</p> : null}
                {order.withdrawal_deadline ? (
                  <p>{t("success.withdrawal", { date: formatLongDay(trToday(new Date(order.withdrawal_deadline)), locale) })}</p>
                ) : null}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={{ pathname: `/siparis/${order.order_no}`, query: orderToken ? { t: orderToken } : {} }}
                  className="vitrin-cta-primary text-center"
                >
                  {t("success.cta")}
                </Link>
                <Link href={SITES_HREF} className="vitrin-cta-secondary text-center">
                  {t("success.sites")}
                </Link>
              </div>
            </>
          ) : view === "expired" ? (
            <>
              <div className="mt-7 space-y-3 text-[15px] leading-relaxed text-[#3d5a3d]">
                <p>{t("expired.body")}</p>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={site.slug ? siteDetailHref({ slug: site.slug }) : SITES_HREF} className="vitrin-cta-primary text-center">
                  {t("expired.cta")}
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="mt-7 space-y-3 text-[15px] leading-relaxed text-[#3d5a3d]">
                <p>
                  {t(`${view}.body`)}{" "}
                  {order.payment_expires_at ? t("failed.held", { time: formatTrClock(order.payment_expires_at) }) : null}
                </p>
                <p className="text-sm text-[#6b8f6b]">{t("failed.hint")}</p>
              </div>
              <RetryPaymentButton
                orderNo={order.order_no}
                token={token}
                labels={{
                  retry: t("failed.retry"),
                  retrying: t("failed.retrying"),
                  errors: {
                    expired: t("errors.expired"),
                    closed: t("errors.closed"),
                    rate_limited: t("errors.rateLimited"),
                    generic: t("errors.generic"),
                  },
                }}
              />
            </>
          )}
        </div>
      </div>
    </SectionWrapper>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="text-[#6b8f6b]">{label}</dt>
      <dd className="text-right font-semibold text-[#0e2519]">{value}</dd>
    </div>
  );
}
