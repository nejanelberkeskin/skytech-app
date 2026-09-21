import { getTranslations } from "next-intl/server";
import type { OrderTimelineStep } from "@/lib/orders/view";

export default async function OrderTimeline({
  timeline,
  dates,
  locale,
  subdued,
  completed,
}: {
  timeline: OrderTimelineStep[];
  dates: Record<string, string>;
  locale: string;
  subdued: boolean;
  completed: boolean;
}) {
  const t = await getTranslations({
    locale,
    namespace: "orderStatusPage.timeline",
  });
  return (
    <section
      aria-labelledby="timeline-title"
      className={`rounded-3xl border p-6 sm:p-8 ${subdued ? "border-black/10 bg-[#f5f6f4]" : "border-[#1B6B3A]/15 bg-white"}`}
    >
      <h2 id="timeline-title" className="text-xl font-semibold">
        {t("title")}
      </h2>
      {subdued && (
        <p className="mt-2 text-sm leading-relaxed text-[#526352]">
          {t("stopped")}
        </p>
      )}
      <ol className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {timeline.map((step, index) => (
          <li
            key={step.key}
            aria-current={
              !subdued &&
              (step.state === "current" ||
                (completed && step.key === "completed"))
                ? "step"
                : undefined
            }
            className="flex min-w-0 gap-3"
          >
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${subdued || step.state === "upcoming" ? "border-[#98ac98] bg-white text-[#526352]" : "border-[#1B6B3A] bg-[#1B6B3A] text-white"}`}
            >
              {step.state === "done" ? (
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m4 10 4 4 8-8" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-relaxed">
                {t(`${step.key}.title`)}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-[#526352]">
                {t(`${step.key}.description`)}
              </p>
              {step.on && (
                <time
                  dateTime={step.on}
                  className="mt-2 block text-xs font-medium text-[#3d5a3d]"
                >
                  {dates[step.on]}
                </time>
              )}
              <span className="sr-only">{t(step.state)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
