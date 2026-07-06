# Iyzico Ödeme Entegrasyonu Kurulumu

## 1. Iyzico Hesabı Oluşturma

1. [Iyzico Sandbox](https://sandbox-merchant.iyzipay.com) adresine git
2. Yeni hesap oluştur (veya var olan hesapla giriş yap)
3. Dashboard'dan **API Key** ve **Secret Key**'i al

## 2. Environment Variables Ayarla

`.env.local` dosyasına şu değişkenleri ekle:

```env
# Iyzico Konfigürasyonu
NEXT_PUBLIC_IYZICO_BASE_URL=https://sandbox-api.iyzipay.com
NEXT_PUBLIC_IYZICO_API_KEY=YOUR_API_KEY
IYZICO_SECRET_KEY=YOUR_SECRET_KEY

# App URL (callback için)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 3. Supabase Database

Aşağıdaki SQL'i Supabase SQL Editor'da çalıştır:

```sql
-- Payments tablosu (zaten oluşturmuşsun)
-- Kontrol et: SELECT * FROM payments;

-- Orders tablosuna payment_status sütunu ekle
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending'
CHECK (payment_status in ('pending', 'paid', 'failed'));

-- Indices
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_iyzico_id ON public.payments(iyzico_payment_id);
```

## 4. API Endpoints

### POST `/api/payment/checkout`
Ödeme checkout'u başlatır ve Iyzico checkout form'unu döndürür.

**Request:**
```json
{
  "orderId": "uuid",
  "userId": "uuid",
  "amount": 60000,  // Kuruş cinsinden (600.00 TRY)
  "email": "user@example.com",
  "fullName": "Şirket Adı",
  "ipAddress": "127.0.0.1",
  "description": "5.000 Tohum Paketi"
}
```

**Response:**
```json
{
  "status": "success",
  "paymentId": "uuid",
  "checkoutFormContent": "<!-- Iyzico form HTML -->"
}
```

### POST `/api/payment/callback`
Iyzico'dan webhook callback alır ve ödeme statusünü günceller.

### GET `/api/payment/status?paymentId=uuid`
Ödeme durumunu kontrol eder.

## 5. Kurumsal Ödeme Sayfası

`/app/kurumsal/panel/odeme` sayfasında:

- **Tohum Paketi Seçimi**: 1.000, 5.000, 10.000 tohum
- **Ödeme Yöntemleri**:
  - **Havale/EFT**: Kurumsal fatura ile (B2B)
  - **Kredi Kartı**: Iyzico ile güvenli ödeme

## 6. Test Etme

### Sandbox Kartları

```
Başarılı Ödeme:
Kart No: 4282009057337010
Ay/Yıl: 12/2026
CVV: 123

Başarısız Ödeme:
Kart No: 5890040000000016
Ay/Yıl: 12/2026
CVV: 123
```

### Test Akışı

1. Admin panele gir: `/admin/giris`
2. Kurumsal panele gir: `/kurumsal/panel`
3. "Ödeme & Faturalandırma" sekmesine git
4. Paket seç → Kredi Kartı → Ödemeye Devam Et
5. Iyzico form'u doldur ve test kartı kullan

## 7. Production'a Geçme

Production'da:
1. [Iyzico Live](https://merchant.iyzipay.com) hesabı oluştur
2. Live API Key ve Secret Key'i al
3. `.env.production` dosyasını güncelle:

```env
NEXT_PUBLIC_IYZICO_BASE_URL=https://api.iyzipay.com
IYZICO_SECRET_KEY=YOUR_LIVE_SECRET_KEY
```

## 8. Sorun Giderme

### 401 Unauthorized
- API Key / Secret Key kontrol et
- Signature header hesaplamasını kontrol et

### 400 Bad Request
- Tutarın format'ını kontrol et (kuruş cinsinden)
- Zorunlu alanları kontrol et (email, fullName, vb.)

### Webhook Callback Alamıyorum
- Iyzico Dashboard'dan callback URL'sini kontrol et
- `NEXT_PUBLIC_APP_URL` doğru ayarlanmış mı kontrol et
- Iyzico'dan test webhook gönder

## Notlar

- Iyzico **sandboxta** ve **production**da farklı API endpoints kullanır
- Ödeme status'u real-time olarak veritabanında güncellenir
- Callback işleme başarısız olursa, `/api/payment/status` ile manuel kontrol et
