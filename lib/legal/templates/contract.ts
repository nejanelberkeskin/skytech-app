/**
 * MESAFELİ HİZMET SÖZLEŞMESİ — tohum topu bıraktırma hizmeti.
 *
 * Tek şablon iki alıcı türüne hizmet eder: tüketici (6502 sayılı Kanun) ve
 * tüketici sıfatı taşımayan alıcı (kurumsal). İkincisinde Kanun uygulanmaz;
 * 14 günlük cayma ve iade koşulları tüketici olmayan alıcıya da sözleşmesel
 * olarak tanınır. Fatura türü tek başına tüketici sıfatını belirlemez.
 *
 * [AVUKAT] Bu metin bir TASLAKTIR; yayına alınmadan önce hukuk incelemesinden
 * geçmelidir. Özellikle: m.6 (ifanın imkânsızlaşmasında seçimlik haklar), m.9.4
 * (tür değişikliği), m.12 (delil), kurumsal alıcıya ilişkin hükümler.
 * Metin değişirse lib/legal/version.ts içindeki sürüm artırılır.
 */
import { COMPANY } from "@/lib/company";
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

export function contractDocument(ctx: LegalContext): LegalDocument {
  const site = COMPANY.website.replace(/^https?:\/\//, "");
  const corporate = isCorporate(ctx);

  const blocks: LegalBlock[] = [
    { type: "heading", text: "Madde 1 — Taraflar" },
    { type: "paragraph", text: "1.1. SATICI:" },
    sellerTable(),
    { type: "paragraph", text: "1.2. ALICI:" },
    buyerTable(ctx),

    { type: "heading", text: "Madde 2 — Tanımlar" },
    {
      type: "list",
      items: [
        `Site: SATICI'ya ait ${site} adresli internet sitesi.`,
        "Proje Uygulama Sahası: SATICI'nın tohum topu bırakma çalışması yürüttüğü, Site'de tanıtılan ve ALICI tarafından seçilen saha.",
        "Tohum topu: Tohumun kil ve besleyici karışımla kaplanarak hazırlandığı, sahaya dronla bırakılan küre.",
        "Bırakma: Tohum toplarının SATICI tarafından insansız hava aracı (dron) ile Proje Uygulama Sahası'na bırakılması.",
        "Katılım Sertifikası: Bırakma işleminin yapıldığını belgeleyen, ALICI'nın belirlediği adla düzenlenen elektronik belge.",
        "İzleme dönemi: Bırakmayı izleyen, sahanın incelendiği ve raporlandığı Nisan–Eylül dönemi.",
      ],
    },

    { type: "heading", text: "Madde 3 — Konu ve kapsam" },
    {
      type: "paragraph",
      text: "3.1. Bu sözleşmenin konusu, ALICI'nın Site üzerinden elektronik ortamda sipariş verdiği, nitelikleri ve bedeli aşağıda belirtilen hizmetin sunulmasına ilişkin olarak tarafların hak ve yükümlülüklerinin belirlenmesidir.",
    },
    { type: "paragraph", text: `3.2. ${TEXT.serviceDefinition}` },
    {
      type: "paragraph",
      text: "3.3. Tüketici sıfatı, işlemin ticari veya mesleki olmayan amaçla yapılmasına göre belirlenir. Bireysel veya kurumsal fatura seçimi tek başına bu sıfatı belirlemez. Tüketici işlemlerinde 6502 sayılı Kanunun emredici hükümleri uygulanır. Tüketici olmayan alıcıya da bu sözleşmedeki 14 günlük cayma ve iade imkânı sözleşmesel olarak tanınır.",
    },

    { type: "heading", text: "Madde 4 — Hizmetin nitelikleri ve bedeli" },
    serviceTable(ctx),
    priceTable(ctx),
    { type: "paragraph", text: `4.1. ${TEXT.noExtraCommunicationCost}` },
    {
      type: "paragraph",
      text: "4.2. Yukarıdaki bedel, siparişin onaylandığı an için geçerlidir ve sözleşmenin kurulmasından sonra SATICI tarafından tek taraflı olarak artırılamaz.",
    },

    { type: "heading", text: "Madde 5 — Ödeme ve fatura" },
    {
      type: "paragraph",
      text: "5.1. Bedel, siparişin onaylanması sırasında banka veya kredi kartıyla, ödeme kuruluşunun güvenli ödeme sayfasında peşin olarak tahsil edilir. Kart bilgileri SATICI'ya ulaşmaz ve SATICI tarafından saklanmaz.",
    },
    {
      type: "paragraph",
      text: "5.2. İlk ödemenin başarısız olması hâlinde sipariş tamamlanmaz. Başarıyla kurulmuş sözleşmede sonradan ortaya çıkan ters ibraz, banka itirazı veya ödeme uyuşmazlığı sözleşmeyi kendiliğinden geçmişe etkili olarak yok saydırmaz; tarafların hak ve borçları somut duruma ve mevzuata göre değerlendirilir.",
    },
    { type: "paragraph", text: `5.3. ${TEXT.invoice}` },

    { type: "heading", text: "Madde 6 — Hizmetin ifası" },
    scheduleTable(ctx),
    ...(ctx.schedule.rolledToNextSeason
      ? ([
          {
            type: "note",
            text: `İçinde bulunulan bırakma sezonunun hazırlık süresi dolduğu için bu sipariş ${ctx.schedule.season.label} sezonuna yazılmıştır; yukarıdaki tarihler bu sezona aittir.`,
          },
        ] as LegalBlock[])
      : []),
    { type: "paragraph", text: `6.1. ${TEXT.calendar}` },
    {
      type: "paragraph",
      text: "6.2. Bırakmanın yapılacağı gün; hava koşulları, uçuş izinleri ve saha koşulları gözetilerek SATICI tarafından, yukarıdaki son tarihi aşmamak üzere belirlenir.",
    },
    { type: "paragraph", text: `6.3. ${TEXT.completionNotice}` },
    { type: "paragraph", text: `6.4. ${TEXT.lateOrImpossible}` },

    { type: "heading", text: "Madde 7 — Cayma hakkı" },
    { type: "paragraph", text: `7.1. ${TEXT.withdrawalRight(withdrawalLastDay(ctx))}` },
    { type: "paragraph", text: `7.2. ${TEXT.withdrawalHow()}` },
    { type: "paragraph", text: `7.3. ${TEXT.withdrawalRefund}` },
    { type: "paragraph", text: `7.4. ${TEXT.noEarlyPerformance}` },
    { type: "paragraph", text: `7.5. ${TEXT.rightsAfterWithdrawalPeriod}` },
    ...(corporate ? ([{ type: "paragraph", text: `7.6. ${TEXT.corporateWithdrawal}` }] as LegalBlock[]) : []),

    { type: "heading", text: "Madde 8 — Katılım Sertifikası ve görüntüler" },
    {
      type: "paragraph",
      text: "8.1. Katılım Sertifikası, bırakma işlemi tamamlandıktan sonra ALICI'nın belirlediği adla düzenlenir ve e-posta ile iletilir. Sertifika; adı, sahayı, bırakılan tohum topu adedini, türü ve bırakma tarihini gösterir; Site’de paylaşılabilir bir doğrulama sayfası bulunur. Kişisel ad, ancak adın sahibi tarafından ayrıca ve isteğe bağlı olarak verilen yayın izniyle bu sayfada gösterilir. İzin verilmemesi siparişe veya sertifika hakkına engel değildir.",
    },
    {
      type: "paragraph",
      text: "8.2. Yayın izni; adın saha, adet ve tarih bilgileriyle bağlantıyı bilen kişilerce görülebilmesini kapsar ve ücretsiz olarak geri alınabilir. Başka bir kişinin adı için ALICI’nın beyanı o kişinin açık rızası yerine geçmez. İlgili kişi doğrudan aydınlatılıp geçerli izni kaydedilene kadar üçüncü kişinin adı herkese açık sayfada gizlenir. SATICI’nın aydınlatma ve başvuruyu sonuçlandırma yükümlülüğü ALICI’ya devredilmez.",
    },
    {
      type: "paragraph",
      text: "8.3. Bedelin iade edildiği hâllerde düzenlenmiş Katılım Sertifikası iptal edilir ve doğrulama sayfasında iptal edildiği belirtilir.",
    },
    {
      type: "paragraph",
      text: "8.4. Çalışmaya ilişkin görüntüler, aynı sahada ve aynı dönemde yapılan bırakma çalışmasının tamamına ilişkindir; tek bir siparişe özgü ayrı bir çekim yapılmaz.",
    },

    { type: "heading", text: "Madde 9 — Hizmetin sınırları" },
    { type: "paragraph", text: `9.1. ${TEXT.noResultGuarantee}` },
    { type: "paragraph", text: `9.2. ${TEXT.notADonation}` },
    {
      type: "paragraph",
      text: "9.3. Sahalar, hukuki statülerine göre ilgili arazi, orman, çevre ve uçuş mevzuatına tabidir. Bu sözleşme ALICI'ya sahaya giriş, sahada işaretleme, tabela veya benzeri bir düzenleme yapma hakkı vermez.",
    },
    {
      type: "paragraph",
      text: `9.4. ${TEXT.speciesBySeller} Siparişte bildirilen tür, saha, adet, bedel veya ifa takviminde esaslı değişiklik gerekiyorsa SATICI nedeni ve önerilen yeni koşulları bırakmadan önce kalıcı veri saklayıcısıyla açıklar. Değişiklik ancak ALICI’nın açık kabulüyle uygulanır; cevap verilmemesi veya itiraz edilmemesi kabul değildir. Kabul alınamazsa ilk koşullar geçerlidir; bunlarla ifa mümkün değilse Madde 6.4 uygulanır. Önerinin değerlendirilmesi doğmuş iade hakkını veya kanuni süreleri ertelemez.`,
    },

    { type: "heading", text: "Madde 10 — Tarafların yükümlülükleri" },
    {
      type: "paragraph",
      text: "10.1. SATICI; hizmeti bu sözleşmeye, Site'de belirtilen niteliklere ve yürürlükteki mevzuata uygun olarak, sözleşmede belirtilen süre içinde ifa etmekle yükümlüdür.",
    },
    {
      type: "paragraph",
      text: "10.2. ALICI; sipariş sırasında verdiği bilgilerin doğru ve güncel olduğunu, bildirimlerin belirttiği e-posta adresine yapılacağını kabul eder. İletişim bilgilerindeki değişiklikleri SATICI'ya bildirmek ALICI'nın sorumluluğundadır.",
    },
    {
      type: "paragraph",
      text: "10.3. Tarafların kontrolü dışında gelişen, öngörülemeyen ve tarafların borçlarını yerine getirmesini engelleyen hâller (doğal afet, orman yangını, salgın, savaş, resmî makam kararları, uçuş yasakları ve benzeri) mücbir sebep sayılır. Mücbir sebebin ifayı imkânsızlaştırması hâlinde Madde 6.4 uygulanır.",
    },

    { type: "paragraph", text: "10.4. Tüketici, ayıplı hizmette mevzuattaki şartlarla hizmetin yeniden görülmesini, ortaya çıkan eserin ücretsiz onarımını, ayıp oranında bedel indirimini veya sözleşmeden dönmeyi talep edebilir; seçimlik hakkın niteliğine uygun hükümler ve tazminat hakları saklıdır. Sonuç garantisi verilmemesi, eksik veya sözleşmeye aykırı çalışmayı ayıpsız hâle getirmez." },
    { type: "heading", text: "Madde 11 — Kişisel verilerin korunması" },
    {
      type: "paragraph",
      text: `11.1. ALICI’nın kişisel verileri; sözleşmenin kurulması ve ifası, faturalandırma, ödeme işlemleri, yasal yükümlülüklerin yerine getirilmesi ve ALICI ile iletişim amaçlarıyla işlenir. Ayrıntılı bilgi ${site}/kvkk adresindeki Aydınlatma Metni'nde yer alır.`,
    },
    {
      type: "paragraph",
      text: "11.2. Ticari elektronik ileti gönderimi, ALICI'nın bu sözleşmeden bağımsız olarak ayrıca vereceği izne bağlıdır; bu izin siparişin şartı değildir ve dilendiği zaman geri alınabilir.",
    },

    { type: "heading", text: "Madde 12 — Bildirimler ve kayıtlar" },
    {
      type: "paragraph",
      text: "12.1. İşlem bildirimleri e-posta ve uygun kalıcı veri saklayıcısıyla iletilir. Bu hüküm cayma ve ilgili kişi başvurusu için açıklanan diğer kanalları veya kanunun öngördüğü şekil şartlarını sınırlamaz.",
    },
    {
      type: "paragraph",
      text: "12.2. Bu sözleşme, Ön Bilgilendirme Formu ve Cayma Formu, siparişin onaylanmasının ardından ALICI'nın e-posta adresine gönderilir; ayrıca SATICI tarafından elektronik ortamda, içeriği değiştirilemeyecek biçimde saklanır.",
    },
    {
      type: "paragraph",
      text: "12.3. Tarafların elektronik kayıtları, yazışmaları, ödeme belgeleri ve diğer delilleri kanuni ispat kurallarına göre değerlendirilir. SATICI kayıtlarına kesin veya münhasır delil niteliği tanınmaz; ALICI’nın delil sunma ve itiraz hakları ile kanuni ispat yükü dağılımı değişmez.",
    },

    { type: "heading", text: "Madde 13 — Uyuşmazlıkların çözümü" },
    { type: "paragraph", text: `13.1. ${TEXT.disputesConsumer} ${TEXT.disputesCorporate}` },
    { type: "paragraph", text: "13.2. Bu sözleşmeye Türkiye Cumhuriyeti hukuku uygulanır." },

    { type: "heading", text: "Madde 14 — Yürürlük" },
    {
      type: "paragraph",
      text: "14.1. Bu sözleşme; ALICI'nın Ön Bilgilendirme Formu'nu teyit edip sözleşmeyi elektronik ortamda onaylaması ve ödemenin gerçekleşmesiyle kurulur ve yürürlüğe girer. Ön Bilgilendirme Formu ile Cayma Formu bu sözleşmenin ayrılmaz parçasıdır.",
    },
    {
      type: "paragraph",
      text: "14.2. Bir hükmün geçersizliğinin sözleşmenin kalanına etkisi emredici hukuk kurallarıyla belirlenir. Tüketici aleyhine haksız şartlar tüketiciyi bağlamaz; bu hüküm geçersiz şartı geçerli kılmaz.",
    },
  ];

  return {
    kind: "contract",
    title: "Mesafeli Hizmet Sözleşmesi",
    meta: metaLines(ctx),
    version: ctx.version,
    blocks,
  };
}
