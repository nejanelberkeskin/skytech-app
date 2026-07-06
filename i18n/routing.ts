import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["tr", "en", "ru"],
  defaultLocale: "tr",
  // /tr/... değil de / olarak kalsın (default locale prefix yok)
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
