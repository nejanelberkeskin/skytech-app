import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServiceRoleClient, createSupabaseServer } from "@/lib/supabase/server";
import { getClientIP, rateLimit } from "@/lib/admin-auth";
import { issuesToFieldErrors } from "@/lib/requests/schema";
import { PASSWORD_MIN, corporateApplicationSchema } from "@/lib/corporate/accounts";
import { sendCorporateApplicationReceived, sendCorporateApplicationStaffNotice } from "@/lib/mail";

/**
 * POST /api/kurumsal/basvuru — kurumsal hesap başvurusu (043).
 *
 * Oturum varsa başvuru o hesaba bağlanır (şifre istenmez). Oturum yoksa yeni hesap açılır: Supabase e-posta doğrulaması
 * gönderir. Başvuru satırını yalnız sunucu yazar; durum her zaman `pending` başlar ve yalnız yönetim değiştirir.
 * Kimlik gövdeden alınmaz. Yanıt: { ok, status, needsEmailConfirmation }.
 */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 10_000;

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const limited = rateLimit(`kurumsal-basvuru:${ip}`, 5, 10 * 60_000);
  if (limited) return limited;

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const parsed = corporateApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", fields: issuesToFieldErrors(parsed.error.issues) }, { status: 400 });
  }
  const data = parsed.data;
  // Bot tuzağı: sessizce başarılı dön, hiçbir şey yazma.
  if (data.website && data.website.trim()) return NextResponse.json({ ok: true, status: "pending", needsEmailConfirmation: true });

  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  let userId = auth.user?.id ?? null;
  let needsEmailConfirmation = false;

  if (!userId) {
    const password = data.password ?? "";
    if (password.length < PASSWORD_MIN) {
      return NextResponse.json({ error: "validation", fields: { password: "passwordShort" } }, { status: 400 });
    }
    const origin = req.nextUrl.origin;
    const { data: created, error } = await supabase.auth.signUp({
      email: data.email,
      password,
      options: {
        data: { full_name: data.authorizedPerson, company_name: data.companyTitle, phone: data.phone, account_type: "corporate" },
        emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent("/kurumsal/panel")}`,
      },
    });
    // Kayıtlı e-posta: Supabase kimliksiz bir kullanıcı döndürür; başvuru o hesaba yazılmaz, giriş yapması istenir.
    if (error || !created.user || (created.user.identities?.length ?? 0) === 0) {
      return NextResponse.json({ error: "email_exists" }, { status: 409 });
    }
    userId = created.user.id;
    needsEmailConfirmation = !created.session;
  }

  const db = createServiceRoleClient();
  const { data: existing, error: readError } = await db
    .from("corporate_accounts")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (existing) return NextResponse.json({ error: "already_applied", status: existing.status }, { status: 409 });

  const { error: insertError } = await db.from("corporate_accounts").insert({
    user_id: userId,
    company_title: data.companyTitle,
    tax_id: data.taxId,
    tax_office: data.taxOffice,
    address: data.address,
    authorized_person: data.authorizedPerson,
    contact_email: auth.user?.email ?? data.email,
    phone: data.phone,
  });
  if (insertError) {
    if (insertError.code === "23505") return NextResponse.json({ error: "already_applied", status: "pending" }, { status: 409 });
    console.error("[kurumsal/basvuru] kayıt yazılamadı", insertError.code);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const mail = {
    userId,
    companyTitle: data.companyTitle,
    authorizedPerson: data.authorizedPerson,
    email: auth.user?.email ?? data.email,
    phone: data.phone,
    taxId: data.taxId,
    taxOffice: data.taxOffice,
  };
  after(async () => {
    await Promise.allSettled([sendCorporateApplicationReceived(mail), sendCorporateApplicationStaffNotice(mail)]);
  });
  return NextResponse.json({ ok: true, status: "pending", needsEmailConfirmation }, { status: 201 });
}
