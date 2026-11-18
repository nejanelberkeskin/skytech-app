"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { PROJECTS, type ProjectStatus } from "@/lib/projects-data";

// Durum etiketi: fotoğrafın üstünde okunması için dolu zeminli, düz renkli.
const STATUS_META: Record<ProjectStatus, { color: string }> = {
  active: { color: "bg-white text-[#1B6B3A] border-[#1B6B3A]/30" },
  pilot: { color: "bg-amber-50 text-amber-800 border-amber-200" },
  completed: { color: "bg-white text-[#3d5a3d] border-[#14261a]/15" },
};

export default function ProjectsGrid() {
  const t = useTranslations("projectsPage");
  return (
    <motion.div
      layout
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto"
    >
      <AnimatePresence mode="popLayout">
        {PROJECTS.map((project) => {
          const meta = STATUS_META[project.status];
          const hasImage = Boolean(project.image);
          const region = t(`items.${project.id}.region`);
          return (
            <motion.article
              key={project.id}
              layout
              layoutId={`project-${project.id}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{
                layout: { type: "spring", stiffness: 280, damping: 30 },
                opacity: { duration: 0.25 },
                scale: { duration: 0.25 },
              }}
              whileHover={{ y: -6 }}
              className="group vitrin-card overflow-hidden"
            >
              {/* Görsel yalnızca tamamlanmış projelerde. Pilot sahalarda
                  saha görseli olmadığı için düz zeminli yer tutucu gösterilir. */}
              <div className="relative aspect-[16/10] overflow-hidden">
                {hasImage ? (
                  <Image
                    src={project.image}
                    alt={`${project.city}, ${project.district} — ${region}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#e9ebe2] flex items-center justify-center">
                    <MapPinIcon className="w-10 h-10 text-[#6b8f6b]" />
                  </div>
                )}
                <div
                  className={`absolute top-3 right-3 inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.16em] ${meta.color}`}
                >
                  {t(`status.${project.status}`)}
                </div>
                {/* Yıl + şehir: geçişli karartma yerine düz, koyu bir künye plakası. */}
                <div className="absolute bottom-3 left-3 rounded-md bg-[#10241a] px-3 py-2">
                  <p className="text-xs text-[#a7d4a7] font-medium">{project.year}</p>
                  <p className="text-lg font-bold text-white tracking-tight">{project.city}</p>
                  <p className="text-xs text-white/80">{project.district}</p>
                </div>
              </div>
              <div className="p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-[#1B6B3A] font-bold mb-1">
                  {region}
                </p>
                <h3 className="text-lg font-bold text-[#14261a] tracking-tight">
                  {project.city}
                </h3>
                <p className="mb-2 text-sm font-medium text-[#3d5a3d]">{project.district}</p>
                <p className="text-sm text-[#3d5a3d] leading-relaxed">{t(`items.${project.id}.desc`)}</p>
              </div>
            </motion.article>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
