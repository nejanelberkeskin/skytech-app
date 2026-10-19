/**
 * Paraşüt API v4 istemcisi — YALNIZ SUNUCU. Resmî tanım: https://apidocs.parasut.com (swagger.json).
 *
 * Kimlik: OAuth2 "password" akışı (client_id/secret Paraşüt destekten alınır; kullanıcı e-posta + parola). Erişim
 * belirteci 2 saat geçerli; süreç içinde önbellekte tutulur, yenileme belirteci saklanmaz (her süreç yeniden alır —
 * dönen yenileme belirteçleri sunucular arasında yarışmaz).
 * Hız sınırı: 10 istek / 10 sn → istekler en az 1,1 sn arayla gider. Zaman aşımı 20 sn.
 * Ortam: PARASUT_CLIENT_ID, PARASUT_CLIENT_SECRET, PARASUT_USERNAME, PARASUT_PASSWORD, PARASUT_COMPANY_ID.
 */

export const PARASUT_BASE = "https://api.parasut.com";

export interface ParasutConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  companyId: string;
}

export function parasutConfig(env: NodeJS.ProcessEnv = process.env): ParasutConfig | null {
  const c = {
    clientId: env.PARASUT_CLIENT_ID?.trim() ?? "",
    clientSecret: env.PARASUT_CLIENT_SECRET?.trim() ?? "",
    username: env.PARASUT_USERNAME?.trim() ?? "",
    password: env.PARASUT_PASSWORD ?? "",
    companyId: env.PARASUT_COMPANY_ID?.trim() ?? "",
  };
  if (!c.clientId || !c.clientSecret || !c.username || !c.password || !/^\d{1,12}$/.test(c.companyId)) return null;
  return c;
}

export class ParasutError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ParasutError";
  }
}

export interface JsonApiResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | { id: string; type: string }[] | null }>;
}
export interface JsonApiDoc {
  data: JsonApiResource | JsonApiResource[] | null;
  included?: JsonApiResource[];
}

type Fetch = typeof fetch;

export interface ParasutClientOptions {
  fetchImpl?: Fetch;
  /** Testte 0 verilir. */
  minIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export function createParasutClient(cfg: ParasutConfig, opts: ParasutClientOptions = {}) {
  const doFetch = opts.fetchImpl ?? fetch;
  const minInterval = opts.minIntervalMs ?? 1100;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let token: { value: string; expiresAt: number } | null = null;
  let lastCall = 0;

  async function pace() {
    const wait = lastCall + minInterval - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
  }

  async function timed(url: string, init: RequestInit): Promise<Response> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await doFetch(url, { ...init, signal: ctl.signal, cache: "no-store" });
    } finally {
      clearTimeout(t);
    }
  }

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt - 60_000 > Date.now()) return token.value;
    await pace();
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      username: cfg.username,
      password: cfg.password,
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
    });
    const res = await timed(`${PARASUT_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!res.ok || !json?.access_token) throw new ParasutError(res.status, "Paraşüt girişi başarısız (istemci bilgileri ya da kullanıcı kontrol edilmeli).");
    token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 7200) * 1000 };
    return token.value;
  }

  /** JSON:API isteği. 204 → null. Hata gövdesindeki ilk başlık/ayrıntı iletiye taşınır (kişisel veri içermez). */
  async function request(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<JsonApiDoc | null> {
    const bearer = await accessToken();
    await pace();
    const res = await timed(`${PARASUT_BASE}/v4/${cfg.companyId}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/vnd.api+json",
        ...(body ? { "Content-Type": "application/vnd.api+json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 204) return null;
    const json = (await res.json().catch(() => null)) as (JsonApiDoc & { errors?: { title?: string; detail?: string }[] }) | null;
    if (!res.ok) {
      if (res.status === 401) token = null;
      const e = json?.errors?.[0];
      throw new ParasutError(res.status, [e?.title, e?.detail].filter(Boolean).join(": ") || `Paraşüt isteği başarısız (${res.status})`);
    }
    return json;
  }

  return { request };
}

export type ParasutClient = ReturnType<typeof createParasutClient>;

/** Tekil kaynak (data dizi değilse). */
export function one(doc: JsonApiDoc | null): JsonApiResource | null {
  return doc && doc.data && !Array.isArray(doc.data) ? doc.data : null;
}
/** Liste (data dizi). */
export function many(doc: JsonApiDoc | null): JsonApiResource[] {
  return doc && Array.isArray(doc.data) ? doc.data : [];
}
