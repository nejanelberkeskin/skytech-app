import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Bütün sayfalar app/[locale] altında: iç bağlantı dil önekini @/i18n/navigation'dan alır.
  // Öneksiz next/link EN/RU ziyaretçisini Türkçe sayfaya götürür; iyimser rota tahmini açıkken
  // (next.config.ts) görünür bağlantı sonsuz ön yükleme döngüsüne de girer (scripts/e2e/prefetch-loop.mjs).
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: "Link'i @/i18n/navigation'dan alın: öneksiz href EN/RU ziyaretçisini Türkçe sayfaya götürür.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
