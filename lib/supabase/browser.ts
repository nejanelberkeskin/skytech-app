import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client — cookie-based session.
 * @supabase/ssr otomatik olarak cookie'ye yazar/okur.
 * Client component'lerde kullanım: import { supabase } from "@/lib/supabase/browser";
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
