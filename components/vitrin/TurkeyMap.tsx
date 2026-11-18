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

/* Düz dolgular: il zemini (fill), üstüne gelince (fillHover), açıklama noktası ve etiket rengi. */
const STATUS_STYLES: Record<
  ProjectStatus,
  { fill: string; fillHover: string; chip: string }
> = {
  active: {
    fill: "#9cc4a5",
    fillHover: "#7fb38b",
    chip: "border-[#1B6B3A]/30 bg-white text-[#1B6B3A]",
  },
  pilot: {
    fill: "#ecc983",
    fillHover: "#e2b55e",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
  },
  completed: {
    fill: "#bcc5b1",
    fillHover: "#a8b39b",
    chip: "border-[#14261a]/15 bg-white text-[#3d5a3d]",
  },
};

const PROVINCE_FILL = "#e9ebe2";
const PROVINCE_FILL_HOVER = "#dfe3d6";
const MARKER_COLOR = "#1B6B3A";
const [, , VIEW_W, VIEW_H] = TR_VIEWBOX.split(" ").map(Number);

/* Determine highest priority status if multiple projects exist for one province */
const STATUS_PRIORITY: ProjectStatus[] = ["active", "pilot", "completed"];

export default function TurkeyMap({ projects }: Props) {
  const t = useTranslations("projectsPage");
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  // İşaretler ilk açılışta sırayla belirir; sonrasında üstüne gelme tepkisi gecikmesiz olur.
  const [markersEntered, setMarkersEntered] = useState(false);

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

  const activeMarkers = useMemo(() => {
    const markers: { key: string; x: number; y: number }[] = [];
    projectsByProvince.forEach((list, key) => {
      if (!list.some((p) => p.status === "active")) return;
      const province = TURKEY_PROVINCES.find((p) => normalizeName(p.name) === key);
      const center = province ? pathCenter(province.d) : null;
      if (center) markers.push({ key, x: center.x, y: center.y });
    });
    return markers;
  }, [projectsByProvince]);

  const hoveredProjects = hovered
    ? projectsByProvince.get(normalizeName(hovered)) ?? []
    : [];
  const hoveredStatus = hovered ? provinceStatus(hovered) : null;

  return (
    <div className="relative w-full">
      <div className="relative aspect-[1000/422] rounded-xl overflow-hidden border border-[#14261a]/12 bg-white">
        {/* SVG */}
        <svg
          viewBox={TR_VIEWBOX}
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={t("map.aria")}
        >
          <g>
            {TURKEY_PROVINCES.map((province) => {
              const status = provinceStatus(province.name);
              const styles = status ? STATUS_STYLES[status] : null;
              const isHovered = hovered === province.name;

              return (
                <motion.path
                  key={province.id}
                  d={province.d}
                  initial={false}
                  animate={{
                    fill: styles
                      ? isHovered
                        ? styles.fillHover
                        : styles.fill
                      : isHovered
                      ? PROVINCE_FILL_HOVER
                      : PROVINCE_FILL,
                  }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ scale: 1.03 }}
                  style={{
                    stroke: isHovered ? "#c9cfbf" : "#ffffff",
                    strokeWidth: isHovered ? 1 : 0.6,
                    cursor: "pointer",
                    transformOrigin: "center",
                    transformBox: "fill-box",
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
          </g>
        </svg>

        {/* Aktif saha işaretleri: beyaz çerçeveli düz yeşil nokta. Ekran pikseliyle çizilir ki
            dar ekranda da seçilsin; fareyi yakalamaz, il üstündeki etkileşim bozulmaz. */}
        {activeMarkers.map((marker, i) => (
          <motion.span
            key={`marker-${marker.key}`}
            aria-hidden
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: hovered && normalizeName(hovered) === marker.key ? 1.4 : 1,
              opacity: 1,
            }}
            transition={{ duration: 0.4, delay: markersEntered ? 0 : 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => {
              if (i === activeMarkers.length - 1) setMarkersEntered(true);
            }}
            style={{
              left: `${(marker.x / VIEW_W) * 100}%`,
              top: `${(marker.y / VIEW_H) * 100}%`,
              backgroundColor: MARKER_COLOR,
            }}
            className="pointer-events-none absolute z-10 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full border-2 border-white"
          />
        ))}

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
        <LegendDot color={STATUS_STYLES.active.fill} label={t("status.active")} />
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
      <div className="rounded-lg border border-[#14261a]/12 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="text-sm font-bold text-[#14261a] tracking-tight">{province}</h4>
          {styles && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-[0.14em] ${styles.chip}`}
            >
              {status && t(`status.${status}`)}
            </span>
          )}
        </div>

        {projects.length > 0 ? (
          /* Sahalarda tohum topu sayısı gösterilmez; yalnız saha adı listelenir. */
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id} className="text-xs text-[#3d5a3d] truncate">
                {p.region}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[#6b8f6b]">{t("map.emptyProvince")}</p>
        )}
      </div>
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="w-2.5 h-2.5 rounded-full border border-[#14261a]/15"
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
  let count = 0;
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = parseFloat(numbers[i]);
    const y = parseFloat(numbers[i + 1]);
    if (!isNaN(x) && !isNaN(y)) {
      count++;
    }
  }
  if (count === 0) return null;
  // The first pair is absolute, rest are mostly relative — this gives a rough center
  return { x: parseFloat(numbers[0]), y: parseFloat(numbers[1]) };
}
