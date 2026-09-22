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
      ["Tohum topu bırakma son tarihi (kesin süre)", trLongDate(performanceDeadline)],
      ["Sertifika teslim son tarihi", "[YAYIN ÖNCESİ TAMAMLANACAK: siparişe özgü kesin tarih]"],
      ["İzleme içeriği teslim son tarihi", "[YAYIN ÖNCESİ TAMAMLANACAK: siparişe özgü kesin tarih]"],
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
    "Hizmet; kararlaştırılan tohum toplarının hazırlanmasını ve sahaya bırakılmasını, Katılım Sertifikası ile izleme içeriğinin sunulmasını kapsar. Çimlenme, fidan gelişimi, orman oluşumu veya belirli bir karbon giderimi garanti edilmez. Bu açıklama, SATICI’nın mesleki özen, sözleşmeye uygun ifa ve ayıplı hizmetten doğan sorumluluğunu kaldırmaz.",

  notADonation:
    "Bu işlem bir hizmet satın alımıdır; bağış, yardım veya yatırım değildir. ALICI’ya saha, ağaç veya ürün üzerinde mülkiyet, kullanım, tahsis ya da adlandırma hakkı; karbon kredisi veya denkleştirme hakkı vermez. Katılım Sertifikası bağış makbuzu veya karbon belgesi değildir. Vergisel sonuçlar alıcının durumu ve ilgili mevzuata göre belirlenir; vergi indirimi taahhüt edilmez.",

  noExtraCommunicationCost: "Uzaktan iletişim aracının kullanılması nedeniyle ALICI'ya ek bir maliyet yansıtılmaz.",

  invoice:
    "Fatura, işlemin niteliğine ve yürürlükteki vergi mevzuatına uygun zamanda ve yasal süre içinde e-Fatura veya e-Arşiv Fatura olarak düzenlenir ve ALICI’ya iletilir. Peşin tahsilat, belgenin düzenlenme anı ve KDV’nin doğumu bakımından ilgili kurallarla birlikte değerlendirilir. Fatura veya muhasebe işlemleri, cayma ve iade hakkının kullanılmasının ön şartı değildir.",

  calendar:
    "Tohum topu bırakma işlemleri Ekim–Mart döneminde yapılır; Nisan–Eylül döneminde sahalar incelenir, izlenir ve raporlanır. Bırakma işlemi, cayma süresi dolmadan yapılmaz.",

  completionNotice:
    "Bırakma tamamlandığında ALICI’ya e-posta ile bilgi verilir. Katılım Sertifikası ve izleme içeriği, sipariş belgelerinde kendileri için ayrı ayrı kararlaştırılan kesin son tarihlere kadar e-posta veya kalıcı veri saklayıcısıyla sunulur. Bırakmanın tamamlanması, henüz teslim edilmemiş bu edimleri sona erdirmez.",

  lateOrImpossible:
    "SATICI, kararlaştırılan ifa süresine uymakla yükümlüdür. Süresinde ifa edilmezse ALICI sözleşmeyi feshedebilir; tahsil edilen tüm bedel, fesih bildiriminin ulaşmasından itibaren 14 (on dört) gün içinde yasal faiziyle birlikte iade edilir. İfanın imkânsızlaşması hâlinde SATICI, durumu öğrendiği tarihten itibaren 3 (üç) gün içinde yazılı olarak veya kalıcı veri saklayıcısıyla bildirir ve tahsil edilen tüm bedeli bildirim tarihinden itibaren en geç 14 (on dört) gün içinde iade eder. Başka saha, tür veya sezon önerisi iadeyi durdurmaz ve süresini uzatmaz. Yeni bir hizmet ancak kapsamı, bedeli ve takvimi ayrıca açıklanıp ALICI’nın açık kabulü alınarak kararlaştırılır; sessizlik kabul değildir. Her hava veya izin sorunu kendiliğinden imkânsızlık sayılmaz; olayın gerçek etkisi ve SATICI’nın sorumluluğu değerlendirilir.",

  /** Cayma süresinin dolması diğer hakları etkilemez (sözleşme m.7 ve cayma sayfası). */
  rightsAfterWithdrawalPeriod:
    "Cayma süresinin dolması; hizmetin ayıplı, geç ya da hiç ifa edilmemesinden doğan hakları ve mevzuattan kaynaklanan diğer talepleri ortadan kaldırmaz.",

  withdrawalRightGeneral: TEXT_WITHDRAWAL_GENERAL,

  withdrawalRight: (lastDay: string): string =>
    `${TEXT_WITHDRAWAL_GENERAL} Ödeme öncesi hesaplanan cayma son günü ${lastDay} olarak gösterilmiştir; sözleşmenin daha sonra kurulması veya kanuni süre uzaması bu tarihi ALICI aleyhine kısaltmaz. Cayma hakkında gereği gibi bilgilendirme yapılmamışsa tüketici 14 günlük süreyle bağlı değildir. Cayma hakkı, olağan cayma süresinin bitiminden itibaren bir yıl sonra sona erer. Bu bir yıllık süre içinde gereği gibi bilgilendirme yapılırsa 14 günlük süre bilgilendirme gününden itibaren başlar. Son günün kanuni tatile rastlamasından doğan haklar saklıdır.`,

  withdrawalHow: () =>
    `Cayma bildirimi; ${withdrawalChannels()} yoluyla yapılabilir. Süresi dolmadan yazılı veya kalıcı veri saklayıcısıyla yöneltilen açık cayma beyanı yeterlidir. Örnek form, üyelik, gerekçe, telefon görüşmesi, belge yükleme veya elektronik başvuruda ıslak imza zorunlu tutulmaz. Sipariş numarası bilinmiyorsa kaydın bulunmasını sağlayan bilgilerle başvurulabilir. İnternet sitesindeki form kullanıldığında, bildirimin SATICI'ya ulaştığı ALICI'ya derhal e-posta ile teyit edilir.`,

  withdrawalRefund:
    "Cayma bildiriminin SATICI’ya ulaştığı tarihten itibaren en geç 14 (on dört) gün içinde tahsil edilen bedelin tamamı, ALICI’nın ödemede kullandığı araca uygun şekilde, tek seferde ve ALICI’ya hiçbir masraf veya yükümlülük getirmeden iade edilir. Alındı teyidi ya da iç onay sürecinin gecikmesi iade süresini yeniden başlatmaz. SATICI’ya usulünce yöneltilmiş süresindeki beyanın geçerliliği, bildirimin daha sonra işleme alınması nedeniyle ortadan kalkmaz. Fatura iptali veya banka işlemleri kanuni iade yükümlülüğünü kaldırmaz.",

  noEarlyPerformance:
    "SATICI, bırakma işlemini cayma süresi dolmadan yapmaz; ALICI’dan bu süre içinde ifaya başlama veya cayma hakkından vazgeçme onayı alınmaz. Sertifikanın kişiye özel hazırlanması, bu hizmette tanınan cayma hakkını tek başına ortadan kaldırmaz. Cayma süresinin dolması ayıplı, geç veya hiç ifa edilmeyen hizmete ilişkin hakları ve diğer kanuni talepleri kaldırmaz.",

  corporateWithdrawal:
    "ALICI'nın tüketici sıfatı taşımadığı hâllerde de SATICI, bu bölümdeki cayma ve iade koşullarını ALICI'ya sözleşmesel olarak aynen tanır.",

  disputesConsumer:
    "Tüketici sıfatını taşıyan ALICI, yürürlükteki parasal görev sınırları içinde yerleşim yerinin bulunduğu veya tüketici işleminin yapıldığı yerdeki Tüketici Hakem Heyetine başvurabilir. Tüketici mahkemesinde dava açılması gereken uyuşmazlıklarda 6502 sayılı Kanun m.73/A uyarınca, kanuni istisnalar dışında önce arabulucuya başvurulur. Tüketicinin kanunen yetkili diğer mercilere başvuru hakları saklıdır.",

  disputesCorporate:
    "Tüketici niteliği, fatura türünden değil işlemin ticari veya mesleki amacından ve somut koşullarından belirlenir. Tüketici olmayan alıcıya da sözleşmedeki 14 günlük cayma ve iade hakları tanınır. Uyuşmazlıklarda genel görev ve yetki kuralları ile uygulanabildiği ölçüde dava şartı arabuluculuk hükümleri geçerlidir. Bu metin tüketicinin haklarını daraltan veya tüm alıcılar için münhasır Ankara yetkisi kuran bir hüküm içermez.",
} as const;
