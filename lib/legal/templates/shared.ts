/**
 * Ön bilgilendirme formu ile sözleşmenin ORTAK kullandığı tablolar ve cümleler.
 * Bir koşul iki belgede de geçiyorsa metni burada tek yerde durur; böylece iki
 * belge birbiriyle çelişemez.
 */
import { count, money, sellerRows, trDayOf, trLongDate, withdrawalChannels } from "../format";
import type { LegalBlock, LegalContext } from "../types";

export const ORDER_NO_PENDING = "Sipariş onaylandığında atanır";

export function metaLines(ctx: LegalContext): string[] {
  return [
    `Sipariş no: ${ctx.orderNo ?? ORDER_NO_PENDING}`,
    `Sipariş tarihi: ${trLongDate(ctx.orderDate)}`,
    `Belge sürümü: ${ctx.version}`,
  ];
}

export function sellerTable(): LegalBlock {
  return { type: "table", rows: sellerRows() };
}

export function buyerTable(ctx: LegalContext): LegalBlock {
  const b = ctx.buyer;
  const rows: [string, string][] =
    b.type === "corporate"
      ? [
          ["Unvan", b.name],
          ...(b.taxLine ? ([["Vergi dairesi / no", b.taxLine]] as [string, string][]) : []),
          ...(b.authorizedPerson ? ([["Siparişi veren yetkili", b.authorizedPerson]] as [string, string][]) : []),
        ]
      : [["Adı soyadı", b.name]];
  rows.push(["Adres", b.address], ["Telefon", b.phone], ["E-posta", b.email]);
  return { type: "table", rows };
}

export function serviceTable(ctx: LegalContext): LegalBlock {
  const s = ctx.site;
  const rows: [string, string | null][] = [
    ["Proje Uygulama Sahası", s.name],
    ["Konum", s.location],
    ["Alan", s.area],
    ["Saha niteliği", s.fire],
    ["Çalışma türü", s.workType],
    ["Sahaya bırakılan tür(ler)", s.species.length ? s.species.join(", ") : null],
    ["Tohum topu adedi", `${count(ctx.quantity)} adet`],
    ["Sertifikada yer alacak ad", ctx.certificateName],
  ];
  return { type: "table", rows: rows.filter((r): r is [string, string] => Boolean(r[1])) };
}

export function priceTable(ctx: LegalContext): LegalBlock {
  return {
    type: "table",
    rows: [
      ["Birim bedel (KDV dâhil)", `${money(ctx.unitPriceKurus)} / tohum topu`],
      ["Adet", count(ctx.quantity)],
      ["Toplam bedel (tüm vergiler dâhil)", money(ctx.totalKurus)],
      [`Toplamın içindeki KDV (%${ctx.vatRate})`, money(ctx.vatKurus)],
      ["Ek masraf", "Yoktur. Nakliye, teslimat veya benzeri adlarla ek bir bedel alınmaz."],
      [
        "Ödeme şekli",
        "Banka veya kredi kartıyla, ödeme kuruluşunun güvenli ödeme sayfasında 3D Secure doğrulamasıyla. Kart bilgileri SATICI tarafından görülmez ve saklanmaz.",
      ],
    ],
  };
}

export function scheduleTable(ctx: LegalContext): LegalBlock {
  const { season, earliestReleaseOn, performanceDeadline } = ctx.schedule;
  return {
    type: "table",
    rows: [
      ["Bırakma sezonu", `${trLongDate(season.startsOn)} – ${trLongDate(season.endsOn)}`],
      ["En erken bırakma tarihi", trLongDate(earliestReleaseOn)],
      ["Hizmetin ifa edileceği son tarih (kesin süre)", trLongDate(performanceDeadline)],
    ],
  };
}

/** Cayma hakkının kullanılabileceği son gün (İstanbul takvimiyle). */
export function withdrawalLastDay(ctx: LegalContext): string {
  return trLongDate(trDayOf(ctx.schedule.withdrawalDeadline));
}

export const isCorporate = (ctx: LegalContext) => ctx.buyer.type === "corporate";

/* ── İki belgede de birebir geçen cümleler ────────────────────────────────── */

const TEXT_WITHDRAWAL_GENERAL =
  "ALICI, sözleşmenin kurulduğu tarihten itibaren 14 (on dört) gün içinde, hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir.";

export const TEXT = {
  serviceDefinition:
    "Sözleşme konusu hizmet; SATICI'nın, aşağıda belirtilen Proje Uygulama Sahasına, aşağıda belirtilen adette tohum topunu insansız hava aracı (dron) ile bırakması, bırakma işlemi tamamlandığında ALICI adına bir Katılım Sertifikası düzenlemesi ve izleme döneminde çalışmaya ilişkin görüntüleri ALICI ile paylaşmasıdır.",

  speciesBySeller:
    "Sahaya bırakılacak tür, sahanın iklim ve toprak koşullarına göre SATICI tarafından belirlenir; ALICI tür seçimi yapmaz.",

  noResultGuarantee:
    "Hizmet bir iş görme edimidir: tohum toplarının sahaya bırakılmasını kapsar. Çimlenme, fidan gelişimi ve orman oluşumu doğa koşullarına bağlıdır; SATICI bu konularda bir sonuç taahhüdünde bulunmaz.",

  notADonation:
    "Bu hizmet bağış veya yardım değildir. ALICI'ya saha, ağaç ya da ürün üzerinde mülkiyet, kullanım veya adlandırma hakkı ile karbon kredisi, karbon denkleştirme veya benzeri bir hak vermez. Katılım Sertifikası bir bağış makbuzu ya da karbon belgesi değildir; vergi indirimi sağlamaz.",

  noExtraCommunicationCost: "Uzaktan iletişim aracının kullanılması nedeniyle ALICI'ya ek bir maliyet yansıtılmaz.",

  invoice:
    "Fatura, hizmetin ifasını (tohum topu bırakma işleminin tamamlanmasını) izleyen yedi gün içinde elektronik olarak (e-Arşiv Fatura veya e-Fatura) düzenlenir ve ALICI'nın e-posta adresine gönderilir.",

  calendar:
    "Tohum topu bırakma işlemleri Ekim–Mart döneminde yapılır; Nisan–Eylül döneminde sahalar incelenir, izlenir ve raporlanır. Bırakma işlemi, cayma süresi dolmadan yapılmaz.",

  completionNotice:
    "Bırakma tamamlandığında ALICI'ya e-posta ile bilgi verilir ve Katılım Sertifikası iletilir. Çalışmaya ilişkin görüntüler, bırakmayı izleyen izleme döneminde (bırakmadan yaklaşık altı ay sonra) e-posta ile paylaşılır.",

  lateOrImpossible:
    "SATICI hizmeti yukarıdaki son tarihe kadar ifa edemezse ALICI sözleşmeyi feshedebilir; bu durumda ödenen bedelin tamamı, fesih bildiriminin SATICI'ya ulaştığı tarihten itibaren 14 (on dört) gün içinde yasal faiziyle birlikte iade edilir. Hava koşulları, idari kararlar veya sahaya erişimin engellenmesi gibi nedenlerle ifanın imkânsızlaşması hâlinde SATICI, durumu öğrendiği tarihten itibaren 3 (üç) gün içinde ALICI'ya bildirir ve ALICI'nın tercihine göre ya ödenen bedelin tamamını bildirim tarihinden itibaren 14 (on dört) gün içinde iade eder ya da hizmeti ALICI'nın onaylayacağı başka bir Proje Uygulama Sahasında veya izleyen bırakma sezonunda ifa eder.",

  withdrawalRightGeneral: TEXT_WITHDRAWAL_GENERAL,

  withdrawalRight: (lastDay: string): string =>
    `${TEXT_WITHDRAWAL_GENERAL} Bu sipariş için cayma hakkı en geç ${lastDay} günü sonuna kadar kullanılabilir.`,

  withdrawalHow: () =>
    `Cayma bildirimi; ${withdrawalChannels()} yoluyla yapılabilir. Ekteki Cayma Formu kullanılabileceği gibi cayma kararını bildiren açık bir beyan da yeterlidir. İnternet sitesindeki form kullanıldığında, bildirimin SATICI'ya ulaştığı ALICI'ya derhal e-posta ile teyit edilir.`,

  withdrawalRefund:
    "Cayma hakkının kullanılması hâlinde ödenen bedelin tamamı, cayma bildiriminin SATICI'ya ulaştığı tarihten itibaren 14 (on dört) gün içinde, ALICI'nın ödemede kullandığı araca uygun şekilde, tek seferde ve ALICI'ya hiçbir masraf veya yükümlülük getirmeden iade edilir. Düzenlenmiş bir Katılım Sertifikası varsa iptal edilir.",

  noEarlyPerformance:
    "SATICI, bırakma işlemini cayma süresi dolmadan yapmaz. Bu nedenle ALICI'dan cayma süresi içinde ifaya başlanmasına ilişkin bir onay istenmez ve cayma hakkının kaybına yol açan bir durum oluşmaz. Cayma süresi dolduktan sonra cayma hakkı kullanılamaz; bu tarihten sonra bedel iadesi yalnızca ifanın gecikmesi veya imkânsızlaşması hâllerinde söz konusu olur.",

  corporateWithdrawal:
    "ALICI'nın tüketici sıfatı taşımadığı hâllerde de SATICI, bu bölümdeki cayma ve iade koşullarını ALICI'ya sözleşmesel olarak aynen tanır.",

  disputesConsumer:
    "Tüketici sıfatını taşıyan ALICI, bu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar dâhilinde yerleşim yerinin bulunduğu veya hizmeti satın aldığı yerdeki Tüketici Hakem Heyetine; bu sınırların üzerindeki uyuşmazlıklarda ise Tüketici Mahkemelerine başvurabilir.",

  disputesCorporate:
    "ALICI'nın tüketici sıfatı taşımadığı hâllerde 6502 sayılı Tüketicinin Korunması Hakkında Kanun hükümleri uygulanmaz; bu sözleşmeden doğan uyuşmazlıklarda Ankara Mahkemeleri ve İcra Daireleri yetkilidir.",
} as const;
