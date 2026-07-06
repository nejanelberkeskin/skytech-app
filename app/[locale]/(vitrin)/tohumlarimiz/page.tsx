import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import SectionHeading from "@/components/vitrin/SectionHeading";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import { TreesIcon, SproutIcon, ClockIcon, GlobeIcon } from "@/components/ui/Icons";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ourSeeds" });
  return buildPageMetadata(
    {
      title: t("meta.title"),
      description: t("meta.description"),
      path: "/tohumlarimiz",
    },
    locale
  );
}

const SEED_IDS = ["kizilcam", "karacam", "sedir", "ardic"] as const;

const SEED_ACCENTS: Record<(typeof SEED_IDS)[number], string> = {
  kizilcam: "from-[#1B6B3A] to-[#22894a]",
  karacam: "from-[#22894a] to-[#34d399]",
  sedir: "from-[#34d399] to-[#a3e635]",
  ardic: "from-[#1B6B3A] to-[#34d399]",
};

export default async function TohumlarimizPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ourSeeds");

  const seeds = SEED_IDS.map((id) => ({
    id,
    name: t(`seeds.${id}.name`),
    latin: t(`seeds.${id}.latin`),
    family: t(`seeds.${id}.family`),
    region: t(`seeds.${id}.region`),
    climate: t(`seeds.${id}.climate`),
    rootDepth: t(`seeds.${id}.rootDepth`),
    germination: t(`seeds.${id}.germination`),
    lifespan: t(`seeds.${id}.lifespan`),
    ecologicalRole: t(`seeds.${id}.ecologicalRole`),
    description: t(`seeds.${id}.description`),
    accent: SEED_ACCENTS[id],
  }));

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumbSchemaName"), path: "/tohumlarimiz" }]} />
      <BreadCrumb
        title={t("breadcrumbTitle")}
        subtitle={t("breadcrumbSubtitle")}
        items={[{ label: t("breadcrumbSchemaName") }]}
      />

      <SectionWrapper variant="light">
        <SectionHeading
          badge={t("sectionBadge")}
          title={<>{t("sectionTitleLine")} <span className="text-gradient-forest">{t("sectionTitleAccent")}</span></>}
          subtitle={t("sectionSubtitle")}
        />

        <div className="space-y-12 max-w-5xl mx-auto">
          {seeds.map((seed, i) => (
            <article
              key={seed.id}
              className="vitrin-card overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-0"
            >
              {/* Sol — Tür kartı: gerçek ağaç görseli + okunabilirlik gradyanı */}
              <div className="relative md:col-span-4 min-h-[340px] text-white overflow-hidden">
                <Image
                  src={`/images/tohumlar/${seed.id}.webp`}
                  alt={`${seed.name} — ${seed.latin}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
                {/* Üst + alt koyu gradyan — metin fotoğrafın üstünde okunur kalsın */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a1f12]/70 via-[#0a1f12]/10 to-[#0a1f12]/85 pointer-events-none" />
                <div className="relative h-full p-8 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/80">
                      {t("typeLabel", { number: String(i + 1).padStart(2, "0") })}
                    </span>
                    <h3 className="text-3xl font-bold mt-2 leading-tight drop-shadow-md">{seed.name}</h3>
                    <p className="text-sm italic text-white/85 mt-1">{seed.latin}</p>
                  </div>
                  <div className="mt-8 flex items-center gap-3 text-sm text-white/95">
                    <TreesIcon className="w-10 h-10 shrink-0" strokeWidth={1.4} />
                    <span className="text-xs leading-relaxed">{seed.family}</span>
                  </div>
                </div>
              </div>

              {/* Sağ — Detay */}
              <div className="md:col-span-8 p-8 lg:p-10 space-y-6">
                <p className="text-base text-[#3d5a3d] leading-relaxed">{seed.description}</p>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <Detail icon={<GlobeIcon className="w-4 h-4" />} label={t("labels.region")} value={seed.region} />
                  <Detail icon={<SproutIcon className="w-4 h-4" />} label={t("labels.climate")} value={seed.climate} />
                  <Detail icon={<TreesIcon className="w-4 h-4" />} label={t("labels.rootDepth")} value={seed.rootDepth} />
                  <Detail icon={<ClockIcon className="w-4 h-4" />} label={t("labels.germination")} value={seed.germination} />
                  <Detail icon={<ClockIcon className="w-4 h-4" />} label={t("labels.lifespan")} value={seed.lifespan} />
                  <Detail icon={<SproutIcon className="w-4 h-4" />} label={t("labels.ecologicalRole")} value={seed.ecologicalRole} />
                </dl>
              </div>
            </article>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper variant="tinted" className="text-center">
        <p className="text-base text-[#3d5a3d] leading-relaxed max-w-2xl mx-auto">
          {t("footnote")}
        </p>
      </SectionWrapper>
    </>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-7 h-7 rounded-lg bg-[#1B6B3A]/8 flex items-center justify-center text-[#1B6B3A] shrink-0">
        {icon}
      </span>
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-widest text-[#1B6B3A]">{label}</dt>
        <dd className="text-sm text-[#3d5a3d] mt-0.5 leading-snug">{value}</dd>
      </div>
    </div>
  );
}
