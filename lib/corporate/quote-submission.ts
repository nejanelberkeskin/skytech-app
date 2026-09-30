/**
 * Kurumsal teklif gönderimi — hesap oluşturma ve teklif kaydı iki ayrı adım, iki ayrı sonuç.
 *
 * - Hesap bu sayfa oturumunda bir kez oluşturulur. Yeniden denemede signUp tekrar çağrılmaz: ikinci
 *   çağrı "zaten kayıtlı" hatası verir ve doğrulanmamış hesaba onay e-postasını yeniden gönderebilir.
 * - Teklif kimliği istemcide bir kez üretilir ve her denemede aynı gider. İlk deneme sunucuda kaydedilip
 *   yanıtı yolda kaybolduysa yeniden deneme birincil anahtar çakışması (23505) alır; bu "zaten kaydedildi"
 *   demektir, mükerrer teklif oluşmaz. (Oturumsuz istemci kendi teklifini okuyamaz; SELECT yalnız
 *   authenticated. Bu yüzden kaydı sorgulamak yerine kimlik tekrarı kullanılır.)
 * - Aynı anda tek gönderim: ikinci çağrı "busy" döner ve hiçbir istek yapmaz.
 * - Kaydedilmemiş ya da kaydı doğrulanamamış teklif hiçbir zaman "saved" dönmez.
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

export type QuoteSubmitOutcome =
  | { status: "saved"; accountCreated: boolean }
  | { status: "account_created_quote_failed"; email: string; error: string }
  | { status: "quote_failed"; error: string }
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

export function createQuoteSubmitter(deps: QuoteSubmitterDeps) {
  const quoteId = deps.newId();
  let account: CreatedAccount | null = null;
  let inFlight = false;

  async function saveQuote(userId: string, quote: QuoteFields): Promise<DbError | null> {
    for (let attempt = 1; ; attempt++) {
      const { error } = await deps.insertQuote({ ...quote, id: quoteId, user_id: userId, status: "PENDING" });
      if (!error || isDuplicate(error)) return null;
      if (!isForeignKey(error) || attempt >= FOREIGN_KEY_ATTEMPTS) return error;
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
      const error = await saveQuote(userId, input.quote);
      if (error) {
        return accountCreated && account
          ? { status: "account_created_quote_failed", email: account.email, error: error.message }
          : { status: "quote_failed", error: error.message };
      }
      return { status: "saved", accountCreated };
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
  };
}
