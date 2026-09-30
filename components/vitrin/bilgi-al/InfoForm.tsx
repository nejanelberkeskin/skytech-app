"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { trackLead } from "@/lib/analytics";
import { CONTACT_FIELD_ORDER, problemsFromResponse, validateContact, type ContactField, type ContactProblem } from "@/lib/contact-form";

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-sm text-[#1a2e1a] placeholder:text-[#94b494] focus:outline-none focus:border-[#1B6B3A]/40 focus:ring-2 focus:ring-[#1B6B3A]/15 transition-all disabled:opacity-60 aria-[invalid=true]:border-[#dc2626]/60";

type Status = "idle" | "submitting" | "success" | "error" | "uncertain";
type Problems = Partial<Record<ContactField, ContactProblem>>;

export default function InfoForm() {
  const t = useTranslations("infoPage");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problems>({});
  const [focusTarget, setFocusTarget] = useState<{ field: ContactField; n: number } | null>(null);

  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  const feedback = useRef<HTMLParagraphElement | null>(null);
  const success = useRef<HTMLDivElement | null>(null);
  const fields = useRef<Partial<Record<ContactField, HTMLElement | null>>>({});
  const feedbackId = useId();
  const noticeId = useId();
  const errorIds = useId();
  const errorId = (field: ContactField) => `${errorIds}-${field}`;

  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => {
    if (status === "success") success.current?.focus();
    if (status === "error" || status === "uncertain") feedback.current?.focus();
  }, [status]);
  // Doğrulama hatasında odak ilk hatalı alana; ileti o alanın açıklaması olarak okunur.
  useEffect(() => {
    if (focusTarget) fields.current[focusTarget.field]?.focus();
  }, [focusTarget]);

  const SUBJECTS = [
    t("topics.individual"),
    t("topics.corporate"),
    t("topics.esg"),
    t("topics.drone"),
    t("topics.press"),
    t("topics.partnership"),
    t("topics.other"),
  ];

  const problemText = (field: ContactField, problem: ContactProblem) =>
    problem === "invalid_email" ? t("form.errors.emailInvalid")
      : problem === "too_long" ? t("form.errors.tooLong")
      : problem === "notice_required" ? t("form.errors.notice")
      : field === "name" ? t("form.errors.name")
      : field === "email" ? t("form.errors.email")
      : field === "subject" ? t("form.errors.subject")
      : t("form.errors.message");

  function showProblems(next: Problems) {
    setProblems(next);
    const first = CONTACT_FIELD_ORDER.find((field) => next[field]);
    if (first) setFocusTarget((previous) => ({ field: first, n: (previous?.n ?? 0) + 1 }));
  }
  const clearProblem = (field: ContactField) =>
    setProblems((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  const fieldProps = (field: ContactField) => ({
    ref: (node: HTMLElement | null) => { fields.current[field] = node; },
    "aria-invalid": problems[field] ? true : undefined,
    "aria-describedby": problems[field] ? errorId(field) : undefined,
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      company: fd.get("company"),
      subject: fd.get("subject"),
      message: fd.get("message"),
      noticeRead: fd.get("noticeRead") === "on",
      website: fd.get("website"), // honeypot
    };
    // Sunucuyla aynı kurallar: hatalı istek gönderilmez, kilit kurulmaz (düzeltip yeniden gönderilebilir).
    const found = validateContact(payload);
    if (Object.keys(found).length) {
      setStatus("idle");
      setErrorMsg(null);
      showProblems(found);
      return;
    }
    setProblems({});
    busy.current = true;
    setStatus("submitting");
    setErrorMsg(null);

    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/public/bilgi-al", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (request.current !== controller) return;
      if (res.status >= 400 && res.status < 500) {
        busy.current = false;
        if (res.status !== 429) {
          // 4xx kesin ret: mesaj gönderilmedi. Sunucu hatalı alanı bildiriyorsa o alan işaretlenir.
          const fromServer = problemsFromResponse(await res.json().catch(() => null));
          if (request.current !== controller) return;
          if (Object.keys(fromServer).length) {
            setStatus("idle");
            showProblems(fromServer);
            return;
          }
        }
        setStatus("error");
        setErrorMsg(res.status === 429 ? t("form.rateLimited") : t("form.error"));
        return;
      }
      const receipt: unknown = await res.json().catch(() => null);
      if (request.current !== controller) return;
      if (!res.ok || !receipt || typeof receipt !== "object" || Array.isArray(receipt) || !("ok" in receipt) || receipt.ok !== true) {
        setStatus("uncertain");
        setErrorMsg(t("form.uncertain"));
        return;
      }
      setStatus("success");
      // Analytics failure must not turn a confirmed submission into a retry prompt.
      try { trackLead({ subject: String(payload.subject || "") }); } catch { /* optional analytics */ }
    } catch {
      if (request.current !== controller) return;
      setStatus("uncertain");
      setErrorMsg(t("form.uncertain"));
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }

  if (status === "success") {
    return (
      <div ref={success} role="status" tabIndex={-1} className="vitrin-card p-7 lg:p-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1B6B3A]/10 flex items-center justify-center mb-5">
          <CheckIcon className="w-7 h-7 text-[#1B6B3A]" />
        </div>
        <h2 className="text-2xl font-bold text-[#1a2e1a] mb-2">{t("form.success.title")}</h2>
        <p className="text-sm text-[#3d5a3d]">{t("form.success.desc")}</p>
      </div>
    );
  }

  const problemFor = (field: ContactField) => {
    const problem = problems[field];
    return problem ? { id: errorId(field), text: problemText(field, problem) } : null;
  };

  return (
    <div className="vitrin-card p-7 lg:p-10">
      <h2 className="text-2xl font-bold text-[#1a2e1a] mb-2">{t("form.heading")}</h2>
      <p className="text-sm text-[#3d5a3d] mb-7">{t("form.subheading")}</p>

      <form className="space-y-5" noValidate onSubmit={handleSubmit} aria-busy={status === "submitting"} aria-describedby={errorMsg ? feedbackId : undefined}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("form.name.label")} required problem={problemFor("name")}>
            <input type="text" name="name" autoComplete="name" maxLength={200} required disabled={status === "submitting"} className={inputClass} placeholder={t("form.name.placeholder")} onChange={() => clearProblem("name")} {...fieldProps("name")} />
          </Field>
          <Field label={t("form.email.label")} required problem={problemFor("email")}>
            <input type="email" name="email" autoComplete="email" maxLength={254} required disabled={status === "submitting"} className={inputClass} placeholder={t("form.email.placeholder")} onChange={() => clearProblem("email")} {...fieldProps("email")} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("form.phone.label")} problem={problemFor("phone")}>
            <input type="tel" name="phone" autoComplete="tel" maxLength={40} disabled={status === "submitting"} className={inputClass} placeholder={t("form.phone.placeholder")} onChange={() => clearProblem("phone")} {...fieldProps("phone")} />
          </Field>
          <Field label={t("form.company.label")} problem={problemFor("company")}>
            <input type="text" name="company" autoComplete="organization" maxLength={200} disabled={status === "submitting"} className={inputClass} placeholder={t("form.company.placeholder")} onChange={() => clearProblem("company")} {...fieldProps("company")} />
          </Field>
        </div>

        <Field label={t("form.subject.label")} required problem={problemFor("subject")}>
          <select name="subject" required disabled={status === "submitting"} className={inputClass} onChange={() => clearProblem("subject")} {...fieldProps("subject")}>
            <option value="">{t("form.subject.placeholder")}</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label={t("form.message.label")} required problem={problemFor("message")}>
          <textarea
            name="message"
            maxLength={5000}
            required
            disabled={status === "submitting"}
            rows={6}
            className={`${inputClass} resize-none`}
            placeholder={t("form.message.placeholder")}
            onChange={() => clearProblem("message")}
            {...fieldProps("message")}
          />
        </Field>

        {/* Honeypot — gerçek kullanıcılar görmez/doldurmaz */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="pt-2">
          <div className="flex items-start gap-3 text-xs text-[#6b8f6b]">
            <input id={noticeId} name="noticeRead" type="checkbox" required disabled={status === "submitting"} className="mt-1 accent-[#1B6B3A]" onChange={() => clearProblem("noticeRead")} {...fieldProps("noticeRead")} />
            <div><label htmlFor={noticeId} className="cursor-pointer">{t("form.consent")}</label>{" "}
              <Link href="/kvkk" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{t("form.privacyLink")}</Link>
            </div>
          </div>
          {problemFor("noticeRead") && <p id={errorId("noticeRead")} className="mt-1.5 text-xs text-[#b91c1c]">{problemFor("noticeRead")!.text}</p>}
        </div>

        {errorMsg && (
          <p ref={feedback} id={feedbackId} tabIndex={-1} role="alert" className="text-sm text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3">{errorMsg}</p>
        )}

        <button type="submit" disabled={status === "submitting" || status === "uncertain"} className="vitrin-cta-primary w-full justify-center disabled:opacity-70">
          {status === "submitting" ? t("form.submitting") : t("form.submit")}
          {status !== "submitting" && (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, problem, children }: { label: string; required?: boolean; problem: { id: string; text: string } | null; children: React.ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="block text-xs font-semibold text-[#1a2e1a] mb-1.5 uppercase tracking-wider">
          {label}{required && <span className="text-[#dc2626] ml-0.5">*</span>}
        </span>
        {children}
      </label>
      {problem && <p id={problem.id} className="mt-1.5 text-xs text-[#b91c1c]">{problem.text}</p>}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
