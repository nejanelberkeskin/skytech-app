/**
 * Türkiye il listesi — plaka sırasına göre.
 * Talep formlarındaki il seçimlerinde ve sunucu doğrulamasında kullanılır;
 * kod (plaka) saklanır, ad görüntülenir.
 */
export interface Il {
  kod: string; // "01" … "81"
  ad: string;
}

export const TR_ILLER: readonly Il[] = [
  { kod: "01", ad: "Adana" },
  { kod: "02", ad: "Adıyaman" },
  { kod: "03", ad: "Afyonkarahisar" },
  { kod: "04", ad: "Ağrı" },
  { kod: "05", ad: "Amasya" },
  { kod: "06", ad: "Ankara" },
  { kod: "07", ad: "Antalya" },
  { kod: "08", ad: "Artvin" },
  { kod: "09", ad: "Aydın" },
  { kod: "10", ad: "Balıkesir" },
  { kod: "11", ad: "Bilecik" },
  { kod: "12", ad: "Bingöl" },
  { kod: "13", ad: "Bitlis" },
  { kod: "14", ad: "Bolu" },
  { kod: "15", ad: "Burdur" },
  { kod: "16", ad: "Bursa" },
  { kod: "17", ad: "Çanakkale" },
  { kod: "18", ad: "Çankırı" },
  { kod: "19", ad: "Çorum" },
  { kod: "20", ad: "Denizli" },
  { kod: "21", ad: "Diyarbakır" },
  { kod: "22", ad: "Edirne" },
  { kod: "23", ad: "Elazığ" },
  { kod: "24", ad: "Erzincan" },
  { kod: "25", ad: "Erzurum" },
  { kod: "26", ad: "Eskişehir" },
  { kod: "27", ad: "Gaziantep" },
  { kod: "28", ad: "Giresun" },
  { kod: "29", ad: "Gümüşhane" },
  { kod: "30", ad: "Hakkâri" },
  { kod: "31", ad: "Hatay" },
  { kod: "32", ad: "Isparta" },
  { kod: "33", ad: "Mersin" },
  { kod: "34", ad: "İstanbul" },
  { kod: "35", ad: "İzmir" },
  { kod: "36", ad: "Kars" },
  { kod: "37", ad: "Kastamonu" },
  { kod: "38", ad: "Kayseri" },
  { kod: "39", ad: "Kırklareli" },
  { kod: "40", ad: "Kırşehir" },
  { kod: "41", ad: "Kocaeli" },
  { kod: "42", ad: "Konya" },
  { kod: "43", ad: "Kütahya" },
  { kod: "44", ad: "Malatya" },
  { kod: "45", ad: "Manisa" },
  { kod: "46", ad: "Kahramanmaraş" },
  { kod: "47", ad: "Mardin" },
  { kod: "48", ad: "Muğla" },
  { kod: "49", ad: "Muş" },
  { kod: "50", ad: "Nevşehir" },
  { kod: "51", ad: "Niğde" },
  { kod: "52", ad: "Ordu" },
  { kod: "53", ad: "Rize" },
  { kod: "54", ad: "Sakarya" },
  { kod: "55", ad: "Samsun" },
  { kod: "56", ad: "Siirt" },
  { kod: "57", ad: "Sinop" },
  { kod: "58", ad: "Sivas" },
  { kod: "59", ad: "Tekirdağ" },
  { kod: "60", ad: "Tokat" },
  { kod: "61", ad: "Trabzon" },
  { kod: "62", ad: "Tunceli" },
  { kod: "63", ad: "Şanlıurfa" },
  { kod: "64", ad: "Uşak" },
  { kod: "65", ad: "Van" },
  { kod: "66", ad: "Yozgat" },
  { kod: "67", ad: "Zonguldak" },
  { kod: "68", ad: "Aksaray" },
  { kod: "69", ad: "Bayburt" },
  { kod: "70", ad: "Karaman" },
  { kod: "71", ad: "Kırıkkale" },
  { kod: "72", ad: "Batman" },
  { kod: "73", ad: "Şırnak" },
  { kod: "74", ad: "Bartın" },
  { kod: "75", ad: "Ardahan" },
  { kod: "76", ad: "Iğdır" },
  { kod: "77", ad: "Yalova" },
  { kod: "78", ad: "Karabük" },
  { kod: "79", ad: "Kilis" },
  { kod: "80", ad: "Osmaniye" },
  { kod: "81", ad: "Düzce" },
] as const;

export const TR_IL_KODLARI: readonly string[] = TR_ILLER.map((i) => i.kod);

const _adMap = new Map(TR_ILLER.map((i) => [i.kod, i.ad]));

/** Plaka kodundan il adı; bilinmeyen kodda null. */
export function ilAdi(kod: string | null | undefined): string | null {
  if (!kod) return null;
  return _adMap.get(kod) ?? null;
}

/** Alfabetik (Türkçe) sıralı kopya — seçim listeleri için. */
export const TR_ILLER_ALFABETIK: readonly Il[] = [...TR_ILLER].sort((a, b) =>
  a.ad.localeCompare(b.ad, "tr")
);
