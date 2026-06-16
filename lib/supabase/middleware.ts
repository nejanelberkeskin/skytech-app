import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

interface UpdateSessionResult {
  supabase: ReturnType<typeof createServerClient> | null;
  user: { id: string; email?: string | null } | null;
  response: NextResponse;
}

/**
 * Middleware için Supabase client — cookie okur/yazar.
 * Her request'te session'ı refresh eder (token expiry önleme).
 *
 * Defensive: env değişkenleri tanımlı değilse (örn. Vercel Preview env scope
 * eksikse) middleware'i çökertmek yerine pass-through olur — vitrin sayfaları
 * yine render edilir, sadece auth-protected sayfalardaki redirect mantığı
 * "user null" akışıyla devam eder.
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Env yoksa Supabase çağrılarını skip — middleware crash etmesin.
  if (!url || !key) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[middleware] Supabase env değişkenleri tanımlı değil — auth bypass."
      );
    }
    return { supabase: null, user: null, response: supabaseResponse };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { supabase, user, response: supabaseResponse };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[middleware] supabase.auth.getUser hata:", err);
    }
    return { supabase, user: null, response: supabaseResponse };
  }
}
