// Dil korunumu (#108 raporu §7): EN/RU kullanıcısı giriş, hesabım ve kurumsal panel geçişlerinde Türkçe sayfaya düşmemeli.
// next/navigation'ın useRouter'ı öneksiz yolu olduğu gibi kullanır, usePathname'i ise dil önekli yolu döndürür (etkin menü
// EN/RU'da işaretlenmez). Bu dosyalar @/i18n/navigation sözleşmesini kullanır; giriş/kayıt/şifre yenileme sayfaları ise
// dil önekli yolu `getPathname` ile kendileri kurduğu için next/navigation yönlendiricisini bilerek korur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const nextNavNames = (src) => {
  const m = /import\s*\{([^}]*)\}\s*from\s*"next\/navigation"/.exec(src);
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
};
const i18nNavNames = (src) => {
  const m = /import\s*\{([^}]*)\}\s*from\s*"@\/i18n\/navigation"/.exec(src);
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
};

const I18N_ROUTER = [
  'app/[locale]/(uygulama)/hesabim/layout.tsx',
  'app/[locale]/(uygulama)/kurumsal/giris/page.tsx',
  'app/[locale]/(uygulama)/kurumsal/panel/layout.tsx',
  'app/[locale]/(uygulama)/kurumsal/panel/odeme/page.tsx',
  'app/[locale]/(uygulama)/kurumsal/panel/page.tsx',
];
const PREFIXED_PATH_PAGES = [
  'app/[locale]/(uygulama)/auth/login/page.tsx',
  'app/[locale]/(uygulama)/auth/register/page.tsx',
  'app/[locale]/(uygulama)/auth/sifre-yenile/page.tsx',
];

test('hesabım ve kurumsal panel: useRouter/usePathname @/i18n/navigation sözleşmesinden; next/navigation yalnız diğer kancalar için', () => {
  for (const file of I18N_ROUTER) {
    const src = read(file);
    const fromNext = nextNavNames(src);
    assert.ok(!fromNext.includes('useRouter') && !fromNext.includes('usePathname'), `${file}: next/navigation'dan ${fromNext.join(', ')}`);
    const fromI18n = i18nNavNames(src);
    if (/\buseRouter\(/.test(src)) assert.ok(fromI18n.includes('useRouter'), `${file}: useRouter i18n'den değil`);
    if (/\busePathname\(/.test(src)) assert.ok(fromI18n.includes('usePathname'), `${file}: usePathname i18n'den değil`);
  }
  // Ödeme sayfası useSearchParams'ı Next'ten almaya devam eder (körlemesine değiştirilmez).
  assert.deepEqual(nextNavNames(read('app/[locale]/(uygulama)/kurumsal/panel/odeme/page.tsx')), ['useSearchParams']);
});

test('giriş/kayıt/şifre yenileme: next/navigation yönlendiricisine yalnız dil önekli yol (localPath ya da safeNext sonucu) verilir', () => {
  for (const file of PREFIXED_PATH_PAGES) {
    const src = read(file);
    assert.ok(/getPathname\(\{\s*locale,\s*href\s*\}\)/.test(src), `${file}: localPath (getPathname) yok`);
    const pushes = [...src.matchAll(/router\.(push|replace)\(([^)]*)\)/g)].map((m) => m[2].trim());
    assert.ok(pushes.length > 0, file);
    for (const arg of pushes) assert.ok(/^localPath\(|^redirect$/.test(arg), `${file}: router.push(${arg}) dil önekli değil`);
  }
});

test('[locale] altında next/navigation yönlendiricisine öneksiz dizge verilmez (gerileme koruması)', () => {
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
  const offenders = [];
  for (const file of [...walk(join(ROOT, 'app/[locale]')), ...walk(join(ROOT, 'components'))]) {
    const src = readFileSync(file, 'utf8');
    if (!nextNavNames(src).includes('useRouter')) continue;
    for (const m of src.matchAll(/router\.(push|replace)\(\s*[`"']\//g)) offenders.push(`${relative(ROOT, file)}: ${m[0]}`);
  }
  assert.deepEqual(offenders, []);
});

test('safeNext: yalnız yerel yol; açık yönlendirme ve satır sonu reddedilir, dil önekli yol korunur', async () => {
  const { safeNext } = await import('../../lib/auth/safe-next.ts');
  const fallback = '/en/hesabim';
  assert.equal(safeNext('/en/hesabim/taleplerim', fallback), '/en/hesabim/taleplerim');
  assert.equal(safeNext('/ru/kurumsal/panel', fallback), '/ru/kurumsal/panel');
  for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/a\r\nb', `/${'x'.repeat(250)}`, '', null]) {
    assert.equal(safeNext(bad, fallback), fallback, String(bad));
  }
});
