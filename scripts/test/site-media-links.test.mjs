// Saha haber/video bağlantıları (041): şema, güvenli okuma ve yetki kuralı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mediaLinksSchema, readMediaLinks } from '../../lib/sites/media-links.ts';
import { loadSource } from './load-source.mjs';

const rules = loadSource('lib/sites/admin-access.ts');
const ok = { kind: 'news', title: 'Karşıyaka yangını kontrol altında', source: 'AA', url: 'https://www.aa.com.tr/tr/x', date: '2025-06-30' };

test('geçerli bağlantı kabul edilir, boş tarih null olur', () => {
  const r = mediaLinksSchema.parse([{ ...ok, date: '' }]);
  assert.equal(r[0].date, null);
});

test('https olmayan adres, bilinmeyen tür ve 12 üstü öğe reddedilir', () => {
  assert.equal(mediaLinksSchema.safeParse([{ ...ok, url: 'http://x.com/a' }]).success, false);
  assert.equal(mediaLinksSchema.safeParse([{ ...ok, url: 'javascript:alert(1)' }]).success, false);
  assert.equal(mediaLinksSchema.safeParse([{ ...ok, kind: 'podcast' }]).success, false);
  assert.equal(mediaLinksSchema.safeParse(Array.from({ length: 13 }, () => ok)).success, false);
});

test('vitrin okuyucusu bozuk öğeleri atlar', () => {
  assert.deepEqual(readMediaLinks(null), []);
  assert.equal(readMediaLinks([ok, { kind: 'news', url: 'javascript:x' }, 'x']).length, 1);
});

test('bağlantıları değiştirmek yalnız düzenleme yetkisi ister; aynı liste değişiklik sayılmaz', () => {
  const before = { media_links: [ok], is_public: true, status: 'open' };
  assert.deepEqual(rules.diffSite(before, { media_links: [{ ...ok }] }), {});
  const changes = rules.diffSite(before, { media_links: [] });
  assert.deepEqual(rules.requiredSitePermissions(before, changes), ['sites.edit']);
});

test('041 göçü yalnız ekleme yapar ve biçimi korur', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/041_land_media_links.sql', import.meta.url), 'utf8');
  assert.match(sql, /ADD COLUMN media_links jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(sql, /jsonb_array_length\(media_links\) <= 12/);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE)\b/i);
});
