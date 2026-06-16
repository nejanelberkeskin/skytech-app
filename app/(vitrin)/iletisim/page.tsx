import Link from "next/link";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "İletişim — Bize Ulaşın",
  description:
    "Skytech Green Ankara ofisi, telefon, e-posta ve sosyal medya iletişim bilgileri. Çalışma saatleri 09:00-18:00, hafta içi.",
  path: "/iletisim",
});

const CONTACTS = [
  {
    Icon: PinIcon,
    title: "Adres",
    primary: "Ankara, Türkiye",
    secondary: "Skytech Green Teknoloji A.Ş.\nDetaylı adres iletişim formundan iletilir.",
  },
  {
    Icon: PhoneIcon,
    title: "Telefon",
    primary: "+90 (XXX) XXX XX XX",
    secondary: "Hafta içi 09:00 - 18:00\nWhatsApp Business üzerinden de erişilebilir.",
  },
  {
    Icon: MailIcon,
    title: "E-posta",
    primary: "info@skytechgreen.com",
    secondary: "kurumsal@skytechgreen.com\npress@skytechgreen.com",
  },
];

const SOCIAL = [
  { name: "LinkedIn", href: "#", Icon: LinkedInIcon },
  { name: "Instagram", href: "#", Icon: InstagramIcon },
  { name: "X (Twitter)", href: "#", Icon: XIcon },
  { name: "YouTube", href: "#", Icon: YouTubeIcon },
];

export default function IletisimPage() {
  return (
    <>
      <BreadcrumbSchema items={[{ name: "İletişim", path: "/iletisim" }]} />
      <BreadCrumb
        title="Bize Ulaşın"
        subtitle="Bireysel sorularınız için bilgi formumuza, kurumsal projeler için teklif sayfamıza yönelin. Sosyal medyadan da bağlantı kurabilirsiniz."
        items={[{ label: "İletişim" }]}
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
              Konum
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-[#1a2e1a]">Bizi Ziyaret Edin</h2>
          </div>

          {/* GORSEL: Google Maps embed iframe — Ankara ofis lokasyonu, 16:9 oran. */}
          <div className="relative aspect-[16/9] rounded-3xl bg-gradient-to-br from-[#0a1f12] via-[#0c2a17] to-[#0a1f12] overflow-hidden border border-black/5 shadow-xl flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/5 border border-white/10 mb-5">
                <PinIcon className="w-10 h-10 text-[#34d399]" />
              </div>
              <p className="text-white text-xl font-bold mb-2">Harita Yakında</p>
              <p className="text-[#a7d4a7] text-sm">Google Maps embed buraya gelecek</p>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Sosyal Medya */}
      <SectionWrapper variant="light">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B6B3A]/8 text-[#1B6B3A] mb-4 text-xs font-semibold uppercase tracking-wider">
            Sosyal Medya
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-[#1a2e1a] mb-3">Hikayemizi Takip Edin</h2>
          <p className="text-base text-[#3d5a3d] mb-8">
            Drone uçuşları, saha videoları, ekip hikayeleri ve teknolojik atılımlar — sosyal medyada.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOCIAL.map((s) => (
              <Link
                key={s.name}
                href={s.href}
                className="group inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white border border-black/8 text-[#1a2e1a] hover:bg-[#1B6B3A] hover:text-white hover:border-[#1B6B3A] transition-all"
              >
                <s.Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{s.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </SectionWrapper>

      {/* CTA */}
      <SectionWrapper variant="tinted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a2e1a] leading-tight mb-5">
            Hangi Yoldan <span className="text-gradient-forest">İlerleyelim?</span>
          </h2>
          <p className="text-base text-[#3d5a3d] mb-8">
            İhtiyacınıza en uygun temas noktası için aşağıdan seçin.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link href="/bilgi-al" className="vitrin-cta-primary">Bilgi Almak İstiyorum</Link>
            <Link href="/kurumsal/teklif-al" className="vitrin-cta-secondary">Kurumsal Teklif</Link>
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
