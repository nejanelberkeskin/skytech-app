import { permanentRedirect } from "next/navigation";

/** The old landing contained demo totals and unsupported carbon claims. Keep one public service page. */
export default async function CorporateLanding({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(`${locale === "tr" ? "" : `/${locale}`}/kurumsal-cozumler`);
}
