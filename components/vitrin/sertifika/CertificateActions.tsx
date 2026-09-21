"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

const subscribe = () => () => {};
const canShare = () => typeof navigator.share === "function";
const serverSnapshot = () => false;

export default function CertificateActions({
  imageUrl,
  pageUrl,
  filename,
  text,
}: {
  imageUrl: string;
  pageUrl: string;
  filename: string;
  text: string;
}) {
  const t = useTranslations("certificatePage");
  const shareSupported = useSyncExternalStore(
    subscribe,
    canShare,
    serverSnapshot,
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("download");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/png")) throw new Error("format");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(t("downloaded"));
    } catch {
      setMessage(t("downloadError"));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setMessage(t("copied"));
    } catch {
      setMessage(t("copyError"));
    }
  }
  async function share() {
    try {
      await navigator.share({ title: t("title"), text, url: pageUrl });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        setMessage(t("shareError"));
    }
  }
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="rounded-full bg-[#1B6B3A] px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B6B3A] disabled:opacity-60"
        >
          {t(busy ? "downloading" : "download")}
        </button>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-[#1B6B3A]/30 px-5 py-3 text-sm font-semibold text-[#1B6B3A] focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {t("copy")}
        </button>
        {shareSupported && (
          <button
            type="button"
            onClick={share}
            className="rounded-full border border-[#1B6B3A]/30 px-5 py-3 text-sm font-semibold text-[#1B6B3A] focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {t("share")}
          </button>
        )}
      </div>
      <p role="status" className="mt-3 min-h-5 text-sm text-[#3d5a3d]">
        {message}
      </p>
    </div>
  );
}
