# Sipariş özeti API erişimi

`GET /api/orders/invoice/[orderId]` resmî fatura üretmez; mevcut sipariş özeti ekranına veri sağlar. Eski `aktif admin_users kaydı var` koşulu kaldırıldı. Bu koşul, belge/iletişim/vergi izni olmayan personele başka müşterinin bilgilerini açıyordu.

- Kimlik `getUser()` ile doğrulanır; yalnız çerezden alınan `getSession()` sahiplik kanıtı değildir.
- Doğrulanmış sipariş sahibi kendi özetini aynı yanıt biçimiyle okumaya devam eder; personel izni aranmaz.
- Diğer kullanıcılar için mevcut saklı belge politikası uygulanır: `orders.documents.read`, `customers.contact.read`, `customers.tax.read`; her birinin ayrı ayrı bütün kayıt kapsamı gerekir. Aktif personel olmak tek başına yeterli değildir.
- `requirePermission` belge iznine ait mevcut MFA davranışını uygular. Bu uç global `ADMIN_MFA_ENFORCED` politikasını değiştirmez; bayrak kapalıysa mevcut dağıtım davranışı korunur. Üretimde zorlamanın açılması ayrı operasyon şartıdır.
- Yetki kararı öncesinde yalnız sipariş kimliği ve sahip kimliği okunur. İki okuma arasında sahip değişirse eski sahibe belge verilmez. Misafir siparişlerinde NULL sahiplik karşılaştırması ayrıca ele alınır.
- Bütün yanıtlar `private, no-store`, `noindex, nofollow`, `no-referrer` taşır. Hatalar eski sayfanın beklediği `{error: string}` biçimindedir; ham sağlayıcı/veritabanı ayrıntısı ya da nesne döndürülmez. Alt veri sorgusu başarısızsa eksik verili başarılı belge üretilmez.

Bu değişiklik yalnız yerel kod/test ve taslak PR kapsamındadır. SQL, yetki ataması, canlı veri okuma/yazma, gerçek e-posta/ödeme/iade ve dağıtım yapılmadı. Sahte hesap ve verilerle gerçek rota kodunu çalıştıran testler; sahip/izinsiz kişi/personel, üç ayrı izin, dar kapsam, MFA reddi, kimlik değişimi, sahiplik yarışı, misafir sahiplik ve hata yollarını sınar.
