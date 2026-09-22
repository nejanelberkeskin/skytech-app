/**
 * Hukuki belge → tek başına açılabilen HTML. Bütün metin kaçışlanır; çıktı
 * deterministiktir (aynı belge → bayt bayt aynı HTML → aynı SHA-256).
 * Siparişe özel kopya bu HTML'dir; veritabanında değişmez olarak saklanır.
 */
import type { LegalBlock, LegalDocument } from "./types";

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const CSS = [
  "body{font:16px/1.65 -apple-system,'Segoe UI',Roboto,'Noto Sans',Arial,sans-serif;color:#1a2e1a;background:#fff;margin:0;padding:28px 24px 40px;max-width:760px}",
  "h1{font-size:22px;line-height:1.25;margin:0 0 6px;color:#0e2519}",
  "h2{font-size:16px;line-height:1.35;margin:28px 0 10px;color:#0e2519}",
  "h3{font-size:16px;line-height:1.4;margin:20px 0 8px;color:#0e2519}",
  ".meta{font-size:16px;color:#4b6b4b;margin:0 0 20px;padding-bottom:14px;border-bottom:1px solid #d5e2d5}",
  ".meta span{display:inline-block;margin-right:18px}",
  "p{margin:0 0 12px}",
  "ul{margin:0 0 14px;padding-left:22px}li{margin:0 0 8px}",
  "table{width:100%;border-collapse:collapse;margin:0 0 16px;font-size:16px}",
  "th,td{border:1px solid #d5e2d5;padding:7px 10px;text-align:left;vertical-align:top}",
  "th{width:34%;background:#f4f8f2;font-weight:600}",
  ".note{background:#f4f8f2;border:1px solid #d5e2d5;border-radius:8px;padding:10px 14px;margin:0 0 16px;font-size:16px}",
  ".field{display:flex;gap:10px;align-items:flex-end;margin:0 0 18px}.field span{white-space:nowrap}",
  ".field i{flex:1;border-bottom:1px solid #6b8f6b;height:1.2em}",
  "@media print{body{padding:0;max-width:none}}",
].join("");

function renderBlock(block: LegalBlock): string {
  switch (block.type) {
    case "heading":
      return `<h2>${esc(block.text)}</h2>`;
    case "subheading":
      return `<h3>${esc(block.text)}</h3>`;
    case "paragraph":
      return `<p>${esc(block.text)}</p>`;
    case "note":
      return `<div class="note">${esc(block.text)}</div>`;
    case "list":
      return `<ul>${block.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "table":
      return `<table>${block.rows
        .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)
        .join("")}</table>`;
    case "fields":
      return block.labels.map((l) => `<p class="field"><span>${esc(l)}:</span><i></i></p>`).join("");
  }
}

export function renderLegalHtml(doc: LegalDocument): string {
  return (
    `<!doctype html><html lang="tr"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<title>${esc(doc.title)}</title><style>${CSS}</style></head><body>` +
    `<h1>${esc(doc.title)}</h1>` +
    `<p class="meta">${doc.meta.map((m) => `<span>${esc(m)}</span>`).join("")}</p>` +
    doc.blocks.map(renderBlock).join("") +
    `</body></html>`
  );
}
