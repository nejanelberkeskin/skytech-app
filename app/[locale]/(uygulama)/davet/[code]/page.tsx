import { redirect } from "next/navigation";
/** Eski davet sistemi aktif satış modeli dışındadır; ad sorgulamaz ve takip çerezi yazmaz. */
export default async function DavetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(locale === "tr" ? "/sahalar" : `/${locale}/sahalar`);
}
export const metadata = { robots: { index: false, follow: false } };
