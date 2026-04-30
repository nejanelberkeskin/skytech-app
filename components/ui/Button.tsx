import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   Button — Skytech Green Design System
   ═══════════════════════════════════════════════════════════════════════
   Variant'lar:
     primary   → Emerald glow, CTA butonları ("Sepete Ekle", "Onayla")
     secondary → Glass/outline, ikincil aksiyonlar ("Geri", "İptal")
     ghost     → Saydam, minimal aksiyonlar ("Detay", "Daha Fazla")
     danger    → Kırmızı, tehlikeli aksiyonlar ("Sil", "Reddet")
     lime      → Lime accent, öne çıkan kampanya butonları

   Size'lar: sm, md, lg
   ═══════════════════════════════════════════════════════════════════════ */

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
  primary: [
    "bg-emerald-600 text-white",
    "hover:bg-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.3)]",
    "active:bg-emerald-700",
    "disabled:bg-white/[0.04] disabled:text-white/30 disabled:shadow-none",
  ].join(" "),

  secondary: [
    "bg-white/[0.04] text-slate-200 border border-white/[0.08]",
    "hover:bg-white/[0.07] hover:border-white/[0.14] hover:text-white",
    "active:bg-white/[0.03]",
    "disabled:bg-white/[0.02] disabled:text-white/20 disabled:border-white/[0.04]",
  ].join(" "),

  ghost: [
    "bg-transparent text-slate-400",
    "hover:bg-white/[0.05] hover:text-white",
    "active:bg-white/[0.03]",
    "disabled:text-white/20",
  ].join(" "),

  danger: [
    "bg-red-500/10 text-red-400 border border-red-500/20",
    "hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300",
    "active:bg-red-500/15",
    "disabled:bg-white/[0.02] disabled:text-white/20 disabled:border-white/[0.04]",
  ].join(" "),

  lime: [
    "bg-lime-400/10 text-lime-400 border border-lime-400/20",
    "hover:bg-lime-400/20 hover:border-lime-400/30 hover:shadow-[0_0_20px_rgba(163,230,53,0.15)]",
    "active:bg-lime-400/15",
    "disabled:bg-white/[0.02] disabled:text-white/20 disabled:border-white/[0.04]",
  ].join(" "),
};

const sizeStyles: Record<Size, string> = {
  // min-h-[44px] on sm/md ensures Apple HIG 44×44px touch target minimum
  sm: "min-h-[44px] px-3 text-xs gap-1.5 rounded-lg",
  md: "min-h-[44px] px-5 text-sm gap-2 rounded-xl",
  lg: "min-h-[44px] px-7 text-sm gap-2.5 rounded-xl",
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
          "transition-all duration-200 ease-out",
          "active:scale-[0.97] disabled:active:scale-100",
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
