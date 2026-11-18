export type ProjectStatus = "active" | "pilot" | "completed";

export interface Project {
  id: string;
  city: string;       // Province (matches Turkey map name)
  region: string;     // District / sub-region
  status: ProjectStatus;
  trees: number;
  year: number;
  desc: string;
  image: string;      // Kapak: saha sınırı çizili geniş uydu karesi (public/images/sahalar)
  district: string;   // İlçe / mevki — aynı ilde birden çok saha olabilir
  siteSlug?: string;  // Varsa Proje Uygulama Sahası sayfası
}

/**
 * Şu anda yalnızca pilot sahalarımız var: Çanakkale, İzmir, Bursa.
 * Görsel yalnızca tamamlanmış projelerde gösterilir; pilot sahalarda henüz
 * saha görseli olmadığı için image alanı boş bırakılır. Alan çoğaldıkça
 * yeni projeler eklenecek ve tamamlananlar görselleriyle listelenecek.
 */
export const PROJECTS: Project[] = [
  { id: "canakkale", city: "Çanakkale", region: "Pilot Saha", status: "pilot", trees: 0, year: 2026, desc: "Orman Genel Müdürlüğü koordinasyonunda pilot ağaçlandırma çalışması.", image: "/images/sahalar/canakkale-saraycik-genis-2026-09.webp", district: "Merkez (Saraycık)", siteSlug: "canakkale-proje-uygulama-sahasi" },
  { id: "izmir", city: "İzmir", region: "Pilot Saha", status: "pilot", trees: 0, year: 2026, desc: "Drone destekli pilot ekim ve saha analizi çalışmaları.", image: "/images/sahalar/izmir-aliaga-genis-2026-10.webp", district: "Aliağa (Bozköy – Kavaklıdere)", siteSlug: "izmir-proje-uygulama-sahasi" },
  { id: "bursa", city: "Bursa", region: "Pilot Saha", status: "pilot", trees: 0, year: 2026, desc: "Ekosistem restorasyonu odaklı pilot saha hazırlıkları.", image: "/images/sahalar/bursa-diskaya-genis-2026-10.webp", district: "Gürsu (Dışkaya)", siteSlug: "bursa-proje-uygulama-sahasi" },
];
