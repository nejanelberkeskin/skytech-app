/** Legal document bodies are published in Turkish; localized navigation is not a translation. */
export const TURKISH_LEGAL_PATHS = [
  "/gizlilik-politikasi", "/kullanim-kosullari", "/kvkk", "/cerez-politikasi",
  "/on-bilgilendirme", "/mesafeli-satis-sozlesmesi", "/cayma-ve-iade",
  "/ifa-kosullari", "/islem-rehberi",
] as const;
export function isTurkishLegalPage(path: string): boolean {
  return (TURKISH_LEGAL_PATHS as readonly string[]).includes(path);
}

/** Canonicalize content routes only; private/token routes retain their existing access flow. */
export function canonicalTurkishContentPath(pathname: string): string | null {
  if (pathname === "/tr" || pathname === "/tr/") return "/";
  if (!pathname.startsWith("/tr/")) return null;
  const path = pathname.slice(3);
  const root = "/" + path.split("/")[1];
  const content = ["/kaplamali-tohum", "/tohum-topu", "/tohumlarimiz", "/dron-teknolojisi", "/karbon-programi", "/projeler", "/kurumsal-cozumler", "/hakkimizda", "/iletisim", "/bilgi-al", "/kendi-arazim", "/sahalar", ...TURKISH_LEGAL_PATHS];
  return content.includes(root) ? path : null;
}

/** Host canonicalization is for public SEO content, not host-bound account/order cookies. */
export function isSeoContentPath(pathname: string): boolean {
  const unprefixed = pathname.replace(/^\/(tr|en|ru)(?=\/|$)/, "") || "/";
  return canonicalTurkishContentPath(`/tr${unprefixed === "/" ? "" : unprefixed}`) !== null;
}
