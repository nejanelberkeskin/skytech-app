"use client";

import { useEffect, useState } from "react";

/** Remains visible across admin navigation; no timeout hides an audit failure. */
export default function AdminMutationWarnings() {
  const [auditWarning, setAuditWarning] = useState(false);
  useEffect(() => {
    const show = () => setAuditWarning(true);
    window.addEventListener("admin:audit-warning", show);
    return () => window.removeEventListener("admin:audit-warning", show);
  }, []);
  if (!auditWarning) return null;
  return (
    <div role="alert" className="sticky top-16 lg:top-0 z-30 mx-4 my-3 rounded-xl border border-amber-400/50 bg-[#332b12] px-4 py-3 text-sm text-amber-100">
      <strong>İşlem kaydedildi; işlem geçmişi kaydı tamamlanamadı.</strong>{" "}
      Aynı işlemi yeniden yapmayın. Denetim kaydının tamamlanması için sistem sorumlusuna bildirin.
    </div>
  );
}
