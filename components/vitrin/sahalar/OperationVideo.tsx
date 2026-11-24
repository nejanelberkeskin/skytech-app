"use client";
import { useEffect, useRef, useState } from "react";

/** The media element (and its source) is mounted only after an explicit click. */
export default function OperationVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (playing) videoRef.current?.focus(); }, [playing]);
  if (playing) return <video ref={videoRef} tabIndex={0} className="aspect-video w-full rounded-xl bg-black" src={src} poster={poster} controls autoPlay playsInline preload="none" aria-label={label} />;
  return (
    <button type="button" onClick={() => setPlaying(true)} className="relative block aspect-video w-full overflow-hidden rounded-xl bg-[#14261a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B6B3A]" aria-label={label}>
      {/* The poster is a local video frame; no third-party player or thumbnail is loaded. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" width={1280} height={720} loading="lazy" className="h-full w-full object-cover opacity-75" />
      <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-white px-6 py-4 font-semibold text-[#14261a]">▶ {label}</span></span>
    </button>
  );
}
