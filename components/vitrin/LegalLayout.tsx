import BreadCrumb from "@/components/vitrin/BreadCrumb";
import SectionWrapper from "@/components/vitrin/SectionWrapper";
import BreadcrumbSchema from "@/components/seo/BreadcrumbSchema";
import { ORG_LEGAL_NAME } from "@/lib/seo";

/**
 * LegalLayout — yasal sayfalar (gizlilik, koşullar, KVKK, çerez) için ortak
 * kabuk: BreadCrumb başlığı + okunaklı doküman gövdesi + yürürlük tarihi.
 * İçerik Türkçe hukuk metni olduğundan tüm locale'lerde aynı gövde sunulur.
 */
export default function LegalLayout({
  title,
  path,
  effectiveDate,
  children,
}: {
  title: string;
  path: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbSchema items={[{ name: title, path }]} />
      <BreadCrumb title={title} items={[{ label: title }]} />
      <SectionWrapper variant="light">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[0.18em] text-[#6b8f6b] font-bold mb-8">
            {ORG_LEGAL_NAME} · Yürürlük tarihi: {effectiveDate}
          </p>
          <div className="space-y-10">{children}</div>
        </div>
      </SectionWrapper>
    </>
  );
}

export function LegalSection({
  no,
  title,
  children,
}: {
  no: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl lg:text-2xl font-bold text-[#0e2519] mb-4">
        <span className="text-[#1B6B3A] mr-2">{no}.</span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-[#3d5a3d] leading-relaxed">{children}</p>;
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[15px] text-[#3d5a3d] leading-relaxed">
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#22894a] mt-2.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
