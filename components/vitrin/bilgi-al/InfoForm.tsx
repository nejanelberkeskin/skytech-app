"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trackLead } from "@/lib/analytics";

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-sm text-[#1a2e1a] placeholder:text-[#94b494] focus:outline-none focus:border-[#1B6B3A]/40 focus:ring-2 focus:ring-[#1B6B3A]/15 transition-all disabled:opacity-60";

type Status = "idle" | "submitting" | "success" | "error";

export default function InfoForm() {
  const t = useTranslations("infoPage");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const SUBJECTS = [
    t("topics.individual"),
    t("topics.corporate"),
    t("topics.esg"),
    t("topics.drone"),
    t("topics.press"),
    t("topics.partnership"),
    t("topics.other"),
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      company: fd.get("company"),
      subject: fd.get("subject"),
      message: fd.get("message"),
      website: fd.get("website"), // honeypot
    };

    try {
      const res = await fetch("/api/public/bilgi-al", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(typeof data.error === "string" ? data.error : t("form.error"));
        return;
      }

      trackLead({ subject: String(payload.subject || "") });
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(t("form.error"));
    }
  }

  if (status === "success") {
    return (
      <div className="vitrin-card p-7 lg:p-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1B6B3A]/10 flex items-center justify-center mb-5">
          <CheckIcon className="w-7 h-7 text-[#1B6B3A]" />
        </div>
        <h2 className="text-2xl font-bold text-[#1a2e1a] mb-2">{t("form.success.title")}</h2>
        <p className="text-sm text-[#3d5a3d]">{t("form.success.desc")}</p>
      </div>
    );
  }

  return (
    <div className="vitrin-card p-7 lg:p-10">
      <h2 className="text-2xl font-bold text-[#1a2e1a] mb-2">{t("form.heading")}</h2>
      <p className="text-sm text-[#3d5a3d] mb-7">{t("form.subheading")}</p>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("form.name.label")} required>
            <input type="text" name="name" required disabled={status === "submitting"} className={inputClass} placeholder={t("form.name.placeholder")} />
          </Field>
          <Field label={t("form.email.label")} required>
            <input type="email" name="email" required disabled={status === "submitting"} className={inputClass} placeholder={t("form.email.placeholder")} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("form.phone.label")}>
            <input type="tel" name="phone" disabled={status === "submitting"} className={inputClass} placeholder={t("form.phone.placeholder")} />
          </Field>
          <Field label={t("form.company.label")}>
            <input type="text" name="company" disabled={status === "submitting"} className={inputClass} placeholder={t("form.company.placeholder")} />
          </Field>
        </div>

        <Field label={t("form.subject.label")} required>
          <select name="subject" required disabled={status === "submitting"} className={inputClass}>
            <option value="">{t("form.subject.placeholder")}</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label={t("form.message.label")} required>
          <textarea
            name="message"
            required
            disabled={status === "submitting"}
            rows={6}
            className={`${inputClass} resize-none`}
            placeholder={t("form.message.placeholder")}
          />
        </Field>

        {/* Honeypot — gerçek kullanıcılar görmez/doldurmaz */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="flex items-start gap-3 text-xs text-[#6b8f6b] pt-2">
          <input type="checkbox" required disabled={status === "submitting"} className="mt-1 accent-[#1B6B3A]" />
          <p>{t("form.consent")}</p>
        </div>

        {status === "error" && errorMsg && (
          <p className="text-sm text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3">{errorMsg}</p>
        )}

        <button type="submit" disabled={status === "submitting"} className="vitrin-cta-primary w-full justify-center disabled:opacity-70">
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[#1a2e1a] mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-[#dc2626] ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
