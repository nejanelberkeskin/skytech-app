"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
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

/** Clear the URL immediately. Keep the token only in this mounted component's
 * memory for an explicit retry; never copy it into links or browser storage. */
export function OrderAccessPrivacy({ orderNo }: { orderNo?: string }) {
  return <OrderAccessExchange key={orderNo ?? "no-order"} orderNo={orderNo} />;
}

function OrderAccessExchange({ orderNo }: { orderNo?: string }) {
  const t = useTranslations("orderStatusPage.access");
  const [phase, setPhase] = useState<"idle" | "pending" | "failed" | "unavailable">("idle");
  const token = useRef<string | null>(null);
  const active = useRef(false);
  const started = useRef(false);
  const busy = useRef(false);

  const exchange = useCallback(async () => {
    if (!active.current || busy.current || !token.current || !orderNo) return;
    busy.current = true;
    setPhase("pending");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`/api/public/siparis/${encodeURIComponent(orderNo)}/erisim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token.current }),
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      const result: unknown = await response.json().catch(() => null);
      if (!active.current) return;
      if (response.ok && result && typeof result === "object" && "ok" in result && result.ok === true) {
        token.current = null;
        setPhase("idle");
      } else if (response.status === 404) {
        token.current = null;
        setPhase("unavailable");
      } else {
        setPhase("failed");
      }
    } catch {
      if (active.current) setPhase("failed");
    } finally {
      clearTimeout(timeout);
      busy.current = false;
    }
  }, [orderNo]);

  useLayoutEffect(() => {
    active.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.has("t")) {
      token.current = orderNo ? url.searchParams.get("t") : null;
      url.searchParams.delete("t");
      window.history.replaceState(withoutAccessQuery(window.history.state), "", url);
    }
    if (token.current && !started.current) {
      started.current = true;
      // Deferring also avoids duplicate exchange requests during Strict Mode setup.
      queueMicrotask(() => { void exchange(); });
    }
    return () => { active.current = false; };
  }, [orderNo, exchange]);

  if (phase === "idle") return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p role="status" aria-live="polite">{t(phase)}</p>
      {phase === "failed" && (
        <button type="button" onClick={() => void exchange()}
          className="mt-3 min-h-11 rounded-lg border border-amber-800 px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">
          {t("retry")}
        </button>
      )}
    </div>
  );
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
