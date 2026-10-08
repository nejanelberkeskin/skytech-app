import { fail } from "@/lib/api/envelope";

export const dynamic = "force-dynamic";

/**
 * Emekli personel API'si. Eski çağrılar yeni izin, davet ve MFA akışına
 * yönlendirilmez: aynı gövdeyi başka bir mutasyon ucuna taşımak güvenli değildir.
 * Oturum, gövde veya veritabanı okunmadan bütün eski yöntemler kapalı kalır.
 */
function retired() {
  return fail(
    410,
    "endpoint_retired",
    "Bu personel yönetimi uç noktası kullanımdan kaldırıldı. Personel ve Davetler ekranlarını kullanın.",
  );
}

export async function GET() { return retired(); }
export async function POST() { return retired(); }
export async function PUT() { return retired(); }
export async function DELETE() { return retired(); }
