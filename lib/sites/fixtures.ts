/**
 * ÖRNEK saha verileri — yalnız geliştirme ortamında, migration 015 henüz
 * uygulanmamışken arayüz çalışması yapılabilsin diye. Canlıda ASLA kullanılmaz
 * (bkz. lib/sites/data.ts). Değerler gerçek değildir; gerçek saha tablosu
 * müşteriden gelince yönetim panelinden girilecek.
 */
import type { ProjectSite } from "./types";

export const SITE_FIXTURES: ProjectSite[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "ornek-canakkale-proje-uygulama-sahasi",
    name: "ÖRNEK · Çanakkale Proje Uygulama Sahası",
    province: "Çanakkale",
    district: "Merkez",
    areaHectares: 42.5,
    isFireAffected: true,
    fireYear: 2023,
    workType: "ormanlastirma_genclestirme",
    species: [
      { slug: "kizilcam", name: "Kızılçam", latinName: "Pinus brutia", image: "/images/tohumlar/kizilcam.webp" },
    ],
    summary: "Örnek metin: yangından etkilenmiş yamaçlarda kızılçam tohum topu bırakma çalışması.",
    coverImage: "/images/projeler/canakkale-gelibolu.webp",
    gallery: [],
    lat: 40.16,
    lng: 26.41,
    phase: "open",
    acceptsOrders: true,
    videoUrl: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    slug: "ornek-izmir-proje-uygulama-sahasi",
    name: "ÖRNEK · İzmir Proje Uygulama Sahası",
    province: "İzmir",
    district: "Karşıyaka",
    areaHectares: 118,
    isFireAffected: true,
    fireYear: 2024,
    workType: "genclestirme",
    species: [
      { slug: "kizilcam", name: "Kızılçam", latinName: "Pinus brutia", image: "/images/tohumlar/kizilcam.webp" },
      { slug: "sedir", name: "Sedir (Toros Sediri)", latinName: "Cedrus libani", image: "/images/tohumlar/sedir.webp" },
    ],
    summary: null,
    coverImage: "/images/projeler/izmir-karsiyaka.webp",
    gallery: [],
    lat: 38.46,
    lng: 27.12,
    phase: "scheduled",
    acceptsOrders: false,
    videoUrl: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    slug: "ornek-bursa-proje-uygulama-sahasi",
    name: "ÖRNEK · Bursa Proje Uygulama Sahası",
    province: "Bursa",
    district: null,
    areaHectares: null,
    isFireAffected: false,
    fireYear: null,
    workType: "ormanlastirma",
    species: [
      { slug: "karacam", name: "Karaçam", latinName: "Pinus nigra", image: "/images/tohumlar/karacam.webp" },
    ],
    summary: null,
    coverImage: null,
    gallery: [],
    lat: 40.18,
    lng: 29.07,
    phase: "monitoring",
    acceptsOrders: false,
    videoUrl: "https://www.youtube.com/watch?v=ornek",
  },
];
