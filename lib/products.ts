/**
 * Satılan hizmetin ürün tipi — saha bazında seçilir (`lands.product_type`, migration 046).
 *
 *  • coated_seed — Yosun Ekstraktı Kaplamalı Tohum: tohum tek tek kaplanır, adet = tohum.
 *  • seed_ball   — Tohum Topu: tohum kil ve besleyici karışımla küre hâline getirilir, adet = tohum topu.
 *
 * Birim bedel ürün tipine göre satış ayarlarından gelir (`unitPriceFor`). SAF modül: istemci,
 * sunucu ve hukuki şablonlar aynı adları buradan alır. Müşteri arayüzü metinleri `messages/*.json`'da,
 * hukuki metinler ve yönetim ekranı Türkçe adları buradan kullanır.
 */
export const PRODUCT_TYPES = ["coated_seed", "seed_ball"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const DEFAULT_PRODUCT_TYPE: ProductType = "coated_seed";

/** Bilinmeyen ya da eksik değer (eski kayıt) varsayılan ürüne düşer. */
export function productTypeOf(value: unknown): ProductType {
  return value === "seed_ball" ? "seed_ball" : DEFAULT_PRODUCT_TYPE;
}

export interface ProductWords {
  /** Ürün adı (başlık biçimi). */
  name: string;
  /** Cümle içinde ürün: "… kaplamalı tohum", "tohum topu". */
  noun: string;
  /** Sayılan birim: "100 tohum", "100 tohum topu". */
  unit: string;
  /** Belirtme hâli: "… tohumu bırakması". */
  acc: string;
  /** İlgi hâli: "… tohumun bırakılması". */
  gen: string;
  /** Çoğul ilgi hâli: "… tohumların bırakılması". */
  pluralGen: string;
  /** Çoğul iyelik: "tohumlarınız", "tohum toplarınız". */
  yours: string;
  /** Çoğul: "tohumlar", "tohum topları". */
  plural: string;
  /** Hizmet adı (fatura, ödeme açıklaması). */
  service: string;
  /** Sözleşmedeki tanım cümlesi. */
  definition: string;
}

export const PRODUCT_TR: Record<ProductType, ProductWords> = {
  coated_seed: {
    name: "Yosun Ekstraktı Kaplamalı Tohum",
    noun: "yosun ekstraktı kaplamalı tohum",
    unit: "tohum",
    acc: "yosun ekstraktı kaplamalı tohumu",
    gen: "yosun ekstraktı kaplamalı tohumun",
    pluralGen: "yosun ekstraktı kaplamalı tohumların",
    yours: "tohumlarınız",
    plural: "tohumlar",
    service: "Yosun ekstraktı kaplamalı tohum bırakma hizmeti",
    definition: "Yosun ekstraktı kaplamalı tohum: Yüzeyi yosun ekstraktı içeren karışımla kaplanan ve sahaya dronla bırakılan tohum.",
  },
  seed_ball: {
    name: "Tohum Topu",
    noun: "tohum topu",
    unit: "tohum topu",
    acc: "tohum topunu",
    gen: "tohum topunun",
    pluralGen: "tohum toplarının",
    yours: "tohum toplarınız",
    plural: "tohum topları",
    service: "Tohum topu bırakma hizmeti",
    definition: "Tohum topu: Tohumun kil ve besleyici karışımla kaplanarak hazırlandığı, sahaya dronla bırakılan küre.",
  },
};

/** Ürün tipinden bağımsız genel sayfalar (ifa koşulları vb.) için: iki ürünü birlikte anar. */
export const PRODUCT_ANY_TR: ProductWords = {
  name: "Kaplamalı Tohum / Tohum Topu",
  noun: "kaplamalı tohum ya da tohum topu",
  unit: "adet",
  acc: "kaplamalı tohumu ya da tohum topunu",
  gen: "kaplamalı tohumun ya da tohum topunun",
  pluralGen: "kaplamalı tohumların ya da tohum toplarının",
  yours: "tohumlarınız",
  plural: "tohumlar",
  service: "Bırakma hizmeti",
  definition: "",
};

export const PRODUCT_EN: Record<ProductType, { name: string; unit: string; units: string; service: string }> = {
  coated_seed: { name: "Seaweed-Extract Coated Seed", unit: "seed", units: "seeds", service: "seaweed-extract coated seed release service" },
  seed_ball: { name: "Seed Ball", unit: "seed ball", units: "seed balls", service: "seed ball release service" },
};
