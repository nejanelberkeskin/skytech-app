"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { PROJECTS, type ProjectStatus } from "@/lib/projects-data";

const STATUS_META: Record<ProjectStatus, { label: string; color: string; dot: string }> = {
  active: {
    label: "Aktif",
    color: "bg-[#22894a]/15 text-[#1B6B3A] border-[#22894a]/25",
    dot: "bg-[#22894a] animate-pulse",
  },
  pilot: {
    label: "Pilot",
    color: "bg-[#f59e0b]/15 text-[#b45309] border-[#f59e0b]/25",
    dot: "bg-[#f59e0b]",
  },
  completed: {
    label: "Tamamlandı",
    color: "bg-black/5 text-[#3d5a3d] border-black/10",
    dot: "bg-[#94b494]",
  },
};

const FILTERS: { id: ProjectStatus | "all"; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "active", label: "Aktif" },
  { id: "pilot", label: "Pilot" },
  { id: "completed", label: "Tamamlandı" },
];

export default function ProjectsGrid() {
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");

  const filtered = filter === "all" ? PROJECTS : PROJECTS.filter((p) => p.status === filter);

  return (
    <>
      {/* Filter pills */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="flex flex-wrap items-center justify-center gap-2 mb-10"
      >
        {FILTERS.map((f) => {
          const isActive = filter === f.id;
          return (
            <motion.button
              key={f.id}
              onClick={() => setFilter(f.id)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`relative inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-colors ${
                isActive
                  ? "text-white"
                  : "bg-white border border-black/8 text-[#3d5a3d] hover:border-[#1B6B3A]/20 hover:text-[#1B6B3A]"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="projects-filter-active"
                  className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1B6B3A] to-[#22894a] shadow-lg shadow-[#1B6B3A]/25"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative">{f.label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Cards grid — animated layout */}
      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto"
      >
        <AnimatePresence mode="popLayout">
          {filtered.map((project) => {
            const meta = STATUS_META[project.status];
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
                <div className="relative aspect-[16/10] bg-[#0a1f12] overflow-hidden">
                  <Image
                    src={project.image}
                    alt={`${project.city} ${project.region} — drone üst görünüm`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
                  <div
                    className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border text-[10px] font-bold uppercase tracking-[0.16em] ${meta.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <p className="text-xs text-white/70 mb-0.5 font-medium">{project.year}</p>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {project.trees.toLocaleString("tr-TR")}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#a7d4a7] font-bold">
                      Tohum
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#22894a] font-bold mb-1">
                    {project.region}
                  </p>
                  <h3 className="text-lg font-bold text-[#0e2519] mb-2 tracking-tight">
                    {project.city}
                  </h3>
                  <p className="text-sm text-[#3d5a3d] leading-relaxed">{project.desc}</p>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-[#3d5a3d] mt-10"
        >
          Bu kategoride henüz proje yok.
        </motion.p>
      )}
    </>
  );
}
