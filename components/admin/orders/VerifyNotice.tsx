"use client";
import { Link } from "@/i18n/navigation";
export default function VerifyNotice() {
  return <div className="rounded-xl border border-amber-300/40 p-4 text-sm text-amber-100 space-y-2">
    <p>Hesap güvenliğinde doğrulamayı tamamlayın. Bu sayfaya döndüğünüzde görünüm kendiliğinden yenilenir. Siparişi yeniden açıp yapmak istediğiniz işlemi seçin ve onaylayın. Hiçbir işlem otomatik tekrarlanmaz.</p>
    <Link href="/admin/guvenlik" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 underline">Hesap güvenliğini aç (yeni sekme)</Link>
  </div>;
}

