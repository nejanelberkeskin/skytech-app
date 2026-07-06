/**
 * Ortak formatlama yardımcıları — DRY.
 */

/** Iyzico API'nin beklediği tarih formatı: "YYYY-MM-DD HH:mm:ss" */
export function formatDateForIyzico(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * E-posta adresini maskeler: "ne***n@ke***a.com"
 * Domain kısmı da maskelenir — hassas veri sızıntısını önler.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const maskedLocal =
    local.length <= 2
      ? local[0] + "***"
      : local[0] + "***" + local[local.length - 1];
  const domainParts = domain.split(".");
  const maskedDomain =
    domainParts[0].length <= 2
      ? domainParts[0][0] + "***"
      : domainParts[0][0] + domainParts[0][1] + "***" + domainParts[0][domainParts[0].length - 1];
  return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join(".")}`;
}

/** UUID formatını doğrular (injection koruması) */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
