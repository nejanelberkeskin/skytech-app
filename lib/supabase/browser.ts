import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser client — cookie-based session.
 *
 * Lazy-init: env varları eksikse veya kısa süreliğine erişilemiyorsa,
 * import-time'da patlamak yerine ilk gerçek auth/db çağrısında anlamlı
 * bir hata fırlatır. Bu sayede bir client-side modül load hatası tüm
 * sayfayı "Application error: a client-side exception" ile karartmaz —
 * sayfa render olur, sadece auth işlemleri açıkça başarısız olur.
 */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase yapılandırması eksik. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ortam değişkenleri ayarlanmalı."
    );
  }

  _client = createBrowserClient(url, key);
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
