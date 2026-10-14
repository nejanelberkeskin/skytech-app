/** Yönetim menüsü simgeleri: 24×24, çizgi, currentColor. Emoji yerine kullanılır. */
const P: Record<string, string[]> = {
  dashboard: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"],
  finans: ["M3 7h18v12H3z", "M3 10h18", "M7 15h3"],
  iadeler: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5"],
  araziler: ["M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  katalog: ["M12 22V12", "M12 12C12 7 8 4 4 4c0 5 3 8 8 8z", "M12 14c0-4 3-7 8-7 0 4-3 7-8 7z"],
  talepler: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.5 5h13L22 12v7H2v-7z"],
  birakma: ["M6 2 3 6v14h18V6l-3-4z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
  partiler: ["M4 7h4M16 7h4M6 7v2M18 7v2", "M8 12h8l-1 4H9z", "M12 9v3"],
  "satis-ayarlari": ["M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z", "M7.5 7.5h.01"],
  "kurumsal-hesaplar": ["M3 21h18", "M5 21V7l7-4 7 4v14", "M9 10h1M14 10h1M9 14h1M14 14h1"],
  b2b: ["M3 7h18v13H3z", "M8 7V4h8v3", "M3 12h18"],
  kullanicilar: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
  davetler: ["M3 5h18v14H3z", "m3 7 9 6 9-6"],
  roller: ["M15 7a4 4 0 1 1-3.9 5H3v4h3v-2h2v2h3", "M15 7h.01"],
  "islem-kaydi": ["M8 6h13M8 12h13M8 18h13", "M3 6h.01M3 12h.01M3 18h.01"],
  guvenlik: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  close: ["M18 6 6 18M6 6l12 12"],
};

export function AdminIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const paths = P[name] ?? P.dashboard;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
