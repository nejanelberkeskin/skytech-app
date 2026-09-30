/** Accept ISO timestamps with database precision without normalizing invalid dates. */
export function isReceiptTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  // Check the written calendar day before applying its timezone offset.
  return isCalendarDay(match[1]);
}

/** A real calendar day written as YYYY-MM-DD (refund due day). */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

/**
 * Receipt dates as shown to the customer, in Istanbul time. The client and the formatting server action use the
 * same validation, so a timestamp the client accepts (for example database microseconds) is never rejected by the
 * server. Returns null for invalid input; callers decide how to fail.
 */
export function formatReceiptDates(receivedAt: unknown, refundDueOn: unknown, locale: string): { receivedAt: string; refundDueOn: string } | null {
  if (!isReceiptTimestamp(receivedAt) || !isCalendarDay(refundDueOn)) return null;
  const options = { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" } as const;
  const language = locale === "en" ? "en-GB" : locale;
  return {
    receivedAt: new Intl.DateTimeFormat(language, { ...options, hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(receivedAt)),
    refundDueOn: new Intl.DateTimeFormat(language, options).format(new Date(`${refundDueOn}T12:00:00Z`)),
  };
}
