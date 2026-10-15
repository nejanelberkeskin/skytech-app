import Image from "next/image";
import { getTranslations } from "next-intl/server";

/** Ana sayfa: kurum logoları (başlıksız şerit). Logolar özgün renk ve oranında; tıklanınca kurumun sitesi yeni sekmede açılır. */
const LOGOS = [
  { key: "ogm", name: "Orman Genel Müdürlüğü", src: "/images/kurumlar/orman-genel-mudurlugu.webp", href: "https://www.ogm.gov.tr", w: 160, h: 160 },
  { key: "ktu", name: "Karadeniz Teknik Üniversitesi", src: "/images/kurumlar/karadeniz-teknik-universitesi.webp", href: "https://www.ktu.edu.tr", w: 160, h: 160 },
  { key: "acu", name: "Artvin Çoruh Üniversitesi", src: "/images/kurumlar/artvin-coruh-universitesi.webp", href: "https://www.artvin.edu.tr", w: 160, h: 160 },
  { key: "dogus", name: "Doğuş Enerji", src: "/images/kurumlar/dogus-enerji.webp", href: "https://www.dogusenerji.com", w: 502, h: 160 },
] as const;

export default async function InstitutionLogos() {
  const t = await getTranslations("institutionLogos");
  return (
    <section aria-label={t("label")} className="border-y border-[#1B6B3A]/10 bg-white py-8 sm:py-10">
      <ul className="vitrin-container flex flex-wrap items-center justify-center gap-x-6 gap-y-5 sm:gap-x-16">
        {LOGOS.map((logo) => (
          <li key={logo.key}>
            <a
              href={logo.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("open", { name: logo.name })}
              className="block rounded-lg opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B6B3A]"
            >
              <Image
                src={logo.src}
                alt={logo.name}
                width={logo.w}
                height={logo.h}
                className={logo.w > logo.h ? "h-8 w-auto sm:h-12" : "h-12 w-auto sm:h-16"}
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
