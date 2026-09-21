"use client";

import { useId, useState } from "react";
import { youtubeEmbedUrl } from "@/lib/sites/releases";

interface Props {
  youtubeId: string;
  title: string;
  playLabel: { text: string; accessibleName: string };
  note: string;
}

/** No remote images, resource hints or iframe exist until the viewer presses play. */
export default function YouTubeLite({
  youtubeId,
  title,
  playLabel,
  note,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const noteId = useId();

  return (
    <div className="min-w-0">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#0e2519]">
        {playing ? (
          <iframe
            ref={(frame) => {
              frame?.focus();
            }}
            src={youtubeEmbedUrl(youtubeId)}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0 focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-[#d8edb9]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={playLabel.accessibleName}
            aria-describedby={noteId}
            className="absolute inset-0 flex min-h-11 min-w-11 w-full flex-col items-center justify-center gap-3 bg-linear-to-br from-[#1B6B3A] to-[#0e2519] px-4 text-white hover:from-[#247d46] focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-[#d8edb9] sm:gap-4"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-white/10 sm:h-16 sm:w-16">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="ml-1 h-7 w-7"
                fill="currentColor"
              >
                <path d="M7 4.5v15l12-7.5z" />
              </svg>
            </span>
            <span className="text-sm font-semibold sm:text-base">
              {playLabel.text}
            </span>
          </button>
        )}
      </div>
      <p
        id={noteId}
        className="mt-3 text-xs leading-relaxed text-[#526352] sm:text-sm"
      >
        {note}
      </p>
    </div>
  );
}
