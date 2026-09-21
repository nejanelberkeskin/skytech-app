import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatCount, formatTry, type PriceLocale } from "@/lib/pricing";
import type { PublicOrderView } from "@/lib/orders/view";
import { COMPANY } from "@/lib/company";
import { SITES_HREF, siteDetailHref } from "@/lib/sites/links";
import CopyOrderNumber, { OrderAccessPrivacy } from "./OrderControls";
import OrderTimeline from "./OrderTimeline";

function Card({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="rounded-3xl border border-[#1B6B3A]/15 bg-white p-6 sm:p-8"
    >
      <h2 id={`${id}-title`} className="mb-4 text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
function Rows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-[#1B6B3A]/10">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid min-w-0 gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-4"
        >
          <dt className="text-sm text-[#526352]">{row.label}</dt>
          <dd className="break-words text-sm font-semibold sm:text-right">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
const linkClass =
  "inline-flex min-h-11 items-center rounded-xl border border-[#1B6B3A]/25 px-4 py-2 text-sm font-semibold text-[#1B6B3A] underline-offset-4 hover:underline";
export default async function OrderDetails({
  order,
  locale,
  dates,
  refundDueOn,
  withdrawalExpired,
}: {
  order: PublicOrderView;
  locale: PriceLocale;
  dates: Record<string, string>;
  refundDueOn: string | null;
  withdrawalExpired: boolean;
}) {
  const [t, sites, seeds] = await Promise.all([
    getTranslations({ locale, namespace: "orderStatusPage" }),
    getTranslations({ locale, namespace: "sitesPage" }),
    getTranslations({ locale, namespace: "ourSeeds" }),
  ]);
  const interrupted = [
    "withdrawal_requested",
    "cancelled_by_seller",
    "refunded",
  ].includes(order.status);
  const mail = (
    <a
      href={`mailto:${COMPANY.email}`}
      rel="noreferrer"
      className="break-all font-semibold text-[#1B6B3A] underline underline-offset-4"
    >
      {COMPANY.email}
    </a>
  );
  return (
    <div className="vitrin-container space-y-7 pb-20 pt-32 text-[#0e2519] sm:pt-40 motion-reduce:[&_*]:!transition-none motion-reduce:[&_*]:!animate-none">
      <OrderAccessPrivacy orderNo={order.orderNo} />
      {order.isTest && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {t("testOrder")}
        </p>
      )}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="display-headline text-3xl font-semibold sm:text-5xl">
            {t("title")}
          </h1>
          <span
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${interrupted ? "border-amber-200 bg-amber-50 text-amber-900" : "border-[#1B6B3A]/20 bg-[#edf4e9] text-[#1B6B3A]"}`}
          >
            {t(`statuses.${order.status}`)}
          </span>
        </div>
        <CopyOrderNumber orderNo={order.orderNo} />
        <p className="text-lg">
          {t("greeting", { name: order.buyerFirstName })}
        </p>
        <p className="text-sm text-[#526352]">
          {t("createdOn", { date: dates[order.createdOn] })}
        </p>
      </header>
      {order.refund && (
        <section
          aria-labelledby="refund-title"
          className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
            {t(`refund.${order.refund.reason}`)}
          </p>
          <h2 id="refund-title" className="text-xl font-semibold">
            {t(`refund.${order.refund.status}`)}
          </h2>
          <p className="mt-4 text-sm">
            {t("refund.requestedOn", { date: dates[order.refund.requestedOn] })}
          </p>
          {order.refund.status === "succeeded" ? (
            <p className="mt-2 font-semibold">
              {order.refund.completedOn
                ? t("refund.completedOn", {
                    date: dates[order.refund.completedOn],
                  })
                : t("refund.succeeded")}
            </p>
          ) : (
            refundDueOn && (
              <p className="mt-2 font-semibold">
                {t("refund.dueOn", { date: dates[refundDueOn] })}
              </p>
            )
          )}
          <p className="mt-4 text-sm leading-relaxed text-[#526352]">
            {t("refund.bankNote")}
          </p>
        </section>
      )}
      <OrderTimeline
        timeline={order.timeline}
        dates={dates}
        locale={locale}
        subdued={interrupted}
        completed={order.status === "completed"}
      />
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card id="order-summary" title={t("summary.title")}>
          <Rows
            rows={[
              {
                label: t("summary.site"),
                value: order.site.slug ? (
                  <Link
                    href={siteDetailHref({ slug: order.site.slug })}
                    prefetch={false}
                    rel="noreferrer"
                    className="text-[#1B6B3A] underline underline-offset-4"
                  >
                    {order.site.name}
                  </Link>
                ) : (
                  order.site.name
                ),
              },
              ...(order.site.location
                ? [{ label: t("summary.location"), value: order.site.location }]
                : []),
              {
                label: t("summary.workType"),
                value: sites(`workTypes.${order.site.workType}`),
              },
              ...(order.species.length
                ? [
                    {
                      label: t("summary.species"),
                      value: order.species
                        .map((s) =>
                          seeds.has(`seeds.${s.slug}.name`)
                            ? seeds(`seeds.${s.slug}.name`)
                            : s.name,
                        )
                        .join(" · "),
                    },
                  ]
                : []),
              {
                label: t("summary.quantity"),
                value: formatCount(order.quantity, locale),
              },
              {
                label: t("summary.unitPrice"),
                value: formatTry(order.totals.unitPriceKurus, locale),
              },
              {
                label: t("summary.total"),
                value: formatTry(order.totals.totalKurus, locale),
              },
              {
                label: t("summary.certificateName"),
                value: order.certificateName,
              },
            ]}
          />
        </Card>
        <div className="min-w-0 space-y-7">
          <Card id="order-schedule" title={t("schedule.title")}>
            <p className="text-sm text-[#526352]">
              {t("schedule.season", { season: order.schedule.seasonLabel })}
            </p>
            <p className="mt-3 font-semibold leading-relaxed">
              {t(
                interrupted ? "schedule.originalDeadline" : "schedule.deadline",
                { date: dates[order.schedule.performanceDeadline] },
              )}
            </p>
            {order.releasedOn && (
              <p className="mt-3 text-sm">
                {t("schedule.releasedOn", { date: dates[order.releasedOn] })}
              </p>
            )}
          </Card>
          {!interrupted && (
            <Card id="withdrawal-right" title={t("withdrawal.title")}>
              {order.canWithdraw ? (
                <>
                  <p className="mb-5 text-sm leading-relaxed text-[#526352]">
                    {t("withdrawal.available", {
                      date: dates[order.schedule.withdrawalLastDay],
                    })}
                  </p>
                  <Link
                    href={{ pathname: "/cayma", query: { no: order.orderNo } }}
                    rel="noreferrer"
                    prefetch={false}
                    className={linkClass}
                  >
                    {t("withdrawal.action")}
                  </Link>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-[#526352]">
                  {withdrawalExpired
                    ? t("withdrawal.expired", {
                        date: dates[order.schedule.withdrawalLastDay],
                      })
                    : t("withdrawal.unavailable")}{" "}
                  {mail}
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
      <Card id="order-documents" title={t("documents.title")}>
        {locale !== "tr" && (
          <p className="mb-4 text-sm text-[#526352]">{t("documents.languageNote")}</p>
        )}
        <ul className="divide-y divide-[#1B6B3A]/10">
          {order.documents.map((doc) => (
            <li
              key={doc.kind}
              className="flex min-w-0 flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <h3 className="font-semibold">
                  {t(`documents.kinds.${doc.kind}`)}
                </h3>
                <p className="mt-2 break-words text-xs text-[#526352]">
                  {t("documents.hash", { hash: `${doc.sha256.slice(0, 12)}…` })}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <a
                  href={doc.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className={linkClass}
                  aria-label={t("documents.viewNamed", {
                    title: t(`documents.kinds.${doc.kind}`),
                  })}
                >
                  {t("documents.view")}
                </a>
                <a
                  href={doc.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className={linkClass}
                  aria-label={t("documents.pdfNamed", {
                    title: t(`documents.kinds.${doc.kind}`),
                  })}
                >
                  {t("documents.pdf")}
                </a>
              </div>
            </li>
          ))}
        </ul>
        {order.documents.length === 0 && (
          <p className="text-sm text-[#526352]">{t("documents.pending")}</p>
        )}
      </Card>
      <div className="grid items-start gap-7 lg:grid-cols-2">
        {(order.certificate || !interrupted) && (
          <Card id="order-certificate" title={t("certificate.title")}>
            {order.certificate ? (
              <>
                <p className="mb-4 break-words text-sm leading-relaxed text-[#526352]">
                  {order.certificate.status === "cancelled"
                    ? t("certificate.cancelled")
                    : t("certificate.ready")}
                </p>
                <Link
                  href={`/sertifika/${order.certificate.code}`}
                  prefetch={false}
                  rel="noreferrer"
                  className={linkClass}
                >
                  {t("certificate.view")}
                </Link>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-[#526352]">
                {t("certificate.pending")}
              </p>
            )}
          </Card>
        )}
        {(order.videoUrl || (order.releasedOn && !interrupted)) && (
          <Card id="order-video" title={t("video.title")}>
            {order.videoUrl ? (
              <a
                href={order.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className={linkClass}
              >
                {t("video.view")}
              </a>
            ) : (
              <p className="text-sm leading-relaxed text-[#526352]">
                {t("video.pending")}
              </p>
            )}
          </Card>
        )}
        {(order.invoice || !interrupted) && (
          <Card id="order-invoice" title={t("invoice.title")}>
            {order.invoice ? (
              <>
                <p className="text-sm text-[#526352]">
                  {order.invoice.status === "issued"
                    ? order.invoice.issuedOn
                      ? t("invoice.issuedOn", {
                          date: dates[order.invoice.issuedOn],
                        })
                      : t("invoice.issued")
                    : t("invoice.pending")}
                </p>
                {order.invoice.pdfUrl && (
                  <a
                    href={order.invoice.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className={`${linkClass} mt-4`}
                  >
                    {t("invoice.pdf")}
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm leading-relaxed text-[#526352]">
                {t("invoice.notYet")}
              </p>
            )}
          </Card>
        )}
      </div>
      <section
        aria-labelledby="order-help-title"
        className="rounded-3xl bg-[#f1f5ed] p-6 sm:p-8"
      >
        <h2 id="order-help-title" className="text-lg font-semibold">
          {t("help.title")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#526352]">
          {t("help.description")} {mail}
        </p>
        <Link
          href={SITES_HREF}
          prefetch={false}
          rel="noreferrer"
          className="mt-4 inline-block min-h-11 py-3 text-sm font-semibold text-[#1B6B3A] underline underline-offset-4"
        >
          {t("help.sites")}
        </Link>
      </section>
    </div>
  );
}
