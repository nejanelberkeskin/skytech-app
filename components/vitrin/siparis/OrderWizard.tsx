"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { SITES_HREF } from "@/lib/sites/links";
import {
  PRICING_VISIBLE,
  initialQuantity,
  quantityRangeError,
  totalKurus,
  formatCount,
  formatTry,
} from "@/lib/pricing";
import {
  buyerSchema,
  invoiceSchema,
  consentsSchema,
  orderPayloadSchema,
  orderPreviewSchema,
  resolveCertificateName,
} from "@/lib/orders/schema";
import {
  certificateNameSchema,
  CERTIFICATE_NAME,
  contactSchema,
  issuesToFieldErrors,
} from "@/lib/requests/schema";
import {
  previewOrder,
  submitOrder,
  type OrderPreview,
  type OrderErrorCode,
  type OrderFailure,
  type OrderDocumentPreview,
} from "@/lib/orders/client";
import {
  Field,
  QuantityInput,
  SectionCard,
  inputCls,
  ErrorBanner,
} from "@/components/vitrin/talep/FormPrimitives";
import ContactFields from "@/components/vitrin/talep/ContactFields";
import SuccessCard from "@/components/vitrin/talep/SuccessCard";
import {
  useRequestForm,
  useAuthPrefill,
  EMPTY_CONTACT,
} from "@/components/vitrin/talep/useRequestForm";
import BuyerInvoiceFields from "./BuyerInvoiceFields";
import OrderReview, { ReviewRows } from "./OrderReview";
import DocumentDialog from "./DocumentDialog";
import {
  EMPTY_INVOICE,
  EMPTY_CONSENTS,
  invoiceInput,
  errorStep,
  type Buyer,
  type Consents,
  type WizardProps,
} from "./types";

export default function OrderWizard({
  site,
  locale,
  mode,
  schedule,
  dateLabels,
  timeline,
  pricing,
}: WizardProps) {
  const t = useTranslations("orderWizard");
  const requestErrors = useTranslations("requestForms.common.errors");
  const pathname = usePathname();
  const [step, setStep] = useState(1);
  const [quantity, setQuantity] = useState<number | null>(() =>
    initialQuantity(pricing),
  );
  const [certificateName, setCertificateName] = useState("");
  const [buyer, setBuyer] = useState<Buyer>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [invoice, setInvoice] = useState(EMPTY_INVOICE);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [honeypot, setHoneypot] = useState("");
  const [consents, setConsents] = useState(EMPTY_CONSENTS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<OrderErrorCode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [document, setDocument] = useState<OrderDocumentPreview | null>(null);
  const [focus, setFocus] = useState({ revision: 0, error: false });
  const [requestFields, setRequestFields] = useState<Record<string, string>>(
    {},
  );
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const clientToken = useRef("");
  const startedAt = useRef(0);
  const previewSequence = useRef(0);
  const submitLock = useRef(false);
  const request = useRequestForm();
  const { isLoggedIn } = useAuthPrefill((p) => {
    const parts = p.name.trim().split(/\s+/);
    setBuyer((v) => ({
      firstName: v.firstName || parts.slice(0, -1).join(" ") || parts[0] || "",
      lastName: v.lastName || (parts.length > 1 ? parts[parts.length - 1] : ""),
      email: v.email || p.email,
      phone: v.phone || p.phone,
    }));
    setContact((v) => ({
      ...v,
      contactName: v.contactName || p.name,
      email: v.email || p.email,
      phone: v.phone || p.phone,
    }));
  });

  // The shared request hook owns its response state. React's guarded state adjustment
  // moves new server field errors to their step, without an effect/setState loop.
  if (request.fieldErrors !== requestFields) {
    setRequestFields(request.fieldErrors);
    if (
      Object.entries(request.fieldErrors).some(
        ([key, value]) => requestFields[key] !== value,
      )
    ) {
      setStep(errorStep(request.fieldErrors));
      setFocus((v) => ({ revision: v.revision + 1, error: true }));
    }
  }

  useEffect(() => {
    if (!clientToken.current) clientToken.current = crypto.randomUUID();
    startedAt.current = Date.now();
    const url = new URL(window.location.href);
    // A direct/reloaded deep link cannot skip validation; personal data lives only in memory.
    url.searchParams.set("adim", "1");
    window.history.replaceState({ ...window.history.state }, "", url);
    const sequence = previewSequence;
    return () => {
      sequence.current++;
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("adim") !== String(step)) {
      url.searchParams.set("adim", String(step));
      window.history.replaceState({ ...window.history.state }, "", url);
    }
    if (focus.revision === 0) return;
    const target = focus.error
      ? form.current?.querySelector<HTMLElement>(
          'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"], fieldset[aria-invalid="true"] input',
        )
      : heading.current;
    (target ?? heading.current)?.focus({ preventScroll: true });
    (target ?? heading.current)?.scrollIntoView({
      block: focus.error ? "center" : "start",
      behavior: "instant",
    });
  }, [step, focus]);

  useEffect(() => {
    const fieldFailure =
      failure === "validation" || Object.keys(request.fieldErrors).length > 0;
    if (!fieldFailure && (failure || request.formError || notice)) {
      const alert = form.current?.querySelector<HTMLElement>(
        "[data-wizard-feedback]",
      );
      alert?.focus({ preventScroll: true });
      alert?.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [failure, request.formError, request.fieldErrors, notice]);

  const invalidate = () => {
    previewSequence.current++;
    setPreview(null);
    setLoading(false);
    setFailure(null);
    setNotice(null);
    setConsents((v) => ({ ...EMPTY_CONSENTS, marketing: v.marketing }));
  };
  const clear = (path: string) => {
    setErrors((current) => {
      const next = { ...current };
      delete next[path];
      return next;
    });
    request.clearError(path);
  };
  const errorFor = (path: string): string | null => {
    const alias =
      path === "quantity" || path === "certificateName"
        ? `details.${path}`
        : path;
    const key =
      errors[path] ?? request.fieldErrors[path] ?? request.fieldErrors[alias];
    if (!key) return null;
    const params = key.startsWith("certificateName")
      ? { min: CERTIFICATE_NAME.min, max: CERTIFICATE_NAME.max }
      : { min: pricing.minQuantity, max: pricing.maxQuantity };
    return t.has(`errors.${key}`)
      ? t(`errors.${key}`, params)
      : requestErrors.has(key)
        ? requestErrors(key, params)
        : t("errors.generic");
  };
  const validation = useCallback(
    (stage: number): Record<string, string> => {
      if (stage === 1) {
        const result = orderPayloadSchema.shape.quantity.safeParse(quantity);
        if (!result.success)
          return { quantity: result.error.issues[0].message };
        // Şema yalnız mutlak sınırları bilir; geçerli en az / en çok adet satış ayarlarından gelir.
        const range = quantityRangeError(result.data, pricing);
        return range ? { quantity: range } : {};
      }
      if (stage === 2) {
        const result = certificateNameSchema.safeParse(certificateName);
        return result.success
          ? {}
          : { certificateName: result.error.issues[0].message };
      }
      const prefix = (fields: Record<string, string>, root: string) =>
        Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [
            key === "_form" ? root : `${root}.${key}`,
            value,
          ]),
        );
      if (mode === "request") {
        const result = contactSchema.safeParse({ ...contact, locale });
        const fields = result.success
          ? {}
          : prefix(issuesToFieldErrors(result.error.issues), "contact");
        if (!contact.email.trim() && !contact.phone.trim())
          fields["contact.email"] = "contactRequired";
        return fields;
      }
      const b = buyerSchema.safeParse(buyer);
      const i = invoiceSchema.safeParse(invoiceInput(invoice));
      return {
        ...(b.success
          ? {}
          : prefix(issuesToFieldErrors(b.error.issues), "buyer")),
        ...(i.success
          ? {}
          : prefix(issuesToFieldErrors(i.error.issues), "invoice")),
      };
    },
    [quantity, certificateName, mode, contact, locale, buyer, invoice, pricing],
  );

  const showErrors = useCallback((fields: Record<string, string>) => {
    setErrors(fields);
    setNotice(null);
    setFailure("validation");
    setStep(errorStep(fields));
    setFocus((v) => ({ revision: v.revision + 1, error: true }));
  }, []);

  const loadPreview = useCallback(async () => {
    const parsed = orderPreviewSchema.safeParse({
      landId: site.id,
      quantity,
      certificateName,
      buyer,
      invoice: invoiceInput(invoice),
      locale,
    });
    if (!parsed.success) {
      showErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    const sequence = ++previewSequence.current;
    setPreview(null);
    setLoading(true);
    setFailure(null);
    setConsents((v) => ({ ...EMPTY_CONSENTS, marketing: v.marketing }));
    const result = await previewOrder(parsed.data);
    if (sequence !== previewSequence.current) return;
    setLoading(false);
    if (result.ok) setPreview(result);
    else if (
      result.error === "validation" &&
      result.fields &&
      Object.keys(result.fields).length
    )
      showErrors(result.fields);
    else setFailure(result.error);
  }, [site.id, quantity, certificateName, buyer, invoice, locale, showErrors]);

  const move = useCallback(
    (target: number, push = true) => {
      if (submitLock.current) return;
      for (let stage = 1; stage < target; stage++) {
        const fields = validation(stage);
        if (Object.keys(fields).length) {
          showErrors(fields);
          return;
        }
      }
      previewSequence.current++;
      setLoading(false);
      setPreview(null);
      setErrors({});
      setFailure(null);
      setNotice(null);
      setConsents((v) => ({ ...EMPTY_CONSENTS, marketing: v.marketing }));
      if (push) {
        const url = new URL(window.location.href);
        url.searchParams.set("adim", String(target));
        window.history.pushState({ ...window.history.state }, "", url);
      }
      setStep(target);
      setFocus((v) => ({ revision: v.revision + 1, error: false }));
      if (target === 4 && mode === "order") void loadPreview();
    },
    [validation, showErrors, mode, loadPreview],
  );

  useEffect(() => {
    const onPop = () => {
      const value = Number(
        new URL(window.location.href).searchParams.get("adim") || "1",
      );
      move(
        Number.isInteger(value) ? Math.max(1, Math.min(4, value)) : 1,
        false,
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [move]);

  const orderFailure = async (result: OrderFailure) => {
    if (result.error === "documents_stale") {
      setNotice(t("errors.documents_stale"));
      await loadPreview();
    } else if (
      result.error === "validation" &&
      result.fields &&
      Object.keys(result.fields).length
    )
      showErrors(result.fields);
    else setFailure(result.error);
  };

  async function send() {
    if (submitLock.current || request.submitting || loading) return;
    if (step < 4) {
      move(step + 1);
      return;
    }
    if (mode === "request") {
      await request.submit(
        contact,
        {
          type: "open_land_seeding",
          landId: site.id,
          quantity: quantity ?? 0,
          certificateName,
        },
        honeypot,
      );
      return;
    }
    if (!preview) {
      await loadPreview();
      return;
    }
    const consentResult = consentsSchema.safeParse(consents);
    const payload = {
      landId: site.id,
      quantity,
      certificateName,
      buyer,
      invoice: invoiceInput(invoice),
      consents,
      locale,
      documentsVersion: preview.version,
      clientToken: clientToken.current,
      website: honeypot,
      elapsedMs: Math.min(
        86_400_000,
        Math.max(0, Date.now() - startedAt.current),
      ),
      sourcePath: pathname,
    };
    const parsed = orderPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const fields = issuesToFieldErrors(parsed.error.issues);
      if (!consentResult.success)
        for (const [key, value] of Object.entries(
          issuesToFieldErrors(consentResult.error.issues),
        ))
          fields[`consents.${key}`] = value;
      if (invoice.type === "corporate" && !consents.corporateAuthority) {
        fields["consents.corporateAuthority"] = "corporateAuthorityRequired";
      }
      showErrors(fields);
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setFailure(null);
    try {
      const result = await submitOrder(parsed.data);
      if (result.ok) window.location.assign(result.redirectUrl);
      else await orderFailure(result);
    } catch {
      setFailure("generic");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const busy = submitting || request.submitting;
  const inOrderReview = step === 4 && mode === "order";
  const price = inOrderReview
    ? (preview?.totals.totalKurus ?? null)
    : totalKurus(quantity, pricing);
  const showPrice = inOrderReview || PRICING_VISIBLE;
  const finalName =
    certificateName.trim() ||
    (mode === "order"
      ? resolveCertificateName({ certificateName: undefined, buyer })
      : contact.contactName.trim().slice(0, CERTIFICATE_NAME.max)) ||
    t("certificate.placeholder");
  const steps = [
    t("steps.quantity"),
    t("steps.certificate"),
    t(mode === "order" ? "steps.buyer" : "steps.contact"),
    t("steps.review"),
  ];
  const buttonLabel = busy
    ? t("submitting")
    : loading
      ? t("review.loading")
      : step < 4
        ? t("next")
        : mode === "request"
          ? t("request.submit")
          : preview
            ? t("review.pay", {
                total: formatTry(preview.totals.totalKurus, locale),
              })
            : t("retry");
  const actions = (mobile: boolean) => (
    <div className={mobile ? "lg:hidden" : "hidden lg:block"}>
      {inOrderReview && preview && (
        <p className="mb-3 text-sm leading-relaxed text-[#0e2519]">
          {t("review.obligation")}
        </p>
      )}
      <button
        type="submit"
        form="order-wizard"
        disabled={busy || loading}
        className="min-h-12 w-full rounded-2xl bg-[#1B6B3A] px-5 py-3 text-sm font-semibold leading-relaxed text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B6B3A] disabled:opacity-60"
      >
        {buttonLabel}
      </button>
      {inOrderReview && preview && (
        <p className="mt-3 text-xs leading-relaxed text-[#3d5a3d]">
          {t("review.secure")}
        </p>
      )}
    </div>
  );

  const focusSuccess = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    node.focus({ preventScroll: true });
    // Reach the shared SuccessCard's scroll target before its passive effect.
    // Its smooth scroll then has no distance to animate for reduced-motion users.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []);

  if (request.success)
    return (
      <div
        data-immersive
        className="min-h-[70svh] motion-reduce:[&_*]:!transition-none motion-reduce:[&_*]:!animate-none"
        tabIndex={-1}
        ref={focusSuccess}
      >
        <SuccessCard
          result={request.success}
          email={contact.email}
          isLoggedIn={isLoggedIn}
        />
      </div>
    );

  return (
    <div
      data-immersive
      className="relative pb-72 lg:pb-0 motion-reduce:[&_*]:!transition-none motion-reduce:[&_*]:!animate-none"
    >
      <div className="mb-8 flex flex-col gap-5 rounded-3xl border border-[#1B6B3A]/15 bg-[#f8faf5] p-5 sm:flex-row sm:items-center sm:p-6">
        {site.cover && (
          <Image
            src={site.cover}
            alt=""
            width={112}
            height={84}
            unoptimized={/^https?:\/\//i.test(site.cover)}
            className="h-21 w-28 shrink-0 rounded-2xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-[#0e2519]">{site.name}</p>
          {site.location && (
            <p className="mt-1 text-sm text-[#3d5a3d]">{site.location}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {site.fire && (
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-orange-800">
                {site.fire}
              </span>
            )}
            {site.hectares && (
              <span className="rounded-full bg-[#e5efdf] px-3 py-1 text-[#1B6B3A]">
                {site.hectares}
              </span>
            )}
            <span className="py-1 text-[#3d5a3d]">{site.workType}</span>
          </div>
          <p className="mt-2 text-sm text-[#3d5a3d]">
            {site.species.join(" · ")}
          </p>
        </div>
        <Link
          href={SITES_HREF}
          className="min-h-11 shrink-0 py-3 text-sm font-semibold text-[#1B6B3A] underline underline-offset-4"
        >
          {t("changeSite")}
        </Link>
      </div>
      <ol
        aria-label={t("steps.label")}
        className="mb-10 grid grid-cols-4 gap-2"
      >
        {steps.map((label, i) => (
          <li
            key={i}
            aria-current={step === i + 1 ? "step" : undefined}
            className={`min-w-0 border-t-2 pt-3 ${step === i + 1 ? "border-[#1B6B3A] text-[#1B6B3A]" : "border-[#1B6B3A]/15 text-[#3d5a3d]"}`}
          >
            <span className="block text-xs font-semibold">
              {formatCount(i + 1, locale)}
            </span>
            <span className="mt-1 block break-words text-xs leading-relaxed sm:text-sm">
              {label}
            </span>
          </li>
        ))}
      </ol>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
        <form
          id="order-wizard"
          ref={form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="min-w-0 space-y-5"
        >
          <h2
            ref={heading}
            tabIndex={-1}
            className="scroll-mt-32 text-2xl font-semibold text-[#0e2519] outline-none"
          >
            {steps[step - 1]}
          </h2>
          <div
            data-wizard-feedback
            tabIndex={-1}
            className="outline-none space-y-3"
          >
            {notice && (
              <p
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
              >
                {notice}
              </p>
            )}
            <ErrorBanner
              message={failure ? t(`errors.${failure}`) : request.formError}
            />
          </div>
          {failure === "capacity" && (
            <div className="flex flex-wrap gap-4 text-sm">
              <button
                type="button"
                onClick={() => move(1)}
                className="min-h-11 font-semibold text-[#1B6B3A] underline"
              >
                {t("quantity.change")}
              </button>
              <Link
                href={SITES_HREF}
                className="min-h-11 py-3 font-semibold text-[#1B6B3A] underline"
              >
                {t("changeSite")}
              </Link>
            </div>
          )}
          {failure === "site_unavailable" && (
            <Link
              href={SITES_HREF}
              className="inline-block min-h-11 py-3 text-sm font-semibold text-[#1B6B3A] underline"
            >
              {t("changeSite")}
            </Link>
          )}
          {failure === "closed" && (
            // Tam sayfa yenileme: sunucu kipi yeniden belirler; sipariş kapalıysa sihirbaz talep kipinde açılır.
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-block min-h-11 py-3 text-sm font-semibold text-[#1B6B3A] underline"
            >
              {t("request.leaveRequest")}
            </button>
          )}
          {step === 1 && (
            <SectionCard
              step={1}
              title={t("quantity.title")}
              sub={t("quantity.description")}
            >
              <Field
                label={t("quantity.label")}
                required
                error={errorFor("quantity")}
              >
                {(a) => (
                  <QuantityInput
                    id={a.id}
                    value={quantity}
                    onChange={(value) => {
                      setQuantity(value);
                      clear("quantity");
                      request.clearError("details.quantity");
                      invalidate();
                    }}
                    min={pricing.minQuantity}
                    max={pricing.maxQuantity}
                    quick={pricing.quantityPresets}
                    invalid={a.invalid}
                    describedBy={a.describedBy}
                    disabled={busy}
                    ariaLabel={t("quantity.label")}
                  />
                )}
              </Field>
              <p className="text-sm leading-relaxed text-[#3d5a3d]">
                {t("quantity.speciesNote")}
              </p>
              {PRICING_VISIBLE && (
                <div className="rounded-2xl bg-[#f8faf5] p-4">
                  <p className="text-sm font-semibold">
                    {t("quantity.unit")}:{" "}
                    {formatTry(pricing.unitPriceKurus, locale)}
                  </p>
                  <p className="mt-1 text-xs text-[#3d5a3d]">
                    {t("quantity.vatIncluded")}
                  </p>
                </div>
              )}
            </SectionCard>
          )}
          {step === 2 && (
            <SectionCard step={2} title={t("certificate.title")}>
              <Field
                label={t("certificate.label")}
                optional
                error={errorFor("certificateName")}
                hint={
                  errorFor("certificateName")
                    ? undefined
                    : t("certificate.publicNote")
                }
              >
                {(a) => (
                  <input
                    id={a.id}
                    name="certificateName"
                    maxLength={CERTIFICATE_NAME.max}
                    value={certificateName}
                    onChange={(e) => {
                      setCertificateName(e.target.value);
                      clear("certificateName");
                      request.clearError("details.certificateName");
                      invalidate();
                    }}
                    disabled={busy}
                    aria-invalid={a.invalid}
                    aria-describedby={a.describedBy}
                    className={inputCls(a.invalid ? "x" : null)}
                  />
                )}
              </Field>
              <p className="text-right text-xs text-[#3d5a3d]">
                {t("certificate.count", {
                  count: formatCount([...certificateName].length, locale),
                  max: formatCount(CERTIFICATE_NAME.max, locale),
                })}
              </p>
              <p className="text-sm text-[#3d5a3d]">
                {t("certificate.fallback")}
              </p>
              <div className="rounded-2xl border border-[#1B6B3A]/15 bg-[#f8faf5] p-5">
                <p className="break-words font-semibold text-[#0e2519]">
                  {t("certificate.preview", { name: finalName })}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-[#3d5a3d]">
                {t("certificate.delivery")}
              </p>
            </SectionCard>
          )}
          {step === 3 && mode === "order" && (
            <BuyerInvoiceFields
              buyer={buyer}
              invoice={invoice}
              onBuyer={(patch) => {
                setBuyer((v) => ({ ...v, ...patch }));
                Object.keys(patch).forEach((k) => clear(`buyer.${k}`));
                invalidate();
              }}
              onInvoice={(patch) => {
                setInvoice((v) => ({ ...v, ...patch }));
                setErrors((v) =>
                  Object.fromEntries(
                    Object.entries(v).filter(
                      ([key]) => !key.startsWith("invoice"),
                    ),
                  ),
                );
                invalidate();
              }}
              errorFor={errorFor}
              disabled={busy}
            />
          )}
          {step === 3 && mode === "request" && (
            <div
              className="[&_label:has(input[type=checkbox])]:min-h-11"
              ref={(node) =>
                node
                  ?.querySelector('input[name="consent"]')
                  ?.setAttribute("aria-describedby", "ow-contact-consent-error")
              }
            >
              <ContactFields
                step={3}
                values={contact}
                onChange={(patch) => {
                  setContact((v) => ({ ...v, ...patch }));
                  Object.keys(patch).forEach((k) => clear(`contact.${k}`));
                }}
                errorFor={errorFor}
                disabled={busy}
                prefilled={isLoggedIn}
                honeypot={honeypot}
                onHoneypot={setHoneypot}
              />
              <span id="ow-contact-consent-error" className="sr-only">
                {errorFor("contact.consent")}
              </span>
            </div>
          )}
          {step === 4 &&
            mode === "order" &&
            (loading ? (
              <div
                role="status"
                aria-live="polite"
                className="space-y-4 rounded-3xl border border-[#1B6B3A]/15 p-6"
              >
                <p className="text-sm text-[#3d5a3d]">{t("review.loading")}</p>
                <div className="h-8 rounded bg-[#edf4e9]" />
                <div className="h-24 rounded bg-[#edf4e9]" />
                <div className="h-40 rounded bg-[#edf4e9]" />
              </div>
            ) : preview ? (
              <OrderReview
                preview={preview}
                site={site}
                locale={locale}
                buyer={buyer}
                invoice={invoice}
                certificateName={finalName}
                consents={consents}
                onConsent={(key: keyof Consents, value: boolean) => {
                  setConsents((v) => ({ ...v, [key]: value }));
                  clear(`consents.${key}`);
                }}
                errorFor={errorFor}
                onDocument={setDocument}
                dateLabels={dateLabels}
                timeline={timeline}
                disabled={busy}
              />
            ) : (
              <p className="text-sm text-[#3d5a3d]">{t("review.retryNote")}</p>
            ))}
          {step === 4 && mode === "request" && (
            <section className="vitrin-card p-6 lg:p-8">
              <h3 className="mb-3 text-lg font-bold">{t("request.review")}</h3>
              <ReviewRows
                rows={[
                  { label: t("review.site"), value: site.name },
                  {
                    label: t("review.species"),
                    value: site.species.join(" · "),
                  },
                  {
                    label: t("quantity.label"),
                    value: formatCount(quantity ?? 0, locale),
                  },
                  ...(PRICING_VISIBLE && price !== null
                    ? [
                        {
                          label: t("quantity.unit"),
                          value: formatTry(pricing.unitPriceKurus, locale),
                        },
                        {
                          label: t("request.estimated"),
                          value: formatTry(price, locale),
                        },
                      ]
                    : []),
                  { label: t("certificate.label"), value: finalName },
                  {
                    label: t("steps.contact"),
                    value: [
                      contact.contactName,
                      contact.email,
                      contact.phone,
                      contact.company,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  },
                  ...(contact.message
                    ? [{ label: t("request.message"), value: contact.message }]
                    : []),
                ]}
              />
              <p className="mt-6 rounded-2xl bg-[#f8faf5] p-4 text-sm leading-relaxed text-[#3d5a3d]">
                {t("request.note")}
              </p>
              <div className="mt-6">{timeline}</div>
            </section>
          )}
          {mode === "order" && (
            <div
              aria-hidden="true"
              className="absolute -left-[9999px] h-px w-px overflow-hidden"
            >
              <label>
                Website
                <input
                  name="website"
                  type="text"
                  autoComplete="off"
                  tabIndex={-1}
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </div>
          )}
          {step > 1 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => move(step - 1)}
              className="min-h-11 px-1 text-sm font-semibold text-[#1B6B3A] underline underline-offset-4 disabled:opacity-50"
            >
              {t("back")}
            </button>
          )}
          {actions(false)}
        </form>
        <aside
          aria-label={t("review.summaryLabel")}
          className="hidden min-w-0 space-y-5 rounded-3xl border border-[#1B6B3A]/15 bg-[#f8faf5] p-6 lg:sticky lg:top-32 lg:block"
        >
          <h2 className="text-lg font-semibold">{t("review.summaryLabel")}</h2>
          <p className="text-sm font-medium">{site.name}</p>
          <p className="text-sm text-[#3d5a3d]">{site.species.join(" · ")}</p>
          <p className="text-sm text-[#3d5a3d]">
            {t("quantity.selected", {
              count: formatCount(
                inOrderReview
                  ? (preview?.totals.quantity ?? quantity ?? 0)
                  : (quantity ?? 0),
                locale,
              ),
            })}
          </p>
          {showPrice && (
            <div className="border-t border-[#1B6B3A]/15 pt-5">
              <p className="text-xs text-[#3d5a3d]">
                {t(inOrderReview ? "review.total" : "request.estimated")}
              </p>
              <p className="mt-1 text-3xl font-semibold text-[#0e2519]">
                {price === null ? "—" : formatTry(price, locale)}
              </p>
              <p className="mt-2 text-xs text-[#3d5a3d]">
                {t("quantity.vatIncluded")}
              </p>
            </div>
          )}
          <p className="text-xs leading-relaxed text-[#3d5a3d]">
            {t("review.deadline", {
              date:
                dateLabels[
                  (preview?.schedule ?? schedule).performanceDeadline
                ] ?? (preview?.schedule ?? schedule).performanceDeadline,
            })}
          </p>
          {mode === "request" && (
            <p className="text-xs leading-relaxed text-[#3d5a3d]">
              {t("request.note")}
            </p>
          )}
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 max-h-[45svh] overflow-y-auto border-t border-[#1B6B3A]/20 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_24px_#0e25190a] lg:hidden">
        {showPrice && (
          <p className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm text-[#3d5a3d]">
            <span>
              {t(inOrderReview ? "review.total" : "request.estimated")}
            </span>
            <strong className="text-lg text-[#0e2519]">
              {price === null ? "—" : formatTry(price, locale)}
            </strong>
          </p>
        )}
        {actions(true)}
      </div>
      {document && (
        <DocumentDialog document={document} onClose={() => setDocument(null)} />
      )}
    </div>
  );
}
