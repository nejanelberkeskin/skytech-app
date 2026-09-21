/**
 * KVKK AYDINLATMA METNİ — 6698 sayılı Kanun m.10 ve Aydınlatma Yükümlülüğünün Yerine
 * Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ'e göre.
 *
 * TEK KAYNAK: `/kvkk` sayfası da, her siparişle birlikte saklanan kopya da (belge türü
 * `kvkk_notice`) bu bloklardan çıkar; müşteriye gösterilen metin ile saklanan metin ayrışamaz.
 * Aydınlatma metni rıza beyanı DEĞİLDİR: sihirbazdaki kutu "okudum, bilgi edindim" der.
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
import { metaLines, sellerTable } from "./shared";

export const KVKK_NOTICE_TITLE = "Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni";

/** Veri işleyen altyapı sağlayıcıları — değişirse yalnız burası güncellenir (ve sürüm artırılır). */
const PROCESSORS = [
  "Site barındırma ve içerik dağıtımı: Vercel Inc. (Amerika Birleşik Devletleri).",
  "Veritabanı ve üyelik altyapısı: Supabase Inc.; veriler Almanya'daki (Frankfurt) veri merkezinde tutulur.",
  "İşlem e-postalarının gönderimi: Resend (Plus Five Five, Inc., Amerika Birleşik Devletleri).",
  "Google ile giriş yapmayı seçerseniz: Google LLC (Amerika Birleşik Devletleri) — kimlik doğrulama.",
  "Analitik çerezlere izin verirseniz: Google Analytics (Google LLC, Amerika Birleşik Devletleri). Ayrıntı Çerez Politikası'ndadır.",
];

export function kvkkNoticeBlocks(): LegalBlock[] {
  const site = COMPANY.website.replace(/^https?:\/\//, "");
  const channels = [
    `Yazılı olarak: ${COMPANY.legalName}, ${companyAddressLine()}`,
    ...(COMPANY.kep ? [`Kayıtlı elektronik posta (KEP) ile: ${COMPANY.kep}`] : []),
    `Daha önce bize bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden: ${COMPANY.email}`,
  ];

  return [
    {
      type: "note",
      text: `Bu metin, ${site} adresli internet sitesini ziyaret ettiğinizde, bize talep ilettiğinizde, üye olduğunuzda ve tohum topu bıraktırma siparişi verdiğinizde kişisel verilerinizin nasıl işlendiğini açıklar. Aydınlatma metni bir sözleşme ya da rıza beyanı değildir: okuduğunuzu beyan etmeniz, verilerinizin işlenmesine rıza gösterdiğiniz anlamına gelmez.`,
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
        "Hukuki sebep: bir sözleşmenin kurulmasıyla doğrudan doğruya ilgili olması (KVKK m.5/2-c).",
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
        "Hukuki işlem kayıtları: Ön Bilgilendirme Formu'nu teyit ettiğinize, sözleşmeyi kabul ettiğinize ve bu metni okuduğunuza ilişkin beyanların anı ve size gösterilen metnin sürümü; siparişinize özel belgelerin kopyası; IP adresinizin geri döndürülemeyen özeti ve tarayıcı bilgisi.",
      ],
    },
    {
      type: "table",
      rows: [
        [
          "Sözleşmenin kurulması ve ifası (KVKK m.5/2-c)",
          "Siparişin alınması, bedelin tahsili, hizmetin planlanması ve ifası, Katılım Sertifikası'nın düzenlenmesi, sipariş ve bırakma bildirimlerinin gönderilmesi, cayma ve iade işlemlerinin yürütülmesi.",
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

    { type: "subheading", text: "2.5. Katılım Sertifikası" },
    {
      type: "paragraph",
      text: "Tohum topu bırakma tamamlandığında adınıza bir Katılım Sertifikası düzenlenir. Sertifika; sipariş sırasında belirlediğiniz adı, sahayı, tohum topu adedini ve tarihleri içerir. E-posta adresiniz, telefonunuz, adresiniz, fatura bilgileriniz ve sipariş numaranız sertifikada yer almaz. Sertifika sayfası arama motorlarına kapalıdır; ancak bağlantısını bilen herkes tarafından görüntülenebilir ve bağlantıyı dilediğiniz kişilerle paylaşabilirsiniz. Sertifikaya başka bir kişinin adını yazdırıyorsanız, o kişiyi bilgilendirmek size aittir.",
    },

    { type: "subheading", text: "2.6. Ticari elektronik ileti" },
    {
      type: "paragraph",
      text: "Duyuru ve kampanya iletileri yalnız bunun için ayrıca onay vermeniz hâlinde gönderilir. Bu durumda e-posta adresiniz ve telefon numaranız, açık rızanıza (KVKK m.5/1) ve 6563 sayılı Kanun uyarınca verdiğiniz onaya dayanılarak işlenir; izniniz İleti Yönetim Sistemi'ne (İYS) kaydedilir. Bu izin siparişin şartı değildir; dilediğiniz an, hiçbir gerekçe göstermeden ve ücretsiz olarak geri alabilirsiniz. Siparişinize ilişkin bildirimler (sipariş teyidi, cayma teyidi, bırakma ve fatura bildirimleri) ticari ileti değildir; izninizden bağımsız olarak gönderilir.",
    },

    { type: "heading", text: "3. Verilerinizi kimlere, hangi amaçla aktarıyoruz" },
    {
      type: "list",
      items: [
        "Ödeme kuruluşu — iyzico (iyzi Ödeme ve Elektronik Para Hizmetleri A.Ş.): ödemenin alınması ve gerektiğinde iadesi için ad, soyad, e-posta, telefon, fatura adresi, IP adresi, sipariş numarası ve tutar. T.C. kimlik ve vergi numaranız ödeme kuruluşuna aktarılmaz.",
        "Gelir İdaresi Başkanlığı ve e-belge hizmeti alınan özel entegratör: e-Fatura / e-Arşiv Fatura düzenlenmesi için fatura bilgileriniz.",
        "İleti Yönetim Sistemi A.Ş.: ticari elektronik ileti onayı verdiyseniz, onayınıza ilişkin kayıt.",
        "Hukuk, mali müşavirlik ve denetim hizmeti aldığımız kişiler: hizmetin gerektirdiği ölçüde ve sır saklama yükümlülüğü altında.",
        "Yetkili kamu kurum ve kuruluşları ile yargı mercileri: mevzuat gereği talep edilmesi hâlinde.",
      ],
    },
    {
      type: "paragraph",
      text: "Hizmetin sunulabilmesi için veri işleyen sıfatıyla çalıştığımız bilişim altyapısı sağlayıcıları şunlardır:",
    },
    { type: "list", items: PROCESSORS },
    {
      type: "paragraph",
      text: "Bu sağlayıcıların bir kısmı yurt dışında yerleşik olduğundan, verileriniz bu hizmetlerin gerektirdiği ölçüde yurt dışına aktarılır. Yurt dışına aktarım, KVKK m.9'da öngörülen usul ve güvencelere uygun olarak yapılır. Kişisel verileriniz satılmaz, kiralanmaz; pazarlama amacıyla üçüncü kişilerle paylaşılmaz.",
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
        ["Sipariş, sözleşme, fatura, ödeme ve iade kayıtları", "10 yıl (6102 sayılı Türk Ticaret Kanunu m.82; 213 sayılı Vergi Usul Kanunu)."],
        ["Ön bilgilendirme, cayma ve ifaya ilişkin bilgi ve belgeler", "En az 3 yıl (Mesafeli Sözleşmeler Yönetmeliği); ticari kayıt niteliğinde olanlar 10 yıl."],
        ["Ticari elektronik ileti onay kayıtları", "Onayın geçerliliğinin sona erdiği tarihten itibaren 3 yıl (6563 sayılı Kanun ve ilgili yönetmelik)."],
        ["Talep ve iletişim kayıtları", "Talebin sonuçlandırılmasından itibaren 2 yıl."],
        ["Üyelik bilgileri", "Üyelik süresince; üyeliğin sona ermesinden itibaren 1 yıl. Siparişlerinize bağlı kayıtlar yukarıdaki sürelere tabidir."],
        ["Sunucu ve işlem güvenliği kayıtları", "2 yıl."],
      ],
    },
    {
      type: "paragraph",
      text: "Sürelerin sonunda verileriniz silinir, yok edilir veya anonim hâle getirilir. Bir uyuşmazlık ya da resmî inceleme sürüyorsa ilgili kayıtlar bunların sonuçlanmasına kadar saklanır.",
    },

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
    { type: "paragraph", text: "Başvurunuzu, kimliğinizi doğrulamaya elverişli bilgilerle birlikte şu yollardan biriyle iletebilirsiniz:" },
    { type: "list", items: channels },
    {
      type: "paragraph",
      text: "Başvurunuz, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak en kısa sürede ve en geç 30 (otuz) gün içinde ücretsiz sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi hâlinde Kişisel Verileri Koruma Kurulunca belirlenen tarifedeki ücret alınabilir. Başvurunuzun reddedilmesi, verilen yanıtı yetersiz bulmanız ya da süresinde yanıt verilmemesi hâlinde; yanıtı öğrendiğiniz tarihten itibaren 30 (otuz) ve her hâlde başvuru tarihinden itibaren 60 (altmış) gün içinde Kişisel Verileri Koruma Kuruluna şikâyette bulunabilirsiniz.",
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
