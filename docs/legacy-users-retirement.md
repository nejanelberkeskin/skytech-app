# Eski personel API’sinin kapatılması

`/api/admin/users` için GET, POST, PUT ve DELETE artık `410 Gone` döndürür:

```json
{"ok":false,"error":{"code":"endpoint_retired","message":"Bu personel yönetimi uç noktası kullanımdan kaldırıldı. Personel ve Davetler ekranlarını kullanın."}}
```

Yanıtta `Cache-Control: private, no-store` bulunur. Oturum, sorgu veya gövde okunmaz; bozuk JSON ve eski ayrıcalıklı gövdeler de aynı sonucu alır. Personel bilgisi, geçici parola veya kullanıcı varlığı açıklanmaz. Otomatik yönlendirme, başka uçta yeniden deneme, Auth kullanıcısı oluşturma/silme, e-posta, RPC ve audit yazımı yoktur. Kapalı uç için uygulama içi oturum sorgusu yapılmaması, artık işlevi olmayan bir rotanın gereksiz veri erişimini önler. Ortak middleware’in davranışı değişmemiştir; ağdaki kimliksiz çağrı middleware tarafından daha önce reddedilebilir.

## Geçerli kullanıcı akışı

Kaynak taramasında `app`, `components` ve `lib` altında eski ucu çağıran aktif tüketici bulunmadı. `StaffDirectory` ve `StaffDetail` `/api/admin/staff` uçlarını; `Invitations` `/api/admin/invitations` uçlarını kullanır. Yeni personel oluşturma, parola üretme veya eski JSON gövdesini yeni uca taşıma adaptörü eklenmedi. Yeni akışların izin, kapsam, MFA, sürüm ve davet sahipliği kontrolleri değişmedi.

## SQL sınırı

019 göçündeki `create_admin_user` ve `mutate_admin_user` fonksiyonları veritabanında tanımlı kalır. Her ikisinde `PUBLIC`, `anon` ve `authenticated` için EXECUTE iptal edilmiş; yalnız `service_role` yetkisi verilmiştir. Eski HTTP yolu artık bunları çağırmaz. Bu değişiklik SQL fonksiyonlarını kaldırmaz, `service_role` ile doğrudan çağrıyı engellemez ve bu yetkinin güvenliği hakkında canlı doğrulama iddiası taşımaz. Fonksiyonlar eski `SUPER_ADMIN` alanına dayandığından, başka sunucu işi ya da dış tüketici olup olmadığı incelenip ayrı bir göçle emekliye ayrılmaları değerlendirilmelidir. 019–023 göçleri ve gerçek personel kayıtları değiştirilmedi.

## Doğrulama

`scripts/test/legacy-users-retirement.test.mjs` gerçek route ve ortak zarfı bellek içinde çalıştırır. Dört yöntemde kimlik bilgili/kimliksiz istekler, geçerli eski payload, bozuk/boş/büyük gövde, gövdenin hiç tüketilmemesi, okunamayan request nesnesi, 410 hata kodu, no-store ve yönlendirme/yeniden deneme başlıklarının yokluğu sınanır. Sunucu, Auth, audit, e-posta ve ağ bağımlılıkları kullanıldığında test hemen hata verir. Canlı API, e-posta veya veritabanı kullanılmaz.

`audit-regressions.test.mjs` içindeki emekli PUT/DELETE için 409 bekleyen test ve `review-closure.test.mjs` içindeki eski POST için 201/Auth kullanıcı arama sayfalaması bekleyen test kaldırıldı. Yerlerine dört yöntem için 410 ve hiçbir Auth/personel işlemi yapılmaması kanıtı geldi. Son sahip korumasının asıl SQL/personel atama testleri korunmuştur; uç kapatılması bu güvencenin kaldırılması anlamına gelmez.
