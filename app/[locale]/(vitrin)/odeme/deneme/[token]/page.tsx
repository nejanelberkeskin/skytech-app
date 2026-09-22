import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import MockPaymentActions from "@/components/vitrin/odeme/MockPaymentActions";
import { db, getOrderByPaymentToken } from "@/lib/orders/store";
import { getPaymentProvider } from "@/lib/payments";
import { parseMockToken, signMockOutcome } from "@/lib/payments/mock";
import { formatCount, formatTry } from "@/lib/pricing";

/* DENEME ödeme sayfası — sanal POS'un barındırdığı ödeme sayfasının yerini tutar.
   Yalnız PAYMENT_PROVIDER=mock iken ve canlı dağıtım DIŞINDA açılır; aksi hâlde 404.
   Bir geliştirme aracıdır: metinleri çevrilmez, dizine eklenmez. */

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Deneme ödeme sayfası",
  robots: { index: false, follow: false },
};

export default async function MockPaymentPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token: raw } = await params;
  setRequestLocale(locale);

  const provider = getPaymentProvider();
  if (!provider || provider.name !== "mock") notFound();

  let token = raw;
  try {
    token = decodeURIComponent(raw);
  } catch {
    notFound();
  }
  const parsed = parseMockToken(token);
  if (!parsed) notFound();
  const order = await getOrderByPaymentToken(db(), token);
  if (!order) notFound();

  return (
    <SectionWrapper variant="light" className="!py-20 lg:!py-28">
      <div className="mx-auto max-w-xl">
        <p className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          DENEME ORTAMI — bu sayfa sanal POS&apos;un yerini tutar. Gerçek kart bilgisi istenmez, para hareketi olmaz;
          oluşan sipariş &quot;deneme siparişi&quot; olarak işaretlenir.
        </p>
        <div className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm sm:p-9">
          <h1 className="text-2xl font-bold tracking-tight text-[#0e2519]">Deneme ödeme sayfası</h1>
          <dl className="mt-6 divide-y divide-black/5 text-sm">
            <Row label="Sipariş numarası" value={<span className="whitespace-nowrap font-mono">{order.order_no}</span>} />
            <Row label="Proje Uygulama Sahası" value={order.site_snapshot.name} />
            <Row label="Tohum topu adedi" value={formatCount(order.quantity, "tr")} />
            <Row label="Ödenecek tutar (KDV dâhil)" value={<strong>{formatTry(parsed.amountKurus, "tr")}</strong>} />
          </dl>
          <MockPaymentActions
            token={token}
            signatures={{ success: signMockOutcome(token, "success"), failure: signMockOutcome(token, "failure") }}
          />
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
