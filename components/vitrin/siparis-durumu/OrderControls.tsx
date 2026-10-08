"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function CopyOrderNumber({ orderNo }: { orderNo: string }) {
  const t = useTranslations("orderStatusPage");
  const [feedback, setFeedback] = useState<"copied" | "copyFailed" | null>(
    null,
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(orderNo);
      setFeedback("copied");
    } catch {
      setFeedback("copyFailed");
    }
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <p className="break-words font-mono text-lg font-semibold sm:text-xl">
        {orderNo}
      </p>
      <button
        type="button"
        onClick={copy}
        className="min-h-11 rounded-xl border border-[#1B6B3A]/25 px-4 text-sm font-semibold text-[#1B6B3A]"
      >
        {t("copy")}
      </button>
      <span role="status" className="w-full text-sm text-[#3d5a3d]">
        {feedback ? t(feedback) : null}
      </span>
    </div>
  );
}
