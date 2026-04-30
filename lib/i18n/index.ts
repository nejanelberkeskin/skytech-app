import { DEFAULT_LANGUAGE, type Language } from "./config";
import tr, { type Dictionary } from "./dictionaries/tr";
import en from "./dictionaries/en";

const DICTIONARIES: Record<Language, Dictionary> = { tr, en };

/**
 * Server-side dictionary lookup. App router server component'lerinde:
 *
 *   const dict = getDictionary("tr");
 *   <h1>{dict.hero.line1}</h1>
 */
export function getDictionary(lang: Language = DEFAULT_LANGUAGE): Dictionary {
  return DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LANGUAGE];
}

export type { Dictionary } from "./dictionaries/tr";
export {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  isSupportedLanguage,
  getLanguageFromPath,
  localizedHref,
  type Language,
} from "./config";
