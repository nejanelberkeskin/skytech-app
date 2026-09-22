import { NextRequest } from "next/server";
import { getPublicCertificate } from "@/lib/certificates/data";
import { renderCertificate } from "@/lib/certificates/render";

export const runtime = "nodejs";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kod: string }> },
) {
  const { kod } = await params;
  const certificate = await getPublicCertificate(kod);
  if (!certificate)
    return new Response(null, {
      status: 404,
      headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
    });
  const format =
    request.nextUrl.searchParams.get("b") === "yatay" ? "yatay" : "dikey";
  const language = request.nextUrl.searchParams.get("dil");
  const locale = language === "en" || language === "ru" ? language : "tr";
  return renderCertificate(certificate, locale, format);
}
