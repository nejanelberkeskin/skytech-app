import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   Input & Textarea — Skytech Green Design System
   ═══════════════════════════════════════════════════════════════════════
   Glassmorphic form elements:
     - bg-white/[0.03] arka plan, border-white/[0.08] kenarlık
     - Focus: ring-1 ring-emerald-500, kenarlık aydınlanır
     - Error state: ring-red-500, kırmızı alt metin
     - Label ve helper text entegrasyonu
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Shared wrapper styles ──────────────────────────────────────────── */

interface FieldWrapperProps {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldWrapper({ label, helperText, error, required, children, className = "" }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
          {required && <span className="text-emerald-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-slate-500 mt-1.5">{helperText}</p>
      )}
    </div>
  );
}

/* ── Input ──────────────────────────────────────────────────────────── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  wrapperClassName?: string;
}

const inputBase = [
  // min-h-[44px] ensures Apple HIG 44×44px touch target minimum on all form elements
  "w-full min-h-[44px] px-4 py-2.5 text-sm text-white",
  "bg-white/[0.03] border border-white/[0.08] rounded-xl",
  "placeholder:text-slate-600",
  "transition-all duration-200",
  "hover:bg-white/[0.05] hover:border-white/[0.12]",
  "focus:outline-none focus:bg-white/[0.05] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/40",
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.03]",
].join(" ");

const inputError = "border-red-500/40 focus:border-red-500/50 focus:ring-red-500/30";

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, icon, iconRight, wrapperClassName, className = "", ...props }, ref) => {
    const hasIcon = !!icon;
    const hasIconRight = !!iconRight;

    return (
      <FieldWrapper
        label={label}
        helperText={helperText}
        error={error}
        required={props.required}
        className={wrapperClassName}
      >
        <div className="relative">
          {hasIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={[
              inputBase,
              error ? inputError : "",
              hasIcon ? "pl-10" : "",
              hasIconRight ? "pr-10" : "",
              className,
            ].filter(Boolean).join(" ")}
            {...props}
          />
          {hasIconRight && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">
              {iconRight}
            </span>
          )}
        </div>
      </FieldWrapper>
    );
  }
);
Input.displayName = "Input";

/* ── Textarea ──────────────────────────────────────────────────────── */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  wrapperClassName?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, wrapperClassName, className = "", ...props }, ref) => {
    return (
      <FieldWrapper
        label={label}
        helperText={helperText}
        error={error}
        required={props.required}
        className={wrapperClassName}
      >
        <textarea
          ref={ref}
          className={[
            inputBase,
            "resize-none min-h-[80px]",
            error ? inputError : "",
            className,
          ].filter(Boolean).join(" ")}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
Textarea.displayName = "Textarea";

/* ── Select ─────────────────────────────────────────────────────────── */

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  wrapperClassName?: string;
  children: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, wrapperClassName, className = "", children, ...props }, ref) => {
    return (
      <FieldWrapper
        label={label}
        helperText={helperText}
        error={error}
        required={props.required}
        className={wrapperClassName}
      >
        <div className="relative">
          <select
            ref={ref}
            className={[
              inputBase,
              "appearance-none pr-10 cursor-pointer",
              error ? inputError : "",
              className,
            ].filter(Boolean).join(" ")}
            {...(props as any)}
          >
            {children}
          </select>
          <svg
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </FieldWrapper>
    );
  }
);
Select.displayName = "Select";

export default Input;
export { Input, Textarea, Select, FieldWrapper };
export type { InputProps, TextareaProps, SelectProps };
