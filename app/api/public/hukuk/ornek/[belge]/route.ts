import { NextRequest } from "next/server";
import { rateLimit, getClientIP } from "@/lib/admin-auth";
import { renderLegalHtml } from "@/lib/legal/render-html";
import { renderLegalPdf } from "@/lib/legal/render-pdf";
import { sha256Hex } from "@/lib/legal/documents";
import { sampleLegalContext } from "@/lib/legal/sample";
import { contractDocument } from "@/lib/legal/templates/contract";
import { preInfoDocument } from "@/lib/legal/templates/pre-info";
import { kvkkNoticePublicDocument } from "@/lib/legal/templates/kvkk-notice";
import type { LegalContext } from "@/lib/legal/types";
import { withdrawalFormDocument } from "@/lib/legal/templates/withdrawal-form";
import { legalPagesVisible } from "@/lib/legal/visibility";

/**
 * GET /api/public/hukuk/ornek/[belge] — hukuki metinlerin ÖRNEK (yer tutuculu) PDF'i.
 * Kişisel veri içermez. Hukuk sayfaları görünür değilken 404.
 *
 *   belge: on-bilgilendirme | mesafeli-hizmet-sozlesmesi | cayma-formu | kvkk-aydinlatma-metni
 */
export const runtime = "nodejs";

const BUILDERS = {
  "on-bilgilendirme": preInfoDocument,
  "mesafeli-hizmet-sozlesmesi": contractDocument,
  "cayma-formu": withdrawalFormDocument,
  // Genel metin: siparişe bağlı künye (sipariş no, tarih) yazılmaz.
  "kvkk-aydinlatma-metni": (ctx: LegalContext) => kvkkNoticePublicDocument(ctx.version),
} as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ belge: string }> }) {
  const { belge } = await params;
  const build = Object.hasOwn(BUILDERS, belge) ? BUILDERS[belge as keyof typeof BUILDERS] : null;
  if (!build || !legalPagesVisible()) {
    return new Response(null, { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  }

  // PDF üretimi işlemci kullanır; aynı IP'den art arda istekleri sınırla.
  const limited = rateLimit(`hukuk-pdf:${getClientIP(req)}`, 20, 10 * 60_000);
  if (limited) return limited;

  const document = build(sampleLegalContext());
  const pdf = renderLegalPdf(document, { sha256: sha256Hex(renderLegalHtml(document)) });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="skytech-green-${belge}-ornek.pdf"`,
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
