# Davet sahipliği ve görünürlük (023)

Davet yönetimi politikası: yalnız tam kapsamlı `staff.invite` sahibi kendi davetlerini; tam kapsamlı `staff.manage` sahibi bütün davetleri görür. Yazma için ayrıca `staff.invite` gerekir. Bu değişiklik mevcut bir hesaba yeni yetki vermez.

| Etkili izin (tüm kayıtlar) | Liste | Oluşturma | Yeniden gönderme / iptal |
|---|---|---|---|
| staff.invite | Kendi oluşturdukları | Mevcut yetki/MFA kurallarıyla | Kendi oluşturdukları |
| staff.manage | Bütün davetler | Yok | Yok |
| İkisi birlikte | Bütün davetler | Mevcut yetki/MFA kurallarıyla | Bütün davetler |
| Hiçbiri / dar kapsam | Mevcut izin kapısı reddeder | Ret | Ret |

## Sözleşme

- `GET /api/admin/invitations`: `{ items, nextCursor }` zarfı ve DTO değişmez. Aktör `guard.admin.user_id` alanından, bütün davetleri görebilme durumu `hasFullScope(guard.access, "staff.manage")` sonucundan gelir. Query/body aktör veya kapsam belirleyemez.
- Kendi davetleri filtresi `admin_invitations.created_by = auth user UUID` ile sayfalama ve limit uygulanmadan önce SQL sorgusuna eklenir. `admin_users.id` kullanılmaz. Aynı tarihli kayıtlar `(created_at, id)` ile kararlı sayfalanır. 023 buna uygun bileşik indeks ekler.
- `POST /api/admin/invitations/{id}/resend` ve `/revoke`: mevcut staff.invite + MFA kapısı korunur. SQL işlemi satırı kilitler, ardından kendi kaydı veya tam kapsamlı personel yöneticisi koşulunu denetler. Yetkisiz davet kimliği ile olmayan kimlik aynı `404 not_found / Davet bulunamadı.` yanıtını verir; kayıt durumuna bakmadan ret verilir.
- İzinli kişinin kabul edilmiş/iptal edilmiş davetinde eski `410 invitation_unusable` davranışı korunur. Süresi dolmuş ama bekleyen kendi daveti yeniden gönderilebilir.
- Sahiplik/MFA reddinde belirteç, gönderim sayısı, durum ve audit değişmez; e-posta çağrılmaz. Ham belirteç yanıta/loga eklenmez.
- Arayüz görünür liste kapsamını açıklar; yalnız staff.manage sahibi salt okunur açıklaması görür. Personel yönetimi izni değişince liste yeniden yüklenir. Sunucu denetimi arayüz düğmelerinden bağımsızdır.

## Migration ve sınırlar

Yeni `023_invitation_ownership.sql`, 021/022'yi değiştirmeden yeni sahiplik yardımcısını ve güncel resend/revoke fonksiyonlarını kurar. Fonksiyonlar SECURITY DEFINER + boş search_path kullanır; yalnız service_role EXECUTE hakkı vardır. Migration herhangi bir personele rol atamaz, davet göndermez ve mevcut davetleri toplu değiştirmez.

023, üretimde bu politikanın tam uygulanabilmesi için gereklidir. Yalnız uygulama kodunu yayımlamak SQL sahiplik kontrolünü kurmaz. **Canlı migration veya dağıtım yapılmadı.** Migration sırası mevcut kurulumun üzerine 019 → 020 → 021 → 022 → 023; canlı/prova işlemleri ayrıca ele alınır.

## Doğrulama

`invitation-ownership.test.mjs`: gerçek route/izin kapısı/servis/PGlite SQL döngüsünde aktör taklidiyle filtreyi aşma girişimi, aynı zamanlı sayfalama, başka davet kimliğine üç durumda erişim, e-posta/audit/belirteç değişmemesi, kendi süresi dolmuş daveti, yönetici erişimi, salt okuma, MFA ve doğrudan SQL/EXECUTE hakları. Mail ve oturum sağlayıcısı taklittir.

Test altyapısı invitation → role ilişki okumasını destekler; PostgREST tarih/UUID filtreleri metne zorlanmadan PostgreSQL türleriyle karşılaştırılır. PGlite tek bağlantılıdır; gerçek iki bağlantılı eşzamanlılık provası bu testin kapsamı değildir.
