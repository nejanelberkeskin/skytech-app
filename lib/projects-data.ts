export type ProjectStatus = "active" | "pilot" | "completed";

export interface Project {
  id: string;
  city: string;       // Province (matches Turkey map name)
  region: string;     // District / sub-region
  status: ProjectStatus;
  trees: number;
  year: number;
  desc: string;
  image: string;      // public/images/projeler/ altında WebP — yalnız tamamlanmış projelerde dolu
}

/**
 * Şu anda yalnızca pilot sahalarımız var: Çanakkale, İzmir, Bursa.
 * Görsel yalnızca tamamlanmış projelerde gösterilir; pilot sahalarda henüz
 * saha görseli olmadığı için image alanı boş bırakılır. Alan çoğaldıkça
 * yeni projeler eklenecek ve tamamlananlar görselleriyle listelenecek.
 */
export const PROJECTS: Project[] = [
  { id: "canakkale", city: "Çanakkale", region: "Pilot Saha", status: "pilot", trees: 0, year: 2026, desc: "Orman Genel Müdürlüğü koordinasyonunda pilot ağaçlandırma çalışması.", image: "" },
  { id: "izmir", city: "İzmir", region: "Pilot Saha", status: "pilot", trees: 0, year: 2026, desc: "Drone destekli pilot ekim ve saha analizi çalışmaları.", image: "" },
  { id: "bursa", city: "Bursa", region: "Pilot Saha", status: "pilot", trees: 0, year: 2026, desc: "Ekosistem restorasyonu odaklı pilot saha hazırlıkları.", image: "" },
];
