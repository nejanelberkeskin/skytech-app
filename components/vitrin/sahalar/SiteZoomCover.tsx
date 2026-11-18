"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { SiteZoomCover as Cover } from "@/lib/sites/boundary";

/**
 * Saha kapağı: önce çevresiyle birlikte geniş kare (sınır küçük görünür), üzerine gelince sahaya yaklaşır.
 *  • Fareli cihaz: kapsayan `.group` öğesinin üzerine gelince (CSS) — kartın tamamı tetikler.
 *  • Dokunmatik: kapak ekranın ortasına gelince kendiliğinden yaklaşır; `tapToggle` verilirse dokunuşla da değişir.
 *  • Hareket azaltma tercihinde ölçekleme yapılmaz, iki kare arasında yalnız geçiş olur (globals.css).
 */
export default function SiteZoomCover({
  cover,
  alt,
  sizes,
  credit,
  hint,
  tapToggle = false,
  priority = false,
}: {
  cover: Cover;
  alt: string;
  sizes: string;
  credit?: string | null;
  /** Dokunmatik cihazda gösterilen kısa ipucu ("Yaklaşmak için dokunun"). */
  hint?: string;
  tapToggle?: boolean;
  priority?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(hover: none)");
    const sync = () => setTouch(coarse.matches);
    sync();
    coarse.addEventListener("change", sync);
    return () => coarse.removeEventListener("change", sync);
  }, []);

  // Dokunmatik: kapak görünür alanın ortasındayken yaklaş, çıkınca geri dön.
  useEffect(() => {
    const el = ref.current;
    if (!el || !touch) return;
    const io = new IntersectionObserver(([entry]) => setZoomed(entry.isIntersecting), {
      rootMargin: "-30% 0px -30% 0px",
      threshold: 0.6,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [touch]);

  return (
    <div
      ref={ref}
      data-zoomed={zoomed}
      className="site-zoom absolute inset-0"
      style={{ ["--site-zoom" as string]: cover.scale }}
      onClick={tapToggle && touch ? () => setZoomed((z) => !z) : undefined}
    >
      <Image src={cover.wide} alt={alt} fill sizes={sizes} priority={priority} className="site-zoom-wide object-cover" />
      <Image src={cover.close} alt="" aria-hidden fill sizes={sizes} className="site-zoom-close object-cover" />
      {credit && (
        <span className="absolute bottom-1.5 right-2 rounded bg-black/45 px-1.5 py-0.5 text-[9px] text-white/90">{credit}</span>
      )}
      {hint && tapToggle && touch && (
        <span className="absolute left-2 top-2 rounded-md bg-[#14261a]/80 px-2 py-1 text-[11px] font-medium text-white">{hint}</span>
      )}
    </div>
  );
}
