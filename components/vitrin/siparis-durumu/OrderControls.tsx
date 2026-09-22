"use client";

import { useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Next.js stores both page-query segments and rendered search in history.state.
 * Remove only the access parameter, preserving the remaining router structure. */
function withoutAccessQuery(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("__PAGE__?")) {
      try {
        const query: unknown = JSON.parse(value.slice("__PAGE__?".length));
        if (query && typeof query === "object" && !Array.isArray(query)) {
          const clean = Object.fromEntries(
            Object.entries(query).filter(([key]) => key !== "t"),
          );
          return Object.keys(clean).length
            ? `__PAGE__?${JSON.stringify(clean)}`
            : "__PAGE__";
        }
      } catch {
        /* Not a page-query segment; preserve it. */
      }
    }
    if (value.startsWith("?")) {
      const query = new URLSearchParams(value);
      query.delete("t");
      return query.size ? `?${query.toString()}` : "";
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(withoutAccessQuery);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        withoutAccessQuery(item),
      ]),
    );
  }
  return value;
}

/** Consume access only on the server; never retain or share the email-link token.
 * Before the token is removed from the address bar it is exchanged for an HttpOnly cookie
 * (readable by the server only), so a reload or a language switch keeps the page accessible. */
export function OrderAccessPrivacy({ orderNo }: { orderNo?: string }) {
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("t")) {
      const token = url.searchParams.get("t");
      if (token && orderNo) {
        void fetch(`/api/public/siparis/${encodeURIComponent(orderNo)}/erisim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t: token }),
          keepalive: true,
        }).catch(() => undefined);
      }
      url.searchParams.delete("t");
      window.history.replaceState(
        withoutAccessQuery(window.history.state),
        "",
        url,
      );
    }
  }, [orderNo]);
  return null;
}

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
