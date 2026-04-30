import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

/**
 * Server Component / Server Action / Route Handler için Supabase client.
 * Cookie'den session okur — RLS kullanıcı bazında uygulanır.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component'te cookie yazılamaz, ignore
          }
        },
      },
    }
  );
}

/**
 * Service Role client — RLS bypass.
 * SADECE API route'larda ve admin işlemlerinde kullan.
 */
export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
}

// Eski uyumluluk için (kademeli geçiş)
export const createServerSupabase = createServiceRoleClient;
