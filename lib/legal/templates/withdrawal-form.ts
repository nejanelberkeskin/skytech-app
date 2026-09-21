/**
 * CAYMA FORMU — Mesafeli Sözleşmeler Yönetmeliği ekindeki örnek forma göre.
 * Kullanımı zorunlu değildir; cayma kararını bildiren açık bir beyan da yeterlidir.
 *
 * [AVUKAT] TASLAK. Metin değişirse lib/legal/version.ts içindeki sürüm artırılır.
 */
import { COMPANY, companyAddressLine } from "@/lib/company";
import { count, money, trLongDate } from "../format";
import type { LegalContext, LegalDocument } from "../types";
import { ORDER_NO_PENDING, metaLines, withdrawalLastDay } from "./shared";

export function withdrawalFormDocument(ctx: LegalContext): LegalDocument {
  const site = COMPANY.website.replace(/^https?:\/\//, "");
  const to = [COMPANY.legalName, companyAddressLine(), COMPANY.email, ...(COMPANY.kep ? [`KEP: ${COMPANY.kep}`] : [])];

  return {
    kind: "withdrawal_form",
    title: "Cayma Formu",
    meta: metaLines(ctx),
    version: ctx.version,
    blocks: [
      {
        type: "note",
        text: "Bu form yalnızca sözleşmeden cayma hakkı kullanılmak istendiğinde doldurulup gönderilir. Kullanılması zorunlu değildir; cayma kararını bildiren açık bir beyan da yeterlidir.",
      },
      { type: "heading", text: "Kime" },
      { type: "list", items: to },
      { type: "heading", text: "Beyan" },
      {
        type: "paragraph",
        text: "Bu formla, aşağıda bilgileri yer alan hizmetin sunulmasına ilişkin sözleşmeden cayma hakkımı kullandığımı beyan ederim.",
      },
      {
        type: "table",
        rows: [
          ["Sipariş no", ctx.orderNo ?? ORDER_NO_PENDING],
          ["Sipariş tarihi", trLongDate(ctx.orderDate)],
          [
            "Hizmet",
            `${ctx.site.name} adlı Proje Uygulama Sahasına ${count(ctx.quantity)} adet tohum topunun dronla bırakılması`,
          ],
          ["Ödenen toplam bedel", money(ctx.totalKurus)],
        ],
      },
      {
        type: "fields",
        labels: ["Adı soyadı / unvanı", "Adresi", "Tarih", "İmza (yalnızca kâğıt üzerinde gönderilmesi hâlinde)"],
      },
      {
        type: "note",
        text: `Cayma hakkı en geç ${withdrawalLastDay(ctx)} günü sonuna kadar kullanılabilir. Dilerseniz ${site}/cayma adresindeki formu da kullanabilirsiniz; bildiriminizin ulaştığı size derhal e-posta ile teyit edilir. Ödediğiniz bedelin tamamı, bildiriminizin ulaştığı tarihten itibaren 14 (on dört) gün içinde ödemede kullandığınız araca iade edilir.`,
      },
    ],
  };
}
