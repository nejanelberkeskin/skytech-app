/** Tek kaynak: SDK adresi ile siparişin test/canlı işareti aynı doğrulamadan gelir.
 * Resmî uçlar: https://docs.iyzico.com/on-hazirliklar/live-vs-sandbox
 * Anahtarların hangi hesaba ait olduğunu yalnız sağlayıcı doğrulayabilir.
 */
export function iyzicoConfig(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.IYZICO_API_KEY;
  const secretKey = env.IYZICO_SECRET_KEY;
  if (!apiKey?.trim() || !secretKey?.trim()) return null;
  const raw = env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com";
  // Alt alan adı, yol, sorgu, kullanıcı bilgisi ve farklı port kabul edilmez.
  // Sondaki tek eğik çizgi, aynı API kökünün geçerli yazımıdır.
  const uri = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  if (uri !== "https://sandbox-api.iyzipay.com" && uri !== "https://api.iyzipay.com") return null;
  const isTest = uri === "https://sandbox-api.iyzipay.com";
  if (env.VERCEL_ENV === "production" && isTest) return null;
  return { apiKey, secretKey, uri, isTest };
}
