import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "infoPage" });
  return buildPageMetadata(
    {
      title: t("meta.title"),
      description: t("meta.description"),
      path: "/bilgi-al",
    },
    locale
  );
}

export default async function BilgiAlPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("infoPage");

  const SUBJECTS = [
    t("topics.individual"),
    t("topics.corporate"),
    t("topics.esg"),
    t("topics.drone"),
    t("topics.press"),
    t("topics.partnership"),
    t("topics.other"),
  ];

  return (
    <>
      <BreadcrumbSchema items={[{ name: t("breadcrumb.label"), path: "/bilgi-al" }]} />
      <BreadCrumb
        title={t("breadcrumb.title")}
        subtitle={t("breadcrumb.subtitle")}
        items={[{ label: t("breadcrumb.label") }]}
      />

      <SectionWrapper variant="light">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 max-w-6xl mx-auto">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className="vitrin-card p-7 lg:p-10">
              <h2 className="text-2xl font-bold text-[#1a2e1a] mb-2">{t("form.heading")}</h2>
              <p className="text-sm text-[#3d5a3d] mb-7">
                {t("form.subheading")}
              </p>

              <form className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t("form.name.label")} required>
                    <input type="text" name="name" required className={inputClass} placeholder={t("form.name.placeholder")} />
                  </Field>
                  <Field label={t("form.email.label")} required>
                    <input type="email" name="email" required className={inputClass} placeholder={t("form.email.placeholder")} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t("form.phone.label")}>
                    <input type="tel" name="phone" className={inputClass} placeholder={t("form.phone.placeholder")} />
                  </Field>
                  <Field label={t("form.company.label")}>
                    <input type="text" name="company" className={inputClass} placeholder={t("form.company.placeholder")} />
                  </Field>
                </div>

                <Field label={t("form.subject.label")} required>
                  <select name="subject" required className={inputClass}>
                    <option value="">{t("form.subject.placeholder")}</option>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                <Field label={t("form.message.label")} required>
                  <textarea
                    name="message"
                    required
                    rows={6}
                    className={`${inputClass} resize-none`}
                    placeholder={t("form.message.placeholder")}
                  />
                </Field>

                <div className="flex items-start gap-3 text-xs text-[#6b8f6b] pt-2">
                  <input type="checkbox" required className="mt-1 accent-[#1B6B3A]" />
                  <p>
                    {t("form.consent")}
                  </p>
                </div>

                <button type="submit" className="vitrin-cta-primary w-full justify-center">
                  {t("form.submit")}
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            </div>
          </div>

          {/* Yan info */}
          <div className="space-y-5">
            <InfoCard
              icon={<ClockIcon className="w-6 h-6 text-[#1B6B3A]" />}
              title={t("info.response.title")}
              desc={t("info.response.desc")}
            />
            <InfoCard
              icon={<MailIcon className="w-6 h-6 text-[#1B6B3A]" />}
              title="info@skytechgreen.com"
              desc={t("info.email.desc")}
            />
            <InfoCard
              icon={<PhoneIcon className="w-6 h-6 text-[#1B6B3A]" />}
              title="0850 308 2600"
              desc={t("info.phone.desc")}
            />
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-sm text-[#1a2e1a] placeholder:text-[#94b494] focus:outline-none focus:border-[#1B6B3A]/40 focus:ring-2 focus:ring-[#1B6B3A]/15 transition-all";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[#1a2e1a] mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-[#dc2626] ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function InfoCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="vitrin-card p-6">
      <div className="w-12 h-12 rounded-2xl bg-[#1B6B3A]/8 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-base font-bold text-[#1a2e1a] mb-1.5">{title}</p>
      <p className="text-sm text-[#3d5a3d] leading-relaxed">{desc}</p>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
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
