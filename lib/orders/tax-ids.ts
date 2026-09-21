/**
 * TCKN / VKN biçim ve sağlama denetimi — saf işlevler (istemcide de çalışır).
 * Yalnız yazım hatasını yakalar; numaranın gerçekten o kişiye/kuruma ait olduğunu
 * doğrulamaz (böyle bir sorgu yapılmaz, gerekmez).
 */

/** T.C. kimlik numarası: 11 hane, ilk hane 0 olamaz, 10. ve 11. haneler sağlama. */
export function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = [...value].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  if (tenth !== d[9]) return false;
  const eleventh = d.slice(0, 10).reduce((s, n) => s + n, 0) % 10;
  return eleventh === d[10];
}

/** Vergi kimlik numarası: 10 hane, son hane sağlama. */
export function isValidVkn(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const d = [...value].map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i] + (9 - i)) % 10;
    let v = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && v === 0) v = 9;
    sum += v;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

/** Kurumsal faturada: VKN (tüzel kişi) ya da TCKN (şahıs işletmesi). */
export function isValidTaxId(value: string): boolean {
  return value.length === 10 ? isValidVkn(value) : value.length === 11 ? isValidTckn(value) : false;
}

/** Kayıtlarda ve e-postalarda gösterim: son dört hane dışında maskeli. */
export function maskId(value: string | null | undefined): string {
  if (!value) return "";
  return value.length <= 4 ? "•".repeat(value.length) : "•".repeat(value.length - 4) + value.slice(-4);
}
