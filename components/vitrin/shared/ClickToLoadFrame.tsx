"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Üçüncü taraf içerik (harita, video…) YALNIZ ziyaretçi istediğinde yüklenir.
 * İlk hâlde DOM'da iframe yoktur → sayfa açılırken o sağlayıcıya hiçbir istek gitmez.
 * Düğmeye basılınca iframe aynı kutuda oluşur (yerleşim zıplamaz) ve odak ona geçer.
 * Metinler dışarıdan verilir; bileşen dile bağlı değildir.
 */
export default function ClickToLoadFrame({
  src,
  title,
  buttonLabel,
  note,
  icon,
  referrerPolicy = "strict-origin-when-cross-origin",
}: {
  src: string;
  title: string;
  buttonLabel: string;
  /** Düğmenin altındaki kısa açıklama: içerik kimden yüklenecek */
  note: string;
  icon?: ReactNode;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}) {
  const [loaded, setLoaded] = useState(false);
  const noteId = useId();

  if (loaded) {
    return (
      <iframe
        ref={(frame) => {
          frame?.focus();
        }}
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy={referrerPolicy}
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#e9ebe2] px-6 pb-28 text-center sm:pb-6">
      <button
        type="button"
        onClick={() => setLoaded(true)}
        aria-describedby={noteId}
        className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#1B6B3A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#14552d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14261a]"
      >
        {icon}
        {buttonLabel}
      </button>
      <p id={noteId} className="max-w-xs text-xs leading-relaxed text-[#3d5a3d]">
        {note}
      </p>
    </div>
  );
}
