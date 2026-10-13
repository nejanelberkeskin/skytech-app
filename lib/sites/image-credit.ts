/**
 * Saha kapağı uydu görüntüsüyse zorunlu kaynak notu. Copernicus Sentinel verisi ücretsiz ve ticari kullanıma
 * açıktır; değiştirilmiş veride "Contains modified Copernicus Sentinel data [yıl]" ibaresi istenir.
 * Dosya adı sözleşmesi: …-sentinel2-YYYY-AA.webp (public/images/sahalar).
 */
export function coverImageCredit(src: string | null | undefined): string | null {
  const m = src ? /sentinel2-(\d{4})/i.exec(src) : null;
  return m ? `Contains modified Copernicus Sentinel data ${m[1]}` : null;
}
