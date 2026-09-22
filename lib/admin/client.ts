"use client";

/** Existing response bodies stay compatible; post-commit warnings are surfaced by AdminShell. */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (response.ok && !["GET", "HEAD"].includes(method)) {
    try {
      const body: unknown = await response.clone().json();
      if (body && typeof body === "object" && "warnings" in body && Array.isArray(body.warnings) &&
          body.warnings.some((w: unknown) => w && typeof w === "object" && "code" in w && w.code === "audit_unavailable")) {
        window.dispatchEvent(new Event("admin:audit-warning"));
      }
    } catch { /* Reading an optional warning must not turn a committed write into a retry. */ }
  }
  return response;
}
