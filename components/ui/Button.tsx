import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/* Button — yönetim ve kurumsal panel düğmesi. Düz renk, gölge/parlama yok.
   primary: ana işlem (marka yeşili) · secondary: çerçeveli · ghost: yalın · danger: geri alınamaz işlem.
   `lime` eski çağrılar için korunur (çerçeveli yeşil). */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "lime";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-[#1B6B3A] text-white hover:bg-[#165c31] active:bg-[#124d29] disabled:bg-slate-200 disabled:text-slate-500",
  secondary:
    "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400",
  danger:
    "bg-white text-red-700 border border-red-300 hover:bg-red-50 hover:border-red-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200",
  lime: "bg-white text-[#1B6B3A] border border-[#1B6B3A]/40 hover:bg-[#f0f7ec] disabled:text-slate-400 disabled:border-slate-200",
};

const sizeStyles: Record<Size, string> = {
  // min-h-[44px] on sm/md ensures Apple HIG 44×44px touch target minimum
  sm: "min-h-[40px] px-3 text-sm gap-1.5 rounded-lg",
  md: "min-h-[44px] px-4 text-sm gap-2 rounded-lg",
  lg: "min-h-[48px] px-6 text-sm gap-2.5 rounded-lg",
};

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path className="opacity-80" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconRight,
      loading = false,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          // Base
          "inline-flex items-center justify-center font-medium",
          "transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B6B3A]",
          "select-none cursor-pointer disabled:cursor-not-allowed",
          // Variant + Size
          variantStyles[variant],
          sizeStyles[size],
          // Width
          fullWidth ? "w-full" : "",
          // User overrides
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {loading ? <Spinner /> : icon ? <span className="shrink-0">{icon}</span> : null}
        {children && <span>{children}</span>}
        {iconRight && !loading && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
export type { ButtonProps, Variant as ButtonVariant, Size as ButtonSize };
