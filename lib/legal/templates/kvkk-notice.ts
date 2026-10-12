/**
 * KVKK AYDINLATMA METNİ — 6698 sayılı Kanun m.10 ve Aydınlatma Yükümlülüğünün Yerine
 * Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ'e göre.
 *
 * TEK KAYNAK: `/kvkk` sayfası da, her siparişle birlikte saklanan kopya da (belge türü
 * `kvkk_notice`) bu bloklardan çıkar; müşteriye gösterilen metin ile saklanan metin ayrışamaz.
 * Aydınlatma metni rıza beyanı DEĞİLDİR: veri alınırken bildirim olarak gösterilir, onay kutusu yoktur.
 *
 * İçerik, kodun GERÇEKTE yaptığıyla uyumlu tutulmalıdır:
 *  • kart verisi sunucuya gelmez (lib/payments/iyzico.ts — barındırılan ödeme sayfası)
 *  • ödeme kuruluşuna T.C. kimlik / vergi numarası GÖNDERİLMEZ (aynı dosya)
 *  • IP adresi ham saklanmaz, tuzlu özeti saklanır (lib/requests/server.ts → hashIp);
 *    ödeme kuruluşuna ise ham IP iletilir (sahtecilik denetimi için zorunlu alan)
 *  • sertifika sayfasında yalnız seçilen ad görünür, sayfa dizine kapalıdır
 * Bunlardan biri değişirse metin de değişir ve lib/legal/version.ts içindeki sürüm artırılır.
 *
 * [AVUKAT] TASLAK. İncelenecek noktalar: web-brifler/hukuk-taslaklari/KVKK-AVUKAT-NOTLARI.md
 */
import { COMPANY, companyAddressLine } from "@/lib/company";
import type { LegalBlock, LegalContext, LegalDocument } from "../types";
import { draftNotes, metaLines, sellerTable } from "./shared";

export const KVKK_NOTICE_TITLE = "Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni";

/** Veri işleyen altyapı sağlayıcıları — değişirse yalnız burası güncellenir (ve sürüm artırılır). */
const PROCESSORS = [
  "Site barındırma, sunucu işlemleri ve içerik dağıtımı: Vercel. Standart hizmet belgelerinde alıcı Vercel Inc. olarak geçer; istek, erişim ve uygulama verileri hizmet kapsamında işlenir.",
  "Veritabanı ve üyelik altyapısı: Supabase. Standart veri işleme sözleşmesindeki veri işleyen Supabase Pte. Ltd.’dir. Frankfurt bölgesinin seçilmiş olması, destek ve işletim verilerinin yalnız Almanya’da kaldığı anlamına gelmez.",
  "İşlem e-postalarının gönderimi: Resend. Standart hizmet belgelerinde alıcı Plus Five Five, Inc.’dir; alıcı e-posta adresi, ileti içeriği ve iletim kayıtları işlenir.",
  "Şirket e-postası ve yazışmalar: Google Workspace. info@skytechgreen.com adresine gönderdiğiniz içerik ve iletişim bilgileri bu altyapıdan geçebilir.",
  "Google ile giriş yapmayı seçerseniz: Google kimlik doğrulama hizmeti kapsamında gerekli hesap ve oturum bilgileri.",
  "İsteğinizle açılan YouTube videoları: IP, cihaz ve oynatma verileri. Gizlilik geliştirilmiş oynatıcı, veri aktarımını ortadan kaldırmaz. Harita ve sosyal medya bağlantıları dış hizmete geçiştir; bu hizmetlerin kendi açıklamaları da uygulanır.",
  "Analitik özelliği açılır ve ayrıca izin verirseniz: Google Analytics, Vercel Web Analytics ve Speed Insights. Analitik, geçerli aktarım koşulları sağlanmadan açılmaz.",
];

export function kvkkNoticeBlocks(): LegalBlock[] {
  const site = COMPANY.website.replace(/^https?:\/\//, "");
  const channels = [
    `Yazılı olarak: ${COMPANY.legalName}, ${companyAddressLine()}`,
    ...(COMPANY.kep ? [`Kayıtlı elektronik posta (KEP) ile: ${COMPANY.kep}`] : []),
    `Güvenli elektronik imza veya mobil imza ile: ${COMPANY.email}`,
    `Daha önce bize bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden: ${COMPANY.email}`,
  ];

  return [
    {
      type: "note",
      text: `Bu metin, ${site} adresli internet sitesini ziyaret ettiğinizde, bize talep ilettiğinizde, üye olduğunuzda ve tohum topu bıraktırma siparişi verdiğinizde kişisel verilerinizin nasıl işlendiğini açıklar. Aydınlatma metni bir sözleşme ya da rıza beyanı değildir: okuduğunuzu beyan etmeniz, verilerinizin işlenmesine rıza gösterdiğiniz anlamına gelmez. Aydınlatma, bilgi verme yükümlülüğüdür; rızaya dayanmayan gerekli işlemeler için genel bir açık rıza istenmez.`,
    },

    { type: "heading", text: "1. Veri sorumlusu" },
    {
      type: "paragraph",
      text: "Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") uyarınca veri sorumlusu sıfatıyla aşağıda bilgileri yer alan şirket tarafından işlenir. \"Skytech Green\", bu şirketin tohum topu ve dron teknolojisiyle yürüttüğü ormanlaştırma ve gençleştirme çalışmalarının markasıdır.",
    },
    sellerTable(),

    { type: "heading", text: "2. Hangi verileri, hangi amaçla ve hangi hukuki sebeple işliyoruz" },

    { type: "subheading", text: "2.1. Siteyi ziyaret ettiğinizde" },
    {
      type: "list",
      items: [
        "İşlenen veriler: IP adresi, tarayıcı ve cihaz bilgisi, erişim zamanı ve ziyaret edilen sayfalar (sunucu kayıtları); tercihlerinize bağlı olarak çerez verileri.",
        "Amaç: sitenin güvenli ve kesintisiz çalışması, hataların giderilmesi, kötüye kullanımın önlenmesi.",
        "Hukuki sebep: veri sorumlusunun meşru menfaati (KVKK m.5/2-f). Zorunlu olmayan (analitik) çerezler yalnız açık rızanızla (KVKK m.5/1) kullanılır; tercihinizi Çerez Tercihleri'nden her zaman değiştirebilirsiniz.",
      ],
    },

    { type: "subheading", text: "2.2. Bilgi ya da talep formu gönderdiğinizde" },
    {
      type: "list",
      items: [
        "İşlenen veriler: ad, soyad, e-posta, telefon, varsa kurum adı; talebinizin içeriği (arazi başvurusunda arazinin ili, ilçesi, büyüklüğü, niteliği ve paylaştığınız konum bağlantısı; iletiniz).",
        "Amaç: talebinizin değerlendirilmesi, size dönüş yapılması ve teklif hazırlanması.",
        "Hukuki sebep: kişinin kendi sözleşmesini kurmaya yönelik taleplerinde KVKK m.5/2-c; genel soruların yanıtlanması ve kurum temsilcisiyle iletişimde temel hak ve özgürlüklere zarar vermeyen gerekli meşru menfaat kapsamında KVKK m.5/2-f. Hak talebi ve uyuşmazlıklarda gerekli kayıtlar KVKK m.5/2-e kapsamında işlenir.",
      ],
    },

    { type: "subheading", text: "2.3. Üyelik oluşturduğunuzda" },
    {
      type: "list",
      items: [
        "İşlenen veriler: ad, soyad, e-posta, şifrenizin geri döndürülemeyen özeti, oturum kayıtları. Google ile giriş yaparsanız Google hesabınızdaki ad ve e-posta adresi.",
        "Amaç: hesabınızın oluşturulması, güvenli oturum açılması, taleplerinizin ve siparişlerinizin hesabınızda gösterilmesi.",
        "Hukuki sebep: üyelik ilişkisinin kurulması ve ifası (KVKK m.5/2-c).",
      ],
    },

    { type: "subheading", text: "2.4. Tohum topu bıraktırma siparişi verdiğinizde" },
    {
      type: "list",
      items: [
        "Kimlik ve iletişim: ad, soyad, e-posta, cep telefonu, fatura adresi. Kurumsal siparişte ticaret unvanı, vergi dairesi ve vergi numarası, siparişi veren yetkilinin adı; verdiyseniz MERSİS numarası, KEP adresi ve satın alma numarası. Bireysel siparişte T.C. kimlik numarası isteğe bağlıdır ve yalnız faturaya yazılmak üzere alınır.",
        "Sipariş ve işlem: sipariş numarası, seçtiğiniz Proje Uygulama Sahası, tohum topu adedi, bedel, sertifikada yer almasını istediğiniz ad; sipariş, ödeme ve bırakma tarihleri; cayma bildirimi ve iade kayıtları; size gönderilen sipariş bildirimleri.",
        "Ödeme: ödeme kuruluşunun bildirdiği işlem numarası ve sonucu, kartın türü, bankayı tanımlayan ilk haneleri (BIN) ve son dört hanesi, taksit bilgisi. Kart numaranızın tamamı, son kullanma tarihi ve güvenlik kodu tarafımıza ulaşmaz; ödeme kuruluşunun güvenli ödeme sayfasında işlenir.",
        "Hukuki işlem kayıtları: Ön Bilgilendirme Formu'nu teyit ettiğinize, sözleşmeyi kabul ettiğinize ve bu metni okuduğunuza ilişkin beyanların anı ve size gösterilen metnin sürümü; siparişinize özel belgelerin kopyası; IP adresinizin tuzlu özeti ve tarayıcı bilgisi. Özetleme tek başına anonimleştirme değildir; barındırma veya ödeme sağlayıcısı ham IP işleyebilir.",
      ],
    },
    {
      type: "table",
      rows: [
        [
          "Sözleşmenin kurulması ve ifası (KVKK m.5/2-c)",
          "Siparişin alınması, bedelin tahsili, hizmetin planlanması ve ifası, Katılım Sertifikası’nın hazırlanması, sipariş ve bırakma bildirimlerinin gönderilmesi. Cayma ve iade işlemleri ayrıca hukuki yükümlülük ve hakların korunması kapsamında yürütülür; kişisel adın kamuya açıklanması bu sözleşme dayanağına bağlanmaz.",
        ],
        [
          "Hukuki yükümlülüklerin yerine getirilmesi (KVKK m.5/2-ç)",
          "Fatura düzenlenmesi; ön bilgilendirme, sözleşme ve cayma kayıtlarının saklanması; ticari defter ve belgelerin saklanması; yetkili kurum ve kuruluşların taleplerinin karşılanması.",
        ],
        [
          "Bir hakkın tesisi, kullanılması veya korunması (KVKK m.5/2-e)",
          "Olası uyuşmazlıklarda ispat; tüketici hakem heyeti, mahkeme ve icra süreçleri.",
        ],
        [
          "Veri sorumlusunun meşru menfaati (KVKK m.5/2-f)",
          "Sahte ve kötüye kullanım amaçlı işlemlerin önlenmesi, işlem güvenliğinin sağlanması.",
        ],
      ],
    },

    { type: "paragraph", text: "Kurumsal işlemde temsilcinin kişisel verileri, tüzel kişinin sözleşmesinin tarafı olduğu varsayımıyla işlenmez. Gerekli temsil ve iletişim bilgileri temel haklara zarar vermeyen meşru menfaat; ispat ve uyuşmazlık kayıtları hakkın tesisi, kullanılması veya korunması; kanuni bildirimler hukuki yükümlülük kapsamında değerlendirilir." },
    { type: "subheading", text: "2.5. Katılım Sertifikası" },
    {
      type: "paragraph",
      text: "Sertifika için belirlediğiniz ad, saha, adet ve tarihler işlenir; e-posta, telefon, fatura adresi ve sipariş numarası herkese açık doğrulama sayfasına çıkarılmaz. Doğrulama bağlantısını bilen herkes sayfayı görebilir; arama motorlarına kapalı olması gizli erişim sağladığı anlamına gelmez. Kişisel ad varsayılan olarak gizlidir. Kendi adınızı yayımlamak için ayrı, isteğe bağlı açık rıza verebilirsiniz (KVKK m.5/1); vermemeniz siparişi engellemez. Bu izin sipariş sayfasından veya şirketin e-posta adresinden ücretsiz geri alınabilir. Başka birinin adı, o kişi doğrudan aydınlatılıp geçerli yayın izni alınana kadar kamuya açıklanmaz; alıcının beyanı o kişinin rızası yerine geçmez. İzin geri alındığında sonraki yayın durdurulur; üçüncü kişilerin daha önce aldığı kopyalar üzerindeki fiilî kontrolümüz sınırlıdır.",
    },
    {
      type: "paragraph",
      text: "Hediye sertifikasında üçüncü kişinin adının kamuya kapalı olarak alınması da kişisel veri işlemedir. Sertifikayı isteyen kişinin sözleşmesi, adın sahibi üçüncü kişi bakımından kendiliğinden KVKK m.5/2-c dayanağı oluşturmaz. Üçüncü kişinin adı ancak ölçülülüğü ve hak dengesi belgelenmiş meşru menfaat veya ilgili kişinin geçerli rızası gibi somut bir işleme şartı varsa alınır. Bu şart yoksa sertifika adsız hazırlanır; ad daha sonra ilgili kişi tarafından eklenebilir. Çocuk adı için çocuğun durumuna uygun temsil ve izin koşulları ayrıca değerlendirilir; bu akış sağlanmadan çocuk adı toplanmaz veya yayımlanmaz.",
    },
    {
      type: "paragraph",
      text: "Ad başka kişiden alındıysa ilgili kişi makul sürede, kendisiyle ilk iletişimde ve en geç ilk aktarım sırasında aydınlatılır. Aydınlatma için gereksiz ek iletişim bilgisi istenmez. Bu yükümlülük ve veri işleme şartı karşılanamıyorsa üçüncü kişinin adı sisteme alınmaz. Yalnız satın alanın “izin aldım” beyanı yeterli sayılmaz.",
    },

    { type: "subheading", text: "2.6. Ticari elektronik ileti" },
    {
      type: "paragraph",
      text: "Duyuru ve kampanya iletileri yalnız bunun için ayrıca onay vermeniz hâlinde gönderilir. Bu durumda e-posta adresiniz, açık rızanıza (KVKK m.5/1) ve 6563 sayılı Kanun uyarınca verdiğiniz onaya dayanılarak işlenir; onay ve ret bildirimleri uygulanabilir İYS yükümlülükleri çerçevesinde üç iş günü içinde kayda alınır. İYS kaydı ve ret süreçleri tamamlanmadan kampanya gönderimi başlatılmaz. Bu izin siparişin şartı değildir; dilediğiniz an, hiçbir gerekçe göstermeden ve ücretsiz olarak geri alabilirsiniz. Ret bildiriminizin ulaşmasını izleyen en geç üç iş günü içinde ticari elektronik ileti gönderimi durdurulur. İYS dışından alınan onay ve ret kayıtları da mevzuattaki sürelerle İYS’ye işlenir. Sadece mevcut işlemin yürütülmesine ilişkin sipariş, cayma, bırakma ve fatura bildirimleri, içine tanıtım eklenmeksizin pazarlama izninden bağımsız gönderilir. Bu istisna kampanya göndermeye yetki vermez.",
    },

    { type: "heading", text: "3. Verilerinizi kimlere, hangi amaçla aktarıyoruz" },
    {
      type: "list",
      items: [
        "Ödeme kuruluşu — iyzico (iyzi Ödeme ve Elektronik Para Hizmetleri A.Ş.): ödemenin alınması ve gerektiğinde iadesi için ad, soyad, e-posta, telefon, fatura adresi, IP adresi, sipariş numarası ve tutar. T.C. kimlik ve vergi numaranız ödeme kuruluşuna aktarılmaz.",
        "Gelir İdaresi Başkanlığı: e-Fatura / e-Arşiv Fatura düzenlenmesi için fatura bilgileriniz. Şirket e-Fatura sistemine kayıtlıdır; e-Arşiv belgeleri başlangıçta GİB portalından düzenlenir. Henüz seçilmemiş bir özel entegratöre veri aktarıldığı varsayılmaz; bu hizmet kullanılacaksa alıcı ve aktarım bilgisi işlem başlamadan güncellenir.",
        "İleti Yönetim Sistemi A.Ş.: ticari elektronik ileti uygulaması başlatıldığında onay ve ret durumunun mevzuata uygun yönetilmesi için gerekli iletişim adresi, kanal, durum, kaynak ve zaman bilgileri.",
        "Hukuk, mali müşavirlik ve denetim hizmeti aldığımız kişiler: hizmetin gerektirdiği ölçüde ve sır saklama yükümlülüğü altında.",
        "Yetkili kamu kurum ve kuruluşları ile yargı mercileri: mevzuat gereği talep edilmesi hâlinde.",
      ],
    },
    {
      type: "paragraph",
      text: "Kullanılan bilişim hizmetleri ve ilgili alıcı grupları aşağıdadır. Hizmetin niteliğine göre alıcı, veri işleyen veya kendi amaçları bakımından ayrı veri sorumlusu olabilir; tüm sağlayıcılar otomatik olarak veri işleyen sayılmaz:",
    },
    { type: "list", items: PROCESSORS },
    { type: "subheading", text: "3.1. Yurt dışına aktarım" },
    {
      type: "paragraph",
      text: "Bu hizmetlerde yurt dışında depolama veya yurt dışından erişim kişisel veri aktarımı oluşturabilir. Avrupa Birliği içinde barındırma da Türkiye bakımından yurt dışına aktarımdır. Alıcının Türkiye’de merkezinin bulunması ise bütün alt işlem zincirinin Türkiye’de kaldığını tek başına göstermez.",
    },
    {
      type: "paragraph",
      text: "Yurt dışına aktarım için KVKK m.5 veya m.6’daki işleme şartına ek olarak m.9’daki koşullar sağlanır. Uygulanabilir yeterlilik kararı yoksa, uygun güvence yollarından somut işleme uygun olanı kurulmalıdır. Düzenli bulut, üyelik ve e-posta işlemleri, arızi aktarım istisnasına dayandırılamaz. Genel hizmet sözleşmesi, Avrupa Birliği standart sözleşmesi veya çerez izni tek başına Türk hukukundaki aktarım güvencesinin yerine geçmez.",
    },
    ...draftNotes(
      "Her hizmet için fiilen sözleşme imzalayan tüzel kişi, barındırma ve erişim ülkeleri, aktarılan veri kategorileri, amaç, geçerli KVKK m.9 mekanizması ve güvenceye erişim yolu, bu metnin “Yurt dışı aktarım bilgileri” ekinde yayımlanacaktır. Envanterde teyit edilmeyen sağlayıcı unvanı, imzalanmamış standart sözleşme veya yapılmamış Kurum bildirimi tamamlanmış gibi gösterilemez. Ek tamamlanmadan bu sürüm yayına hazır değildir.",
    ),
    {
      type: "paragraph",
      text: "Aktarım hakkında bilgi ve uygulanabilir güvencenin kişisel veri veya ticari sır içermeyen açıklamasını info@skytechgreen.com üzerinden isteyebilirsiniz. Kişisel verileriniz satılmaz, kiralanmaz; bağımsız üçüncü kişilerin kendi pazarlaması için paylaşılmaz.",
    },

    { type: "heading", text: "4. Verilerinizi nasıl topluyoruz" },
    {
      type: "paragraph",
      text: "Verileriniz; sitedeki formlar, sipariş adımları ve üyelik ekranları, bizimle yaptığınız e-posta ve telefon görüşmeleri, ödeme kuruluşunun bize ilettiği işlem sonucu ve çerezler aracılığıyla, tamamen veya kısmen otomatik yollarla toplanır.",
    },

    { type: "heading", text: "5. Verilerinizi ne kadar süre saklıyoruz" },
    {
      type: "table",
      rows: [
        ["Sipariş, sözleşme, fatura, ödeme ve iade kayıtları", "TTK m.82 kapsamındaki ticari belgeler için ilgili takvim yılı sonundan itibaren 10 yıl; VUK m.253 kapsamındaki defter ve belgeler için ilgili yılı izleyen takvim yılından itibaren 5 yıl. Aynı belgeye birden çok yükümlülük uygulanırsa uzun olan süre dikkate alınır; tüm ham teknik kayıtlar bu kapsamda sayılmaz."],
        ["Ön bilgilendirme, cayma ve ifaya ilişkin bilgi ve belgeler", "En az 3 yıl (Mesafeli Sözleşmeler Yönetmeliği); ticari kayıt niteliğinde olanlar 10 yıl."],
        ["Ticari elektronik ileti onay kayıtları", "Onayın geçerliliğinin sona erdiği tarihten itibaren 3 yıl; ticari elektronik iletilere ilişkin diğer kayıtlar, kayıt tarihinden itibaren 3 yıl. Daha uzun somut kanuni yükümlülük varsa yalnız ilgili belgeye uygulanır."],
        ["Talep ve iletişim kayıtları", "Açık talebin yürütülmesi boyunca; kapanan ve siparişe dönüşmeyen genel talepler için kapanıştan sonra en çok 12 ay. Daha erken ihtiyaç kalmaması hâlinde silinir. Ticari yazışma veya somut uyuşmazlık niteliğindeki gerekli kayıtlar ilgili ayrı süreye tabidir."],
        ["Üyelik bilgileri", "Aktif üyelik süresince; kapanışın tamamlanmasından sonra bağımsız saklama nedeni bulunmayan profil verileri en geç 30 gün içinde silinir. Mevzuat veya somut hak koruma amacıyla saklanması gereken sipariş belgeleri ayrı tutulur; eski hesaba giriş erişimi açık bırakılmaz."],
        ["Sunucu ve işlem güvenliği kayıtları", "Genel uygulama erişim kayıtları için en çok 90 gün. Somut olayın incelenmesi için gereken kayıtlar olay dosyasına ayrılır. Siparişin hukuki ispat kaydı ile genel erişim günlüğü aynı kayıt türü sayılmaz. Sağlayıcıların kendi amaçlarıyla tuttuğu kayıtlar için ilgili sağlayıcının açıklamaları da incelenir."],
      ],
    },
    {
      type: "paragraph",
      text: "Sürelerin sonunda verileriniz silinir, yok edilir veya anonim hâle getirilir. Bir uyuşmazlık veya inceleme için yalnız ilgili kayıtların gerekli bölümü korunur; bu gerekçe bütün verilerin süresiz tutulmasına yol açmaz.",
    },
    ...draftNotes(
      "Bu sürümdeki 12 ay, 30 gün ve 90 gün şirket için önerilen operasyonel üst sürelerdir; kanuni genel süreler değildir. Yayın öncesinde saklama ve imha planındaki görevler ve silme düzeni uygulanıp bu sürelerle uyumlu olduğu doğrulanacaktır.",
    ),

    { type: "heading", text: "6. Haklarınız" },
    { type: "paragraph", text: "KVKK m.11 uyarınca veri sorumlusuna başvurarak:" },
    {
      type: "list",
      items: [
        "kişisel verilerinizin işlenip işlenmediğini öğrenme,",
        "işlenmişse buna ilişkin bilgi talep etme,",
        "işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,",
        "yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,",
        "eksik veya yanlış işlenmişse düzeltilmesini isteme,",
        "KVKK m.7'deki şartlar çerçevesinde silinmesini veya yok edilmesini isteme,",
        "düzeltme, silme ve yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,",
        "işlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,",
        "kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme",
      ],
    },
    { type: "paragraph", text: "haklarına sahipsiniz." },

    { type: "heading", text: "7. Başvuru" },
    { type: "paragraph", text: "Başvurunuzda ad, soyad; yazılı başvuruda imza; Türkiye Cumhuriyeti vatandaşı için T.C. kimlik numarası, yabancı için uyruğu ve pasaport/kimlik numarası; tebligata esas adres; varsa bildirim e-postası, telefon/faks ve talep konusu yer alır. Kimlik kartı fotokopisini kendiliğinizden göndermeniz gerekmez; kimlik doğrulama için yalnız gerekli ve ölçülü bilgi istenebilir. Şu yollardan biri kullanılabilir:" },
    { type: "list", items: channels },
    {
      type: "paragraph",
      text: "Nihai cevap yazılı olarak veya elektronik ortamda bildirilir. Yalnız telefonla ya da yüz yüze açıklama, başvurunun kanuna uygun cevaplandırılması yerine geçmez; kabul edilen işlem ve varsa ret gerekçesi cevabımızda belirtilir.",
    },
    {
      type: "paragraph",
      text: "Başvurunuz, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak en kısa sürede ve en geç 30 (otuz) gün içinde sonuçlandırılır; kural olarak ücretsizdir; işlemin ayrıca bir maliyet gerektirmesi hâlinde Kişisel Verileri Koruma Kurulunca belirlenen tarifedeki ücret alınabilir. Başvurunuzun reddedilmesi, verilen yanıtı yetersiz bulmanız ya da süresinde yanıt verilmemesi hâlinde; yanıtı öğrendiğiniz tarihten itibaren 30 (otuz) ve her hâlde başvuru tarihinden itibaren 60 (altmış) gün içinde Kişisel Verileri Koruma Kuruluna şikâyette bulunabilirsiniz. Cevap verilmezse 30 günlük cevap süresinin dolmasından sonra, başvurudan itibaren 60 günlük üst süre içinde şikâyet edilebilir. Başvuru SATICI’nın hatasından kaynaklanıyorsa alınan ücret iade edilir.",
    },

    { type: "heading", text: "8. Bu metindeki değişiklikler" },
    {
      type: "paragraph",
      text: `Bu metin, mevzuattaki ve hizmetlerimizdeki değişikliklere göre güncellenebilir; güncel sürüm ${site}/kvkk adresinde yayımlanır. Sipariş verdiğinizde size gösterilen sürümün bir kopyası siparişinizle birlikte saklanır ve sipariş teyidi e-postanıza eklenir.`,
    },
  ];
}

/** Siparişle birlikte saklanan kopya (künyesinde sipariş no ve belge sürümü yer alır). */
export function kvkkNoticeDocument(ctx: LegalContext): LegalDocument {
  return { kind: "kvkk_notice", title: KVKK_NOTICE_TITLE, meta: metaLines(ctx), version: ctx.version, blocks: kvkkNoticeBlocks() };
}

/** Herkese açık sayfadaki PDF: siparişe bağlı değildir, künyesinde yalnız belge sürümü yer alır. */
export function kvkkNoticePublicDocument(version: string): LegalDocument {
  return { kind: "kvkk_notice", title: KVKK_NOTICE_TITLE, meta: [`Belge sürümü: ${version}`], version, blocks: kvkkNoticeBlocks() };
}
