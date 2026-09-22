import RequestsOverview from "@/components/hesabim/RequestsOverview";

/**
 * Hesabım — genel bakış: taleplerin özeti. (Eski bireysel tohum satışının sipariş / ekim / ödül
 * sayaçları Faz 8'de kaldırıldı; yeni modelin siparişleri "Siparişlerim" sayfasındadır.)
 */
export default function HesabimOverview() {
  return <RequestsOverview />;
}
