"use client";

import { useId, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatCount, type PriceLocale } from "@/lib/pricing";

/* ═══════════════════════════════════════════════════════════════════════
   Talep formları — ortak yapı taşları (vitrin açık tema)
   ═══════════════════════════════════════════════════════════════════════
   bilgi-al formuyla aynı görsel dil: beyaz alanlar, #1B6B3A odak halkası,
   #dc2626 hata. Her alan `error` alırsa kırmızı kenarlık + altında mesaj,
   aria-invalid / aria-describedby bağlanır.
   ═══════════════════════════════════════════════════════════════════════ */

export const inputClass =
  "w-full min-h-[46px] px-4 py-3 rounded-lg bg-white border text-sm text-[#14261a] placeholder:text-[#6b8f6b] transition-colors disabled:opacity-60 focus:outline-none focus:ring-2";
export const inputOk = "border-[#14261a]/20 focus:border-[#1B6B3A] focus:ring-[#1B6B3A]/20";
export const inputBad = "border-[#dc2626]/60 focus:border-[#dc2626] focus:ring-[#dc2626]/15";

export function inputCls(error?: string | null, extra = "") {
  return `${inputClass} ${error ? inputBad : inputOk} ${extra}`.trim();
}

/* ── Bölüm kartı ─────────────────────────────────────────────────────── */

export function SectionCard({
  step,
  title,
  sub,
  children,
  id,
}: {
  step: number;
  title: string;
  sub?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="vitrin-card p-6 lg:p-8" aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="flex items-start gap-4 mb-6">
        <span className="shrink-0 w-9 h-9 rounded-full bg-[#1B6B3A] text-white text-sm font-bold flex items-center justify-center">
          {step}
        </span>
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="text-lg lg:text-xl font-bold text-[#14261a] leading-tight">
            {title}
          </h2>
          {sub && <p className="text-sm text-[#3d5a3d] mt-1 leading-relaxed">{sub}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/* ── Alan sarmalayıcı ────────────────────────────────────────────────── */

export function Field({
  label,
  required,
  optional,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string | null;
  hint?: string;
  children: (a: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}) {
  const t = useTranslations("requestForms.common");
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-semibold text-[#14261a] mb-1.5 uppercase tracking-wider">
        {label}
        {required && <span className="text-[#dc2626] ml-0.5" aria-hidden="true">*</span>}
        {optional && <span className="ml-1.5 normal-case tracking-normal font-medium text-[#6b8f6b]">({t("optional")})</span>}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <p id={errId} role="alert" className="mt-1.5 text-xs font-medium text-[#dc2626]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-[#6b8f6b]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ── Çip grubu (tekli / çoklu seçim) ─────────────────────────────────── */

export interface ChipOption<V extends string> {
  value: V;
  label: string;
  desc?: string;
}

export function ChipGroup<V extends string>({
  options,
  value,
  onChange,
  multiple = false,
  error,
  label,
  disabled,
}: {
  options: readonly ChipOption<V>[];
  value: V[] | V | null;
  onChange: (next: V[] | V | null) => void;
  multiple?: boolean;
  error?: string | null;
  label: string;
  disabled?: boolean;
}) {
  const selected = new Set<V>(Array.isArray(value) ? value : value ? [value] : []);
  const toggle = (v: V) => {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange(Array.from(next));
    } else {
      onChange(selected.has(v) ? null : v);
    }
  };
  return (
    <div role={multiple ? "group" : "radiogroup"} aria-label={label} aria-invalid={!!error} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={active}
            disabled={disabled}
            onClick={() => toggle(o.value)}
            className={`min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-60 ${
              active
                ? "bg-[#1B6B3A] border-[#1B6B3A] text-white"
                : error
                  ? "bg-white border-[#dc2626]/40 text-[#14261a] hover:border-[#dc2626]/60"
                  : "bg-white border-[#14261a]/20 text-[#14261a] hover:border-[#1B6B3A] hover:text-[#1B6B3A]"
            }`}
          >
            {o.label}
            {o.desc && <span className={`block text-[11px] font-medium ${active ? "text-white/80" : "text-[#6b8f6b]"}`}>{o.desc}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Adet girişi (−/+ ve hızlı seçim) ────────────────────────────────── */

export function QuantityInput({
  id,
  value,
  onChange,
  min,
  max,
  quick = [],
  invalid,
  describedBy,
  disabled,
  ariaLabel,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  quick?: number[];
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const locale = useLocale() as PriceLocale;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const step = (dir: -1 | 1) => {
    const base = value ?? min;
    const inc = base >= 1000 ? 500 : base >= 100 ? 50 : 10;
    onChange(clamp(base + dir * inc));
  };
  const btn =
    "w-11 shrink-0 rounded-lg border border-[#14261a]/20 bg-white text-[#14261a] text-lg font-bold hover:border-[#1B6B3A] hover:text-[#1B6B3A] disabled:opacity-40 transition-colors";
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={() => step(-1)} disabled={disabled} aria-label="−">
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value ?? ""}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange(null);
            const n = Number(raw);
            onChange(Number.isFinite(n) ? Math.round(n) : null);
          }}
          onBlur={() => value !== null && onChange(clamp(value))}
          className={`${inputCls(invalid ? "x" : null)} text-center font-bold text-base`}
        />
        <button type="button" className={btn} onClick={() => step(1)} disabled={disabled} aria-label="+">
          +
        </button>
      </div>
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              disabled={disabled}
              onClick={() => onChange(q)}
              className={`min-h-11 sm:min-h-0 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                value === q
                  ? "bg-[#1B6B3A]/10 border-[#1B6B3A] text-[#1B6B3A]"
                  : "bg-white border-[#14261a]/20 text-[#3d5a3d] hover:border-[#1B6B3A]"
              }`}
            >
              {formatCount(q, locale)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Hata şeridi ─────────────────────────────────────────────────────── */

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-4 py-3">
      {message}
    </p>
  );
}

/* ── Özet satırı ─────────────────────────────────────────────────────── */

export function SummaryRowItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-[#14261a]/10 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#6b8f6b] pt-0.5">{label}</span>
      <span className="text-sm font-semibold text-[#14261a] text-right">{value}</span>
    </div>
  );
}
