"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { PROJECTS, type ProjectStatus } from "@/lib/projects-data";

const STATUS_META: Record<ProjectStatus, { color: string; dot: string }> = {
  active: {
    color: "bg-[#22894a]/15 text-[#1B6B3A] border-[#22894a]/25",
    dot: "bg-[#22894a] animate-pulse",
  },
  pilot: {
    color: "bg-[#f59e0b]/15 text-[#b45309] border-[#f59e0b]/25",
    dot: "bg-[#f59e0b]",
  },
  completed: {
    color: "bg-black/5 text-[#3d5a3d] border-black/10",
    dot: "bg-[#94b494]",
  },
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
                  saha görseli olmadığı için marka gradient placeholder gösterilir. */}
              <div className="relative aspect-[16/10] overflow-hidden">
                {hasImage ? (
                  <>
                    <Image
                      src={project.image}
                      alt={`${project.city} — ${region}`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0a1f12] via-[#0e2a18] to-[#123420] flex items-center justify-center">
                    <MapPinIcon className="w-10 h-10 text-[#22894a]/50" />
                    <div className="absolute inset-0 mesh-gradient opacity-20 pointer-events-none" />
                  </div>
                )}
                <div
                  className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border text-[10px] font-bold uppercase tracking-[0.16em] ${meta.color}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {t(`status.${project.status}`)}
                </div>
                <div className="absolute bottom-3 left-3">
                  <p className="text-xs text-white/70 font-medium">{project.year}</p>
                  <p className="text-lg font-bold text-white tracking-tight">{project.city}</p>
                </div>
              </div>
              <div className="p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-[#22894a] font-bold mb-1">
                  {region}
                </p>
                <h3 className="text-lg font-bold text-[#0e2519] mb-2 tracking-tight">
                  {project.city}
                </h3>
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
