import { Link } from "@/i18n/navigation";

/**
 * Saha sayfasında ekranın altına sabitlenen satın alma çubuğu: sayfa boyunca "Bu sahaya tohum topu bıraktır" görünür
 * kalır. `data-sticky-cta` işareti yukarı çık düğmesini çubuğun üstüne kaldırır (ScrollToTop).
 */
export default function StickySiteCta({
  href,
  label,
  siteName,
  priceNote,
}: {
  href: string;
  label: string;
  siteName: string;
  priceNote: string | null;
}) {
  return (
    <div
        data-sticky-cta
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1B6B3A]/15 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_24px_#0e25190f] backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate font-semibold text-[#0e2519]">{siteName}</p>
            {priceNote && <p className="text-sm text-[#3d5a3d]">{priceNote}</p>}
          </div>
          <Link
            href={href}
            className="vitrin-cta-primary w-full justify-center !whitespace-normal !text-center sm:w-auto"
          >
            {label}
          </Link>
        </div>
    </div>
  );
}
