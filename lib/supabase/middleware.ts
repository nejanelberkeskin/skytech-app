import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware için Supabase client — cookie okur/yazar.
 * Her request'te session'ı refresh eder (token expiry önleme).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Request cookie'lerine yaz
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Response'u yeniden oluştur (cookie'leri taşımak için)
          supabaseResponse = NextResponse.next({ request });
          // Response cookie'lerine yaz
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Session'ı refresh et (token expire olduysa yeniler)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user, response: supabaseResponse };
}
