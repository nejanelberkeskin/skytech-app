import { type HTMLAttributes, type ReactNode, forwardRef } from "react";

/* Card — yönetim ve kurumsal panel yüzeyi. Eski varyant adları (glass, glow, stat…) geriye uyum için kalır;
   hepsi beyaz zemin + ince gri çerçeve. */

type Variant = "glass" | "solid" | "elevated" | "glow" | "outline" | "stat";
type Padding = "none" | "sm" | "md" | "lg" | "xl";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  hover?: boolean;
  children: ReactNode;
}

// Sade yüzeyler: beyaz zemin, ince gri çerçeve. Eski varyant adları korunur, hepsi aynı aileye iner.
const variantStyles: Record<Variant, string> = {
  glass: "bg-white border border-slate-200",
  solid: "bg-white border border-slate-200",
  elevated: "bg-white border border-slate-200 shadow-sm",
  glow: "bg-white border border-[#1B6B3A]/30",
  outline: "bg-transparent border border-slate-200",
  stat: "bg-white border border-slate-200",
};

const hoverStyles: Record<Variant, string> = {
  glass: "hover:border-slate-300",
  solid: "hover:border-slate-300",
  elevated: "hover:border-slate-300",
  glow: "hover:border-[#1B6B3A]/50",
  outline: "hover:bg-slate-50",
  stat: "hover:border-slate-300",
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
          "rounded-xl transition-colors duration-150",
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
        {icon && typeof icon !== "string" && <span className="shrink-0 mt-0.5 text-slate-500">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">{title}</h3>
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
  return <div className={`h-px bg-white my-4 ${className}`} />;
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
  // Emoji simgeler gösterilmez (yalnız SVG/öğe simgesi).
  const shownIcon = typeof icon === "string" ? null : icon;
  return (
    <Card variant="stat" padding="none" className="h-full p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug text-slate-600">{label}</p>
        {shownIcon && <span className="text-slate-400">{shownIcon}</span>}
      </div>
      <p className="mt-2 break-words text-xl font-semibold text-slate-900 tabular-nums sm:text-2xl">{value}</p>
      {footerText && (
        <p className={`mt-1 text-xs ${trend === "down" ? "text-red-700" : "text-slate-500"}`}>{footerText}</p>
      )}
    </Card>
  );
}
CardStat.displayName = "CardStat";

/* ── Exports ────────────────────────────────────────────────────────── */

export default Card;
export { Card, CardHeader, CardDivider, CardStat };
export type { CardProps, Variant as CardVariant, Padding as CardPadding };
