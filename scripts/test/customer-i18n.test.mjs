// Müşteri ekranları EN/RU çevirisi (SONRAKI-GOREV madde 1): hesabım ve kurumsal giriş/panel/teklif/ödeme.
// 1) Teklif seçeneklerinin veritabanına yazılan DEĞERLERİ değişmez; yalnız gösterilen etiket çevrilir.
// 2) accountPages / corporatePages iletileri üç dilde ICU olarak derlenir (çoğul, sayı, zengin metin etiketleri).
// 3) Çevrilen dosyalarda, belgelenmiş iddia/taklit modülleri dışında sabit Türkçe arayüz metni kalmaz (gerileme koruması).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Uygulamanın çalışma zamanındaki zincirle aynı derleyici: next-intl → use-intl → intl-messageformat (doğrudan bağımlılık eklenmez).
const fromNextIntl = createRequire(createRequire(import.meta.url).resolve('next-intl'));
const fromUseIntl = createRequire(fromNextIntl.resolve('use-intl'));
const { IntlMessageFormat } = await import(fromUseIntl.resolve('intl-messageformat'));

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const messages = Object.fromEntries(['tr', 'en', 'ru'].map((l) => [l, JSON.parse(read(`messages/${l}.json`))]));

test('teklif seçenekleri: kayıtlı değerler eskisiyle birebir; her anahtarın üç dilde etiketi var', async () => {
  const { SEED_OPTIONS, BUDGET_OPTIONS, TIMELINE_OPTIONS, seedRangeLabelKey } = await import('../../lib/corporate/quote-options.ts');
  // Önceki sürümde formun doğrudan yazdığı diziler (değişirse eski kayıtlar ve extractSeedCount bozulur).
  assert.deepEqual(SEED_OPTIONS.map((o) => o.value), ['1.000 – 5.000', '5.000 – 10.000', '10.000 – 25.000', '25.000 – 50.000', '50.000+', 'Henüz karar vermedim']);
  assert.deepEqual(BUDGET_OPTIONS.map((o) => o.value), ['₺50.000 altı', '₺50.000 – ₺150.000', '₺150.000 – ₺500.000', '₺500.000+', 'Teklif bekliyorum']);
  assert.deepEqual(TIMELINE_OPTIONS.map((o) => o.value), ['1 ay içinde', '3 ay içinde', '6 ay içinde', 'Yıl sonuna kadar', 'Esnek']);
  for (const [grup, liste] of [['seed', SEED_OPTIONS], ['budget', BUDGET_OPTIONS], ['timeline', TIMELINE_OPTIONS]]) {
    for (const o of liste) {
      for (const l of ['tr', 'en', 'ru']) assert.ok(messages[l].corporatePages.quoteOptions[grup][o.key], `${l} ${grup}.${o.key}`);
      // TR etiketi kayıtlı değerin kendisi: Türkçe arayüz önceki görünümle aynı.
      assert.equal(messages.tr.corporatePages.quoteOptions[grup][o.key], o.value);
    }
  }
  assert.equal(seedRangeLabelKey('5.000 – 10.000'), 'r2');
  assert.equal(seedRangeLabelKey('serbest eski değer'), null);
  assert.equal(seedRangeLabelKey(null), null);
});

test('accountPages ve corporatePages iletileri üç dilde ICU olarak derlenir', () => {
  const yapraklar = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? yapraklar(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  let sayi = 0;
  for (const l of ['tr', 'en', 'ru']) {
    for (const ns of ['accountPages', 'corporatePages']) {
      for (const [anahtar, metin] of yapraklar(messages[l][ns])) {
        assert.doesNotThrow(() => new IntlMessageFormat(metin, l), `${l} ${ns}.${anahtar}`);
        sayi++;
      }
    }
  }
  // Çoğul biçimleri: RU'da one/few/many ayrımı gerçekten uygulanıyor.
  const fmt = (m, v) => new IntlMessageFormat(m, 'ru').format(v);
  const seed = messages.ru.accountPages.overview.seedBalls;
  assert.deepEqual([1, 3, 5, 21].map((count) => fmt(seed, { count })), ['1 семенной шар', '3 семенных шара', '5 семенных шаров', '21 семенной шар']);
  assert.equal(new IntlMessageFormat(messages.tr.accountPages.overview.seedBalls, 'tr').format({ count: 12500 }), '12.500 tohum topu');
  assert.ok(sayi > 900, `derlenen ileti ${sayi}`);
});

// Bilinçli olarak çevrilmeyen modüller: çevresel sonuç iddiaları ve taklit veri taşıyor; EN/RU'ya taşınmaları görevin
// "yeni çevresel sonuç vaadi üretme" sınırını aşar. İçerik kararı bekliyor (outputs/claude-musteri-dil-kapanis/TESLIM-RAPORU.md).
const CEVRILMEYEN = {
  'app/[locale]/(uygulama)/kurumsal/panel/page.tsx': ['PitchDeckModal', 'AIESGCopilot', 'generateLinkedInPost', 'generateBoardSummary', 'EmbedSection'],
  'app/[locale]/(uygulama)/kurumsal/teklif-al/page.tsx': ['CarbonSimulator'],
};
const CEVRILEN = [
  'app/[locale]/(uygulama)/hesabim/layout.tsx',
  'app/[locale]/(uygulama)/hesabim/profil/page.tsx',
  'app/[locale]/(uygulama)/hesabim/sertifikalar/page.tsx',
  'app/[locale]/(uygulama)/hesabim/siparisler/page.tsx',
  'app/[locale]/(uygulama)/hesabim/taleplerim/page.tsx',
  'components/hesabim/RequestsOverview.tsx',
  'app/[locale]/(uygulama)/kurumsal/giris/page.tsx',
  'app/[locale]/(uygulama)/kurumsal/panel/layout.tsx',
  'app/[locale]/(uygulama)/kurumsal/panel/odeme/page.tsx',
  'app/[locale]/(uygulama)/kurumsal/panel/page.tsx',
  'app/[locale]/(uygulama)/kurumsal/teklif-al/page.tsx',
];

test('çevrilen müşteri dosyalarında (belgelenmiş modüller dışında) Türkçe harfli sabit metin yok', () => {
  const bulunan = [];
  for (const dosya of CEVRILEN) {
    const kaynak = read(dosya);
    const sf = ts.createSourceFile(dosya, kaynak, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const haric = new Set(CEVRILMEYEN[dosya] ?? []);
    const ust = (node) => {
      for (let n = node.parent; n; n = n.parent) {
        if (ts.isFunctionDeclaration(n) && n.name && haric.has(n.name.text)) return true;
      }
      return false;
    };
    const gez = (node) => {
      if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        const metin = node.text ?? node.getText();
        if (/[çğıöşüÇĞİÖŞÜ]/.test(metin) && !ust(node)) {
          bulunan.push(`${dosya}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${metin.trim().slice(0, 60)}`);
        }
      }
      ts.forEachChild(node, gez);
    };
    gez(sf);
  }
  assert.deepEqual(bulunan, []);
});
