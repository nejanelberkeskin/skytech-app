import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import ClickToLoadFrame from "@/components/vitrin/shared/ClickToLoadFrame";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import LocalBusinessSchema from "@/components/seo/LocalBusinessSchema";
import { buildPageMetadata, ORG_ADDRESS, ORG_GEO, ORG_LEGAL_NAME, ORG_SOCIAL } from "@/lib/seo";
import { TRANSACTIONS_ENABLED } from "@/lib/site-config";

const ADDRESS_LOCALITY = `${ORG_ADDRESS.district} / ${ORG_ADDRESS.city}, ${ORG_ADDRESS.country}`;

/** Harita çerçevesi: iş merkezinin çevresi (~1,7 km × 1,4 km) ve işaret. */
const MAP_EMBED_URL = (() => {
  const { latitude: lat, longitude: lon } = ORG_GEO;
  const bbox = [lon - 0.01, lat - 0.0065, lon + 0.01, lat + 0.0065].map((n) => n.toFixed(4)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lon.toFixed(5)}`;
})();

/** Yol tarifi: Google binayı adresten bulur (I Blok, haritadaki iş merkezi noktasından daha kesin). */
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  `${ORG_ADDRESS.street}, ${ORG_ADDRESS.district}/${ORG_ADDRESS.city}`,
)}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contactPage" });
  return buildPageMetadata(
    {
      title: t("meta.title"),
      description: t("meta.description"),
      path: "/iletisim",
    },
    locale
  );
}

export default async function IletisimPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contactPage");

  const CONTACTS = [
    {
      Icon: PinIcon,
      title: t("contacts.address.title"),
      primary: ORG_ADDRESS.street,
      secondary: `${ADDRESS_LOCALITY}\n${ORG_LEGAL_NAME}`,
    },
    {
      Icon: PhoneIcon,
      title: t("contacts.phone.title"),
      primary: "0850 308 2600",
      secondary: `+90 530 127 64 35\n${t("contacts.phone.secondary")}`,
    },
    {
      Icon: MailIcon,
      title: t("contacts.email.title"),
      primary: "info@skytechgreen.com",
      secondary: "",
    },
  ];

  // href yoksa hesap henuz acilmamis demektir; tiklanamaz durur.
  // Onceki halinde dordune de href="#" verilmisti — tiklaninca hicbir sey
  // olmayan olu linklerdi.
  const SOCIAL: { name: string; href?: string; Icon: (p: { className?: string }) => React.ReactElement }[] = [
    { name: "LinkedIn", href: ORG_SOCIAL.linkedin, Icon: LinkedInIcon },
    { name: "Instagram", href: ORG_SOCIAL.instagram, Icon: InstagramIcon },
    { name: "X (Twitter)", Icon: XIcon },
    { name: "YouTube", Icon: YouTubeIcon },
  ];

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumb.label"), path: "/iletisim" }]} />
      <LocalBusinessSchema />
      <BreadCrumb
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        items={[{ label: t("breadcrumb.label") }]}
      />

      {/* İletişim Kartları */}
      <SectionWrapper variant="light">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto stagger-children">
          {CONTACTS.map((c) => (
            <div key={c.title} className="vitrin-card p-7">
              <div className="w-12 h-12 rounded-2xl bg-[#1B6B3A]/8 flex items-center justify-center mb-5">
                <c.Icon className="w-5 h-5 text-[#1B6B3A]" />
              </div>
              <p className="text-xs uppercase tracking-wider text-[#6b8f6b] font-semibold mb-1.5">
                {c.title}
              </p>
              <p className="text-base font-bold text-[#1a2e1a] mb-2">{c.primary}</p>
              <p className="text-sm text-[#3d5a3d] leading-relaxed whitespace-pre-line">
                {c.secondary}
              </p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Harita */}
      <SectionWrapper variant="tinted">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-3 text-xs font-semibold uppercase tracking-wider">
              {t("map.badge")}
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-[#1a2e1a]">{t("map.title")}</h2>
          </div>

          {/* Harita (tıklayınca yüklenir) + adres kartı — nokta ve adres lib/seo.ts'ten */}
          <div className="relative aspect-[16/9] rounded-3xl overflow-hidden border border-black/5 shadow-xl bg-[#0a1f12]">
            {/* OpenStreetMap embed — keyless + her yerde frameable
                (Google'ın keyless ?output=embed formatı kaldırıldı: 404 + SAMEORIGIN).
                Harita yalnız ziyaretçi "Haritayı göster" dediğinde yüklenir: sayfa açılırken
                üçüncü tarafa istek gitmez (Çerez Politikası §3). Adres kartı her zaman görünür. */}
            <ClickToLoadFrame
              src={MAP_EMBED_URL}
              title={t("map.title")}
              buttonLabel={t("map.show")}
              note={t("map.consentNote")}
              icon={<PinIcon className="h-4 w-4" />}
            />
            {/* Adres kartı — haritanın üzerinde */}
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm rounded-2xl px-5 py-4 flex items-start gap-3 pointer-events-none bg-[#0a1f12]/92 backdrop-blur-md border border-white/10 shadow-xl">
              <PinIcon className="w-5 h-5 text-[#34d399] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white leading-snug">{ORG_ADDRESS.street}</p>
                <p className="text-xs text-[#a7d4a7]">{ADDRESS_LOCALITY}</p>
                <a
                  href={DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[#a3e635] hover:text-white transition-colors pointer-events-auto"
                >
                  {t("map.directions")} →
                </a>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Sosyal Medya */}
      <SectionWrapper variant="light">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-4 text-xs font-semibold uppercase tracking-wider">
            {t("social.badge")}
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-[#1a2e1a] mb-3">{t("social.title")}</h2>
          <p className="text-base text-[#3d5a3d] mb-8">
            {t("social.subtitle")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOCIAL.map((s) =>
              s.href ? (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white border border-black/8 text-[#1a2e1a] hover:bg-[#1B6B3A] hover:text-white hover:border-[#1B6B3A] transition-all"
                >
                  <s.Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{s.name}</span>
                </a>
              ) : (
                <span
                  key={s.name}
                  aria-disabled="true"
                  className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/60 border border-black/5 text-[#1a2e1a]/35 cursor-default"
                >
                  <s.Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{s.name}</span>
                </span>
              )
            )}
          </div>
        </div>
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="tinted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            {t.rich("cta.title", {
              accent: (chunks) => <span className="text-gradient-forest">{chunks}</span>,
            })}
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8">
            {t("cta.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link href="/bilgi-al" className="vitrin-cta-primary">{t("cta.primary")}</Link>
            {TRANSACTIONS_ENABLED && (
              <Link href="/kurumsal/teklif-al" className="vitrin-cta-secondary">{t("cta.secondary")}</Link>
            )}
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
