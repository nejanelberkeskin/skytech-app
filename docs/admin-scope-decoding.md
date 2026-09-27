# Etkili yetki yanıtında varsayılan ret

`toEffectiveAccess` veritabanının `admin_effective_permissions` yanıtını okur. Eksik veya tanınmayan kapsam daha önce `all` olabiliyordu; `null` izin/rol satırı da çözümlemeyi çökertiyordu. İstemciden bu yanıtın doğrudan değiştirilebildiğine ilişkin bir bulgu yoktur. Bu düzeltme bozuk/veri sözleşmesine uymayan RPC yanıtının yetki genişletmesini önler.

- Bütün kayıtlar erişimi yalnız açık `{ kind: "all" }` ile verilir.
- Saha kapsamı boş olmayan, tamamı boş olmayan metin kimliklerinden oluşan dizi ister. Kimlikler String() ile dönüştürülmez. Gerçek saha varlığı ve UUID doğrulaması yazma sözleşmesinin sorumluluğudur.
- Bilinmeyen/eksik kapsam, null/ilkel izin ve rol satırları elenir. Kapsamsız kalan izin erişim vermez; geçerli diğer kapsamlar kaybolmaz.
- Geçerli `all`, `sites`, `assigned`, rol sürümü ve süre bilgisi değişmez. İzin adı yalnız tanınan bir metin olabilir.
- Tekil ve çoğul gerçek sunucu kapıları bozuk kapsamla `forbidden` döner. Bozuk kapsam yanında geçerli dar kapsam varsa tam erişim isteyen uç `scope_unsupported` döner; dar kapsamı uygulayan uç kendi kayıt süzgecini uygulamak üzere erişimi alır.

Kanıt: `scripts/test/permission-scope-decoding.test.mjs`. 17 bozuk kapsam örneği; null satırlar; geçerli karma kapsamın korunumu; açık all; gerçek requirePermission/requireAnyPermission. Oturum ve RPC yanıtı taklit, çözümleyici ve kapı gerçek kaynak kodudur. Yeni migration, canlı DB/erişim işlemi veya arayüz değişikliği gerektirmez.
