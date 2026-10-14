import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";

/* Input, Select, Textarea — yönetim ve kurumsal panel form alanları. Beyaz zemin, gri çerçeve, odakta marka yeşili.
   Etiket kutuya bağlıdır (htmlFor); hata ya da açıklama metni ekran okuyucuda kutuyla okunur (aria-describedby). */

/* ── Shared wrapper styles ──────────────────────────────────────────── */

interface FieldWrapperProps {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  /** Etiketin bağlandığı kutunun kimliği; hata ve açıklama metinleri buna göre adlandırılır. */
  fieldId?: string;
}

function FieldWrapper({ label, helperText, error, required, children, className = "", fieldId }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-emerald-700 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p id={fieldId ? `${fieldId}-error` : undefined} className="text-xs text-red-700 mt-1.5 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={fieldId ? `${fieldId}-help` : undefined} className="text-xs text-slate-500 mt-1.5">{helperText}</p>
      )}
    </div>
  );
}

/** Kutunun kimliği (verilmezse üretilir) ve hata / açıklama metnine bağlayan aria öznitelikleri. */
function useFieldA11y(id: string | undefined, error?: string, helperText?: string, describedBy?: string) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const note = error ? `${fieldId}-error` : helperText ? `${fieldId}-help` : null;
  return {
    fieldId,
    aria: {
      id: fieldId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": [describedBy, note].filter(Boolean).join(" ") || undefined,
    },
  };
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
  // min-h-[44px]: dokunmatik hedef en az 44 px
  "w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900",
  "bg-white border border-slate-300 rounded-lg",
  "placeholder:text-slate-400",
  "transition-colors duration-150",
  "hover:border-slate-400",
  "focus:outline-none focus:border-[#1B6B3A] focus:ring-2 focus:ring-[#1B6B3A]/20",
  "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
].join(" ");

const inputError = "border-red-400 focus:border-red-500 focus:ring-red-500/20";

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, icon, iconRight, wrapperClassName, className = "", ...props }, ref) => {
    const hasIcon = !!icon;
    const hasIconRight = !!iconRight;
    const { fieldId, aria } = useFieldA11y(props.id, error, helperText, props["aria-describedby"]);

    return (
      <FieldWrapper
        fieldId={fieldId}
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
            {...aria}
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
    const { fieldId, aria } = useFieldA11y(props.id, error, helperText, props["aria-describedby"]);
    return (
      <FieldWrapper
        fieldId={fieldId}
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
          {...aria}
        />
      </FieldWrapper>
    );
  }
);
Textarea.displayName = "Textarea";

/* ── Select ─────────────────────────────────────────────────────────── */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  wrapperClassName?: string;
  children: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, wrapperClassName, className = "", children, ...props }, ref) => {
    const { fieldId, aria } = useFieldA11y(props.id, error, helperText, props["aria-describedby"]);
    return (
      <FieldWrapper
        fieldId={fieldId}
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
            {...props}
            {...aria}
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
