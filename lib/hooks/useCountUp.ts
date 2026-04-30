"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useCountUp — Sayaç animasyonu hook'u.
 * Hedef değere doğru ease-out cubic ile sayar. Görünür alana girene kadar
 * tetiklenmesini istiyorsan `enabled` parametresini IntersectionObserver
 * ile birlikte kullan.
 */
export function useCountUp(target: number, duration = 2000, enabled = true): number {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || target === 0) {
      setValue(target);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);

  return value;
}

/**
 * useInViewCountUp — IntersectionObserver ile görünür alana girince
 * sayaç animasyonunu başlatır.
 */
export function useInViewCountUp<T extends HTMLElement = HTMLDivElement>(
  target: number,
  duration = 2000
): { ref: React.RefObject<T | null>; value: number } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const value = useCountUp(target, duration, inView);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, value };
}
