import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "en" ? "Corporate quote" : locale === "ru" ? "Корпоративное предложение" : "Kurumsal teklif";
  return buildPageMetadata({ title, description: title, path: "/kurumsal/teklif-al", noindex: true }, locale);
}
export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
