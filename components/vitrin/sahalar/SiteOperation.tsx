import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { estimatedSeedTarget, operationMonth, siteOperation } from "@/lib/sites/operations";
import type { ProjectSite } from "@/lib/sites/types";
import OperationVideo from "./OperationVideo";

export default async function SiteOperation({ site, locale }: { site: ProjectSite; locale: string }) {
  const operation = siteOperation(site.slug);
  if (!operation) return null;
  const t = await getTranslations({ locale, namespace: "siteOperation" });
  const target = operation.completed ? null : estimatedSeedTarget(site.areaHectares);
  const month = operationMonth(operation.releaseMonth, locale);
  return <section className="my-12 space-y-8" aria-labelledby="operation-title">
    <div>
      <h2 id="operation-title" className="text-2xl font-semibold text-[#14261a]">{t("title")}</h2>
      <p className="mt-3 text-lg font-semibold text-[#1B6B3A]">{t(operation.completed ? "completed" : "planned", { month })}</p>
      {operation.completed && <p className="mt-2 text-[#3d5a3d]">{t("closed")}</p>}
    </div>
    <dl className="grid gap-6 rounded-xl border border-[#14261a]/12 bg-[#f6f6f1] p-6 sm:grid-cols-2">
      {target !== null && <div className="sm:col-span-2"><dt className="text-sm text-[#3d5a3d]">{t("estimatedSeeds")}</dt><dd className="mt-2 text-2xl font-semibold text-[#14261a]">{t("approximately", { count: new Intl.NumberFormat(locale).format(target) })}</dd><p className="mt-2 text-sm text-[#3d5a3d]">{t("estimateNote")}</p></div>}
      {operation.releasedSeeds !== undefined && <div><dt className="text-sm text-[#3d5a3d]">{t("releasedSeeds")}</dt><dd className="mt-2 text-2xl font-semibold text-[#14261a]">{new Intl.NumberFormat(locale).format(operation.releasedSeeds)}</dd><p className="mt-2 text-sm text-[#3d5a3d]">{t("seedNote")}</p></div>}
      {operation.certificatesDelivered && <div><dt className="text-sm text-[#3d5a3d]">{t("certificates")}</dt><dd className="mt-2 font-semibold text-[#14261a]">{t("delivered")}</dd></div>}
      {operation.monitoringWindow && <div className="sm:col-span-2"><dt className="text-sm text-[#3d5a3d]">{t("monitoring")}</dt><dd className="mt-2 font-semibold text-[#14261a]">{t("monitoringPlan", { from: operationMonth(operation.monitoringWindow.from, locale), through: operationMonth(operation.monitoringWindow.through, locale) })}</dd><p className="mt-2 text-sm text-[#3d5a3d]">{t("monitoringNote")}</p></div>}
      {!operation.completed && <div className="sm:col-span-2"><dt className="text-sm text-[#3d5a3d]">{t("schedule")}</dt><dd className="mt-2 text-[#14261a]">{t("planNote")}</dd></div>}
    </dl>
    {operation.fireContext && <aside className="rounded-xl border border-[#14261a]/12 p-5 text-sm text-[#3d5a3d]"><h3 className="font-semibold text-[#14261a]">{t("fireArea", { hectares: new Intl.NumberFormat(locale).format(operation.fireContext.hectares) })}</h3><p className="mt-2">{t(operation.fireContext.scopeKey)}</p><p className="mt-2">{t("fireNote")}</p><a className="mt-3 inline-block font-semibold text-[#1B6B3A] underline underline-offset-4" href={operation.fireContext.source} target="_blank" rel="noopener noreferrer">{operation.fireContext.publisher} ↗</a></aside>}
    {operation.video && <div><h3 className="mb-4 text-xl font-semibold text-[#14261a]">{t("video")}</h3><OperationVideo {...operation.video} label={t("play")} /></div>}
    {operation.photos && <div>
      <h3 className="mb-4 text-xl font-semibold text-[#14261a]">{t("gallery")}</h3>
      <div className="grid gap-5 sm:grid-cols-2">{operation.photos.map(photo => <figure key={photo.src}>
        <div className="relative aspect-video overflow-hidden rounded-xl"><Image src={photo.src} alt={t(`photos.${photo.caption}`)} fill sizes="(min-width: 1024px) 560px, (min-width: 640px) 50vw, 100vw" className="object-cover" /></div>
        <figcaption className="mt-2 text-sm text-[#3d5a3d]">{t(`photos.${photo.caption}`)}</figcaption>
      </figure>)}</div>
      <p className="mt-4 text-sm text-[#3d5a3d]">{t("galleryNote")}</p>
    </div>}
  </section>;
}
