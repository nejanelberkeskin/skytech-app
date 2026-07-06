"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { TR_VIEWBOX, TURKEY_PROVINCES } from "@/lib/turkeyMapData";

type ProjectStatus = "active" | "pilot" | "completed";
export interface MapProject {
  id: string;
  province: string;
  region: string;
  status: ProjectStatus;
  trees: number;
  year: number;
}

interface Props {
  projects: MapProject[];
}

const STATUS_STYLES: Record<
  ProjectStatus,
  { fill: string; glow: string; chipBg: string; chipText: string }
> = {
  active: {
    fill: "#22894a",
    glow: "rgba(52, 211, 153, 0.55)",
    chipBg: "bg-[#22894a]/15",
    chipText: "text-[#1B6B3A]",
  },
  pilot: {
    fill: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.45)",
    chipBg: "bg-[#f59e0b]/15",
    chipText: "text-[#b45309]",
  },
  completed: {
    fill: "#94b494",
    glow: "rgba(255, 255, 255, 0.30)",
    chipBg: "bg-black/8",
    chipText: "text-[#3d5a3d]",
  },
};

/* Determine highest priority status if multiple projects exist for one province */
const STATUS_PRIORITY: ProjectStatus[] = ["active", "pilot", "completed"];

export default function TurkeyMap({ projects }: Props) {
  const t = useTranslations("projectsPage");
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Group projects by province name (lowercase normalize)
  const projectsByProvince = useMemo(() => {
    const map = new Map<string, MapProject[]>();
    projects.forEach((p) => {
      const key = normalizeName(p.province);
      const existing = map.get(key) ?? [];
      existing.push(p);
      map.set(key, existing);
    });
    return map;
  }, [projects]);

  const provinceStatus = (provinceName: string): ProjectStatus | null => {
    const list = projectsByProvince.get(normalizeName(provinceName));
    if (!list || list.length === 0) return null;
    for (const s of STATUS_PRIORITY) {
      if (list.some((p) => p.status === s)) return s;
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGElement>, provinceName: string) => {
    const rect = (e.currentTarget.ownerSVGElement?.parentElement ??
      e.currentTarget.ownerSVGElement)?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setHovered(provinceName);
  };

  const hoveredProjects = hovered
    ? projectsByProvince.get(normalizeName(hovered)) ?? []
    : [];
  const hoveredStatus = hovered ? provinceStatus(hovered) : null;

  return (
    <div className="relative w-full">
      <div className="relative aspect-[1000/422] rounded-3xl overflow-hidden mesh-dark grain-overlay">
        {/* Aurora layer */}
        <div className="aurora-bg">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-blob aurora-blob-3" />
        </div>

        {/* Grid pattern */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* SVG */}
        <svg
          viewBox={TR_VIEWBOX}
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={t("map.aria")}
        >
          {/* SVG filters for glow */}
          <defs>
            <filter id="map-glow-active" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="map-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g>
            {TURKEY_PROVINCES.map((province) => {
              const status = provinceStatus(province.name);
              const styles = status ? STATUS_STYLES[status] : null;
              const isHovered = hovered === province.name;
              const hasProject = !!status;

              return (
                <motion.path
                  key={province.id}
                  d={province.d}
                  initial={false}
                  animate={{
                    fill: hasProject
                      ? styles!.fill
                      : isHovered
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(255,255,255,0.04)",
                    fillOpacity: hasProject ? (isHovered ? 1 : 0.7) : 1,
                  }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ scale: 1.03 }}
                  style={{
                    stroke: "rgba(255,255,255,0.12)",
                    strokeWidth: isHovered ? 0.8 : 0.4,
                    cursor: "pointer",
                    transformOrigin: "center",
                    transformBox: "fill-box",
                    filter: hasProject && status === "active" ? "url(#map-glow-active)" : undefined,
                  }}
                  onMouseEnter={(e) => handleMouseMove(e, province.name)}
                  onMouseMove={(e) => handleMouseMove(e, province.name)}
                  onMouseLeave={() => {
                    setHovered(null);
                    setTooltipPos(null);
                  }}
                />
              );
            })}

            {/* Pulse markers for active projects */}
            {Array.from(projectsByProvince.entries())
              .filter(([_, list]) => list.some((p) => p.status === "active"))
              .map(([key, list]) => {
                const province = TURKEY_PROVINCES.find(
                  (p) => normalizeName(p.name) === key
                );
                if (!province) return null;
                const center = pathCenter(province.d);
                if (!center) return null;
                return (
                  <PulseMarker
                    key={`pulse-${key}`}
                    cx={center.x}
                    cy={center.y}
                    color={STATUS_STYLES.active.fill}
                  />
                );
              })}
          </g>
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hovered && tooltipPos && (
            <MapTooltip
              province={hovered}
              projects={hoveredProjects}
              status={hoveredStatus}
              x={tooltipPos.x}
              y={tooltipPos.y}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 mt-6 text-xs">
        <LegendDot color={STATUS_STYLES.active.fill} pulse label={t("status.active")} />
        <LegendDot color={STATUS_STYLES.pilot.fill} label={t("status.pilot")} />
        <LegendDot color={STATUS_STYLES.completed.fill} label={t("status.completed")} />
      </div>
    </div>
  );
}

function MapTooltip({
  province,
  projects,
  status,
  x,
  y,
}: {
  province: string;
  projects: MapProject[];
  status: ProjectStatus | null;
  x: number;
  y: number;
}) {
  const t = useTranslations("projectsPage");
  const totalTrees = projects.reduce((s, p) => s + p.trees, 0);
  const styles = status ? STATUS_STYLES[status] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{
        left: x + 18,
        top: y - 18,
        transform: "translateY(-100%)",
      }}
      className="absolute z-30 pointer-events-none w-[260px]"
    >
      <div className="premium-glass-dark rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="text-sm font-bold text-white tracking-tight">{province}</h4>
          {styles && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                backgroundColor: `${styles.fill}26`,
                borderColor: `${styles.fill}40`,
                color: styles.fill,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: styles.fill }}
              />
              {status && t(`status.${status}`)}
            </span>
          )}
        </div>

        {projects.length > 0 ? (
          <>
            <div className="space-y-2 mb-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs text-[#a7d4a7]"
                >
                  <span className="truncate">{p.region}</span>
                  <span className="font-bold text-white tabular-nums shrink-0 ml-3">
                    {p.trees.toLocaleString("tr-TR")}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-baseline justify-between pt-2 border-t border-white/10">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#6b8f6b] font-bold">
                {t("map.totalSeeds")}
              </span>
              <span className="text-base font-bold text-[#34d399] tabular-nums">
                {totalTrees.toLocaleString("tr-TR")}
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-[#6b8f6b]">{t("map.emptyProvince")}</p>
        )}
      </div>
    </motion.div>
  );
}

function PulseMarker({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g style={{ pointerEvents: "none" }}>
      <motion.circle
        cx={cx}
        cy={cy}
        r={2}
        fill={color}
        animate={{ r: [2, 7, 2], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
      />
      <circle cx={cx} cy={cy} r={1.6} fill="#ffffff" />
      <circle cx={cx} cy={cy} r={1.6} fill={color} opacity={0.6} />
    </g>
  );
}

function LegendDot({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`w-2.5 h-2.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
        style={{ backgroundColor: color }}
      />
      <span className="text-[#3d5a3d] font-medium">{label}</span>
    </span>
  );
}

function normalizeName(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .trim();
}

/* Approximate path centroid using SVG path bounding via simple parsing */
function pathCenter(d: string): { x: number; y: number } | null {
  // Quick approximation: parse all numbers and average them as x/y pairs.
  // Not perfectly accurate but good enough for marker placement.
  const numbers = d.match(/-?\d+\.?\d*/g);
  if (!numbers || numbers.length < 2) return null;
  let totalX = 0;
  let totalY = 0;
  let count = 0;
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = parseFloat(numbers[i]);
    const y = parseFloat(numbers[i + 1]);
    if (!isNaN(x) && !isNaN(y)) {
      totalX += x;
      totalY += y;
      count++;
    }
  }
  if (count === 0) return null;
  // The first pair is absolute, rest are mostly relative — this gives a rough center
  return { x: parseFloat(numbers[0]), y: parseFloat(numbers[1]) };
}
