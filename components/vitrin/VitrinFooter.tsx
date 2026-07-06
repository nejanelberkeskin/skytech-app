import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import LanguageSwitcher from "./LanguageSwitcher";
import { ORG_LEGAL_NAME } from "@/lib/seo";

export default async function VitrinFooter() {
  const t = await getTranslations("footer");

  const HIZMETLER = [
    { label: t("services.seedBall"), href: "/tohum-topu" },
    { label: t("services.droneTech"), href: "/dron-teknolojisi" },
    { label: t("services.carbonProgram"), href: "/karbon-programi" },
    { label: t("services.corporate"), href: "/kurumsal-cozumler" },
  ];

  const HIZLI_LINKLER = [
    { label: t("quickLinks.about"), href: "/hakkimizda" },
    { label: t("quickLinks.projects"), href: "/projeler" },
    { label: t("quickLinks.info"), href: "/bilgi-al" },
    { label: t("quickLinks.contact"), href: "/iletisim" },
  ];

  const YASAL = [
    { label: t("legal.privacy"), href: "/gizlilik-politikasi" },
    { label: t("legal.terms"), href: "/kullanim-kosullari" },
    { label: t("legal.kvkk"), href: "/kvkk" },
    { label: t("legal.cookies"), href: "/cerez-politikasi" },
  ];

  return (
    <footer className="relative bg-[#0a1f12] text-[#e0f0e0] mt-20 overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-[#1B6B3A]/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[#22894a]/6 blur-3xl pointer-events-none" />

      <div className="relative vitrin-container py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link href="/" aria-label="Skytech Green" className="inline-flex items-center mb-5">
              <Image
                src="/images/brand/logo.webp"
                alt="Skytech Green"
                width={200}
                height={62}
                className="h-12 w-auto brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-[#a7d4a7] leading-relaxed mb-6 max-w-sm">
              {t("tagline")}
            </p>
            <div className="flex items-center gap-3">
              <SocialIcon href="#" aria="LinkedIn"><LinkedInIcon /></SocialIcon>
              <SocialIcon href="#" aria="Instagram"><InstagramIcon /></SocialIcon>
              <SocialIcon href="#" aria="X"><XIcon /></SocialIcon>
              <SocialIcon href="#" aria="YouTube"><YouTubeIcon /></SocialIcon>
            </div>
          </div>

          {/* Hizmetler */}
          <div className="lg:col-span-2">
            <p className="text-sm font-bold text-white uppercase tracking-wider mb-4">{t("servicesTitle")}</p>
            <ul className="space-y-2.5">
              {HIZMETLER.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[#a7d4a7] hover:text-white transition-colors inline-flex items-center gap-1.5 group"
                  >
                    <ArrowRightIcon className="w-3 h-3 text-[#22894a] group-hover:translate-x-0.5 transition-transform" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Hızlı Linkler */}
          <div className="lg:col-span-2">
            <p className="text-sm font-bold text-white uppercase tracking-wider mb-4">{t("quickLinksTitle")}</p>
            <ul className="space-y-2.5">
              {HIZLI_LINKLER.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[#a7d4a7] hover:text-white transition-colors inline-flex items-center gap-1.5 group"
                  >
                    <ArrowRightIcon className="w-3 h-3 text-[#22894a] group-hover:translate-x-0.5 transition-transform" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter + İletişim */}
          <div className="lg:col-span-4">
            <p className="text-sm font-bold text-white uppercase tracking-wider mb-4">{t("newsletterTitle")}</p>
            <p className="text-sm text-[#a7d4a7] mb-4">{t("newsletterDesc")}</p>
            <form className="flex gap-2 mb-6">
              <input
                type="email"
                placeholder="ornek@skytechgreen.com"
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-[#6b8f6b] focus:outline-none focus:border-[#22894a]/50"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#1B6B3A]/30 transition-shadow"
              >
                {t("subscribe")}
              </button>
            </form>

            <div className="space-y-2.5 text-sm text-[#a7d4a7]">
              <p className="flex items-start gap-2">
                <MailIcon className="w-4 h-4 text-[#22894a] mt-0.5 shrink-0" />
                <span>info@skytechgreen.com</span>
              </p>
              <p className="flex items-start gap-2">
                <PhoneIcon className="w-4 h-4 text-[#22894a] mt-0.5 shrink-0" />
                <span>+90 530 127 64 35</span>
              </p>
              <p className="flex items-start gap-2">
                <PinIcon className="w-4 h-4 text-[#22894a] mt-0.5 shrink-0" />
                <span>Saray Mah. 60 Cad. No:22<br />Kahramankazan / Ankara, Türkiye</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-white/5">
        <div className="vitrin-container py-5 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#6b8f6b]">
            <p>
              &copy; {new Date().getFullYear()} {ORG_LEGAL_NAME} {t("rightsReserved")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {YASAL.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-[#6b8f6b] hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <LanguageSwitcher dark />
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ href, aria, children }: { href: string; aria: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={aria}
      className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#a7d4a7] hover:bg-[#1B6B3A] hover:text-white hover:border-[#22894a] transition-all"
    >
      {children}
    </Link>
  );
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <path d="M27 5C27 5 22 4 16 6C10 8 6 13 6 19C6 22 8 25 11 26C8 24 7 21 7 19C7 14 11 9 17 8C12 11 9 16 9 20C9 24 11 27 14 27C20 27 26 22 27 5Z" fill="currentColor" />
      <path d="M11 26C9 25 7 22 7 19C7 22 8 25 11 26Z" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="9 6 15 12 9 18" strokeLinecap="round" strokeLinejoin="round" />
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
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}
function YouTubeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
