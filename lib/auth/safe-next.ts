/**
 * Yönlendirme hedefi güvenliği — yalnız site içi yol kabul edilir
 * ("/hesabim" gibi). Dış URL, "//evil.com", uzun ya da boş değer → yedek.
 * Auth callback/confirm rotaları ve giriş sonrası redirect'te kullanılır.
 */
export function safeNext(v: string | null | undefined, fallback: string): string {
  if (!v) return fallback;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.length > 200) return fallback;
  if (/[\r\n]/.test(v)) return fallback;
  return v;
}
