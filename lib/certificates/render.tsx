import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { CERT_BACKGROUND, CERT_LAYOUT, type CertificateFormat } from "./layout";
import type { PublicCertificate } from "./types";

const assets = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/NotoSans-Bold.ttf")),
  readFile(join(process.cwd(), "public/images/brand/logo-light.png")),
]);

export async function renderCertificate(
  cert: PublicCertificate,
  locale: string,
  format: CertificateFormat,
) {
  const [t, seeds, [regular, bold, logo]] = await Promise.all([
    getTranslations({ locale, namespace: "certificatePage" }),
    getTranslations({ locale, namespace: "ourSeeds" }),
    assets,
  ]);
  const layout = CERT_LAYOUT[format];
  const background = CERT_BACKGROUND[format];
  // Templates live under public/images/sertifika; this narrow path keeps unrelated assets out of the server bundle.
  const backgroundData = background
    ? `data:image/png;base64,${(await readFile(join(process.cwd(), "public/images/sertifika", background.replace(/^\/images\/sertifika\//, "")))).toString("base64")}`
    : null;
  const nameLength = Array.from(cert.displayName).length;
  const characters = Array.from(cert.displayName);
  const midpoint = Math.ceil(nameLength / 2);
  const spaces = characters.flatMap((char, i) => (char === " " ? [i] : []));
  const split = spaces.length
    ? spaces.reduce((best, i) =>
        Math.abs(i - midpoint) < Math.abs(best - midpoint) ? i : best,
      )
    : midpoint;
  const nameLines =
    nameLength <= 22
      ? [cert.displayName]
      : [
          characters.slice(0, split).join("").trim(),
          characters.slice(split).join("").trim(),
        ];
  // A conservative glyph bound also handles 60 unbroken wide characters in two lines.
  const estimatedWidth = Math.max(
    ...nameLines.map((line) =>
      Array.from(line).reduce((width, char) => {
        if (/[MW@ЩШЮЖФ]/u.test(char)) return width + 1.1;
        if (/[ilIıİ1.,' ]/u.test(char)) return width + 0.4;
        if (char.toUpperCase() === char && char.toLowerCase() !== char)
          return width + 0.9;
        return width + 0.75;
      }, 0),
    ),
  );

  const nameSize = Math.min(
    layout.nameSizes[nameLength <= 22 ? 0 : nameLength <= 40 ? 1 : 2],
    Number(layout.name.width) / estimatedWidth,
  );
  const quantity = new Intl.NumberFormat(locale).format(cert.quantity);
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(cert.releasedOn));
  const species = cert.species
    .map((s) =>
      seeds.has(`seeds.${s.slug}.name`)
        ? seeds(`seeds.${s.slug}.name`)
        : s.name,
    )
    .join(" · ");
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        color: "#f5f7f1",
        fontFamily: "Noto Sans",
        backgroundImage: backgroundData
          ? `url(${backgroundData})`
          : layout.background,
        backgroundSize: "100% 100%",
      }}
    >
      {!backgroundData && <div style={{ display: "flex", ...layout.frame }} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={`data:image/png;base64,${logo.toString("base64")}`}
        style={layout.logo}
      />
      <div style={{ ...layout.title, color: "#b5d0b6" }}>{t("title")}</div>
      <div
        style={{
          ...layout.name,
          fontSize: nameSize,
          lineHeight: layout.nameLineHeight,
          fontWeight: 700,
          flexDirection: "column",
        }}
      >
        {nameLines.map((line, i) => (
          <span key={i} style={{ whiteSpace: "nowrap" }}>
            {line}
          </span>
        ))}
      </div>
      <div style={{ ...layout.quantity, color: "#c7e99e", fontWeight: 700 }}>
        {t("image.quantity", { quantity })}
      </div>
      <div style={layout.site}>{t("image.site", { site: cert.siteName })}</div>
      <div style={{ ...layout.date, color: "#d0dfce" }}>
        {t("image.date", { date })}
      </div>
      <div style={{ ...layout.species, color: "#d0dfce" }}>{species}</div>
      <div style={{ ...layout.workType, color: "#b5d0b6" }}>
        {t(`workTypes.${cert.workType}`)}
      </div>
      <div
        style={{
          ...layout.code,
          flexDirection: "column",
          gap: 6,
          color: "#d0dfce",
        }}
      >
        <span>{cert.code}</span>
        <span>{`skytechgreen.com/sertifika/${cert.code}`}</span>
      </div>
      <div
        style={{
          ...layout.notes,
          flexDirection: "column",
          gap: 10,
          color: "#c0d1c0",
          lineHeight: 1.4,
        }}
      >
        <div style={{ display: "flex" }}>{t("notes.document")}</div>
        <div style={{ display: "flex" }}>{t("notes.nature")}</div>
      </div>
      {cert.status === "cancelled" && (
        <div style={{ ...layout.cancelled, fontWeight: 700 }}>
          {t("cancelledBand")}
        </div>
      )}
    </div>,
    {
      width: layout.width,
      height: layout.height,
      fonts: [
        { name: "Noto Sans", data: regular, weight: 400, style: "normal" },
        { name: "Noto Sans", data: bold, weight: 700, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "X-Robots-Tag": "noindex",
        "Content-Disposition": `inline; filename="${cert.code}-${format}-${locale}.png"`,
      },
    },
  );
}
