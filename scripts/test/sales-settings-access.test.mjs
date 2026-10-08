// 32: satış ayarları — gerçek izin kapısı + gerçek route + gerçek ayar/şema/hazırlık modülleri + PGlite (016/017
// sales_settings, 007 audit, 020 job_runs, 014 email_logs, 021–023 roller). Taklit: oturum/MFA, audit yazımı,
// önbellek geçersizleştirme (sayaç). Her sorgu ve yazma kaydedilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import { createDb, IDS } from './pglite-db.mjs';
import { AAL1, aal2, customRole, envelope, gate, orderAt, permissionKeys, request, staffWithRole, USERS, withMfaEnforced } from './order-admin-helpers.mjs';
import { adminClient } from './admin-rest-client.mjs';

const settingsSchema = await import('../../lib/orders/settings-schema.ts');
const readiness = await import('../../lib/orders/readiness.ts');
const settings = load('lib/orders/settings.ts', {
  '@/lib/supabase/server': { createServiceRoleClient: () => { throw new Error('istemci route’tan gelmeli'); } },
  '@/lib/legal/version': await import('../../lib/legal/version.ts'),
  '@/lib/pricing': await import('../../lib/pricing.ts'),
  './schedule': load('lib/orders/schedule.ts'),
  './settings-schema': settingsSchema,
});
const scopeMod = load('lib/admin/record-scope.ts', { '@/lib/admin/permissions': permissionKeys });

async function salesDb() {
  const db = await createDb();
  const sql = await readFile(new URL('../../supabase/migrations/014_service_requests.sql', import.meta.url), 'utf8');
  await db.exec(sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.email_logs'), sql.indexOf('-- ── 3.')));
  return db;
}

function api(db, who, { role = 'NONE', assurance = AAL1, failTables = [] } = {}) {
  const log = []; const writes = []; const audits = []; const revalidated = [];
  const permissions = gate({ db, userId: who, role, assurance });
  const route = load('app/api/admin/sales-settings/route.ts', {
    'next/cache': { revalidateTag: (tag) => revalidated.push(tag) },
    zod: { z },
    '@/lib/supabase/server': { createServiceRoleClient: () => adminClient(db, { failTables, log, writes }) },
    '@/lib/admin-auth': { getClientIP: () => '127.0.0.1' },
    '@/lib/admin/permissions': permissions,
    '@/lib/admin/permission-set': load('lib/admin/permission-set.ts', {
      '@/lib/api/envelope': envelope, '@/lib/admin/permissions': permissions, '@/lib/admin/permission-keys': permissionKeys, './record-scope': scopeMod,
    }),
    '@/lib/admin/audit': { auditLog: async (_db, rec) => { audits.push(rec); return []; } },
    '@/lib/api/envelope': envelope,
    '@/lib/orders/gate': { canAcceptOrders: (_provider, s) => !s.ordersPaused },
    '@/lib/payments': { getPaymentProvider: () => ({ name: 'mock', isTest: true }) },
    '@/lib/orders/readiness': readiness,
    '@/lib/orders/settings': settings,
    '@/lib/orders/settings-schema': settingsSchema,
  });
  return {
    log, writes, audits, revalidated,
    tables: () => [...new Set(log.map((e) => e.table))].sort(),
    get: () => route.GET(request({ url: 'https://skytechgreen.com/api/admin/sales-settings' })),
    put: (body) => route.PUT(request({ body, url: 'https://skytechgreen.com/api/admin/sales-settings' })),
  };
}
const owner = (db, opts = {}) => api(db, IDS.superAdmin, { role: 'SUPER_ADMIN', ...opts });
const version = async (db) => (await owner(db).get()).body.data.state.updatedAt;
const current = async (db) => (await owner(db).get()).body.data.settings.values;
const row = async (db) => (await db.query('SELECT unit_price_kurus, orders_paused FROM sales_settings')).rows[0];
async function withEnv(vars, fn) {
  const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}
async function roleUser(db, userId, key, perms, scope) {
  await customRole(db, key, perms);
  await staffWithRole(db, userId, key, scope);
}

test('32: GET — gruplar izne göre sorgulanır ve döner; sahip hepsini görür', async () => {
  const db = await salesDb();
  try {
    const open = await orderAt(db, IDS.land);
    await db.query(`UPDATE release_orders SET status='awaiting_payment' WHERE id=$1`, [open]);
    const test = await orderAt(db, IDS.land, { is_test: true });
    await db.query(`UPDATE release_orders SET status='awaiting_payment' WHERE id=$1`, [test]);
    await db.query(`INSERT INTO admin_audit_logs(admin_id, admin_email, action, entity, entity_id, details) VALUES ($1, 'sahip@example.invalid', 'UPDATE', 'sales_settings', 'sales_settings', $2::jsonb)`,
      [IDS.superAdmin, JSON.stringify({ changes: [{ field: 'ordersPaused', from: true, to: false }] })]);
    const o = owner(db);
    const r = await o.get();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const d = r.body.data;
    assert.deepEqual(d.groups, ['state', 'settings', 'openCheckouts', 'history', 'readiness']);
    assert.equal(d.state.ordersPaused, false);
    assert.equal(d.state.repairRequired, false);
    assert.match(d.state.updatedAt, /^\d{4}-\d{2}-\d{2}T.*\+00:00$/);
    assert.equal(d.settings.values.vatRate, 20);
    assert.equal(d.openCheckouts, 1, 'deneme siparişi sayılmaz');
    assert.deepEqual(d.history[0].changes, [{ field: 'ordersPaused', from: true, to: false }]);
    assert.ok(d.readiness.items.every((i) => 'configured' in i && 'verification' in i && 'lastResult' in i));
    assert.deepEqual(d.capabilities, { pause: true, resume: true, pricing: true });
    assert.deepEqual(o.tables(), ['admin_audit_logs', 'email_logs', 'job_runs', 'release_orders', 'sales_settings']);
  } finally { await db.close(); }
});

test('32: GET — yalnız durdurma yetkisi durum ve sürümü görür; fiyat, sayaç, geçmiş ve hazırlık sorgulanmaz', async () => {
  const db = await salesDb();
  try {
    await roleUser(db, USERS.scoped, 'satis_durdur', ['sales.pause']);
    const p = api(db, USERS.scoped);
    const d = (await p.get()).body.data;
    assert.deepEqual(d.groups, ['state']);
    for (const k of ['settings', 'openCheckouts', 'history', 'readiness']) assert.ok(!(k in d), `${k} yok`);
    assert.deepEqual(d.capabilities, { pause: true, resume: false, pricing: false });
    assert.deepEqual(p.tables(), ['sales_settings'], 'yalnız ayar satırı okundu');

    await roleUser(db, USERS.noter, 'hazirlik_okur', ['system.readiness.read']);
    const ro = api(db, USERS.noter);
    const rd = (await ro.get()).body.data;
    assert.deepEqual(rd.groups, ['readiness']);
    assert.ok(!('state' in rd) && !('settings' in rd));
    assert.ok(!ro.tables().includes('release_orders') && !ro.tables().includes('admin_audit_logs'));

    const fin = api(db, IDS.finance, { role: 'FINANCE' });
    const denied = await fin.get();
    assert.equal(denied.status, 403, 'orders.read + audit.read tek başına bu uca girmez');
    assert.equal(denied.body.error.code, 'forbidden');
    assert.deepEqual(fin.tables(), []);
  } finally { await db.close(); }
});

test('32: kapsam — ayarlar küresel: saha kapsamlı satış izni scope_unsupported, hiçbir sorgu ve yazma yok', async () => {
  const db = await salesDb();
  try {
    await roleUser(db, USERS.scoped, 'saha_durdur', ['sales.pause'], { kind: 'sites', siteIds: [IDS.siteA] });
    const s = api(db, USERS.scoped);
    const g = await s.get();
    assert.equal(g.status, 403);
    assert.equal(g.body.error.code, 'scope_unsupported');
    const p = await s.put({ ordersPaused: true, expectedUpdatedAt: await version(db) });
    assert.equal(p.body.error.code, 'scope_unsupported');
    assert.deepEqual(s.tables(), []); assert.deepEqual(s.writes, []);
  } finally { await db.close(); }
});

test('32: durdurma yetkisi — yalnız durdurur; fiyatı ya da yeniden açmayı taşıyan istek bütünüyle reddedilir', async () => {
  const db = await salesDb();
  try {
    await roleUser(db, USERS.scoped, 'satis_durdur', ['sales.pause']);
    const p = api(db, USERS.scoped);
    const v = await version(db);
    const values = await current(db);
    const mixed = await p.put({ settings: { ...values, ordersPaused: true, unitPriceKurus: 1200 }, expectedUpdatedAt: v });
    assert.equal(mixed.status, 403);
    assert.deepEqual(mixed.body.error.details, { reason: 'missing_permission', permissions: ['sales.pricing.manage'] });
    assert.deepEqual(p.writes, []); assert.deepEqual(p.audits, []); assert.deepEqual(p.revalidated, []);
    assert.deepEqual(await row(db), { unit_price_kurus: 1000, orders_paused: false });

    const paused = await p.put({ ordersPaused: true, expectedUpdatedAt: v });
    assert.equal(paused.status, 200, JSON.stringify(paused.body));
    assert.deepEqual(paused.body.data.changed, ['ordersPaused']);
    assert.equal(paused.body.data.state.ordersPaused, true);
    assert.equal(paused.body.data.state.accepting, false);
    assert.ok(!('settings' in paused.body.data), 'durdurma yetkilisi fiyat değerlerini almaz');
    assert.deepEqual(p.audits[0].details.changes, [{ field: 'ordersPaused', from: false, to: true }]);
    assert.deepEqual(p.revalidated, ['sales-settings']);
    const written = p.writes.find((w) => w.table === 'sales_settings');
    assert.equal(written.values.unit_price_kurus, 1000, 'fiyat değişmeden yazıldı (tam satır + sürüm koşulu)');
    assert.deepEqual(await row(db), { unit_price_kurus: 1000, orders_paused: true });

    const resume = await p.put({ ordersPaused: false, expectedUpdatedAt: paused.body.data.state.updatedAt });
    assert.equal(resume.status, 403);
    assert.deepEqual(resume.body.error.details.permissions, ['sales.resume']);
    const stale = await p.put({ ordersPaused: true, expectedUpdatedAt: v });
    assert.equal(stale.status, 409, 'eski sürümle istek kabul edilmez (sürüm kuralı eski uçla aynı)');
    assert.equal(stale.body.error.code, 'conflict');
    const same = await p.put({ ordersPaused: true, expectedUpdatedAt: paused.body.data.state.updatedAt });
    assert.equal(same.status, 200, 'zaten durdurulmuş: değişiklik yok');
    assert.deepEqual(same.body.data.changed, []);
    assert.equal(p.writes.filter((w) => w.table === 'sales_settings').length, 1, 'yalnız ilk durdurma yazıldı');
  } finally { await db.close(); }
});

test('32: MFA — yeniden açma ve fiyat taze aal2 ister; acil durdurma istemez', async () => {
  const db = await salesDb();
  try {
    await roleUser(db, USERS.scoped, 'satis_ac', ['sales.pause', 'sales.resume']);
    await roleUser(db, USERS.noter, 'satis_fiyat', ['sales.pricing.manage']);
    await withMfaEnforced(async () => {
      const u = api(db, USERS.scoped);
      const paused = await u.put({ ordersPaused: true, expectedUpdatedAt: await version(db) });
      assert.equal(paused.status, 200, 'durdurma MFA istemez');
      const resume = await u.put({ ordersPaused: false, expectedUpdatedAt: paused.body.data.state.updatedAt });
      assert.equal(resume.status, 403);
      assert.equal(resume.body.error.code, 'mfa_required');
      assert.deepEqual(resume.body.error.details.permissions, ['sales.resume']);
      const fresh = await api(db, USERS.scoped, { assurance: aal2(2) }).put({ ordersPaused: false, expectedUpdatedAt: paused.body.data.state.updatedAt });
      assert.equal(fresh.status, 200);
      assert.equal(fresh.body.data.state.ordersPaused, false);

      const values = await current(db);
      const priceAal1 = api(db, USERS.noter);
      const denied = await priceAal1.put({ settings: { ...values, unitPriceKurus: 1100 }, expectedUpdatedAt: await version(db) });
      assert.equal(denied.body.error.code, 'mfa_required');
      assert.deepEqual(priceAal1.writes, []);
      const price = await api(db, USERS.noter, { assurance: aal2(1) }).put({ settings: { ...values, unitPriceKurus: 1100 }, expectedUpdatedAt: await version(db) });
      assert.equal(price.status, 200, JSON.stringify(price.body));
      assert.equal(price.body.data.quoteChanged, true);
      assert.equal(price.body.data.settings.values.unitPriceKurus, 1100);
      const pauseViaPricing = await api(db, USERS.noter, { assurance: aal2(1) }).put({ ordersPaused: true, expectedUpdatedAt: await version(db) });
      assert.deepEqual(pauseViaPricing.body.error.details.permissions, ['sales.pause'], 'fiyat yetkisi durdurma yetkisi vermez');
    });
  } finally { await db.close(); }
});

test('32: onarım — geçersiz kayıtta satış kapalı sayılır; hızlı durdurma yok, tam form durdurulmuş kalmalı', async () => {
  const db = await salesDb();
  try {
    await db.query(`UPDATE sales_settings SET quantity_presets='{5000,50}'`);
    const o = owner(db, { assurance: aal2(1) });
    const d = (await o.get()).body.data;
    assert.equal(d.state.repairRequired, true);
    assert.equal(d.state.ordersPaused, true);
    assert.equal(d.settings.values, null);
    assert.equal(d.settings.fieldErrors.quantityPresets, 'presetsOrder');
    const v = d.state.updatedAt;
    assert.equal((await o.put({ ordersPaused: true, expectedUpdatedAt: v })).body.error.code, 'repair_required');
    const fixed = { ...settings.DEFAULT_SALES_SETTINGS, quantityPresets: [50, 5000] };
    assert.equal((await o.put({ settings: { ...fixed, ordersPaused: false }, expectedUpdatedAt: v })).body.error.code, 'repair_requires_pause');
    const saved = await o.put({ settings: { ...fixed, ordersPaused: true }, expectedUpdatedAt: v });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.data.state.repairRequired, false);
    assert.equal(o.writes.filter((w) => w.table === 'sales_settings').length, 1);
  } finally { await db.close(); }
});

test('32: hazırlık — anahtar var diye çalışıyor denmez; zamanlayıcı kanıtı yalnız cron kaydından', async () => {
  const db = await salesDb();
  try {
    await withEnv({ CRON_SECRET: 'GIZLI-cron-deger', RESEND_API_KEY: 're_GIZLI_anahtar' }, async () => {
      const item = (d, key) => d.readiness.items.find((i) => i.key === key);
      let d = (await owner(db).get()).body.data;
      assert.deepEqual([item(d, 'cron').configured, item(d, 'cron').verification, item(d, 'cron').level], [true, 'not_verified', 'warning']);
      assert.deepEqual([item(d, 'email').configured, item(d, 'email').verification, item(d, 'email').level], [true, 'not_verified', 'warning']);

      await db.query(`INSERT INTO job_runs(job, trigger, scope, started_at, finished_at, ok, report) VALUES ('siparis-isleri','admin','status', now() - interval '1 hour', now() - interval '59 minutes', true, '{}')`);
      d = (await owner(db).get()).body.data;
      assert.equal(item(d, 'cron').verification, 'not_verified', 'elle çalıştırma zamanlayıcıyı kanıtlamaz');
      assert.equal(item(d, 'cron').lastResult.source, 'admin');

      await db.query(`INSERT INTO job_runs(job, trigger, scope, started_at, finished_at, ok, report) VALUES ('siparis-isleri','cron','all', now() - interval '3 hours', now() - interval '179 minutes', true, '{}')`);
      await db.query(`INSERT INTO email_logs(recipient_email, template, subject, status) VALUES ('musteri@example.invalid','order','Konu','sent')`);
      d = (await owner(db).get()).body.data;
      assert.deepEqual([item(d, 'cron').verification, item(d, 'cron').level], ['verified', 'ok']);
      assert.equal(item(d, 'email').verification, 'not_verified', 'sağlayıcının kabulü teslim değildir');
      assert.equal(item(d, 'email').lastResult.ok, true);

      const failing = owner(db, { failTables: ['job_runs', 'email_logs'] });
      const f = await failing.get();
      assert.equal(f.status, 200, 'kanıt okunamazsa sayfa düşmez, durum "bilinmiyor" olur');
      assert.deepEqual([item(f.body.data, 'cron').verification, item(f.body.data, 'email').verification], ['unknown', 'unknown']);
      const text = JSON.stringify(d);
      for (const secret of ['GIZLI-cron-deger', 're_GIZLI_anahtar', 'musteri@example.invalid']) assert.ok(!text.includes(secret), secret);
    });
  } finally { await db.close(); }
});

test('32: hatalar — ayar, sayaç ve geçmiş okunamazsa 503 (sahte sıfır yok); geçersiz gövde 400; değişmeyen form yazmaz', async () => {
  const db = await salesDb();
  try {
    for (const table of ['sales_settings', 'release_orders', 'admin_audit_logs']) {
      assert.equal((await owner(db, { failTables: [table] }).get()).status, 503, table);
    }
    const o = owner(db, { assurance: aal2(1) });
    const v = await version(db);
    assert.equal((await o.put({ ordersPaused: true, settings: {}, expectedUpdatedAt: v })).status, 400, 'iki biçim birden olmaz');
    const invalid = await o.put({ settings: { ...(await current(db)), maxQuantity: 1 }, expectedUpdatedAt: v });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'validation');
    assert.equal(invalid.body.error.details.fields.maxQuantity, 'maxBelowMin');
    const same = await o.put({ settings: await current(db), expectedUpdatedAt: v });
    assert.equal(same.status, 200);
    assert.deepEqual(same.body.data.changed, []);
    assert.deepEqual(o.writes, []); assert.deepEqual(o.audits, []); assert.deepEqual(o.revalidated, []);
    assert.equal((await owner(db, { failTables: ['sales_settings'] }).put({ ordersPaused: true, expectedUpdatedAt: v })).status, 503);
  } finally { await db.close(); }
});
