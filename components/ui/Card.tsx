import { type HTMLAttributes, type ReactNode, forwardRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   Card — Skytech Green Design System (Bento Box / Glassmorphism)
   ═══════════════════════════════════════════════════════════════════════
   Variant'lar:
     glass    → Klasik glassmorphism (bg-white/3%, blur, ince border)
     solid    → Opak koyu yüzey (bg-surface), kenar çizgisi belirgin
     elevated → Yükseltilmiş, modal/dropdown benzeri (bg-elevated)
     glow     → Emerald glow kenarlık, premium vurgulama
     outline  → Sadece border, saydam arka plan
     stat     → Özet kartları için, üstte vurgu çizgisi

   Extras:
     hover    → Hover efekti (border aydınlanır, hafif yukarı kalkar)
     padding  → none / sm / md / lg / xl
   ═══════════════════════════════════════════════════════════════════════ */

type Variant = "glass" | "solid" | "elevated" | "glow" | "outline" | "stat";
type Padding = "none" | "sm" | "md" | "lg" | "xl";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  hover?: boolean;
  children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  glass: [
    "bg-white/[0.03] backdrop-blur-xl",
    "border border-white/[0.06]",
  ].join(" "),

  solid: [
    "bg-[var(--bg-surface)]",
    "border border-white/[0.06]",
  ].join(" "),

  elevated: [
    "bg-[var(--bg-elevated)]",
    "border border-white/[0.08]",
    "shadow-xl shadow-black/20",
  ].join(" "),

  glow: [
    "bg-white/[0.03] backdrop-blur-xl",
    "border border-emerald-500/20",
    "shadow-[0_0_20px_rgba(16,185,129,0.06)]",
  ].join(" "),

  outline: [
    "bg-transparent",
    "border border-white/[0.08]",
  ].join(" "),

  stat: [
    "bg-white/[0.03] backdrop-blur-xl",
    "border border-white/[0.06]",
    "border-t-2 border-t-emerald-500/40",
  ].join(" "),
};

const hoverStyles: Record<Variant, string> = {
  glass:    "hover:bg-white/[0.05] hover:border-white/[0.10] hover:-translate-y-0.5",
  solid:    "hover:bg-[var(--bg-hover)] hover:border-white/[0.10] hover:-translate-y-0.5",
  elevated: "hover:border-white/[0.12] hover:-translate-y-0.5",
  glow:     "hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.10)] hover:-translate-y-0.5",
  outline:  "hover:bg-white/[0.03] hover:border-white/[0.14] hover:-translate-y-0.5",
  stat:     "hover:bg-white/[0.05] hover:border-white/[0.10] hover:-translate-y-0.5",
};

const paddingStyles: Record<Padding, string> = {
  none: "",
  sm:   "p-3",
  md:   "p-5",
  lg:   "p-6",
  xl:   "p-8",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "glass",
      padding = "md",
      hover = false,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={[
          "rounded-2xl transition-all duration-300 ease-out",
          variantStyles[variant],
          paddingStyles[padding],
          hover ? `cursor-pointer ${hoverStyles[variant]}` : "",
          className,
        ].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

/* ── Card.Header ────────────────────────────────────────────────────── */

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

function CardHeader({ title, subtitle, icon, action, className = "", ...props }: CardHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-3 ${className}`}
      {...props}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon && <span className="text-xl shrink-0 mt-0.5">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
CardHeader.displayName = "CardHeader";

/* ── Card.Divider ──────────────────────────────────────────────────── */

function CardDivider({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-white/[0.06] my-4 ${className}`} />;
}
CardDivider.displayName = "CardDivider";

/* ── Card.Stat (for summary cards) ─────────────────────────────────── */

interface CardStatProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  /** Eski change prop'u — hâlâ desteklenir */
  change?: string;
  /** Kısa açıklama (change ile aynı alan) */
  sub?: string;
  trend?: "up" | "down" | "neutral";
}

function CardStat({ icon, label, value, change, sub, trend }: CardStatProps) {
  const footerText = change || sub;
  return (
    <Card variant="stat" padding="md">
      <div className="flex items-start justify-between mb-3">
        {icon && <span className="text-2xl">{icon}</span>}
        {trend === "up" && (
          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full font-semibold tracking-wide">
            +
          </span>
        )}
        {trend === "down" && (
          <span className="text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full font-semibold tracking-wide">
            -
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
      {footerText && (
        <p className={`text-xs mt-2 ${
          trend === "up" ? "text-emerald-400/70" :
          trend === "down" ? "text-red-400/70" :
          "text-emerald-400/70"
        }`}>
          {footerText}
        </p>
      )}
    </Card>
  );
}
CardStat.displayName = "CardStat";

/* ── Exports ────────────────────────────────────────────────────────── */

export default Card;
export { Card, CardHeader, CardDivider, CardStat };
export type { CardProps, Variant as CardVariant, Padding as CardPadding };
