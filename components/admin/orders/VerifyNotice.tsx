"use client";
import { Link } from "@/i18n/navigation";
export default function VerifyNotice() {
  return <div className="rounded-xl border border-amber-300/40 p-4 text-sm text-amber-100 space-y-2">
    <p>Hesap güvenliğinde doğrulamayı tamamlayın. Buraya dönüp “Ayrıntıyı yenile” düğmesine basın. Yalnız bilgiler yeniden okunur; bir işlem yapmak için yeniden seçip onaylamanız gerekir.</p>
    <Link href="/admin/guvenlik" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 underline">Hesap güvenliğini aç (yeni sekme)</Link>
  </div>;
}

