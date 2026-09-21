# Skytech Green — Claude Code Handoff Belgesi

> **Tarih:** 16 Mart 2026
> **Amaç:** Bu belge, Cowork modunda yapılan tüm geliştirmelerin özetini, mevcut dosya durumlarını, veritabanı şemasını ve devam edilmesi gereken işleri Claude Code'a aktarmak için hazırlanmıştır.

---

## 1. Proje Genel Bilgisi

- **Framework:** Next.js 16 App Router (`async params`, Server + Client components)
- **Auth:** Supabase Auth — `createSupabaseServer()` (cookie RLS), `createServiceRoleClient()` (RLS bypass)
- **Ödeme:** Iyzico 3D Secure + Checkout Form
- **E-posta:** Resend (fire-and-forget)
- **Veritabanı:** Supabase PostgreSQL (JSONB metadata, RLS)
- **Deploy:** Vercel

---

## 2. Tamamlanan Geliştirmeler (Kronolojik)

### 2.1 — Orphaned Order Fix (Misafir Sipariş Sahiplendirme)

**Sorun:** Misafir kullanıcı ödeme yapıp hesap oluşturduğunda, sipariş `user_id = null` kalıyordu.

**Çözüm zinciri:**

| Dosya | Değişiklik |
|-------|-----------|
| `app/api/auth/claim-order/route.ts` | **YENİ** — Service-role POST endpoint. userId + orderId alır, email eşleştirme güvenlik kontrolü yapar, `orders.user_id`, `payments.user_id` günceller, `profiles` upsert eder |
| `app/checkout/success/page.tsx` | Tek şifre input'lu kayıt formu. `signUp` → `claim-order` → `router.push('/hesabim')` |
| `middleware.ts` | `/api/auth/` PUBLIC_API_PREFIXES'e eklendi |

### 2.2 — Token Tabanlı Callback Lookup

**Sorun:** Iyzico'nun `result.conversationId` alanı zaman zaman `undefined` dönüyordu → sipariş bulunamıyordu.

**Çözüm:**

| Dosya | Değişiklik |
|-------|-----------|
| `app/api/payment/callback/route.ts` | `metadata->>iyzico_token = token` PostgreSQL JSONB sorgusu ile ödeme kaydı bulunur. `conversationId`'ye hiçbir bağımlılık yok |
| `app/api/payment/guest-checkout/route.ts` | `iyzico_token: result.token` metadata'ya kaydedildi |
| `app/api/payment/b2b-checkout/route.ts` | Aynı token kayıt mantığı eklendi |

### 2.3 — E-posta Bloklama Fix

| Dosya | Değişiklik |
|-------|-----------|
| `app/api/payment/callback/route.ts` | `resolve(NextResponse.redirect(...))` e-posta IIFE'den ÖNCE çağrılır. E-posta fire-and-forget — Resend hatası redirect'i asla bloke edemez |

### 2.4 — UX İyileştirmeleri

| Dosya | Değişiklik |
|-------|-----------|
| `app/bireysel/odeme/page.tsx` | Telefon placeholder `"+905xxxxxxxxx"` → `"5XX XXX XX XX"` |
| `app/hesabim/siparislerim/page.tsx` | Koyu tema tamamen açık temaya dönüştürüldü (bg-white, text-gray-900, vb.) |
| `app/checkout/success/page.tsx` | `siparis_no` URL parametresinden okunup "Sipariş Takip Numarası" olarak gösteriliyor |

### 2.5 — Sipariş Takip Numarası (STG-XXXXXX)

| Dosya | Değişiklik |
|-------|-----------|
| `app/api/payment/callback/route.ts` | Başarılı ödeme sonrası `STG-` + 6 karakter random ID üretilir, `orders.metadata.siparis_no`'ya yazılır, redirect URL'ine `siparis_no` parametresi eklenir |
| `app/checkout/success/page.tsx` | `searchParams.get("siparis_no")` okunur ve gösterilir |
| `app/hesabim/siparislerim/page.tsx` | Kart başlığında `metadata.siparis_no` varsa gösterilir |

### 2.6 — E-posta Onay Banner'ı

| Dosya | Değişiklik |
|-------|-----------|
| `app/hesabim/layout.tsx` | `user.email_confirmed_at` null ise tüm hesabım sayfalarının üstünde amber renkli "E-postanızı onaylayın" banner'ı gösterilir. "Tekrar Gönder" butonu `supabase.auth.resend()` çağırır |

### 2.7 — Telefon Sync (Claim-Order)

| Dosya | Değişiklik |
|-------|-----------|
| `app/api/auth/claim-order/route.ts` | `payments.metadata.buyer_phone` okunur, `profiles.phone` alanına upsert edilir |
| `app/api/payment/guest-checkout/route.ts` | `buyer_phone: buyer.phone` metadata'ya eklendi |

### 2.8 — Dashboard İstatistikleri (Anında Yansıma)

| Dosya | Değişiklik |
|-------|-----------|
| `app/hesabim/page.tsx` | Tüm siparişler çekilir (limit yok). `payment_status = 'paid'` VEYA `status IN ('confirmed','preparing','shipped','delivered','planted')` olanların tohum toplamı alınır. Karbon = tohum × 0.025 Ton. Sertifika sayısı `certificates` tablosundan `count: "exact"` ile çekilir. `Promise.all` ile paralel sorgu |

### 2.9 — Arazi Ekimlerim Statü Değişikliği

| Dosya | Değişiklik |
|-------|-----------|
| `app/hesabim/rezervasyonlar/page.tsx` | `confirmed/preparing` → "Drona Yükleniyor 🚁" (yeşil), `planted/delivered` → "Toprakla Buluştu 🌱" (yeşil), `reserved` → "Rezerve — Ödeme Bekleniyor" (sarı). Sorgu artık `order_type IN ('reservation','gift')` — hediye siparişler de listede. `metadata.siparis_no` ve `metadata.gift_recipient_name` gösteriliyor |

### 2.10 — Otomatik Sertifika Oluşturma

| Dosya | Değişiklik |
|-------|-----------|
| `app/api/payment/callback/route.ts` | Fire-and-forget bloğunda: `orderData.user_id` varsa (giriş yapmış kullanıcı) → `certificates` tablosuna upsert. Rezervasyon siparişlerinde `order_allocations → lands.name` join ile `forest_name` belirlenir |
| `app/api/auth/claim-order/route.ts` | Misafir akışında (guest checkout → claim-order): Profiles upsert'ten sonra aynı mantıkla sertifika oluşturulur. `onConflict: "order_id"` ile çift kayıt önlenir |

### 2.11 — Arazi Satış Listeleme Mantığı

| Dosya | Değişiklik |
|-------|-----------|
| `app/bireysel/satin-al/arazi/page.tsx` | **Tamamlanma kuralı:** `filled_seeds >= capacity_seeds VE reserved_seeds === 0`. Tohum limiti dolsa bile içeride rezerve tohum varsa arazi "Aktif Satışta" kalmaya devam eder. Yeni `isReserveFull` state: amber rozet "Rezerve Bekleniyor", kart disabled ama listede görünür. `CompletedLandsBanner` da aynı kurala uyar |

---

## 3. Veritabanı Şeması

### orders
```
id              UUID (PK)
user_id         UUID | null        — misafir siparişlerde null, claim-order'da güncellenir
buyer_email     text
order_type      text               — "physical" | "reservation" | "gift"
status          text               — "pending" | "reserved" | "confirmed" | "preparing" | "shipped" | "delivered" | "planted" | "expired" | "released"
payment_status  text               — "pending" | "paid"
total_seeds     integer
total_price     numeric
shipping_address text | null
metadata        JSONB              — { siparis_no, gift_recipient_name, ... }
is_subscription boolean
created_at      timestamptz
updated_at      timestamptz
-- Kargo alanları:
shipping_status text | null
courier_company text | null
tracking_number text | null
tracking_url    text | null
shipped_at      timestamptz | null
delivered_at    timestamptz | null
```

### payments
```
id                UUID (PK)
order_id          UUID (FK → orders)
user_id           UUID | null
amount            numeric
currency          text             — "TRY"
provider          text             — "iyzico"
status            text             — "pending" | "success" | "failed"
iyzico_payment_id text | null
payment_method    text             — "credit_card"
metadata          JSONB            — {
                                      iyzico_token,
                                      checkout_type ("guest" | "b2b"),
                                      buyer_email,
                                      buyer_name,
                                      buyer_phone,
                                      quote_id (B2B),
                                      cardType,
                                      lastFourDigits,
                                      installment,
                                      iyziCommissionFee,
                                      fraudStatus
                                    }
created_at        timestamptz
updated_at        timestamptz
```

### profiles
```
id            UUID (PK = auth.users.id)
full_name     text | null
email         text
phone         text | null
avatar_url    text | null
address       text | null
city          text | null
referral_code text | null
earned_seeds  integer
created_at    timestamptz
updated_at    timestamptz
```

### certificates
```
id              UUID (PK)
user_id         UUID (FK → auth.users)
order_id        UUID (FK → orders)   — UNIQUE constraint (çift kayıt önler)
recipient_name  text
tree_count      integer
forest_name     text
certificate_url text | null
created_at      timestamptz
```

### lands
```
id              UUID (PK)
name            text
region          text | null
capacity_seeds  integer
filled_seeds    integer
reserved_seeds  integer
status          text
is_public       boolean
created_at      timestamptz
```

### order_allocations
```
id               UUID (PK)
order_id         UUID (FK → orders)
land_id          UUID (FK → lands)
seeds_allocated  integer
status           text
created_at       timestamptz
```

### corporate_quotes
```
id                   UUID (PK)
user_id              UUID
company_name         text
contact_person       text
corporate_email      text
phone                text
tax_office, tax_no   text
need_types           text[]
need_details         text | null
seed_count           integer
budget_range         text | null
timeline             text | null
notes                text | null
status               text   — "PENDING" | "QUOTED" | "PAID" | "REJECTED" | "EXPIRED"
approved_price       numeric | null
approved_seed_count  integer | null
admin_note           text | null
quoted_at            timestamptz | null
quoted_by            UUID | null
paid_at              timestamptz | null
payment_id           UUID (FK → payments) | null
order_id             UUID (FK → orders) | null
created_at, updated_at timestamptz
```

### seed_catalog
```
id             UUID (PK)
slug           text (UNIQUE)
name           text
latin_name     text
emoji          text
color          text
description    text
price          numeric  — TL/tohum
stock          integer
max_order_qty  integer
is_active      boolean
sort_order     integer
created_at, updated_at timestamptz
```

### system_settings
```
id                        UUID (PK)
reservation_ttl_minutes   integer
maintenance_mode          boolean
overflow_tolerance_pct    numeric
updated_at                timestamptz
updated_by                UUID | null
```

---

## 4. Middleware Konfigürasyonu

```typescript
// middleware.ts
const PUBLIC_API_PREFIXES: string[] = [
  "/api/payment/",   // Iyzico guest-checkout, 3DS callback, webhook
  "/api/public/",    // Herkese açık veri endpoint'leri
  "/api/auth/",      // claim-order — signUp sonrası session henüz yok
];
```

Bu prefix'lerle başlayan route'lar `updateSession` middleware'ini atlar → `NextResponse.next()` döner.

---

## 5. Kritik Akışlar

### 5.1 — Misafir Ödeme → Hesap Oluşturma

```
1. Kullanıcı ödeme yapar (guest-checkout → Iyzico form)
2. Iyzico callback gelir → token ile payments bulunur
3. payments güncellenir (status: success)
4. orders güncellenir (payment_status: paid, status: confirmed)
5. siparis_no üretilir → orders.metadata.siparis_no
6. Redirect → /checkout/success?status=success&order_id=X&siparis_no=STG-XXXXXX
7. Kullanıcı şifre belirler → supabase.auth.signUp()
8. fetch("/api/auth/claim-order") → orders.user_id, payments.user_id güncellenir
9. profiles upsert (full_name, email, phone)
10. Sertifika oluşturulur (certificates tablosuna insert)
11. router.push("/hesabim")
```

### 5.2 — Giriş Yapmış Kullanıcı Ödeme

```
1. Kullanıcı ödeme yapar
2. Iyzico callback → ödeme başarılı
3. orders/payments güncellenir + siparis_no
4. Fire-and-forget: e-posta + sertifika (user_id zaten mevcut)
5. Redirect → /checkout/success
6. Kullanıcı hesabıma gider → sertifika, tohum sayısı, karbon hepsi hazır
```

### 5.3 — B2B Akış

```
1. Teklif oluşturulur (corporate_quotes)
2. Admin onaylar (status: QUOTED, approved_price/seed_count set)
3. Müşteri ödeme yapar (b2b-checkout → iyzico_token kaydedilir)
4. Callback → corporate_quotes status: PAID
5. Redirect → /kurumsal/panel/odeme
```

### 5.4 — Arazi Satış Tamamlanma Kuralı

```
isFull = filled_seeds >= capacity_seeds AND reserved_seeds === 0
- filled < capacity → "Açık Proje" (yeşil)
- filled >= capacity AND reserved > 0 → "Rezerve Bekleniyor" (amber, aktif satışta kalır)
- filled >= capacity AND reserved === 0 → "Tamamlandı" (üst banner'a geçer)
```

---

## 6. Değiştirilen Dosyaların Tam Listesi

### Yeni Dosyalar
- `app/api/auth/claim-order/route.ts`

### Büyük Değişiklik Yapılan Dosyalar
- `app/api/payment/callback/route.ts` — token-based lookup, siparis_no, otomatik sertifika
- `app/checkout/success/page.tsx` — tek şifre input, claim-order fetch, siparis_no gösterimi
- `app/hesabim/siparislerim/page.tsx` — koyu tema → açık tema, metadata/siparis_no desteği
- `app/hesabim/page.tsx` — dashboard istatistikleri: tüm paid siparişler, sertifika sayısı
- `app/hesabim/rezervasyonlar/page.tsx` — yeni statü etiketleri, gift order desteği
- `app/bireysel/satin-al/arazi/page.tsx` — isFull/isReserveFull mantığı, CompletedLandsBanner

### Küçük Değişiklik Yapılan Dosyalar
- `app/hesabim/layout.tsx` — emailConfirmed state, onay banner'ı
- `app/bireysel/odeme/page.tsx` — telefon placeholder
- `app/api/payment/guest-checkout/route.ts` — buyer_phone metadata eklendi
- `app/api/payment/b2b-checkout/route.ts` — iyzico_token metadata eklendi
- `app/api/payment/status/route.ts` — buyer_name response'a eklendi
- `middleware.ts` — `/api/auth/` public prefix eklendi

---

## 7. Bilinen Sorunlar & Dikkat Edilecekler

1. **`updated_at` sütunu:** `orders` ve `payments` tablolarında `updated_at` sütunu DB'de olmayabilir. Callback'te kullanılıyor ama claim-order'dan çıkarıldı. DB migration ile eklenmediyse callback'te de hata verebilir (şu an log'a yazılıp geçiliyor).

2. **`certificates.order_id` UNIQUE constraint:** Upsert'ler `onConflict: "order_id"` kullanıyor. Bu constraint DB'de yoksa oluşturulmalı:
   ```sql
   ALTER TABLE certificates ADD CONSTRAINT certificates_order_id_unique UNIQUE (order_id);
   ```

3. **`orders.metadata` JSONB sütunu:** siparis_no bu sütunda saklanıyor. Eğer `metadata` sütunu `orders` tablosunda yoksa:
   ```sql
   ALTER TABLE orders ADD COLUMN metadata JSONB DEFAULT '{}';
   ```

4. **`profiles.phone` sütunu:** claim-order'da phone upsert ediliyor. Yoksa:
   ```sql
   ALTER TABLE profiles ADD COLUMN phone TEXT;
   ```

5. **Supabase Email Confirmation:** Şu an KAPALI (Supabase Dashboard → Authentication → Settings). `signUp` anında session oluşuyor → `router.push('/hesabim')`. AÇIK olursa `isVerificationSent` state tekrar eklenmeli.

6. **Resend Domain Doğrulama:** Dev ortamda onaysız domain hatası alınabiliyor. Fire-and-forget sayesinde bloke etmiyor ama prod'da domain doğrulanmalı.

7. **Gift Orders:** `order_type: "gift"` henüz checkout akışında tam set edilmiyor olabilir. Arazi sayfasında hediye seçeneği var ama `order_type` API tarafında `reservation` olarak kalıyor olabilir. Doğrulanmalı.

---

## 8. Supabase Tipler Dosyası

Proje `lib/types.ts` dosyasında aşağıdaki tipleri kullanıyor:

```typescript
interface Land {
  id: string;
  name: string;
  region: string | null;
  capacity_seeds: number;
  filled_seeds: number;
  reserved_seeds: number;
  status: string;
  is_public: boolean;
}

type ShippingStatus = "pending" | "preparing" | "shipped" | "delivered";

interface GiftInfo {
  recipientName: string;
  recipientEmail: string;
  giftNote: string;
}
```

---

## 9. Önemli Teknik Kararlar

| Karar | Neden |
|-------|-------|
| Token-based lookup (conversationId yerine) | Iyzico conversationId undefined dönebiliyor |
| Fire-and-forget e-posta | Resend hatası redirect'i bloke etmesin |
| Sertifika: callback + claim-order iki yol | Logged-in user callback'te alır, guest user claim-order'da alır |
| `onConflict: "order_id"` | Aynı sipariş için çift sertifika önlemi |
| Metadata merge (spread) | Mevcut metadata ezilmesin: `{ ...existingMeta, yeniAlan }` |
| `siparis_no` metadata'da (dedicated column değil) | Schema migration gerektirmeden hızlı ekleme |
| `email_confirmed_at` banner | Supabase Auth'un native alanını kullanır |

---

## 10. Dosya Yapısı (İlgili Kısım)

```
app/
├── api/
│   ├── auth/
│   │   └── claim-order/route.ts       ← YENİ
│   ├── payment/
│   │   ├── callback/route.ts          ← BÜYÜK DEĞİŞİKLİK
│   │   ├── guest-checkout/route.ts    ← metadata güncelleme
│   │   ├── b2b-checkout/route.ts      ← token kayıt
│   │   └── status/route.ts            ← buyer_name eklendi
│   └── orders/
│       └── reserve/route.ts
├── bireysel/
│   ├── odeme/page.tsx                 ← telefon placeholder
│   └── satin-al/
│       └── arazi/page.tsx             ← isFull/isReserveFull mantığı
├── checkout/
│   └── success/page.tsx               ← guest register, siparis_no
├── hesabim/
│   ├── layout.tsx                     ← email banner
│   ├── page.tsx                       ← dashboard stats fix
│   ├── rezervasyonlar/page.tsx        ← statü etiketleri
│   ├── sertifikalar/page.tsx          ← (değişiklik yok, sertifikaları listeler)
│   └── siparislerim/page.tsx          ← açık tema + siparis_no
└── middleware.ts                       ← /api/auth/ public prefix
```

---

## 11. Talep Toplama + Üyelik Açılışı (15 Eylül 2026)

Ödeme ve fiyatlandırma "çok yakında" kalırken üç talep akışı ve üyelik açıldı.
Ayrıntılı tasarım notları kod içi yorumlarda; burada haritası.

### Bayraklar — `lib/site-config.ts`
| Bayrak | Env | Varsayılan | Ne yapar |
|---|---|---|---|
| `TRANSACTIONS_ENABLED` | `NEXT_PUBLIC_TRANSACTIONS_ENABLED=true` | kapalı | Sipariş/ödeme/kurumsal panel rotalarını açar |
| `REQUESTS_ENABLED` | `NEXT_PUBLIC_REQUESTS_ENABLED=false` | açık | `/talep/*` talep toplama |
| `ACCOUNTS_ENABLED` | `NEXT_PUBLIC_ACCOUNTS_ENABLED=false` | açık | `/auth/*`, `/hesabim` |
| `GOOGLE_AUTH_ENABLED` | `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` | kapalı | Google ile giriş butonları (Supabase'de sağlayıcı kurulmadan açma) |

CTA hedefleri `orderCtaHref(kind)`, etiket seçimi `CTA_MODE` ("order" | "request" | "soon").
Üyelik açık, ödeme kapalıyken `/hesabim/(siparislerim|rezervasyonlar|sertifikalar|davet-et|davet-et-kazan|telemetri)` → `/hesabim`.

### Veritabanı — `supabase/migrations/014_service_requests.sql` (canlıda uygulandı)
- `service_requests`: talepler. Yazma yalnız service_role (API). Üye kendi satırını okur (RLS + sütun bazlı GRANT; `ip_hash`, `admin_note`, `client_token` sütun yetkisi dışında).
- `email_logs`: mail kayıtları (repoda vardı, canlıda yoktu).
- `handle_new_user()` + `on_auth_user_created`: auth.users INSERT → profiles satırı. Not: Supabase, public'teki yeni tablolara anon/authenticated'a varsayılan olarak TÜM yetkileri verir; her yeni tabloda açıkça `REVOKE` yapılmalı.

### Akış
1. `/talep` (merkez) → `/talep/tohum` · `/talep/arazime-ekim` · `/talep/acik-arazi` (vitrin, tr/en/ru, `components/vitrin/talep/*`).
2. `POST /api/public/talep` — zod şeması (`lib/requests/schema.ts`, istemciyle ortak), honeypot, doldurma süresi (<3 sn → `status='spam'`, mail yok), bellek içi + DB (ip_hash, 10/saat) rate limit, katalog/saha canlı doğrulama, `clientToken` idempotency, 20 KB gövde sınırı, `user_id` yalnız oturumdan. Yanıt yalnız `{ requestNo, requestId }`.
3. E-postalar `after()` ile yanıt sonrası: şirkete bildirim (`REQUEST_NOTIFY_EMAIL` → `CONTACT_NOTIFY_EMAIL` → info@skytechgreen.com, reply-to talep sahibi) + talep sahibine tr/en onay.
4. Admin: `/admin/talepler` (SUPER_ADMIN, FINANCE, OPERATIONS) — filtre/arama, detay, durum + not (`PATCH /api/admin/requests`, audit log). Pano: "Bekleyen Talep".
5. Hesap: `/hesabim` talep özeti, `/hesabim/taleplerim`. Misafir talebi → `?talep=<uuid>` ile kayıt/giriş → `POST /api/auth/claim-request` (e-posta eşleşmesi şart).
6. Auth: `/auth/sifremi-unuttum`, `/auth/sifre-yenile`; `GET /api/auth/confirm` (token_hash, cihazdan bağımsız), `GET /api/auth/callback` (PKCE / OAuth).

### Supabase panelinde yapılması gerekenler (kod dışı)
- Authentication → URL Configuration: Site URL `https://skytechgreen.com`, Redirect URLs `https://skytechgreen.com/**`, `https://*.vercel.app/**`, `http://localhost:3000/**`.
- E-posta doğrulama canlıda AÇIK (bu belgenin 7.5 maddesi eskimiş). Yerleşik SMTP saatte birkaç mail ile sınırlı → Resend SMTP tanımlanmalı (`smtp.resend.com`, kullanıcı `resend`, şifre = API anahtarı, gönderen `noreply@skytechgreen.com`).
- E-posta şablonlarını cihazdan bağımsız çalışması için `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/sifre-yenile` (Reset Password) ve `…&type=signup&next=/hesabim` (Confirm signup) biçimine çevirin.
- Security: "Leaked password protection" açın (advisor uyarısı).

### Test
- Mail göndermeden test: `.env.development.local` içine `RESEND_API_KEY=` (boş) koyup dev sunucuyu çalıştırın; `[mail] RESEND_API_KEY not set — skipping` loglanır. Test kayıtları `contact_name LIKE 'TEST%'` ile silinir.
- `npm run i18n:check` — tr/en/ru anahtar eşitliği.

---

## 12. Satış Modeli v2 — Talep Akışının Yeniden Kurulması (21 Eylül 2026)

Müşteri revizyonu (18 Eylül 2026): **doğrudan tohum satışı yok.** İki yol kaldı:
(1) Proje Uygulama Sahasına tohum topu bıraktırma, (2) kendi arazim için başvuru.
Bağlayıcı sözlük ve ana plan depo dışında: `web-brifler/03-…ANA-PLAN.md`, `04-…SOZLUGU.md`.
Bu bölüm 11. bölümdeki akış tarifinin yerine geçer.

### Akış
- Sitedeki bütün "Talep Oluştur / Satın Al" çağrıları → `/talep/acik-arazi` (saha listesi + form).
  Üstte küçük bağlantı: "Kendi arazim için işlem yaptırmak istiyorum" → `/talep/arazime-ekim`.
- `/talep` (seçim sayfası) ve `/talep/tohum` (tohum talebi) **kaldırıldı**; middleware 307 ile
  sahalara yönlendirir (`RETIRED_REQUEST_REDIRECTS`, dil öneki korunur). `seed_purchase` türü
  API'de artık reddedilir; DB kısıtında eski kayıtlar için durur (`ACTIVE_REQUEST_TYPES` yeni türler).
- `orderCtaHref()` artık eski `/bireysel/*` akışına hiçbir koşulda gitmez.
- `?saha=<slug>` ile gelen ziyaretçide o saha seçili açılır (`lib/sites/links.ts → siteOrderHref`).

### Saha ve sertifika sayfaları (GPT-6 Astra, PR #26 · #27)
- `/sahalar` liste, `/sahalar/[slug]` ayrıntı (`components/vitrin/sahalar/*`), `SeasonTimeline`
  (`components/vitrin/shared/`, `full` | `compact`). Veri: `lib/sites/data.ts`; bağlantılar yalnız `lib/sites/links.ts`.
- `/sertifika/[kod]` doğrulama sayfası (noindex) + `GET /api/public/katilim-sertifikasi/[kod]/gorsel?b=dikey|yatay&dil=tr|en|ru`
  (`next/og`, 1080×1350 ve 1200×630). Yerleşim ve arka plan: `lib/certificates/layout.ts` — müşterinin sertifika görseli
  gelince `public/images/sertifika/` altına konur, `CERT_BACKGROUND` ve koordinatlar güncellenir. Fontlar `assets/fonts/`
  (Noto Sans, OFL); dosya izine girdiği build çıktısında doğrulandı. Canlıda veri kaynağı henüz `null` döner (Faz 7).
- Çapraz bağlantılar: talep formundaki saha kartı → saha sayfası (yeni sekme), `/projeler` → `/sahalar`, alt bilgi → `/sahalar`.
  Eski `(uygulama)/sertifika/[id]` sayfası kaldırıldı.

### Kurallar — tek kaynak
| Ne | Nerede |
|---|---|
| Birim bedel (10 TL, KDV dâhil, kuruş tam sayı), en az 20 / en çok 100.000, hazır adetler 50·100·200·500·5000 | `lib/pricing.ts` |
| Fiyatı formda gizleme | `NEXT_PUBLIC_PRICING_VISIBLE=false` (varsayılan: görünür) |
| Sertifikadaki ad: 2–60 karakter, harf/rakam/temel noktalama | `lib/requests/schema.ts → certificateNameSchema` |
| Saha verisi (hektar var, adet/kapasite YOK), tür müşteri tarafından seçilmez | `lib/sites/*` (migration 015) |
| E-posta / hesabım / admin etiketleri | `lib/requests/labels.ts` |

- Tahmini tutar istemciden alınmaz; API `details.unitPriceKurus` ve `estimatedTotalKurus` alanlarını
  kendi hesaplayıp talebe yazar (müşterinin gördüğü fiyatın anlık kopyası; bağlayıcı değil).
- Onay kutusu "açık rıza" dilinden çıkarıldı (`CONSENT_VERSION = "2026-09-21"`): talebe dönüş için
  veri işleme rızaya dayanmaz; ticari ileti izni sipariş akışında ayrı ve isteğe bağlı alınacak.
- Sayı/para biçimleri bilinçli olarak `Intl` kullanmaz (`formatCount`, `formatTry`, `formatHectares`):
  Node ile tarayıcı ICU'su ayrışınca hydration uyuşmazlığı çıkıyordu.

### Yönetim — saha formu (Faz 2b)
- `/admin/araziler` ("Sahalar & Kapasite"; SUPER_ADMIN, ENGINEER): il/ilçe, sayfa adresi, hektar, Yangın Sahası + yıl,
  çalışma türü, sahaya bırakılan tür(ler), evre, yayın, sıra, kapasite, EN/RU ad, TR/EN/RU tanıtım, kapak, YouTube videosu.
- Şema panel ve API'de ORTAK: `lib/sites/admin.ts` (migration 015 kısıtlarıyla birebir). Adres boşsa addan üretilir
  (`lib/sites/slug.ts`), çakışırsa `-2`, `-3`… eklenir. Tür seçimi katalogla doğrulanır.
- "Yayından al / Yayına al" yalnız `is_public`'i değiştirir; evreye dokunmaz (`full` artık vitrinde "Kontenjan doldu").
- Eski "Tahmini Karbon" kartı kaldırıldı (doğrulanmamış katsayı). Kapasite sayıları yalnız bu ekranda görünür.

### Sipariş çekirdeği — temel (Faz 3a; arayüz yok, hiçbir yerden çağrılmıyor)
- `supabase/migrations/016_release_orders.sql` — **canlıya uygulandı (21 Eyl 2026, `release_orders_016`)**; önce canlıda geri alınan bir denemeyle 33 denetimden geçti. Deneme siparişleri `is_test=true` ile işaretlenir (oluştuktan sonra değişmez) ve yalnız onlar `purge_test_orders()` ile silinebilir; gerçek siparişler, belgeler ve olaylar silinemez/değiştirilemez. Fatura bilgisi (`invoice`) üyenin sütun yetkisi dışında. `sales_settings`, `release_batches`,
  `release_orders`, `order_documents` (değişmez), `order_events` (değişmez), `order_refunds`, `order_invoices`;
  kapasite işlevleri (satır kilidi), RLS + sütun bazlı yetki. Eski `orders/payments/certificates` tablolarına dokunmaz.
- `lib/orders/types.ts` durumlar ve alan sözlüğü · `state.ts` durum makinesi (`assertTransition`, `canWithdraw`) ·
  `schedule.ts` takvim (sezon 1 Eki–31 Mar, cayma 14 gün, hazırlık payı 21 gün, yetişmeyen sipariş sonraki sezona;
  İstanbul saatiyle) · `identifiers.ts` sipariş no `SG-YYYY-XXXXXX` ve sertifika kodu (yalnız sunucu) ·
  `tax-ids.ts` TCKN/VKN sağlaması · `schema.ts` sihirbazın ortak zod şeması (alıcı, Bireysel/Kurumsal fatura,
  ayrı onay kutuları; **tutar alanı yok** — sunucu hesaplar).
- [MM] bekleyen varsayımlar migration'da işaretli: KDV %20, fatura zamanı `on_performance`.

### Hukuki belgeler (Faz 3b)
- `lib/legal/`: belge = düz metin bloklarının listesi (`types.ts`). AYNI bloklardan `render-html.ts` (deterministik,
  kaçışlı; siparişe özel DEĞİŞMEZ kopya + SHA-256) ve `render-pdf.ts` (jsPDF + gömülü Noto Sans; yalnız sunucu) üretir.
  Şablonlar `templates/`: `pre-info.ts`, `contract.ts`, `withdrawal-form.ts`; iki belgede de geçen cümleler tek yerde
  (`templates/shared.ts → TEXT`) durur, hukuk sayfaları da oradan okur → metinler birbirinden ayrışamaz.
- `version.ts`: `LEGAL_DOCUMENTS_VERSION`. "-taslak" ekliyken (hukuk incelemesi bitmeden) canlı sitede sipariş alınmaz;
  yalnız deneme sağlayıcısıyla, canlı site dışında deneme siparişi oluşturulabilir (kural: `lib/orders/gate.ts`).
  Metin değişince sürüm artırılır; eski sürümü görmüş müşteri `documents_stale` alır ve yeniden onaylar.
- `documents.ts`: `buildLegalContext()` + `buildOrderDocuments()` — önizleme ile sipariş kopyası aynı işlevden çıkar.
  Bireyselde T.C. kimlik no belgeye YAZILMAZ. Kurumsal alıcıda 6502 uygulanmaz ama 14 gün cayma sözleşmesel tanınır, yetki Ankara.
- Hukuk sayfaları (`/on-bilgilendirme`, `/mesafeli-satis-sozlesmesi`, `/cayma-ve-iade`, `/ifa-kosullari`, `/islem-rehberi`)
  ve örnek PDF ucu (`/api/public/hukuk/ornek/[belge]`): canlıda yalnız `NEXT_PUBLIC_LEGAL_PAGES_ENABLED=true` iken;
  geliştirmede ve Vercel önizlemesinde her zaman (`lib/legal/visibility.ts`). Taslakken `noindex`, sitemap'te yok.
- `lib/company.ts`: satıcı künyesi tek kaynak; `missingCompanyFields()` açılış kontrolü.
- Testler: `npm test` (Node'un yerleşik koşucusu + `scripts/test/alias-loader.mjs`; derleme gerekmez).
  `LEGAL_DRAFTS_DIR=<klasör> npm test` örnek HTML + PDF çıktılarını yazar (avukat incelemesi için).

### Sipariş kaydı, ödeme akışı, cayma (Faz 3c)
**Akış:** sihirbaz → `POST /api/public/siparis/onizleme` (kesin tutar + takvim + belgeler; kayıt yok) →
`POST /api/public/siparis` (sipariş + kapasite + belgeler; yanıt `redirectUrl`) → ödeme sayfası → dönüş →
`/odeme/sonuc/<no>?t=` (onaylandı / tamamlanamadı + yeniden dene / süre doldu) → `/siparis/<no>?t=` (Astra, brif 08).

- **Kapı — `lib/orders/gate.ts`:** satış bayrağı + yapılandırılmış ödeme sağlayıcısı + (metinler taslakken) yalnız deneme
  siparişi ve yalnız canlı site dışında. Üç uç da (önizleme, sipariş, yeniden ödeme) aynı işlevi çağırır.
- **Ayarlar — `lib/orders/settings.ts`:** fiyat/KDV/asgari adet/hazırlık süresi/ödeme süresi `sales_settings` tablosundan.
  `quoteVersion()` = hukuki sürüm + fiyat + KDV + hazırlık süresi; önizleme bunu döner, sihirbaz `documentsVersion` olarak
  geri yollar. Arada biri değiştiyse `documents_stale` → müşteri güncel tutarı görüp YENİDEN onaylar.
  Sihirbazın anlık gösterimi `lib/pricing.ts` sabitlerinden; fiyat değişirse ikisi birlikte güncellenmeli (ayrışırsa log uyarısı).
- **Oluşturma — `lib/orders/create.ts`:** `clientToken` ile tek sipariş (çift tıklama/ağ tekrarı) → o sahadaki süresi dolmuş
  siparişleri kapat (tembel temizlik; ayrıca zamanlanmış iş Faz 6) → saha denetimi → kapasiteyi SATIR KİLİDİYLE ayır →
  `draft` sipariş → üç belgenin değişmez HTML kopyası + SHA-256 (`order_documents`) → olaylar: `order_created`,
  `consent_recorded` (her kutu: an + sürüm; IP özeti), `documents_generated` (belgelerin yapısal kaynağı da burada
  saklanır; PDF her zaman bu kaynaktan üretilir → şablon değişse de müşterinin onayladığı metin).
- **Ödeme — `lib/payments/` + `lib/orders/payment-flow.ts`:** sağlayıcı arayüzü `init / retrieve / refund`.
  `PAYMENT_PROVIDER=mock|iyzico` (yalnız sunucu). `mock`: `/odeme/deneme/<belirteç>` sayfası sanal POS'un yerini tutar,
  imzalı belirteç + imzalı sonuç; `VERCEL_ENV=production` iken ASLA çalışmaz; siparişler `is_test=true`.
  `iyzico`: bkz. Faz 4. Sağlayıcı yoksa `getPaymentProvider()` null → her şey "closed". Dönüşte sonuç SAĞLAYICIDAN sorgulanır,
  tahsil edilen tutar siparişle karşılaştırılır, durum koşullu UPDATE ile bir kez değişir (çift geri çağrı güvenli).
  - Cayma süresi ödeme anından başlar → `withdrawal_deadline` ödeme onayında yazılır.
  - Tahsil edilmiş ödeme sahipsiz kalmaz: yeniden başlatılan ödemede eski oturumun dönüşü `payment_started`
    olaylarındaki belirteç özetinden bulunur; `payment_failed` ve `expired` siparişe gelen onay da işlenir (geç ödemede
    kapasite yeniden ayrılır; ayrılamazsa `payment_meta.capacityHeld=false` + olay → yönetim incelemeli).
  - Aynı siparişe ikinci bir tahsilat gelirse `payment_succeeded {duplicate:true}` olayı yazılır → **Faz 5 yönetim
    ekranı bunu "iade edilecek tahsilat" olarak göstermeli.**
  - Dönüş adresi her sağlayıcı için `callbackUrl = /api/payment/donus` (bkz. Faz 4).
- **Erişim — `lib/orders/access.ts`:** misafir müşteri siparişine `?t=<HMAC>` ile erişir (numarayı bilmek yetmez); üye
  kendi siparişine oturumla. Anahtar `ORDER_LINK_SECRET` (**canlıya çıkmadan tanımlanmalı**; yoksa service role
  anahtarından türetilir — o anahtar döndürülürse e-postalardaki bağlantılar geçersizleşir).
- **Erişim çerezi:** sipariş sayfası belirteci adres çubuğundan siler; silmeden önce `POST /api/public/siparis/<no>/erisim`
  ile HttpOnly `sgo_<no>` çerezine çevirir (ödeme dönüş uçları çerezi doğrudan yazar). Böylece yenileme ve dil değişimi
  404 vermez. Çerez yeni yetki vermez: değeri aynı imza doğrulamasından geçer. Sayfalar ve belge/yeniden-ödeme uçları
  `?t=` yoksa çerezi okur (`lib/orders/access-cookie.ts`, `orderCookieName`).
- **Görünüm — `lib/orders/view-data.ts`:** `getOrderView(no, { token, userId })` gerçek kaydı `PublicOrderView`'a çevirir;
  ödenmemiş siparişin sayfası yoktur (null). Geliştirmede `?t=ornek` örnekleri durur.
  Belgeler: `GET /api/public/siparis/<no>/belge/<kind>?t=…&bicim=html|pdf` (HTML = saklanan kopya, CSP sandbox; önbellek yok).
- **E-posta — `lib/orders/after-payment.ts`, `lib/mail.ts`:** ödeme onayında müşteriye teyit (üç PDF ekli — "kalıcı veri
  saklayıcısı") + şirkete bildirim; `after()` ile yanıtı bekletmez. Sonuç `email_sent` / `email_failed` olayı.
  `RESEND_API_KEY` yoksa (yerel) gönderilmez, `email_logs`'a da yazılmaz; olay `email_failed {reason:"no_api_key"}`.
- **Cayma — `lib/orders/withdrawal.ts`, `POST /api/public/cayma`:** sipariş no + e-posta (eşleşmezse `not_found`, hangisinin
  yanlış olduğu söylenmez) → `paid → withdrawal_requested` + bekleyen `order_refunds` + olay + müşteriye DERHAL teyit.
  İadenin kendisi (sağlayıcı `refund()` → `refunded`, kapasiteyi geri ver, sertifika iptali) Faz 5 yönetim ekranında.
  `SALES_ENABLED` kapalıyken form da kapalıdır; satışı GEÇİCİ durdurmak gerekirse bayrağı kapatmak yerine
  `sales_settings`'e "sipariş alımı durduruldu" alanı eklenmeli (cayma hakkı açık kalmalı).
- Middleware: `/odeme/*` herkese açık sayfa (misafir müşteri). `/siparis/*` ve `/cayma` satırları Astra'nın PR'ında.
- Deneme verisi: geliştirmede oluşan siparişler CANLI veritabanına `is_test=true` olarak yazılır ve sahada kapasite
  tutar. Temizlik: `select public.purge_test_orders();` (kapasiteyi de geri verir) — **kullanıcı onayıyla**.

### iyzico sağlayıcısı (Faz 4)
- `lib/payments/iyzico.ts` — Ödeme Formu, iyzico'nun BARINDIRDIĞI sayfa (`paymentPageUrl`); kart verisi sunucumuza gelmez.
  `PAYMENT_PROVIDER=iyzico` + `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` / `IYZICO_BASE_URL`. Adres "sandbox" içeriyorsa
  `isTest=true` → siparişler deneme siparişi olur; canlı anahtarlarla gerçek sipariş. Eski akışla aynı SDK (`lib/iyzico.ts`).
  - `init`: tek kalem (`VIRTUAL`), `basketId` = sipariş no, `conversationId` = sipariş kimliği, **taksit kapalı** (`[1]` —
    iade "tek seferde"; taksit açılacaksa müşteri kararı + komisyon). Bireysel alıcı T.C. no vermediyse `11111111111`.
  - `retrieve`: `status=success` + `paymentStatus=SUCCESS` + `fraudStatus≠-1` → ödendi; tutar metni kuruşa kayan nokta
    olmadan çevrilir (`priceToKurus`), para birimi TRY ve `basketId` siparişle karşılaştırılır (`reference`).
    `fraudStatus=0` (iyzico incelemesinde) tahsil edilmiş sayılır; `payment_meta.fraudStatus` olarak görünür.
  - `refund`: tamamı — önce ödeme kimliğiyle iade (v2), olmazsa kalem kimliğiyle, o da olmazsa aynı gün iptali.
    Faz 5 yönetim ekranı çağıracak; henüz hiçbir yerden çağrılmıyor ve deneme ortamında SINANMADI.
- `POST /api/payment/donus` — iyzico müşterinin tarayıcısını başka kaynaktan POST ile buraya gönderir (gövde: `token`).
  CSRF'den muaf (`middleware.ts → CSRF_EXEMPT_PREFIXES`); güvenlik sonucun sunucudan sorgulanmasına dayanır. Her zaman
  303: `/odeme/sonuc/<no>?t=` ya da sipariş bulunamazsa `/odeme/hata` (genel sayfa, üç dil).
- Deneme ortamında doğrulanan: oturum açılışı (barındırılan sayfada doğru tutar), tamamlanmamış ödemenin dönüşü →
  `payment_failed`, yeniden deneme yeni oturum açar, tanınmayan/bozuk belirteç → hata sayfası, diğer uçlarda CSRF sürüyor.
  **Kart bilgisi girilmesi gereken başarılı ödeme adımını kullanıcı deneyecek** (iyzico deneme kartlarıyla).
- Canlıya geçişte: canlı anahtarlar + `IYZICO_BASE_URL=https://api.iyzipay.com`, iyzico panelinde dönüş alan adı,
  `ORDER_LINK_SECRET`, hukuki sürümden "-taslak" ekinin kalkması, `NEXT_PUBLIC_SALES_ENABLED=true`.

### Sihirbazın akışa bağlanması (Faz 4b; Astra'nın #31'i bu dalda birleşik)
- "Satın Al / Talep Oluştur" çağrıları artık **`/sahalar`**'a gider (`REQUEST_ROUTES.hub = openLand = "/sahalar"`); oradan
  sahanın sihirbazı `/sahalar/<slug>/katil` açılır. Eski `/talep/acik-arazi` (ve `/talep`, `/talep/tohum`) 307 ile
  `/sahalar`'a; eski `?saha=<slug>` bağlantıları doğrudan o sahanın sihirbazına yönlenir (middleware; slug biçimi doğrulanır).
  Eski açık arazi formu sayfası ve `OpenLandRequestForm` artık ULAŞILMAZ — Faz 8 temizliğinde silinecek.
- Sihirbazın kipi (sipariş / talep) bayraktan değil **sipariş kapısından** okunur (`lib/orders/gate.ts`): bayrak açık ama
  sağlayıcı yok ya da metinler taslak + canlı site ise sihirbaz çıkmaz sokağa girmez, talep kipinde açılır.
- Özet adımında tür girilmemiş sahada boş satır gösterilmez; TR dışı dillerde "belgeler Türkçe düzenlenir" notu.
- Alt bilgideki "Talep" hızlı bağlantısı kalktı (hedefi "Proje Uygulama Sahaları" ile aynı adresti).
- **Faz 9 notu:** `CTA_MODE` hâlâ eski bayrağa bakıyor; satış açıldığında çağrı metinleri ("Talep Oluştur" → katılım dili)
  gözden geçirilmeli.

### Yönetim — siparişler (Faz 5a)
- Modül `birakma` → `/admin/birakma-siparisleri` (kenar çubuğunda "Siparişler"; eski tohum satışı modülü "Eski Siparişler").
  Görüntüleme SUPER_ADMIN + FINANCE + OPERATIONS; **para ve fatura işlemleri SUPER_ADMIN + FINANCE**. OPERATIONS'a kimlik/vergi
  no maskeli gider. Her işlem `admin_audit_logs` + siparişin `order_events` izine (`admin:<uuid>`) yazılır.
- API: `GET /api/admin/release-orders` (liste, durum sayıları, uyarılar: iade bekleyen · fatura kesilecek · çift tahsilat ·
  kapasitesiz ödeme), `GET|POST /api/admin/release-orders/[id]` (ayrıntı + işlemler), `…/[id]/belge/[kind]` (müşteriye giden
  belgelerin aynısı). Liste açılırken tembel işler çalışır: süresi dolan ödenmemiş siparişler kapanır, cayma süresi dolan
  `paid` siparişler `confirmed` olur (`confirmDueOrders`; zamanlanmış iş Faz 6).
- İşlemler `lib/orders/admin-actions.ts`: `cancelBySeller` (→ bekleyen iade + müşteriye bildirim) · `executeRefund` (iade
  ÖDEMENİN ALINDIĞI sağlayıcıdan; iade satırı karşılaştır-ve-yaz ile sahiplenilir → eşzamanlı ikinci istek `in_progress`;
  başarıda `refunded`, kapasite serbest (`capacityHeld=false` ise dokunulmaz), sertifika iptal, müşteriye bildirim;
  kesilmiş faturası varsa **iade faturası** kuyruğa girer, kesilmemişse kuyruktaki fatura iptal olur) · `refundDuplicate` ·
  `queueInvoice` ("şimdi fatura kes") · `markInvoiceIssued` (fatura no / ETTN / tarih elle işlenir; e-fatura entegrasyonu yok).
- Arayüz: sayfa + `components/admin/ReleaseOrderDetail.tsx`. Para işlemleri tek adımlı onay ister (tutar düğmenin üstünde).
- Şirkete giden sipariş/cayma bildirimlerinde "Yönetim panelinde aç" bağlantısı (`?no=SG-…`).
- **Sınama:** işlemler canlı veritabanındaki DENEME siparişlerinde betikle sınandı (iade, satıcı iptali, eşzamanlı iade,
  çift tahsilat, fatura). Panel oturum gerektirdiği için sayfanın kendisi tarayıcıda DENENMEDİ (ayrıntı bileşeni geçici bir
  önizlemeyle görüldü) — kullanıcı deneyecek.

### Yönetim — bırakma partileri (Faz 5b)
- Modül `partiler` → `/admin/birakma-partileri`. Yönetim SUPER_ADMIN + OPERATIONS; FINANCE yalnız görüntüler.
- `lib/orders/batches.ts`: `createBatch` · `updateBatch` · `deleteBatch` (yalnız hiçbir siparişin bağlı olmadığı parti) ·
  `assignOrders` (yalnız `confirmed`, aynı saha + sezon, kapasitesi ayrılmış; biri uygunsuzsa hiçbiri alınmaz → `scheduled`) ·
  `unassignOrder` (→ `confirmed`) · `completeRelease` (**geri alınamaz**: parti `released_on` yalnız NULL iken yazılarak
  sahiplenilir → eşzamanlı ikinci istek işleyemez; siparişler `released`, `commit_reserved_capacity` ile kapasite kalıcıya
  geçer, fatura zamanı "bırakmada" ise fatura kuyruğu dolar). Bırakma tarihi ileri olamaz ve her siparişin cayma süresi
  o tarihten ÖNCE dolmuş olmalıdır.
- API: `GET|POST /api/admin/release-batches`, `GET|PATCH|POST|DELETE /api/admin/release-batches/[id]`.
  Liste ayrıca "partiye alınmayı bekleyen" siparişleri saha × sezon olarak verir.
- Sipariş ayrıntısına `reserve_capacity` işlemi eklendi: geç ödemede kapasitesi ayrılamamış sipariş (saha kapasitesi
  artırıldıktan sonra) buradan ayrılır; ayrılmadan partiye alınamaz.
- **Faz 6'ya devreden:** bırakmada Katılım Sertifikası üretimi + müşteriye bildirim, `released → monitoring → completed`
  geçişleri, video bağlantısı ve bildirimi, zamanlanmış işler.
- Sınama: betikle, taze bir deneme siparişi üzerinde uçtan uca (kesinleşme → parti → atama/çıkarma → tarih denetimleri →
  eşzamanlı iki bırakma isteğinden yalnız biri → `released` + fatura kuyruğu + kapasite `reserved→filled`). Sayfa tarayıcıda
  DENENMEDİ (oturum gerekiyor).

### Sertifika, bildirimler ve zamanlanmış işler (Faz 6)
- **Katılım Sertifikası** bırakma tamamlanınca düzenlenir: `completeRelease` her siparişe benzersiz kod verir
  (`lib/orders/certificates.ts → issueCertificate`, yinelenebilir). Herkese açık sayfa (`/sertifika/[kod]`, Astra #27) artık
  gerçek kayıttan okur (`lib/certificates/data.ts`): yalnız seçilen ad, saha, adet, tarihler, video — e-posta/telefon/fatura/
  sipariş no ÇIKMAZ; iade edilmiş siparişte "iptal"; canlıda deneme siparişlerinin sertifikası gösterilmez.
- **Bildirim kuyrukları** (e-posta büyük partilerde isteği kilitlemesin diye): `sendPendingCertificateEmails` (gönderildi
  bilgisi olay izinden: `email_sent` + `release_certificate`; son 14 günde düzenlenenler taranır) ve
  `sendPendingVideoEmails` (`video_notified_at` boş olanlar). İkisi de işlemin ardından `after()` ile VE zamanlanmış işten
  çağrılır; gönderilmişi yeniden göndermez. Müşteri e-postalarındaki bağlantı kökü canlıda hep asıl alan adı (`publicOrigin`).
- **Çalışma videosu:** yönetim → parti ayrıntısı → "Çalışma videosu" (yalnız bırakılmış parti; yalnız YouTube bağlantısı —
  `youtubeIdFrom`). İlk yayımda `video_published_at` yazılır, müşterilere e-posta gider, sipariş `completed` olur
  (gerekirse `released → monitoring → completed` ardışık). Sonradan yalnız bağlantı düzeltilir; yeniden e-posta gitmez.
  İzleme raporu bağlantısı da aynı ekrandan (saha sayfasında herkese açık görünür).
- **Durum geçişleri:** `released → monitoring` bırakma sezonu bitince (1 Nisan; `startMonitoringDue`, ölçüt `seasonEndOf`).
- **Zamanlanmış iş:** `GET /api/cron/siparis-isleri` (günde bir, `vercel.json` → 03:00 UTC): süre dolumu · kesinleşme ·
  izleme dönemine geçiş · gitmemiş sertifika ve video bildirimleri. Yetki `Authorization: Bearer <CRON_SECRET>`;
  **`CRON_SECRET` Vercel'de tanımlı değilse uç kapalıdır (503)** — canlıya çıkmadan tanımlanmalı. İşler yinelenebilir.
- **Saha çalışma günlüğü** (`lib/sites/releases*.ts` + Astra #46: `components/vitrin/sahalar/SiteReleases.tsx`,
  `components/vitrin/shared/YouTubeLite.tsx`): saha sayfasında "Bu sahadaki çalışmalar" — tamamlanan bırakmalar (tarih, başlık,
  video, izleme raporu; ADET YOK). Video tıklayınca yüklenir: oynat'a basılmadan DOM'da iframe / ytimg / preconnect yoktur,
  basınca `youtube-nocookie.com`. Boş listede bölüm hiç çıkmaz. `?ornek=calisma` yalnız geliştirmede okunur (canlıda
  `searchParams`'a dokunulmaz). `YouTubeLite` geneldir; sipariş / sertifika sayfalarında da kullanılabilir.
- Sınama: betikle, taze deneme siparişinde uçtan uca (gerçek e-posta gönderilmeden; "başarılı gönderim" yolu sahte
  göndericiyle): sertifika kodu + yinelenebilirlik · herkese açık sertifikada kişisel veri yok · bildirim bir kez ·
  1 Nisan geçişi · geçersiz/erken video reddi · video düzeltmesinde yeniden bildirim yok · bildirim gitmeden `completed`
  olmuyor · çalışma günlüğü ve sipariş görünümü doluyor. Zamanlanmış iş ucu: kimliksiz/yanlış anahtar 401, doğru anahtar 200.

### Hesabım — Siparişlerim (Faz 7)
- `/hesabim/siparisler` (kenar menüde "Siparişlerim"; yalnız `SALES_ENABLED` iken listelenir). Üyenin siparişleri tarayıcıdan
  **RLS ile** okunur (`release_orders_select_own` + sütun yetkisi: fatura/onay/ödeme ayrıntısı dışarıda). Yalnız ödenmiş
  siparişler; kartta durum, saha, adet, tutar, son tarih / bırakma tarihi, sertifika, video, cayma bağlantısı (süre içindeyse).
  Ayrıntı ve belgeler `/siparis/<no>` sayfasında (üye oturumuyla; belirteç gerekmez).
- `POST /api/auth/claim-orders`: aynı e-postayla MİSAFİR olarak verilmiş siparişleri hesaba bağlar — yalnız hesabın e-postası
  doğrulanmışsa, yalnız sahipsiz siparişler, yinelenebilir. Sayfa açılırken çağrılır.
- Eski `/hesabim/siparislerim` (tohum satışı) sayfasına dokunulmadı; Faz 8 temizliğinde kalkacak.
- Sınama: sorgu biçimi canlı şemaya karşı doğrulandı; sayfa üye oturumu gerektirdiği için tarayıcıda DENENMEDİ.

### KVKK Aydınlatma Metni (Faz 9a)
- Yeni metin `lib/legal/templates/kvkk-notice.ts` (ziyaret · talep · üyelik · sipariş · sertifika · ticari ileti; alıcılar ve
  yurt dışı aktarım; saklama süreleri; haklar ve başvuru). **Tek kaynak:** `/kvkk` sayfası da, her siparişle saklanan kopya da
  (belge türü `kvkk_notice` — dördüncü belge; e-postaya PDF olarak eklenir, sihirbazda ve sipariş sayfasında listelenir) bu
  bloklardan çıkar. Onay kaydındaki sürümle birlikte "müşteriye hangi metin gösterildi" ispatlanabilir.
- **Canlıda eski metin durur:** yeni metin yalnız `legalPagesVisible()` iken (geliştirme, Vercel önizlemesi,
  `NEXT_PUBLIC_LEGAL_PAGES_ENABLED=true`). Onaydan sonra `app/[locale]/(vitrin)/kvkk/page.tsx` içindeki eski blok silinir.
- Metin KODLA UYUMLU tutulmalı (dosyanın başındaki liste): kart verisi bize gelmez · **T.C. kimlik / vergi no iyzico'ya
  gönderilmez** (bu PR'da kapatıldı; `identityNumber` her zaman genel değer) · IP ham saklanmaz (özet) · sertifika sayfası
  dizine kapalı. Sağlayıcı değişirse `PROCESSORS` listesi + sürüm güncellenir.
- Belge modeline `subheading` blok türü eklendi (HTML `<h3>`, PDF kalın satır, sayfa bileşeni). Sürüm `2026-09.2-taslak`.
- Avukat için: `web-brifler/hukuk-taslaklari/` yeniden üretildi (12 PDF + 12 HTML) + `KVKK-AVUKAT-NOTLARI.md`
  (en önemli açık: m.9 yurt dışı aktarım güvencesi; saklama süresi önerileri; sertifikanın hukuki sebebi).
- Devreden: `/gizlilik-politikasi` ve `/cerez-politikasi` bu metinle uyumlu hâle getirilecek (onaydan sonra).

### Sıradaki (plan §Fazlar)
Faz 5c satış ayarları ekranı (fiyat/KDV/süreler + "sipariş alımı durduruldu"; sihirbaz fiyatı sunucudan almalı) → Faz 6 sertifika + zamanlanmış işler (süre dolumu, cayma süresi sonu → `confirmed`, video
bildirimi).
