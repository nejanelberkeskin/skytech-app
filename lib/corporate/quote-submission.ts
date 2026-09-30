/**
 * Kurumsal teklif gönderimi — hesap oluşturma ve teklif kaydı iki ayrı adım, iki ayrı sonuç.
 *
 * - Hesap bu sayfa oturumunda bir kez oluşturulur. Yeniden denemede signUp tekrar çağrılmaz: ikinci
 *   çağrı "zaten kayıtlı" hatası verir ve doğrulanmamış hesaba onay e-postasını yeniden gönderebilir.
 * - Teklif kimliği istemcide bir kez üretilir ve her denemede aynı gider. İlk deneme sunucuda kaydedilip
 *   yanıtı yolda kaybolduysa yeniden deneme birincil anahtar çakışması (23505) alır; mükerrer teklif oluşmaz.
 *   (Oturumsuz istemci kendi teklifini okuyamaz; SELECT yalnız authenticated. Bu yüzden kaydı sorgulamak
 *   yerine kimlik tekrarı kullanılır.)
 * - AYNI KİMLİK ⇒ AYNI İÇERİK: sonucu belirsiz kalan (yanıtı gelmeyen) ilk denemenin içeriği o kimlik için
 *   kalıcı olarak sabitlenir; sonraki her deneme o içeriği gönderir. 23505 ancak böyle bir sabit içerik varken
 *   "kaydedildi" sayılır ve kaydedilen de odur. Sonuç, kaydedilen içeriği (`quote`) ve sonradan yapılan
 *   düzenlemelerin eklenmediğini (`editsDiscarded`) taşır; arayüz düzenlenmiş formu kaydedilmiş gibi göstermez.
 *   Kesin ret (PostgREST'in kodlu hatası: kayıt kesinlikle olmadı) içeriği sabitlemez; düzeltilmiş içerik aynı
 *   kimlikle gönderilebilir. Belirsiz bir denemeden sonra gelen ret sabitlemeyi kaldırmaz: RLS reddi benzersizlik
 *   denetiminden önce gelir, önceki denemenin kaydedilip kaydedilmediğini söylemez.
 * - Aynı anda tek gönderim: ikinci çağrı "busy" döner ve hiçbir istek yapmaz.
 * - Kaydedilmemiş ya da içeriği doğrulanamamış teklif hiçbir zaman "saved" dönmez.
 */

export interface QuoteFields {
  company_name: string;
  tax_office: string;
  tax_no: string;
  contact_person: string;
  corporate_email: string;
  phone: string;
  need_types: string[];
  need_details: string;
  seed_count: string;
  budget_range: string;
  timeline: string;
  notes: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  metadata: Record<string, string>;
}

export interface DbError {
  code?: string;
  message: string;
}

export type QuoteRow = QuoteFields & { id: string; user_id: string; status: "PENDING" };

export interface QuoteSubmitterDeps {
  signUp(input: SignUpInput): Promise<{ userId: string | null; error: string | null }>;
  insertQuote(row: QuoteRow): Promise<{ error: DbError | null }>;
  newId(): string;
  sleep(ms: number): Promise<void>;
}

/**
 * `uncertain`: teklif kaydedilmiş olabilir (yanıt gelmedi); içerik sabitlendi, yeniden deneme onu gönderir.
 * `quote_unverifiable`: bu kimlikte bir kayıt var ama içeriğine kefil olunamıyor (önceden belirsiz deneme yok);
 * uygulamada yalnız kimlik çakışmasıyla olur. Yeniden denenmez; kullanıcı panelden kontrol eder.
 */
export type QuoteSubmitOutcome =
  | { status: "saved"; accountCreated: boolean; quote: QuoteFields; editsDiscarded: boolean }
  | { status: "account_created_quote_failed"; email: string; error: string; uncertain: boolean }
  | { status: "quote_failed"; error: string; uncertain: boolean }
  | { status: "quote_unverifiable"; accountCreated: boolean }
  | { status: "signup_failed"; error: string }
  | { status: "busy" };

export interface CreatedAccount {
  userId: string;
  email: string;
}

/** Yeni hesabın auth kaydı veritabanına henüz yansımadıysa yabancı anahtar hatası geçicidir. */
const FOREIGN_KEY_ATTEMPTS = 3;
const isDuplicate = (error: DbError) => error.code === "23505";
const isForeignKey = (error: DbError) => error.code === "23503" || error.message.includes("foreign key");
/** PostgREST kodlu hata döndürdüyse istek reddedildi, kayıt olmadı. Kod yoksa (ağ, zaman aşımı, ağ geçidi) belirsiz. */
const isDefinitive = (error: DbError) => typeof error.code === "string" && error.code.length > 0;

const QUOTE_KEYS: (keyof QuoteFields)[] = [
  "company_name", "tax_office", "tax_no", "contact_person", "corporate_email", "phone",
  "need_types", "need_details", "seed_count", "budget_range", "timeline", "notes",
];
const sameQuote = (a: QuoteFields, b: QuoteFields) =>
  QUOTE_KEYS.every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));

type SaveResult = { kind: "saved" } | { kind: "duplicate" } | { kind: "rejected" | "uncertain"; error: DbError };

export function createQuoteSubmitter(deps: QuoteSubmitterDeps) {
  const quoteId = deps.newId();
  let account: CreatedAccount | null = null;
  let inFlight = false;
  /** Sonucu belirsiz kalan ilk denemenin içeriği; bir kez sabitlenir, bir daha değişmez. */
  let pinned: QuoteFields | null = null;

  async function saveQuote(userId: string, quote: QuoteFields): Promise<SaveResult> {
    for (let attempt = 1; ; attempt++) {
      const { error } = await deps.insertQuote({ ...quote, id: quoteId, user_id: userId, status: "PENDING" });
      if (!error) return { kind: "saved" };
      if (isDuplicate(error)) return { kind: "duplicate" };
      if (!isDefinitive(error)) return { kind: "uncertain", error };
      if (!isForeignKey(error) || attempt >= FOREIGN_KEY_ATTEMPTS) return { kind: "rejected", error };
      await deps.sleep(1000 * attempt);
    }
  }

  async function submit(input: {
    existingUserId: string | null;
    signUp: SignUpInput;
    quote: QuoteFields;
  }): Promise<QuoteSubmitOutcome> {
    if (inFlight) return { status: "busy" };
    inFlight = true;
    try {
      let userId = input.existingUserId ?? account?.userId ?? null;
      if (!userId) {
        const created = await deps.signUp(input.signUp);
        if (created.error || !created.userId) {
          return { status: "signup_failed", error: created.error ?? "account_not_created" };
        }
        account = { userId: created.userId, email: input.signUp.email };
        userId = created.userId;
      }
      const accountCreated = !input.existingUserId && account !== null;
      const payload = pinned ?? input.quote;
      const editsDiscarded = pinned !== null && !sameQuote(pinned, input.quote);
      const result = await saveQuote(userId, payload);
      if (result.kind === "saved") return { status: "saved", accountCreated, quote: payload, editsDiscarded };
      if (result.kind === "duplicate") {
        // Bu kimlikle yalnız sabit içerik gönderilmiş olabilir; ona kefil olunabilir, başkasına olunamaz.
        return pinned
          ? { status: "saved", accountCreated, quote: pinned, editsDiscarded }
          : { status: "quote_unverifiable", accountCreated };
      }
      if (result.kind === "uncertain" && !pinned) pinned = payload;
      const uncertain = pinned !== null;
      return accountCreated && account
        ? { status: "account_created_quote_failed", email: account.email, error: result.error.message, uncertain }
        : { status: "quote_failed", error: result.error.message, uncertain };
    } finally {
      inFlight = false;
    }
  }

  return {
    submit,
    get quoteId() {
      return quoteId;
    },
    get createdAccount() {
      return account;
    },
    /** Sabitlenmiş içerik (belirsiz bir denemeden sonra); yoksa null. */
    get pinnedQuote() {
      return pinned;
    },
  };
}
