"use client";

import { useEffect, useState } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Yukarı çık"
      className={`fixed bottom-6 right-6 z-30 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      style={{
        background: "linear-gradient(135deg, #1B6B3A 0%, #22894a 100%)",
        boxShadow: "0 8px 24px rgba(27, 107, 58, 0.35), 0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <polyline points="18 15 12 9 6 15" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
