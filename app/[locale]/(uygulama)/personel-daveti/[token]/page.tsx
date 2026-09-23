import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AcceptInvitation from "@/components/admin/access/AcceptInvitation";
export const metadata: Metadata = {
  title: "Personel daveti",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  alternates: { canonical: null, languages: {} },
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) notFound();
  return <AcceptInvitation token={token} />;
}
