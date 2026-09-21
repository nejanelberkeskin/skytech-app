/**
 * ÖN BİLGİLENDİRME FORMU — Mesafeli Sözleşmeler Yönetmeliği m.5'te sayılan
 * bilgiler, siparişin somut verileriyle.
 *
 * [AVUKAT] Bu metin bir TASLAKTIR; yayına alınmadan önce hukuk incelemesinden
 * geçmelidir. Metin değişirse lib/legal/version.ts içindeki sürüm artırılır.
 */
import type { LegalBlock, LegalContext, LegalDocument } from "../types";
import {
  TEXT,
  buyerTable,
  isCorporate,
  metaLines,
  priceTable,
  scheduleTable,
  sellerTable,
  serviceTable,
  withdrawalLastDay,
} from "./shared";

export function preInfoDocument(ctx: LegalContext): LegalDocument {
  const rolled: LegalBlock[] = ctx.schedule.rolledToNextSeason
    ? [
        {
          type: "note",
          text: `İçinde bulunulan bırakma sezonunun hazırlık süresi dolduğu için bu sipariş ${ctx.schedule.season.label} sezonuna yazılmıştır; yukarıdaki tarihler bu sezona aittir.`,
        },
      ]
    : [];

  const blocks: LegalBlock[] = [
    {
      type: "paragraph",
      text: "Bu form, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, ALICI'nın siparişi onaylamadan ve ödeme yükümlülüğü altına girmeden önce bilgilendirilmesi amacıyla düzenlenmiştir.",
    },

    { type: "heading", text: "1. Satıcıya ilişkin bilgiler" },
    sellerTable(),

    { type: "heading", text: "2. Alıcıya ilişkin bilgiler" },
    buyerTable(ctx),

    { type: "heading", text: "3. Hizmetin temel nitelikleri" },
    { type: "paragraph", text: TEXT.serviceDefinition },
    serviceTable(ctx),
    { type: "list", items: [TEXT.speciesBySeller, TEXT.noResultGuarantee, TEXT.notADonation] },

    { type: "heading", text: "4. Toplam bedel ve ödeme" },
    priceTable(ctx),
    { type: "paragraph", text: TEXT.noExtraCommunicationCost },
    { type: "paragraph", text: TEXT.invoice },

    { type: "heading", text: "5. Hizmetin ifası" },
    scheduleTable(ctx),
    ...rolled,
    { type: "paragraph", text: TEXT.calendar },
    { type: "paragraph", text: TEXT.completionNotice },
    { type: "paragraph", text: TEXT.lateOrImpossible },

    { type: "heading", text: "6. Cayma hakkı" },
    { type: "paragraph", text: TEXT.withdrawalRight(withdrawalLastDay(ctx)) },
    { type: "paragraph", text: TEXT.withdrawalHow() },
    { type: "paragraph", text: TEXT.withdrawalRefund },
    { type: "paragraph", text: TEXT.noEarlyPerformance },
    ...(isCorporate(ctx) ? ([{ type: "paragraph", text: TEXT.corporateWithdrawal }] as LegalBlock[]) : []),

    { type: "heading", text: "7. Şikâyet ve uyuşmazlıkların çözümü" },
    {
      type: "paragraph",
      text: "ALICI, talep ve şikâyetlerini yukarıda yer alan iletişim kanallarından SATICI'ya iletebilir; başvurular en kısa sürede yanıtlanır.",
    },
    { type: "paragraph", text: isCorporate(ctx) ? TEXT.disputesCorporate : TEXT.disputesConsumer },

    { type: "heading", text: "8. Teyit" },
    {
      type: "paragraph",
      text: "ALICI; hizmetin temel nitelikleri, tüm vergiler dâhil toplam bedeli, ödeme ve ifa koşulları ile cayma hakkı konularında, siparişi onaylamadan ve ödeme yükümlülüğü altına girmeden önce açık ve anlaşılır biçimde bilgilendirildiğini ve bu formu elektronik ortamda okuyup teyit ettiğini kabul eder. Bu formun bir örneği, sipariş teyidiyle birlikte ALICI'nın e-posta adresine gönderilir.",
    },
  ];

  return {
    kind: "pre_info",
    title: "Ön Bilgilendirme Formu",
    meta: metaLines(ctx),
    version: ctx.version,
    blocks,
  };
}
