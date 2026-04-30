export type ProjectStatus = "active" | "pilot" | "completed";

export interface Project {
  id: string;
  city: string;       // Province (matches Turkey map name)
  region: string;     // District / sub-region
  status: ProjectStatus;
  trees: number;
  year: number;
  desc: string;
}

export const PROJECTS: Project[] = [
  { id: "antalya", city: "Antalya", region: "Manavgat", status: "active", trees: 12000, year: 2025, desc: "Yangın sonrası rehabilitasyon, 50 hektar alan." },
  { id: "mugla", city: "Muğla", region: "Marmaris", status: "active", trees: 8500, year: 2025, desc: "Karaçam ağaçlandırması, eğimli yamaçlar." },
  { id: "izmir", city: "İzmir", region: "Karşıyaka", status: "pilot", trees: 1500, year: 2026, desc: "Pilot bölge — drone test uçuşları başladı." },
  { id: "ankara", city: "Ankara", region: "Beypazarı", status: "completed", trees: 6500, year: 2024, desc: "Hazine arazisi, Kurumsal Hatıra Ormanı." },
  { id: "canakkale", city: "Çanakkale", region: "Gelibolu", status: "completed", trees: 4200, year: 2024, desc: "Tarihî alan koruma + erozyon önleme." },
  { id: "bolu", city: "Bolu", region: "Mengen", status: "active", trees: 9800, year: 2026, desc: "Su havzası koruma — sediment azaltma." },
];
