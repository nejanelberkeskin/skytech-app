/**
 * Satışa hazırlık — Yönetim → Satış Ayarları'nın üstünde gösterilir. YALNIZ SUNUCU.
 *
 * "Şu an sipariş alınıyor mu?" sorusunun cevabı sipariş uçlarıyla AYNI kapıdan gelir
 * (`canAcceptOrders`). Altındaki maddeler açılış kontrol listesinin koddan okunabilen kısmıdır:
 *   blocker → sipariş alınmasını şu an engelliyor
 *   warning → sipariş alınır ama açılıştan önce tamamlanmalı
 *   ok      → hazır
 * Gizli değerler (anahtarlar, parolalar) HİÇBİR KOŞULDA dönmez; yalnız tanımlı olup olmadıkları.
 */
import { COMPANY, missingCompanyFields } from "@/lib/company";
import { LEGAL_DOCUMENTS_VERSION, isDraftLegalVersion } from "@/lib/legal/version";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/visibility";
import { getPaymentProvider } from "@/lib/payments";
import { SALES_ENABLED } from "@/lib/site-config";
import { canAcceptOrders } from "./gate";
import type { SalesSettings } from "./settings-schema";

export type ReadinessLevel = "ok" | "warning" | "blocker";

export interface ReadinessItem {
  key: string;
  level: ReadinessLevel;
  label: string;
  detail: string;
}

export interface SalesReadiness {
  /** Sipariş uçlarının şu anki kararı (bayrak + sağlayıcı + hukuki metin kilidi + durdurma). */
  accepting: boolean;
  environment: "production" | "preview" | "development";
  items: ReadinessItem[];
}

const COMPANY_FIELD_LABELS: Record<string, string> = {
  mersis: "MERSİS no",
  kep: "KEP adresi",
  phone: "telefon",
  tradeRegistryNo: "ticaret sicil no",
  tradeRegistryOffice: "ticaret sicil müdürlüğü",
  chamber: "meslek odası",
};

type Env = Record<string, string | undefined>;

function providerLabel(provider: { name: string; isTest: boolean }): string {
  if (provider.name === "mock") return "deneme sağlayıcısı";
  if (provider.name === "iyzico") return provider.isTest ? "iyzico deneme ortamı" : "iyzico";
  return provider.name;
}

export function salesReadiness(settings: Pick<SalesSettings, "ordersPaused">, env: Env = process.env): SalesReadiness {
  const provider = getPaymentProvider();
  const environment = env.VERCEL_ENV === "production" ? "production" : env.VERCEL_ENV === "preview" ? "preview" : "development";
  const draft = isDraftLegalVersion();
  // Taslak metin canlıda ya da gerçek sağlayıcıyla siparişi engeller; önizlemede deneme siparişine izin verir.
  const draftBlocks = draft && (environment === "production" || !provider?.isTest);
  const missing = missingCompanyFields();
  const items: ReadinessItem[] = [];
  const add = (key: string, level: ReadinessLevel, label: string, detail: string) => items.push({ key, level, label, detail });

  add(
    "salesFlag",
    SALES_ENABLED ? "ok" : "blocker",
    SALES_ENABLED ? "Satış bayrağı açık" : "Satış bayrağı kapalı",
    SALES_ENABLED
      ? "NEXT_PUBLIC_SALES_ENABLED=true."
      : "NEXT_PUBLIC_SALES_ENABLED açık değil; sihirbaz talep toplar. Açılış günü en son açılır (değişiklik yeniden dağıtım ister).",
  );
  add(
    "provider",
    !provider ? "blocker" : provider.isTest ? "warning" : "ok",
    !provider ? "Ödeme sağlayıcısı yok" : provider.isTest ? `Deneme ödemesi (${providerLabel(provider)})` : `Ödeme: ${providerLabel(provider)}, canlı`,
    !provider
      ? "PAYMENT_PROVIDER tanımlı değil ya da anahtarları eksik."
      : provider.isTest
        ? "Siparişler deneme sayılır, gerçek para alınmaz. Canlı için iyzico canlı anahtarları ve IYZICO_BASE_URL gerekir."
        : "Gerçek ödeme alınır.",
  );
  add(
    "legal",
    !draft ? "ok" : draftBlocks ? "blocker" : "warning",
    draft ? "Hukuki metinler taslak" : "Hukuki metinler kesin",
    draft
      ? `Sürüm ${LEGAL_DOCUMENTS_VERSION}. Avukat onayından sonra "-taslak" eki kalkar; o zamana kadar canlıda gerçek sipariş alınmaz${draftBlocks ? "" : " (burada yalnız deneme siparişi alınabilir)"}.`
      : `Sürüm ${LEGAL_DOCUMENTS_VERSION}.`,
  );
  add(
    "paused",
    settings.ordersPaused ? "blocker" : "ok",
    settings.ordersPaused ? "Sipariş alımı durduruldu" : "Sipariş alımı açık",
    settings.ordersPaused ? "Aşağıdaki kutudan yeniden açılır." : "Aşağıdaki kutudan geçici olarak durdurulabilir.",
  );
  add(
    "legalPages",
    LEGAL_PAGES_ENABLED ? "ok" : "warning",
    LEGAL_PAGES_ENABLED ? "Hukuk sayfaları yayında" : "Hukuk sayfaları canlıda gizli",
    LEGAL_PAGES_ENABLED
      ? "Ön bilgilendirme, sözleşme, cayma ve KVKK sayfaları herkese açık."
      : "NEXT_PUBLIC_LEGAL_PAGES_ENABLED açık değil; metinler onaylanınca, açılıştan önce açılmalı.",
  );
  add(
    "company",
    missing.length ? "warning" : "ok",
    missing.length ? "Şirket künyesinde eksik var" : "Şirket künyesi tam",
    missing.length
      ? `Eksik: ${missing.map((k) => COMPANY_FIELD_LABELS[k] ?? k).join(", ")} (lib/company.ts).`
      : `${COMPANY.legalName}.`,
  );
  add(
    "email",
    env.RESEND_API_KEY ? "ok" : "warning",
    env.RESEND_API_KEY ? "E-posta gönderimi tanımlı" : "E-posta gönderilmiyor",
    env.RESEND_API_KEY
      ? "Sipariş teyidi, belgeler ve bildirimler gönderilir."
      : "RESEND_API_KEY tanımlı değil: sipariş teyidi ve belgeler müşteriye gitmez.",
  );
  add(
    "cron",
    env.CRON_SECRET ? "ok" : "warning",
    env.CRON_SECRET ? "Zamanlanmış işler tanımlı" : "Zamanlanmış işler kapalı",
    env.CRON_SECRET
      ? "Süresi dolan siparişler düşer, cayma süresi dolanlar kesinleşir, bildirimler gider."
      : "CRON_SECRET tanımlı değil: ödenmeyen siparişler kendiliğinden düşmez (kapasite ayrılı kalır), kesinleşme ve bildirimler yalnız yönetim ekranları açıldıkça işler.",
  );
  add(
    "orderLinks",
    env.ORDER_LINK_SECRET ? "ok" : "warning",
    env.ORDER_LINK_SECRET ? "Sipariş bağlantı anahtarı tanımlı" : "Sipariş bağlantı anahtarı yok",
    env.ORDER_LINK_SECRET
      ? "E-postalardaki sipariş bağlantıları kendi anahtarıyla imzalanır (sonradan değiştirilirse eski bağlantılar geçersizleşir)."
      : "ORDER_LINK_SECRET tanımlı değil: bağlantılar veritabanı anahtarından türetiliyor; o anahtar yenilenirse eski bağlantılar açılmaz.",
  );
  add(
    "appUrl",
    env.NEXT_PUBLIC_APP_URL ? "ok" : "warning",
    env.NEXT_PUBLIC_APP_URL ? `Site adresi: ${env.NEXT_PUBLIC_APP_URL}` : "Site adresi tanımlı değil",
    env.NEXT_PUBLIC_APP_URL
      ? "E-postalardaki bağlantılar bu adrese gider."
      : "NEXT_PUBLIC_APP_URL tanımlı değil: e-postalardaki bağlantılar https://skytechgreen.com'a gider.",
  );

  return { accepting: canAcceptOrders(provider, settings), environment, items };
}
