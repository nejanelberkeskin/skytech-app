import type { SiteLocale } from "./types";

/** Translate only a known generic Turkish suffix; preserve place names and authored translations. */
export function localizeSiteName(name: string, locale: SiteLocale): string {
  if (locale === "tr") return name;
  const suffix = locale === "en" ? "Project Site" : "проектный участок";
  return name.replace(/Proje Uygulama Sahası$/u, suffix);
}
