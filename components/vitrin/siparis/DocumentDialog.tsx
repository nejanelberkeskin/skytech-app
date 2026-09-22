"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { OrderDocumentPreview } from "@/lib/orders/client";

export function downloadDocument(document: OrderDocumentPreview) {
  const url = URL.createObjectURL(
    new Blob([document.html], { type: "text/html;charset=utf-8" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${document.kind}.html`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function DocumentDialog({
  document,
  onClose,
}: {
  document: OrderDocumentPreview;
  onClose: () => void;
}) {
  const t = useTranslations("orderWizard.documents");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = window.document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90svh] w-[calc(100%_-_2rem)] max-w-3xl overflow-hidden rounded-2xl border border-[#1B6B3A]/20 bg-white p-0 text-[#0e2519] shadow-2xl backdrop:bg-[#050d08]/60"
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/10 p-4">
        <h2 id="document-title" className="text-base font-semibold sm:text-lg">
          {document.title}
        </h2>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-xl border border-[#1B6B3A]/20 px-4 text-sm font-semibold"
        >
          {t("close")}
        </button>
      </div>
      <iframe
        sandbox=""
        srcDoc={document.html}
        title={document.title}
        className="block h-[60svh] w-full border-0 bg-white"
      />
      <div className="flex justify-end border-t border-black/10 p-4">
        <button
          type="button"
          onClick={() => downloadDocument(document)}
          className="min-h-11 rounded-xl bg-[#1B6B3A] px-5 text-sm font-semibold text-white"
        >
          {t("download")}
        </button>
      </div>
    </dialog>
  );
}
