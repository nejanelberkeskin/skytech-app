"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import { useId } from "react";
import { useTranslations } from "next-intl";

export type Act = "prepare" | "flight" | "soil" | "sprout";
type SceneProps = { progress: MotionValue<number>; clay: string };

export function JourneyScene({ act, progress }: { act: Act; progress: MotionValue<number> }) {
  const clay = `sj-clay-${useId()}`;
  return (
    <svg viewBox="0 0 640 420" aria-hidden="true" focusable="false" fill="none" strokeLinecap="round" strokeLinejoin="round" className="sj-svg">
      <defs>
        <radialGradient id={clay} cx="30%" cy="23%" r="80%">
          <stop stopColor="#d9b887" /><stop offset="0.38" stopColor="#a67a49" />
          <stop offset="0.78" stopColor="#6b4527" /><stop offset="1" stopColor="#382311" />
        </radialGradient>
      </defs>
      {act === "prepare" && <Preparation progress={progress} clay={clay} />}
      {act === "flight" && <Flight progress={progress} clay={clay} />}
      {act === "soil" && <Soil progress={progress} clay={clay} />}
      {act === "sprout" && <Sprout progress={progress} />}
    </svg>
  );
}

function Ball({ clay }: { clay: string }) {
  return (
    <g>
      <circle r="64" fill={`url(#${clay})`} stroke="#c9a06f" strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M-49-20C-46-41-27-52-8-53" stroke="#e5c99d" strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M-42 24l9 3m49-62 4 3M26 30l8-4M-12-32l4 2M-21 43l7-2M40-7l5 4M-41-5l3-2M2 18l6-2" stroke="#382311" strokeOpacity="0.55" strokeWidth="1.5" />
      <path d="M-28-22l4-1M20-5l3 2M-9 34l3 1M37 11l3-1" stroke="#d9b887" strokeOpacity="0.5" strokeWidth="1.5" />
    </g>
  );
}

function Seed() {
  return (
    <g stroke="#e3c99f" strokeWidth="1.5">
      <path d="M-15 9C-19-4-8-17 14-13C17 1 5 15-15 9Z" fill="#382b18" />
      <path d="M-12 7Q-3-2 10-9" />
    </g>
  );
}

function Preparation({ progress, clay }: SceneProps) {
  const t = useTranslations("seedJourney");
  const closeX = useTransform(progress, [0, 0.7], [-42, 0]);
  const closeY = useTransform(progress, [0, 0.7], [20, 0]);
  const scale = useTransform(progress, [0, 0.7], [0.86, 1]);
  const shell = useTransform(progress, [0.65, 0.94], [0, 1]);
  const labels = useTransform(progress, [0.6, 0.85], [1, 0]);
  return (
    <>
      <ellipse cx="320" cy="352" rx="115" ry="9" fill="#050d08" opacity="0.5" />
      <g transform="translate(320 206)">
        <circle r="147" stroke="#a7d4a7" strokeOpacity="0.12" strokeWidth="1.25" strokeDasharray="2 9" />
        <g transform="scale(1.7)"><Ball clay={clay} /></g>
        <motion.g style={{ x: closeX, y: closeY, scale }}>
          <circle r="88" fill="#433821" stroke="#c9a06f" strokeWidth="1.5" />
          <path d="M-68-13l8-9M-56 43l11 3M26 66l8-6M48-49l7 8M-24-68l9 4M65 16l-8 6M-41-39l5 8M18 44l7-7M42-17l8 3" stroke="#8f8751" strokeWidth="1.5" />
          <circle r="46" fill="#241e12" stroke="#ad965e" strokeWidth="1.5" />
          <g transform="scale(1.6)"><Seed /></g>
        </motion.g>
        <motion.g style={{ opacity: shell }}><g transform="scale(1.7)"><Ball clay={clay} /></g></motion.g>
      </g>
      <motion.g style={{ opacity: labels }} stroke="#a7d4a7" strokeWidth="1.25">
        <path d="M383 119L430 76H472M260 201H181L105 80H42M314 215L414 310H468" opacity="0.7" />
        <g fill="#a7d4a7" stroke="none" fontSize="18">
          <text x="475" y="65">{t("labels.clay")}</text>
          <text x="42" y="60">{t("labels.organic")}</text>
          <text x="390" y="350">{t("labels.seed")}</text>
        </g>
        <g fill="#a7d4a7" stroke="none"><circle cx="383" cy="119" r="2.5" /><circle cx="260" cy="201" r="2.5" /><circle cx="314" cy="215" r="2.5" /></g>
      </motion.g>
    </>
  );
}

const CONTOURS = [
  "M-35 278C88 170 166 321 284 268S493 181 684 219",
  "M-35 297C86 189 174 344 288 287S505 198 684 240",
  "M-35 318C87 212 172 363 298 306S512 219 684 263",
  "M-35 340C98 236 176 390 305 328S525 241 684 284",
  "M-35 362C105 266 193 408 311 351S531 263 684 309",
  "M-35 385C124 289 197 437 326 373S542 286 684 334",
];

function Flight({ progress, clay }: SceneProps) {
  const t = useTranslations("seedJourney");
  const terrainX = useTransform(progress, [0, 1], [24, -24]);
  const route = useTransform(progress, [0.05, 0.85], [0, 1]);
  const droneX = useTransform(progress, [0, 1], [-24, 24]);
  const ballY = useTransform(progress, [0, 0.75, 1], [0, 0, 68]);
  const rotor = useTransform(progress, [0, 1], [0.65, 1]);
  return (
    <>
      <motion.g style={{ x: terrainX }} stroke="#77a47e" strokeOpacity="0.35" strokeWidth="1.25">
        {CONTOURS.map(d => <path key={d} d={d} />)}
      </motion.g>
      <path d="M87 310C202 366 329 213 554 277" stroke="#a7d4a7" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="3 8" />
      <motion.path d="M87 310C202 366 329 213 554 277" stroke="#a3e635" strokeWidth="1.5" style={{ pathLength: route }} />
      {[ [148, 321], [247, 300], [343, 267], [451, 261] ].map(([cx, cy], index) => <RoutePoint key={cx} cx={cx} cy={cy} index={index} progress={progress} />)}
      <text x="402" y="368" fill="#a7d4a7" fontSize="18">{t("labels.route")}</text>
      <motion.g style={{ x: droneX }}>
        <g stroke="#a7d4a7" strokeWidth="1.5" fill="#183b29">
          <path d="M280 118L203 81M360 118L437 81M279 132L211 149M361 132L429 149" />
          <path d="M282 104Q320 91 358 104L367 130L347 140H293L273 130Z" fill="#28583b" />
          <path d="M295 143H345L338 177H302Z" fill="#122c1d" />
          <path d="M310 178H330L326 190H314Z" />
          <path d="M284 137L274 179H258M356 137L366 179H382" />
          <path d="M301 114H339" strokeOpacity="0.5" />
          {[[199, 79], [441, 79], [205, 148], [435, 148]].map(([x, y]) => (
            <g key={x} transform={`translate(${x} ${y})`}>
              <ellipse rx="47" ry="7" fill="#34d399" fillOpacity="0.06" strokeOpacity="0.25" />
              <motion.path d="M-43 0H43" style={{ scaleX: rotor }} />
              <path d="M0-4V6" /><circle r="3" fill="#a7d4a7" />
            </g>
          ))}
        </g>
        <g transform="translate(320 208)"><motion.g style={{ y: ballY }}><g transform="scale(.24)"><Ball clay={clay} /></g></motion.g></g>
      </motion.g>
    </>
  );
}

function RoutePoint({ cx, cy, index, progress }: { cx: number; cy: number; index: number; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.12 + index * 0.16, 0.2 + index * 0.16], [0, 1]);
  return <motion.circle cx={cx} cy={cy} r="4" fill="#a3e635" style={{ opacity }} />;
}

function Ground() {
  return (
    <g>
      <path d="M25 316Q151 293 256 310T462 305T615 298V414H25Z" fill="#241e12" />
      <path d="M25 316Q151 293 256 310T462 305T615 298" stroke="#9b895e" strokeWidth="1.5" />
      <path d="M80 339l26-3m49 36 35-2m38-27 19 1m141 29 24-3m37-33 18-2m68 18 31-5M281 391l27 2M53 388l19-2" stroke="#c9a06f" strokeOpacity="0.22" strokeWidth="1.25" />
    </g>
  );
}

function Soil({ progress, clay }: SceneProps) {
  const y = useTransform(progress, [0, 0.24, 0.31, 0.38, 1], [-180, -10, 0, 0, 0]);
  const x = useTransform(progress, [0, 0.28, 0.4, 1], [-15, -15, 0, 0]);
  const rotate = useTransform(progress, [0, 0.24, 0.4, 1], [-18, -18, 8, 8]);
  const squash = useTransform(progress, [0, 0.24, 0.29, 0.38, 1], [1, 1, 0.93, 1, 1]);
  const clayOpacity = useTransform(progress, [0.64, 0.95], [1, 0]);
  const dissolveY = useTransform(progress, [0.64, 1], [0, 26]);
  const dissolveScale = useTransform(progress, [0.64, 1], [1, 0.45]);
  const crack = useTransform(progress, [0.56, 0.74], [0, 1]);
  const rain = useTransform(progress, [0.4, 0.5, 0.78, 0.91], [0, 0.6, 0.6, 0]);
  const rainY = useTransform(progress, [0.4, 0.9], [-30, 55]);
  const dust = useTransform(progress, [0.24, 0.29, 0.43], [0, 0.22, 0]);
  const dustScale = useTransform(progress, [0.24, 0.43], [0.6, 1.15]);
  const seed = useTransform(progress, [0.65, 0.88], [0, 1]);
  return (
    <>
      <Ground />
      <motion.g style={{ opacity: rain, y: rainY }} stroke="#a7d4a7" strokeWidth="1.25">
        <path d="M185 95l-8 23M257 42l-9 27M321 102l-7 21M383 55l-8 24M455 109l-8 25M222 193l-8 24M363 179l-7 21M424 221l-7 20" />
      </motion.g>
      <g transform="translate(320 310)"><motion.ellipse rx="65" ry="9" fill="#c9a06f" style={{ opacity: dust, scale: dustScale }} /></g>
      <g transform="translate(320 276)">
        <motion.g style={{ x, y, rotate, scaleY: squash }}>
          <motion.g style={{ opacity: clayOpacity, y: dissolveY, scaleY: dissolveScale }}>
            <g transform="scale(.59)"><Ball clay={clay} />
              <motion.path d="M-15-60L-9-30L-23-10L-6 7L-13 39M-6 7L21 16L33 47M-9-30L19-41" stroke="#241407" strokeWidth="2" style={{ pathLength: crack }} />
            </g>
          </motion.g>
        </motion.g>
      </g>
      <motion.g style={{ opacity: seed }}><g transform="translate(320 315)"><Seed /></g></motion.g>
    </>
  );
}

const NEEDLES = ["M0-102Q-28-113-43-140", "M0-102Q-23-128-22-158", "M0-102Q-6-132 0-168", "M0-102Q16-135 25-153", "M0-102Q32-122 47-131", "M0-102Q-24-99-49-113", "M0-102Q26-98 43-110"];
function Sprout({ progress }: { progress: MotionValue<number> }) {
  const root = useTransform(progress, [0.02, 0.33], [0, 1]);
  const branches = useTransform(progress, [0.2, 0.5], [0, 1]);
  const stem = useTransform(progress, [0.28, 0.64], [0, 1]);
  const needles = useTransform(progress, [0.57, 0.82], [0, 1]);
  const landscape = useTransform(progress, [0.74, 0.94], [0, 1]);
  const scale = useTransform(progress, [0.73, 0.98], [1, 0.85]);
  const camera = useTransform(scale, value => `translate(${320 * (1 - value)} ${315 * (1 - value)}) scale(${value})`);
  return (
    <>
      <motion.g style={{ opacity: landscape }}>
        <path d="M20 283Q95 251 179 272T375 254T620 232V326H20Z" fill="#183b29" />
        <path d="M20 283Q95 251 179 272T375 254T620 232" stroke="#528b57" strokeWidth="1.25" />
        {[[112, 269, 0.32], [202, 277, 0.23], [470, 247, 0.36], [551, 241, 0.28]].map(([x, y, s]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${s})`} stroke="#a7d4a7" strokeWidth="3">
            <path d="M0 0V-102" />{NEEDLES.map(d => <path key={d} d={d} />)}
          </g>
        ))}
      </motion.g>
      <Ground />
      <motion.g transform={camera}>
        <g transform="translate(320 315)">
          <Seed />
          <g stroke="#c9a06f" strokeWidth="1.5">
            <motion.path d="M-3 4Q-13 23-5 43T-9 82" style={{ pathLength: root }} />
            <motion.path d="M-8 27Q-26 32-32 48M-5 45Q17 48 24 64M-6 61Q-25 66-29 75" style={{ pathLength: branches }} />
          </g>
          <motion.path d="M0-4C-8-36 6-66 0-102" stroke="#a7d4a7" strokeWidth="2" style={{ pathLength: stem }} />
          {NEEDLES.map((d, index) => <motion.path key={d} d={d} stroke={index % 2 ? "#a3e635" : "#34d399"} strokeWidth="1.5" style={{ pathLength: needles }} />)}
        </g>
      </motion.g>
    </>
  );
}
