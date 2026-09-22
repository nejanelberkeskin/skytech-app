import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SITES_HREF } from "@/lib/sites/links";
import { OrderAccessPrivacy } from "@/components/vitrin/siparis-durumu/OrderControls";

export default async function OrderNotFound() {
  const t = await getTranslations("orderStatusPage.notFound");
  return (
    <div className="vitrin-container min-h-[65svh] pb-20 pt-40">
      <OrderAccessPrivacy />
      <p className="mb-4 font-mono text-sm text-[#526352]">404</p>
      <h1 className="text-3xl font-semibold text-[#0e2519]">{t("title")}</h1>
      <p className="mt-4 max-w-xl leading-relaxed text-[#526352]">
        {t("description")}
      </p>
      <Link
        href={SITES_HREF}
        rel="noreferrer"
        className="mt-6 inline-block min-h-11 py-3 font-semibold text-[#1B6B3A] underline"
      >
        {t("back")}
      </Link>
    </div>
  );
}
