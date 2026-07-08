/**
 * Site genel yapılandırması — özellik bayrakları.
 *
 * TRANSACTIONS_ENABLED: Sipariş / ödeme / hesap akışlarının açık olup
 * olmadığını belirler. Şu an FALSE — yalnız vitrin (tanıtım) yayında;
 * satın alma, ödeme, üyelik ve kurumsal panel askıda.
 *
 * Geri açmak için: Vercel'de NEXT_PUBLIC_TRANSACTIONS_ENABLED=true env'i
 * ekleyip redeploy et. Env yoksa varsayılan olarak KAPALI kabul edilir.
 */
export const TRANSACTIONS_ENABLED =
  process.env.NEXT_PUBLIC_TRANSACTIONS_ENABLED === "true";

/**
 * Transactions kapalıyken kullanıcı bu rotalara gitmeye çalışırsa
 * /yakinda'ya yönlendirilir. Admin paneli bilinçli olarak DIŞARIDA —
 * ekip yönetim erişimi korunur.
 */
export const SUSPENDED_ROUTE_PATTERNS: RegExp[] = [
  /^\/bireysel(\/.*)?$/,          // sipariş + ödeme akışı
  /^\/checkout(\/.*)?$/,          // ödeme sonuç ekranları
  /^\/hesabim(\/.*)?$/,           // üye paneli
  /^\/auth(\/.*)?$/,              // giriş / kayıt
  /^\/kurumsal$/,                 // kurumsal app girişi (login/teklif CTA'ları suspended)
  /^\/kurumsal\/giris(\/.*)?$/,   // kurumsal giriş
  /^\/kurumsal\/panel(\/.*)?$/,   // kurumsal panel
  /^\/kurumsal\/teklif-al(\/.*)?$/, // hesap yaratan B2B teklif formu
  /^\/lands(\/.*)?$/,             // arazi rezervasyonu — satın alma akışının parçası
  /^\/kargo-takip(\/.*)?$/,       // sipariş yoksa takip edilecek kargo da yok
];

export function isSuspendedRoute(pathname: string): boolean {
  return SUSPENDED_ROUTE_PATTERNS.some((re) => re.test(pathname));
}
