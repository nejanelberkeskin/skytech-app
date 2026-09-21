/**
 * Hukuki belge → PDF (YALNIZ SUNUCU). HTML ile AYNI blok listesinden üretilir;
 * metin seçilebilir/aranabilir, Türkçe ve Kiril karakterler gömülü Noto Sans ile basılır.
 *
 * PDF müşteriye e-postayla giden okunur kopyadır. Bütünlük kanıtı HTML kopyanın
 * SHA-256 özetidir; o özet PDF'in son sayfasına da yazılır (yönetim panelindeki
 * "özeti doğrula" ile karşılaştırılabilsin diye).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import { COMPANY } from "@/lib/company";
import type { LegalBlock, LegalDocument } from "./types";

const PAGE = { width: 595.28, height: 841.89, left: 56, right: 56, top: 60, bottom: 66 } as const;
const CONTENT_WIDTH = PAGE.width - PAGE.left - PAGE.right;
const LINE = 1.45;
const SIZE = { title: 17, meta: 9, heading: 11.5, body: 10, table: 9.5, footer: 8 } as const;
const COLOR = { text: "#1a2e1a", muted: "#4b6b4b", rule: "#d5e2d5", fill: "#f4f8f2" } as const;
const FONT = "NotoSans";

let fontCache: { regular: string; bold: string } | null = null;
function fonts() {
  if (!fontCache) {
    // Yollar sabit yazıldı: Next'in dosya izi bu iki dosyayı sunucu paketine alır.
    fontCache = {
      regular: readFileSync(join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf")).toString("base64"),
      bold: readFileSync(join(process.cwd(), "assets/fonts/NotoSans-Bold.ttf")).toString("base64"),
    };
  }
  return fontCache;
}

export interface PdfOptions {
  /** HTML kopyanın SHA-256 özeti — son sayfaya yazılır. */
  sha256?: string;
  /** Belge üstverisindeki oluşturma anı; verilirse aynı girdi aynı PDF'i üretir. */
  createdAt?: Date;
}

export function renderLegalPdf(document: LegalDocument, options: PdfOptions = {}): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true, putOnlyUsedFonts: true });
  const f = fonts();
  doc.addFileToVFS("NotoSans-Regular.ttf", f.regular);
  doc.addFont("NotoSans-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", f.bold);
  doc.addFont("NotoSans-Bold.ttf", FONT, "bold");
  doc.setProperties({
    title: document.title,
    subject: document.meta.join(" · "),
    author: COMPANY.legalName,
    creator: COMPANY.brand,
  });
  if (options.createdAt) doc.setCreationDate(options.createdAt);

  let y: number = PAGE.top;
  const bottom = PAGE.height - PAGE.bottom;

  const setStyle = (style: "normal" | "bold", size: number, color: string = COLOR.text) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const lineHeight = (size: number) => size * LINE;
  const ensure = (height: number) => {
    if (y + height > bottom) {
      doc.addPage();
      y = PAGE.top;
    }
  };
  const wrap = (text: string, width: number): string[] => doc.splitTextToSize(text, width) as string[];

  /** Metni satır satır basar; sayfa sonunda kaldığı yerden yeni sayfada sürer. */
  const flow = (text: string, x: number, width: number, size: number, style: "normal" | "bold" = "normal", color: string = COLOR.text) => {
    setStyle(style, size, color);
    for (const line of wrap(text, width)) {
      ensure(lineHeight(size));
      doc.text(line, x, y, { baseline: "top" });
      y += lineHeight(size);
    }
  };

  const drawBlock = (block: LegalBlock) => {
    switch (block.type) {
      case "heading": {
        y += 8;
        // Başlık sayfa sonunda yalnız kalmasın: ardından en az iki satır sığmalı.
        ensure(lineHeight(SIZE.heading) + 2 * lineHeight(SIZE.body));
        flow(block.text, PAGE.left, CONTENT_WIDTH, SIZE.heading, "bold");
        y += 4;
        break;
      }
      case "subheading": {
        y += 4;
        // Alt başlık sayfa sonunda yalnız kalmasın: ardından en az iki satır sığmalı.
        ensure(3 * lineHeight(SIZE.body));
        flow(block.text, PAGE.left, CONTENT_WIDTH, SIZE.body, "bold");
        y += 3;
        break;
      }
      case "paragraph": {
        flow(block.text, PAGE.left, CONTENT_WIDTH, SIZE.body);
        y += 6;
        break;
      }
      case "list": {
        for (const item of block.items) {
          setStyle("normal", SIZE.body);
          ensure(lineHeight(SIZE.body));
          doc.text("•", PAGE.left + 2, y, { baseline: "top" });
          flow(item, PAGE.left + 14, CONTENT_WIDTH - 14, SIZE.body);
          y += 3;
        }
        y += 4;
        break;
      }
      case "note": {
        const pad = 8;
        setStyle("normal", SIZE.table);
        const lines = wrap(block.text, CONTENT_WIDTH - 2 * pad);
        const height = lines.length * lineHeight(SIZE.table) + 2 * pad;
        ensure(height);
        doc.setFillColor(COLOR.fill);
        doc.setDrawColor(COLOR.rule);
        doc.roundedRect(PAGE.left, y, CONTENT_WIDTH, height, 4, 4, "FD");
        let ty = y + pad;
        setStyle("normal", SIZE.table);
        for (const line of lines) {
          doc.text(line, PAGE.left + pad, ty, { baseline: "top" });
          ty += lineHeight(SIZE.table);
        }
        y += height + 10;
        break;
      }
      case "table": {
        const pad = 5;
        const labelWidth = CONTENT_WIDTH * 0.34;
        const valueWidth = CONTENT_WIDTH - labelWidth;
        for (const [label, value] of block.rows) {
          setStyle("bold", SIZE.table);
          const left = wrap(label, labelWidth - 2 * pad);
          setStyle("normal", SIZE.table);
          const right = wrap(value, valueWidth - 2 * pad);
          const height = Math.max(left.length, right.length) * lineHeight(SIZE.table) + 2 * pad;
          ensure(height);
          doc.setDrawColor(COLOR.rule);
          doc.setFillColor(COLOR.fill);
          doc.rect(PAGE.left, y, labelWidth, height, "FD");
          doc.rect(PAGE.left + labelWidth, y, valueWidth, height, "S");
          setStyle("bold", SIZE.table);
          left.forEach((line, i) => doc.text(line, PAGE.left + pad, y + pad + i * lineHeight(SIZE.table), { baseline: "top" }));
          setStyle("normal", SIZE.table);
          right.forEach((line, i) =>
            doc.text(line, PAGE.left + labelWidth + pad, y + pad + i * lineHeight(SIZE.table), { baseline: "top" })
          );
          y += height;
        }
        y += 12;
        break;
      }
      case "fields": {
        for (const label of block.labels) {
          const height = 30;
          ensure(height);
          setStyle("normal", SIZE.body);
          const text = `${label}:`;
          doc.text(text, PAGE.left, y + 12, { baseline: "top" });
          const start = PAGE.left + doc.getTextWidth(text) + 8;
          doc.setDrawColor(COLOR.muted);
          doc.line(start, y + 12 + SIZE.body, PAGE.left + CONTENT_WIDTH, y + 12 + SIZE.body);
          y += height;
        }
        y += 8;
        break;
      }
    }
  };

  // Başlık ve künye
  flow(document.title, PAGE.left, CONTENT_WIDTH, SIZE.title, "bold");
  y += 2;
  flow(document.meta.join("   ·   "), PAGE.left, CONTENT_WIDTH, SIZE.meta, "normal", COLOR.muted);
  y += 6;
  doc.setDrawColor(COLOR.rule);
  doc.line(PAGE.left, y, PAGE.left + CONTENT_WIDTH, y);
  y += 12;

  document.blocks.forEach(drawBlock);

  if (options.sha256) {
    y += 6;
    flow(`Belge özeti (SHA-256): ${options.sha256}`, PAGE.left, CONTENT_WIDTH, SIZE.footer, "normal", COLOR.muted);
  }

  // Alt bilgi: belge adı + sayfa numarası
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    setStyle("normal", SIZE.footer, COLOR.muted);
    const footerY = PAGE.height - 38;
    doc.setDrawColor(COLOR.rule);
    doc.line(PAGE.left, footerY - 8, PAGE.left + CONTENT_WIDTH, footerY - 8);
    doc.text(`${COMPANY.brand} · ${document.title} · ${document.meta[0]}`, PAGE.left, footerY, { baseline: "top" });
    const label = `Sayfa ${i} / ${pages}`;
    doc.text(label, PAGE.left + CONTENT_WIDTH - doc.getTextWidth(label), footerY, { baseline: "top" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
