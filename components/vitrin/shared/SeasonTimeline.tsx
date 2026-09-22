import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
  /** Zero-based UTC month, supplied by the server to avoid hydration drift. */
  currentMonth: number;
  variant?: "full" | "compact";
}

export default async function SeasonTimeline({
  locale,
  currentMonth,
  variant = "full",
}: Props) {
  const t = await getTranslations({ locale, namespace: "seasonTimeline" });
  const compact = variant === "compact";
  const months = Array.from({ length: 12 }, (_, i) => (i + 9) % 12);
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  });
  return (
    <section
      aria-label={t("title")}
      className={`rounded-3xl border border-[#1B6B3A]/15 bg-[#f8faf5] ${compact ? "p-3" : "p-5 sm:p-8 lg:p-10"}`}
    >
      {!compact && (
        <div className="mb-8 max-w-2xl">
          <h2 className="display-headline text-2xl font-semibold text-[#0e2519] sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#3d5a3d] sm:text-base">
            {t("description")}
          </p>
        </div>
      )}
      <div
        className={`mb-4 grid grid-cols-2 gap-3 ${compact ? "text-xs" : "text-sm"}`}
      >
        <p className="font-semibold text-[#1B6B3A]">{t("release")}</p>
        <p className="font-semibold text-[#3d5a3d]">{t("monitoring")}</p>
      </div>
      <ol
        className={`grid grid-cols-12 ${compact ? "gap-px" : "gap-1 sm:gap-2"}`}
      >
        {months.map((month, i) => (
          <li
            key={month}
            aria-current={month === currentMonth ? "date" : undefined}
            className="min-w-0 text-center"
          >
            <div
              className={`h-2 ${i < 6 ? "bg-[#1B6B3A]" : "bg-[#c3d4bd]"} ${i === 0 || i === 6 ? "rounded-l-full" : ""} ${i === 5 || i === 11 ? "rounded-r-full" : ""}`}
            />
            <span
              className={`mt-3 block whitespace-nowrap text-[9px] sm:text-xs ${month === currentMonth ? "font-bold text-[#0e2519] underline decoration-2 underline-offset-4" : "text-[#3d5a3d]"}`}
            >
              {formatter
                .format(new Date(Date.UTC(2026, month, 1)))
                .replace(/\.$/u, "")}
            </span>
            <span className="sr-only">
              {i < 6 ? t("release") : t("monitoring")}
              {month === currentMonth ? ` · ${t("current")}` : ""}
            </span>
          </li>
        ))}
      </ol>
      <p
        className={`mt-6 border-t border-[#1B6B3A]/15 pt-4 text-[#3d5a3d] ${compact ? "text-xs" : "text-sm"}`}
      >
        {t("video")}
      </p>
    </section>
  );
}
