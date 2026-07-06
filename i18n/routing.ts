import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["tr", "en", "ru"],
  defaultLocale: "tr",
  // /tr/... değil de / olarak kalsın (default locale prefix yok)
  localePrefix: "as-needed",
  // Otomatik dil algılamayı KAPAT. Açıkken, tarayıcı dili en/ru olan
  // ziyaretçiler için next-intl kök "/"'ı /en'e yönlendirmeye çalışıyor;
  // özel middleware'imiz bu redirect'i işleyemeyip 404 üretiyordu.
  // Kapalıyken "/" herkese Türkçe (varsayılan) açılır; dil değiştirici ile
  // /en ve /ru açıkça seçilir.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
