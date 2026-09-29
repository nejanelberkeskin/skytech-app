/**
 * Satışa hazırlık — Yönetim → Satış Ayarları'nın üstünde gösterilir. YALNIZ SUNUCU.
 *
 * "Şu an sipariş alınıyor mu?" sorusunun cevabı sipariş uçlarıyla AYNI kapıdan gelir
 * (`canAcceptOrders`). Altındaki maddeler açılış kontrol listesinin koddan okunabilen kısmıdır:
 *   blocker → sipariş alınmasını şu an engelliyor
 *   warning → sipariş alınır ama açılıştan önce tamamlanmalı
 *   ok      → hazır
 * Gizli değerler (anahtarlar, parolalar) HİÇBİR KOŞULDA dönmez; yalnız tanımlı olup olmadıkları.
 *
 * Üç ayrı durum (web-brifler/32 §5): `configured` (anahtar/ayar tanımlı mı), `verification` (çalıştığı
 * KAYITLA kanıtlandı mı) ve `lastResult` (son işlem sonucu). Anahtarın varlığı yalnız ilkini kanıtlar:
 * e-posta teslimi ve zamanlayıcının kendiliğinden çalışması anahtar var diye "hazır" sayılmaz.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANY, missingCompanyFields } from "@/lib/company";
import { JOBS } from "@/lib/jobs/runs";
import { LEGAL_DOCUMENTS_VERSION, isDraftLegalVersion } from "@/lib/legal/version";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/visibility";
import { getPaymentProvider } from "@/lib/payments";
import { SALES_ENABLED } from "@/lib/site-config";
import { canAcceptOrders } from "./gate";
import type { SalesSettings } from "./settings-schema";

export type ReadinessLevel = "ok" | "warning" | "blocker";
/** Çalıştığına dair kanıt: kayıtla doğrulandı / kanıt yok / son deneme başarısız / kanıt okunamadı. */
export type ReadinessVerification = "verified" | "not_verified" | "failed" | "unknown";

export interface ReadinessResult {
  at: string;
  ok: boolean;
  /** cron: zamanlayıcı · admin: yönetimden elle çalıştırma · provider: e-posta sağlayıcısının yanıtı */
  source: "cron" | "admin" | "provider";
}

export interface ReadinessItem {
  key: string;
  level: ReadinessLevel;
  label: string;
  detail: string;
  /** Bu madde için gereken anahtar ya da ayar tamam mı? Tanımlı olması çalıştığını göstermez. */
  configured: boolean;
  /** Dış işleyişi olan maddelerde (e-posta, zamanlayıcı) çalıştığının kanıtı; diğerlerinde null. */
  verification: ReadinessVerification | null;
  /** Son işlem sonucu (kayıt varsa). */
  lastResult: ReadinessResult | null;
}

/** Kayıtlardan okunan kanıt. `null` alan: o kaynak okunamadı. Hiç verilmezse kanıt "unknown" sayılır. */
export interface ReadinessEvidence {
  scheduler: { lastCronSuccessAt: string | null; lastCronFailureAt: string | null; lastManualSuccessAt: string | null } | null;
  email: { lastAcceptedAt: string | null; lastFailedAt: string | null } | null;
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

const newest = (...values: (string | null)[]) => values.filter((v): v is string => !!v).sort().at(-1) ?? null;
const whenText = (iso: string) => new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" });

/** Zamanlanmış iş ve e-posta kayıtlarından kanıt (gizli değer ve alıcı bilgisi okunmaz). */
export async function loadReadinessEvidence(db: SupabaseClient): Promise<ReadinessEvidence> {
  const job = "siparis-isleri";
  const lastRun = (trigger: "cron" | "admin", ok: boolean) =>
    db.from("job_runs").select("finished_at").eq("job", job).eq("trigger", trigger).eq("ok", ok)
      .order("finished_at", { ascending: false }).limit(1);
  const lastMail = (status: "sent" | "failed") =>
    db.from("email_logs").select("created_at").eq("status", status).order("created_at", { ascending: false }).limit(1);
  const [cronOk, cronFail, manualOk, sent, failed] = await Promise.all([
    lastRun("cron", true), lastRun("cron", false), lastRun("admin", true), lastMail("sent"), lastMail("failed"),
  ]);
  const at = (r: { data: unknown }, column: string) => {
    const row = ((r.data ?? []) as Record<string, unknown>[])[0];
    return row && typeof row[column] === "string" ? new Date(row[column] as string).toISOString() : null;
  };
  return {
    scheduler: cronOk.error || cronFail.error || manualOk.error
      ? null
      : { lastCronSuccessAt: at(cronOk, "finished_at"), lastCronFailureAt: at(cronFail, "finished_at"), lastManualSuccessAt: at(manualOk, "finished_at") },
    email: sent.error || failed.error ? null : { lastAcceptedAt: at(sent, "created_at"), lastFailedAt: at(failed, "created_at") },
  };
}

export function salesReadiness(
  settings: Pick<SalesSettings, "ordersPaused">,
  env: Env = process.env,
  evidence?: ReadinessEvidence,
  now: Date = new Date(),
): SalesReadiness {
  const provider = getPaymentProvider();
  const environment = env.VERCEL_ENV === "production" ? "production" : env.VERCEL_ENV === "preview" ? "preview" : "development";
  const draft = isDraftLegalVersion();
  // Taslak metin canlıda ya da gerçek sağlayıcıyla siparişi engeller; önizlemede deneme siparişine izin verir.
  const draftBlocks = draft && (environment === "production" || !provider?.isTest);
  const missing = missingCompanyFields();
  const items: ReadinessItem[] = [];
  const add = (
    key: string, level: ReadinessLevel, label: string, detail: string, configured: boolean,
    verification: ReadinessVerification | null = null, lastResult: ReadinessResult | null = null,
  ) => items.push({ key, level, label, detail, configured, verification, lastResult });

  add(
    "salesFlag",
    SALES_ENABLED ? "ok" : "blocker",
    SALES_ENABLED ? "Satış bayrağı açık" : "Satış bayrağı kapalı",
    SALES_ENABLED
      ? "NEXT_PUBLIC_SALES_ENABLED=true."
      : "NEXT_PUBLIC_SALES_ENABLED açık değil; sihirbaz talep toplar. Açılış günü en son açılır (değişiklik yeniden dağıtım ister).",
    SALES_ENABLED,
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
    Boolean(provider),
  );
  add(
    "legal",
    !draft ? "ok" : draftBlocks ? "blocker" : "warning",
    draft ? "Hukuki metinler taslak" : "Hukuki metinler kesin",
    draft
      ? `Sürüm ${LEGAL_DOCUMENTS_VERSION}. Avukat onayından sonra "-taslak" eki kalkar; o zamana kadar canlıda gerçek sipariş alınmaz${draftBlocks ? "" : " (burada yalnız deneme siparişi alınabilir)"}.`
      : `Sürüm ${LEGAL_DOCUMENTS_VERSION}.`,
    !draft,
  );
  add(
    "paused",
    settings.ordersPaused ? "blocker" : "ok",
    settings.ordersPaused ? "Sipariş alımı durduruldu" : "Sipariş alımı açık",
    settings.ordersPaused ? "Aşağıdaki kutudan yeniden açılır." : "Aşağıdaki kutudan geçici olarak durdurulabilir.",
    !settings.ordersPaused,
  );
  add(
    "legalPages",
    LEGAL_PAGES_ENABLED ? "ok" : "warning",
    LEGAL_PAGES_ENABLED ? "Hukuk sayfaları yayında" : "Hukuk sayfaları canlıda gizli",
    LEGAL_PAGES_ENABLED
      ? "Ön bilgilendirme, sözleşme, cayma ve KVKK sayfaları herkese açık."
      : "NEXT_PUBLIC_LEGAL_PAGES_ENABLED açık değil; metinler onaylanınca, açılıştan önce açılmalı.",
    LEGAL_PAGES_ENABLED,
  );
  add(
    "company",
    missing.length ? "warning" : "ok",
    missing.length ? "Şirket künyesinde eksik var" : "Şirket künyesi tam",
    missing.length
      ? `Eksik: ${missing.map((k) => COMPANY_FIELD_LABELS[k] ?? k).join(", ")} (lib/company.ts).`
      : `${COMPANY.legalName}.`,
    missing.length === 0,
  );
  // E-posta: anahtar gönderimi mümkün kılar; teslim (alan adı doğrulaması, bounce) bu kontrolde kanıtlanmaz.
  const mail = evidence?.email;
  const mailFailedLast = !!mail?.lastFailedAt && (!mail.lastAcceptedAt || mail.lastFailedAt > mail.lastAcceptedAt);
  const mailLast = mail ? newest(mail.lastAcceptedAt, mail.lastFailedAt) : null;
  add(
    "email",
    "warning",
    !env.RESEND_API_KEY ? "E-posta gönderilmiyor" : mailFailedLast ? "E-posta: son gönderim başarısız" : "E-posta tanımlı; teslim doğrulanmadı",
    !env.RESEND_API_KEY
      ? "RESEND_API_KEY tanımlı değil: sipariş teyidi ve belgeler müşteriye gitmez."
      : [
          "Gönderim anahtarı tanımlı.",
          mail == null
            ? "Gönderim kaydı okunamadı; çalıştığı doğrulanamadı."
            : mail.lastAcceptedAt
              ? `Son kabul edilen gönderim: ${whenText(mail.lastAcceptedAt)} (sağlayıcı kabul etti; müşteriye teslim edildiği kanıtlanmadı).`
              : "Henüz kabul edilmiş gönderim kaydı yok.",
          mailFailedLast ? `Son başarısız gönderim: ${whenText(mail!.lastFailedAt!)}.` : "",
          "Alan adı doğrulaması ve teslim takibi bu kontrolde yapılmaz.",
        ].filter(Boolean).join(" "),
    Boolean(env.RESEND_API_KEY),
    !env.RESEND_API_KEY ? "not_verified" : mail == null ? "unknown" : mailFailedLast ? "failed" : "not_verified",
    mail && mailLast ? { at: mailLast, ok: !mailFailedLast, source: "provider" } : null,
  );

  // Zamanlayıcı: yalnız ZAMANLAYICININ (cron) son başarılı çalışması kanıttır; elle çalıştırma zamanlayıcıyı kanıtlamaz.
  const jobs = evidence?.scheduler;
  const staleMs = JOBS["siparis-isleri"].staleAfterHours * 3_600_000;
  const cronFailedLast = !!jobs?.lastCronFailureAt && (!jobs.lastCronSuccessAt || jobs.lastCronFailureAt > jobs.lastCronSuccessAt);
  const cronFresh = !!jobs?.lastCronSuccessAt && !cronFailedLast && now.getTime() - Date.parse(jobs.lastCronSuccessAt) <= staleMs;
  const cronVerification: ReadinessVerification = !env.CRON_SECRET
    ? "not_verified"
    : jobs == null ? "unknown" : cronFailedLast ? "failed" : cronFresh ? "verified" : "not_verified";
  const cronLast = jobs ? newest(jobs.lastCronSuccessAt, jobs.lastCronFailureAt, jobs.lastManualSuccessAt) : null;
  add(
    "cron",
    cronVerification === "verified" ? "ok" : "warning",
    !env.CRON_SECRET
      ? "Zamanlanmış işler kapalı"
      : cronVerification === "verified" ? "Zamanlanmış işler çalışıyor" : cronVerification === "failed" ? "Zamanlanmış iş son çalışmada hata verdi" : "Zamanlayıcının çalıştığı doğrulanmadı",
    [
      !env.CRON_SECRET
        ? "CRON_SECRET tanımlı değil: ödenmeyen siparişler kendiliğinden düşmez (kapasite ayrılı kalır); kesinleşme ve bildirimler yalnız Zamanlanmış İşler ekranından elle çalıştırılınca işler."
        : "İş uçlarının kimlik doğrulama anahtarı tanımlı.",
      jobs == null
        ? "Çalışma kaydı okunamadı."
        : jobs.lastCronSuccessAt
          ? `Zamanlayıcının son başarılı çalışması: ${whenText(jobs.lastCronSuccessAt)}${cronFresh ? "." : ` (${JOBS["siparis-isleri"].staleAfterHours} saatten eski).`}`
          : "Zamanlayıcının başarılı çalışma kaydı yok.",
      jobs && cronFailedLast ? `Son hata: ${whenText(jobs.lastCronFailureAt!)}.` : "",
      jobs?.lastManualSuccessAt ? `Son elle çalıştırma: ${whenText(jobs.lastManualSuccessAt)} (zamanlayıcıyı kanıtlamaz).` : "",
    ].filter(Boolean).join(" "),
    Boolean(env.CRON_SECRET),
    cronVerification,
    jobs && cronLast
      ? {
          at: cronLast,
          ok: !(cronLast === jobs.lastCronFailureAt),
          source: cronLast === jobs.lastManualSuccessAt && cronLast !== jobs.lastCronSuccessAt && cronLast !== jobs.lastCronFailureAt ? "admin" : "cron",
        }
      : null,
  );
  add(
    "orderLinks",
    env.ORDER_LINK_SECRET ? "ok" : "warning",
    env.ORDER_LINK_SECRET ? "Sipariş bağlantı anahtarı tanımlı" : "Sipariş bağlantı anahtarı yok",
    env.ORDER_LINK_SECRET
      ? "E-postalardaki sipariş bağlantıları kendi anahtarıyla imzalanır (sonradan değiştirilirse eski bağlantılar geçersizleşir)."
      : "ORDER_LINK_SECRET tanımlı değil: bağlantılar veritabanı anahtarından türetiliyor; o anahtar yenilenirse eski bağlantılar açılmaz.",
    Boolean(env.ORDER_LINK_SECRET),
  );
  add(
    "appUrl",
    env.NEXT_PUBLIC_APP_URL ? "ok" : "warning",
    env.NEXT_PUBLIC_APP_URL ? `Site adresi: ${env.NEXT_PUBLIC_APP_URL}` : "Site adresi tanımlı değil",
    env.NEXT_PUBLIC_APP_URL
      ? "E-postalardaki bağlantılar bu adrese gider."
      : "NEXT_PUBLIC_APP_URL tanımlı değil: e-postalardaki bağlantılar https://skytechgreen.com'a gider.",
    Boolean(env.NEXT_PUBLIC_APP_URL),
  );

  return { accepting: canAcceptOrders(provider, settings), environment, items };
}
