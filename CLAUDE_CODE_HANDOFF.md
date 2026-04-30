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
