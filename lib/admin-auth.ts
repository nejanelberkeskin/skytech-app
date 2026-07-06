/**
 * Server-side Admin Authentication & Authorization Guard
 *
 * Usage in any /api/admin/* route:
 *   const { admin, error } = await requireAdmin(request, ["SUPER_ADMIN", "FINANCE"]);
 *   if (error) return error;
 *   // `admin` is now the authenticated AdminUser
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { UserRole, AdminUser } from "@/lib/rbac";

interface AuthResult {
  admin: AdminUser | null;
  error: NextResponse | null;
}

/**
 * Verify the caller is an active admin with one of the allowed roles.
 * Returns { admin, error } — if error is non-null, return it immediately.
 */
export async function requireAdmin(
  _request: NextRequest,
  allowedRoles?: UserRole[]
): Promise<AuthResult> {
  try {
    // Read session from cookies (same pattern as createSupabaseServer)
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
              // Server Component'te cookie yazılamaz
            }
          },
        },
      }
    );

    // getUser — Supabase auth sunucusundan token doğrular (cookie'ye değil,
    // gerçek JWT/refresh validity'ye dayanır). getSession yalnız cookie'yi
    // okur ve sahte/bozuk cookie ile aldatılabilir.
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return {
        admin: null,
        error: NextResponse.json(
          { error: "Oturum bulunamadı. Lütfen giriş yapın." },
          { status: 401 }
        ),
      };
    }

    // Look up admin record via service role (bypasses RLS)
    const service = createServiceRoleClient();
    const { data: adminUser, error: dbError } = await service
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (dbError || !adminUser) {
      return {
        admin: null,
        error: NextResponse.json(
          { error: "Yönetici yetkisi bulunamadı." },
          { status: 403 }
        ),
      };
    }

    // Role check (if specific roles required)
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(adminUser.role as UserRole)) {
        return {
          admin: null,
          error: NextResponse.json(
            { error: `Bu işlem için yetkiniz yok. Gerekli rol: ${allowedRoles.join(", ")}` },
            { status: 403 }
          ),
        };
      }
    }

    return { admin: adminUser as AdminUser, error: null };
  } catch (err) {
    console.error("[requireAdmin] Auth check failed:", err);
    return {
      admin: null,
      error: NextResponse.json(
        { error: "Kimlik doğrulama hatası." },
        { status: 500 }
      ),
    };
  }
}

// ── Rate Limiter (in-memory, LRU eviction) ──────────────────────────────────
//
// Sliding window + LRU eviction ile bellek sızıntısını önler.
// Tek instance'ta çalışır; Redis'e geçiş aynı arayüzle yapılabilir.
//
const MAX_KEYS = 10_000; // LRU taşma limiti
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// LRU eviction — en eski girişleri temizle
function evictStaleEntries() {
  if (rateLimitMap.size <= MAX_KEYS) return;
  const now = Date.now();
  // Önce süresi dolmuş olanları temizle
  for (const [k, v] of rateLimitMap) {
    if (v.resetAt < now) rateLimitMap.delete(k);
  }
  // Hâlâ taşıyorsa en eski %20'yi sil
  if (rateLimitMap.size > MAX_KEYS) {
    const toDelete = Math.floor(rateLimitMap.size * 0.2);
    let deleted = 0;
    for (const key of rateLimitMap.keys()) {
      if (deleted >= toDelete) break;
      rateLimitMap.delete(key);
      deleted++;
    }
  }
}

/**
 * In-memory rate limiter with LRU eviction.
 * Returns NextResponse error if limit exceeded, null if allowed.
 *
 * @param key      Unique identifier (e.g., IP + endpoint)
 * @param limit    Max requests per window
 * @param windowMs Window duration in ms (default 60s)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): NextResponse | null {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    // Map.delete + set → LRU sırasını güncelle (Map insertion order)
    rateLimitMap.delete(key);
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    evictStaleEntries();
    return null;
  }

  // LRU sırasını güncelle
  rateLimitMap.delete(key);
  entry.count++;
  rateLimitMap.set(key, entry);

  if (entry.count > limit) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen bir süre bekleyin." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}

/**
 * Extract client IP from request headers.
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
