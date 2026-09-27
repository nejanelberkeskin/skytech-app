# Genel Bakış: grup bazında okuma yetkisi

GET /api/admin/dashboard yalnız yetkili metrikleri döndürür. Her grubun tam kapsamlı izni gerekir: orders.read (sipariş/adet), batches.read (parti kuyruğu), sites.read (saha/kapasite), requests.read (talepler), invoices.read (fatura kuyruğu), finance.read (para/iade). B2B mevcut eski API/menü sınırına bağlı SUPER_ADMIN/FINANCE rolünü korur; özel finans rolü B2B açmaz.

DTO lib/admin/dashboard-dto.ts. Alan yokluğu sıfır değildir; raw overview dönmez. Boş izinli kişi boş özet kabuğu ve izinli navigasyon görür, operasyon sorgusu yapılmaz. Yetkili sorgu hatası503+no-store. Gerçek exact/headcount eksik/null/geçersizse503; yetkisiz tablo okunmaz. B2B exactcount; yalnız yayındaki sahalar id sıralı tüm sayfalardan okunur. İlk1000satır raporu sessizce kesmez.

UI izin/kimlik değişince veriyi aynı render'da bırakır; abort ve istek nesli eski yanıtı engeller.503/bozuk200sonrası eski rakam kalmaz; gerçek0 gösterilir; toplam bekleyen iş yerine ayrı izinli kuyruk kartları vardır. Grafikler finans ve sipariş izinlerini ayrı uygular. Ayrıntı bağlantıları mevcut canVisit kapısıyla filtrelenir. Taklit tarayıcı testi yetki azalırken gecikmiş başarılı yanıtı özellikle sınar.

Doğrulama: 164test; yeni16sunucu dashboard testi,4eski-personel emeklilik testi; mobil dahil11tarayıcı kontrolü. Aynı pakette /api/admin/users 410oldu, docs/legacy-users-retirement.md.

Sınırlar: sahaların çok sayfalı okuması tek transaction snapshot değildir; eşzamanlı ekleme/silmede görünüm yeni yenilemeyle düzelir. Finans RPC'sinin mevcut normalizeOverview eksik sayıyı0yapma davranışı ayrı borçtur. Henüz taşınmamış eski modüller yeni özelrole açılmaz; Genel Bakış görmek hedef modülde işlem yetkisi vermez. Canlı veritabanı/migration/yetki değişikliği yok.
