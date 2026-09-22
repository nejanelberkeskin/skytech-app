"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase/browser";
import { trackLead } from "@/lib/analytics";
import { ACCOUNTS_ENABLED } from "@/lib/site-config";
import {
  CERTIFICATE_NAME,
  RELEASE_QTY,
  issuesToFieldErrors,
  requestPayloadSchema,
  type ContactInput,
  type RequestDetailsInput,
} from "@/lib/requests/schema";

/* ═══════════════════════════════════════════════════════════════════════
   Talep gönderimi — istemci tarafı ortak mantık
   ═══════════════════════════════════════════════════════════════════════
   1. Zod şemasıyla ön doğrulama (sunucuyla aynı kurallar, aynı anahtarlar)
   2. POST /api/public/talep — honeypot + doldurma süresi + kaynak yol
   3. Yanıt durumlarını alan hatası / genel hata / başarıya çevirir
   4. Başarıda GA4 generate_lead
   ═══════════════════════════════════════════════════════════════════════ */

export type FieldErrors = Record<string, string>;

export interface SubmitSuccess {
  requestNo: string;
  requestId: string;
}

export interface ContactState {
  contactName: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  consent: boolean;
}

/** Hata sonrası ilk hatalı alanı (ya da ilk uyarıyı) görünür alana kaydır. */
function scrollToFirstInvalid() {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export const EMPTY_CONTACT: ContactState = {
  contactName: "",
  email: "",
  phone: "",
  company: "",
  message: "",
  consent: false,
};

/** Hata anahtarını (şemadan) yerelleştirilmiş metne çevirir. */
export function useErrorText() {
  const t = useTranslations("requestForms.common.errors");
  return useCallback(
    (key: string | undefined | null): string | null => {
      if (!key) return null;
      const params = key.startsWith("certificateName")
        ? { min: CERTIFICATE_NAME.min, max: CERTIFICATE_NAME.max }
        : { min: RELEASE_QTY.min, max: RELEASE_QTY.max };
      // Anahtar şemadan (dinamik) geldiği için next-intl'in statik tip
      // daraltmasını atlıyoruz; bilinmeyen anahtarda genel mesaja düşer.
      const translate = t as unknown as (k: string, p?: Record<string, number>) => string;
      try {
        return translate(key, params);
      } catch {
        return t("generic");
      }
    },
    [t]
  );
}

export interface PrefillData {
  name: string;
  email: string;
  phone: string;
}

/**
 * Giriş yapmış kullanıcının ad / e-posta / telefon bilgisini yükler
 * (profiles tablosu RLS ile yalnız kendi satırını okur) ve `onPrefill` ile
 * forma verir. Üyelik kapalıysa veya oturum yoksa hiçbir şey olmaz.
 */
export function useAuthPrefill(onPrefill?: (p: PrefillData) => void) {
  const [prefill, setPrefill] = useState<PrefillData | null>(null);
  const onPrefillRef = useRef(onPrefill);

  useEffect(() => {
    onPrefillRef.current = onPrefill;
  });

  useEffect(() => {
    if (!ACCOUNTS_ENABLED) return;
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !alive) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .maybeSingle();
        if (!alive) return;
        const data: PrefillData = {
          name: profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "",
          email: user.email ?? "",
          phone: profile?.phone ?? "",
        };
        setPrefill(data);
        onPrefillRef.current?.(data);
      } catch {
        // oturum okunamadı → misafir
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { prefill, isLoggedIn: prefill !== null };
}

export function useRequestForm() {
  const locale = useLocale() as "tr" | "en" | "ru";
  const pathname = usePathname();
  const tErr = useTranslations("requestForms.common.errors");
  const errorText = useErrorText();

  const startedAt = useRef<number>(Date.now());
  // Idempotency: form açılışında bir kez üretilir; tekrar denemelerde aynı
  // token gider, sunucu tek kayıt tutar. Başarıdan sonra yeni form → yeni token.
  const clientToken = useRef<string>("");
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SubmitSuccess | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    if (!clientToken.current && typeof crypto !== "undefined" && "randomUUID" in crypto) {
      clientToken.current = crypto.randomUUID();
    }
  }, []);

  /** Alan hatası — anahtarları yerelleştirilmiş metne çevrilmiş hâlde. */
  const errorFor = useCallback(
    (path: string): string | null => errorText(fieldErrors[path]),
    [fieldErrors, errorText]
  );

  const clearError = useCallback((path: string) => {
    setFieldErrors((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const submit = useCallback(
    async (contact: ContactState, details: RequestDetailsInput, honeypot: string) => {
      if (inFlight.current) return;
      setFormError(null);

      const contactInput: ContactInput = {
        contactName: contact.contactName,
        email: contact.email || undefined,
        phone: contact.phone || undefined,
        company: contact.company || undefined,
        message: contact.message || undefined,
        consent: contact.consent as true,
        locale,
      };
      const body = {
        contact: contactInput,
        details,
        website: honeypot,
        elapsedMs: Math.max(0, Date.now() - startedAt.current),
        sourcePath: pathname,
        clientToken: clientToken.current || undefined,
      };

      // Ön doğrulama — sunucuyla aynı şema; hatalı alanlar hemen işaretlenir.
      // Telefon/e-posta zorunluluğu şemada nesne-düzeyi kontrol olduğundan
      // diğer alan hataları varken çalışmaz; ilk gönderimde de görünsün diye
      // burada ayrıca eklenir.
      const pre = requestPayloadSchema.safeParse(body);
      const errors = pre.success ? {} : issuesToFieldErrors(pre.error.issues);
      if (!contact.email.trim() && !contact.phone.trim() && !errors["contact.email"] && !errors["contact.phone"]) {
        errors["contact.email"] = "contactRequired";
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setFormError(tErr("fixFields"));
        scrollToFirstInvalid();
        return;
      }
      setFieldErrors({});

      inFlight.current = true;
      setSubmitting(true);
      try {
        const res = await fetch("/api/public/talep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          requestNo?: string;
          requestId?: string;
          error?: string;
          fields?: FieldErrors;
        };

        if (res.status === 201 && data.ok && data.requestNo && data.requestId) {
          trackLead({ subject: details.type });
          setSuccess({ requestNo: data.requestNo, requestId: data.requestId });
          return;
        }
        if (res.status === 400 && data.fields) {
          setFieldErrors(data.fields);
          setFormError(tErr("fixFields"));
          scrollToFirstInvalid();
          return;
        }
        if (res.status === 429) return setFormError(tErr("rateLimited"));
        if (res.status === 503 && data.error === "closed") return setFormError(tErr("closed"));
        setFormError(tErr("generic"));
      } catch {
        setFormError(tErr("generic"));
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [locale, pathname, tErr]
  );

  return useMemo(
    () => ({ submit, submitting, fieldErrors, errorFor, clearError, formError, success }),
    [submit, submitting, fieldErrors, errorFor, clearError, formError, success]
  );
}
