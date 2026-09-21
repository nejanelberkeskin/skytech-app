"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  requestWithdrawal,
  type WithdrawalResult,
  type WithdrawalErrorCode,
} from "@/lib/orders/client";
import {
  withdrawalRequestSchema,
  type WithdrawalRequestInput,
} from "@/lib/orders/schema";
import { issuesToFieldErrors } from "@/lib/requests/schema";
import { COMPANY } from "@/lib/company";
import {
  Field,
  inputCls,
  ErrorBanner,
} from "@/components/vitrin/talep/FormPrimitives";

type Receipt = Extract<WithdrawalResult, { ok: true }>;
type ReceiptLabels = { receivedAt: string; refundDueOn: string };
type Props = {
  locale: "tr" | "en" | "ru";
  initialOrderNo: string;
  formatReceipt: (
    receivedAt: string,
    refundDueOn: string,
  ) => Promise<ReceiptLabels>;
};
export default function WithdrawalForm({
  locale,
  initialOrderNo,
  formatReceipt,
}: Props) {
  const t = useTranslations("withdrawalPage");
  const [values, setValues] = useState({
    orderNo: initialOrderNo,
    email: "",
    note: "",
    website: "",
  });
  const [phase, setPhase] = useState<"form" | "confirm" | "success">("form");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<WithdrawalErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [dates, setDates] = useState<ReceiptLabels | null>(null);
  const [focus, setFocus] = useState({ revision: 0, target: "heading" });
  const section = useRef<HTMLDivElement>(null);
  const beganAt = useRef(0);
  const locked = useRef(false);
  const confirmedInput = useRef<WithdrawalRequestInput | null>(null);
  useEffect(() => {
    beganAt.current = Date.now();
  }, []);
  useEffect(() => {
    if (!focus.revision) return;
    const selector =
      focus.target === "field"
        ? '[aria-invalid="true"]'
        : focus.target === "error"
          ? "[data-form-feedback]"
          : "[data-phase-heading]";
    const node = section.current?.querySelector<HTMLElement>(selector);
    node?.focus({ preventScroll: true });
    node?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [focus, phase]);
  function focusOn(target: string) {
    setFocus((v) => ({ revision: v.revision + 1, target }));
  }
  const fieldError = (path: string) =>
    fields[path]
      ? t.has(`errors.${fields[path]}`)
        ? t(`errors.${fields[path]}`)
        : t("errors.validation")
      : null;
  function edit(key: keyof typeof values, value: string) {
    setValues((v) => ({
      ...v,
      [key]: key === "orderNo" ? value.toUpperCase() : value,
    }));
    setFields((v) => {
      const next = { ...v };
      delete next[key];
      return next;
    });
    setError(null);
  }
  function prepare() {
    const parsed = withdrawalRequestSchema.safeParse({ ...values, locale });
    if (!parsed.success) {
      setFields(issuesToFieldErrors(parsed.error.issues));
      setError("validation");
      focusOn("field");
      return;
    }
    confirmedInput.current = parsed.data;
    setFields({});
    setError(null);
    setPhase("confirm");
    focusOn("heading");
  }
  async function send() {
    if (locked.current || !confirmedInput.current) return;
    locked.current = true;
    setSubmitting(true);
    setError(null);
    const input = {
      ...confirmedInput.current,
      elapsedMs: Math.min(86400000, Math.max(0, Date.now() - beganAt.current)),
    };
    let result: WithdrawalResult;
    try {
      result = await requestWithdrawal(input);
    } catch {
      result = { ok: false, error: "generic" };
    }
    locked.current = false;
    setSubmitting(false);
    if (result.ok) {
      // Receipt is final as soon as the endpoint accepts. A date-formatting failure
      // must never invite a duplicate withdrawal submission.
      setReceipt(result);
      setPhase("success");
      focusOn("heading");
      try {
        setDates(await formatReceipt(result.receivedAt, result.refundDueOn));
      } catch {
        setDates({
          receivedAt: result.receivedAt,
          refundDueOn: result.refundDueOn,
        });
      }
    } else {
      setError(result.error);
      if (
        result.error === "validation" &&
        result.fields &&
        Object.keys(result.fields).length
      ) {
        setFields(result.fields);
        setPhase("form");
        focusOn("field");
      } else focusOn("error");
    }
  }
  const primary =
    "min-h-12 rounded-2xl bg-[#1B6B3A] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B6B3A]";
  return (
    <div
      ref={section}
      className="rounded-3xl border border-[#1B6B3A]/15 bg-white p-6 sm:p-8 motion-reduce:[&_*]:!transition-none motion-reduce:[&_*]:!animate-none"
    >
      {phase === "form" && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            prepare();
          }}
          className="space-y-5"
        >
          <h2
            data-phase-heading
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            {t("form.title")}
          </h2>
          <div data-form-feedback tabIndex={-1} className="outline-none">
            <ErrorBanner
              message={
                error ? t(`errors.${error}`, { email: COMPANY.email }) : null
              }
            />
          </div>
          <Field
            label={t("form.orderNo")}
            required
            error={fieldError("orderNo")}
            hint={fieldError("orderNo") ? undefined : t("form.orderNoHint")}
          >
            {(a) => (
              <input
                id={a.id}
                name="orderNo"
                value={values.orderNo}
                onChange={(e) => edit("orderNo", e.target.value)}
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
                required
                aria-invalid={a.invalid}
                aria-describedby={a.describedBy}
                className={inputCls(a.invalid ? "error" : null, "font-mono")}
              />
            )}
          </Field>
          <Field label={t("form.email")} required error={fieldError("email")}>
            {(a) => (
              <input
                id={a.id}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={200}
                required
                value={values.email}
                onChange={(e) => edit("email", e.target.value)}
                aria-invalid={a.invalid}
                aria-describedby={a.describedBy}
                className={inputCls(a.invalid ? "error" : null)}
              />
            )}
          </Field>
          <Field
            label={t("form.note")}
            optional
            error={fieldError("note")}
            hint={fieldError("note") ? undefined : t("form.noteHint")}
          >
            {(a) => (
              <textarea
                id={a.id}
                name="note"
                rows={4}
                maxLength={500}
                value={values.note}
                onChange={(e) => edit("note", e.target.value)}
                aria-invalid={a.invalid}
                aria-describedby={a.describedBy}
                className={inputCls(a.invalid ? "error" : null)}
              />
            )}
          </Field>
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] h-px w-px overflow-hidden"
          >
            <label>
              Website
              <input
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={values.website}
                onChange={(e) => edit("website", e.target.value)}
              />
            </label>
          </div>
          <button type="submit" className={`${primary} w-full sm:w-auto`}>
            {t("form.submit")}
          </button>
        </form>
      )}
      {phase === "confirm" && (
        <section aria-labelledby="confirmation-heading" className="space-y-5">
          <h2
            id="confirmation-heading"
            data-phase-heading
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            {t("confirm.title")}
          </h2>
          <p className="break-words font-mono text-sm font-semibold">
            {values.orderNo.trim()}
          </p>
          <p className="text-sm leading-relaxed text-[#526352]">
            {t("confirm.description")}
          </p>
          <div data-form-feedback tabIndex={-1} className="outline-none">
            <ErrorBanner
              message={
                error ? t(`errors.${error}`, { email: COMPANY.email }) : null
              }
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void send()}
              className={primary}
            >
              {t(submitting ? "confirm.submitting" : "confirm.submit")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setPhase("form");
                setError(null);
                focusOn("heading");
              }}
              className="min-h-12 rounded-2xl border border-[#1B6B3A]/25 px-6 py-3 text-sm font-semibold text-[#1B6B3A] disabled:opacity-60"
            >
              {t("confirm.cancel")}
            </button>
          </div>
        </section>
      )}
      {phase === "success" && receipt && (
        <section aria-labelledby="receipt-heading" className="space-y-5">
          <h2
            id="receipt-heading"
            data-phase-heading
            tabIndex={-1}
            className="text-2xl font-semibold outline-none"
          >
            {t("success.title")}
          </h2>
          <dl className="space-y-4 rounded-2xl bg-[#f1f5ed] p-5">
            <div>
              <dt className="text-xs font-semibold text-[#526352]">
                {t("form.orderNo")}
              </dt>
              <dd className="mt-1 break-words font-mono font-semibold">
                {receipt.orderNo}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-[#526352]">
                {t("success.receivedAt")}
              </dt>
              <dd className="mt-1 text-sm">
                <time dateTime={receipt.receivedAt}>
                  {dates?.receivedAt ?? receipt.receivedAt}
                </time>
              </dd>
            </div>
          </dl>
          <p className="font-semibold leading-relaxed">
            {t("success.refundDueOn", {
              date: dates?.refundDueOn ?? receipt.refundDueOn,
            })}
          </p>
          <p className="text-sm leading-relaxed text-[#526352]">
            {t("success.email")}
          </p>
        </section>
      )}
    </div>
  );
}
