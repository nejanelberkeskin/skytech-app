import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getOrderView } from "@/lib/orders/view-data";
import { ORDER_NO_RE } from "@/lib/orders/types";
import { buildPageMetadata } from "@/lib/seo";
import type { PriceLocale } from "@/lib/pricing";
import OrderDetails from "@/components/vitrin/siparis-durumu/OrderDetails";

type Props = {
  params: Promise<{ locale: PriceLocale; no: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, no } = await params;
  const t = await getTranslations({ locale, namespace: "orderStatusPage" });
  return {
    ...buildPageMetadata(
      {
        title: t("title"),
        description: t("description"),
        path: `/siparis/${encodeURIComponent(no)}`,
        noindex: true,
      },
      locale,
    ),
    referrer: "no-referrer",
  };
}
export default async function OrderPage({ params, searchParams }: Props) {
  const { locale, no } = await params;
  setRequestLocale(locale);
  if (!ORDER_NO_RE.test(no)) notFound();
  const { t: token } = await searchParams;
  // Misafir müşteri e-postadaki belirteçle, üye kendi siparişine oturumuyla erişir.
  let userId: string | null = null;
  if (typeof token !== "string") {
    try {
      const auth = await createSupabaseServer();
      userId = (await auth.auth.getUser()).data.user?.id ?? null;
    } catch {
      userId = null;
    }
  }
  const order = await getOrderView(no, {
    token: typeof token === "string" ? token : null,
    userId,
  });
  if (!order) notFound();
  const formatter = new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : locale,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Istanbul",
    },
  );
  const refundDueOn = order.refund
    ? new Date(
        new Date(`${order.refund.requestedOn}T12:00:00Z`).getTime() +
          14 * 86400000,
      )
        .toISOString()
        .slice(0, 10)
    : null;
  const days = [
    order.createdOn,
    order.schedule.performanceDeadline,
    order.schedule.withdrawalLastDay,
    order.releasedOn,
    order.refund?.requestedOn,
    order.refund?.completedOn,
    refundDueOn,
    order.invoice?.issuedOn,
    ...order.timeline.map((s) => s.on),
  ];
  const dates: Record<string, string> = {};
  for (const day of days)
    if (day) dates[day] = formatter.format(new Date(`${day}T12:00:00Z`));
  const today = new Date(new Date().getTime() + 3 * 3600000).toISOString().slice(0, 10);
  return (
    <OrderDetails
      order={order}
      locale={locale}
      dates={dates}
      refundDueOn={refundDueOn}
      withdrawalExpired={order.schedule.withdrawalLastDay < today}
    />
  );
}
