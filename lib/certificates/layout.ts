import type { CSSProperties } from "react";

export type CertificateFormat = "dikey" | "yatay";
export const CERT_BACKGROUND: Record<CertificateFormat, string | null> = {
  dikey: null,
  yatay: null,
};

const region = (
  left: number,
  top: number,
  width: number,
  height: number,
  fontSize: number,
): CSSProperties => ({
  position: "absolute",
  left,
  top,
  width,
  height,
  fontSize,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
});

/** All background, typography and text coordinates live here, in output pixels. */
export const CERT_LAYOUT = {
  dikey: {
    width: 1080,
    height: 1350,
    background:
      "radial-gradient(ellipse at 80% 20%, #214e35 0%, #0e2519 45%, #050d08 100%)",
    frame: {
      position: "absolute",
      left: 30,
      top: 30,
      width: 1020,
      height: 1290,
      border: "1px solid #739b7e",
    } as CSSProperties,
    logo: {
      position: "absolute",
      left: 72,
      top: 70,
      width: 280,
      height: 35,
    } as CSSProperties,
    title: region(80, 220, 920, 65, 36),
    name: region(85, 335, 910, 180, 72),
    nameSizes: [72, 56, 44],
    nameLineHeight: 1.2,
    quantity: region(90, 565, 900, 60, 36),
    site: region(90, 640, 900, 110, 30),
    date: region(90, 758, 900, 70, 26),
    species: region(90, 885, 900, 70, 24),
    workType: region(90, 959, 900, 50, 23),
    code: region(75, 1040, 930, 80, 21),
    notes: region(80, 1160, 920, 130, 18),
    cancelled: {
      ...region(0, 145, 1080, 56, 25),
      background: "#f2d4ab",
      color: "#633a17",
    },
  },
  yatay: {
    width: 1200,
    height: 630,
    background:
      "radial-gradient(ellipse at 80% 20%, #214e35 0%, #0e2519 45%, #050d08 100%)",
    frame: {
      position: "absolute",
      left: 18,
      top: 18,
      width: 1164,
      height: 594,
      border: "1px solid #739b7e",
    } as CSSProperties,
    logo: {
      position: "absolute",
      left: 44,
      top: 34,
      width: 165,
      height: 20.625,
    } as CSSProperties,
    title: region(235, 40, 750, 46, 28),
    name: region(80, 108, 1040, 110, 56),
    nameSizes: [56, 44, 34],
    nameLineHeight: 1.2,
    quantity: region(65, 235, 1070, 42, 28),
    site: region(60, 280, 1080, 66, 24),
    date: region(60, 347, 1080, 40, 22),
    species: region(55, 398, 1090, 37, 19),
    workType: region(55, 436, 1090, 35, 18),
    code: region(50, 478, 1100, 46, 16),
    notes: region(50, 538, 1100, 62, 14),
    cancelled: {
      ...region(900, 0, 300, 32, 16),
      background: "#f2d4ab",
      color: "#633a17",
    },
  },
} as const;
