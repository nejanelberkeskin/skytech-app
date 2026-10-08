// Zamanlayıcı ucunun yayın öncesi korumaları (35 §2 madde 3, CRON_SECRET). release-readiness-local.test.mjs'in
// kapsamadığı durumlar: çakışan ve yinelenen teslim (Vercel teslimi "en iyi çaba"dır, aynı çalışmayı iki kez
// çağırabilir), elle başlatılmış çalışma sürerken zamanlayıcı, süre sınırında yarıda kalmış çalışma, kayıt tablosu
// (020) yokken davranış, hatanın görünürlüğü ve gizli değerin yanıta ya da günlüğe sızmaması, yetki başlığı biçimi.
// Gerçek uç + gerçek lib/jobs/runs.ts + gerçek 020 işlevleri (PGlite); iş gövdesi taklit (asıl işler ayrı sahiplikte).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
import { createDb, IDS } from './pglite-db.mjs';
import { adminClient } from './admin-rest-client.mjs';

const runs = await import('../../lib/jobs/runs.ts');
const SECRET = 'yerel-deneme-anahtari-0123456789';

/** runRecorded'ın çağırdığı gerçek 020 işlevleri; `missing` verilirse işlev yokmuş gibi (020 uygulanmamış) davranır. */
const jobRpc = (db, { missing = false } = {}) => async (name, args) => {
  if (missing) return { data: null, error: { message: `Could not find the function public.${name}`, code: 'PGRST202' } };
  try {
    if (name === 'start_job_run') {
      const r = await db.query('SELECT public.start_job_run($1, $2, $3, $4) AS id', [args.p_job, args.p_trigger, args.p_scope, args.p_actor]);
      return { data: r.rows[0].id, error: null };
    }
    if (name === 'finish_job_run') {
      await db.query('SELECT public.finish_job_run($1, $2, $3::jsonb, $4)', [args.p_id, args.p_ok, args.p_report === null ? null : JSON.stringify(args.p_report), args.p_error]);
      return { data: null, error: null };
    }
  } catch (e) {
    return { data: null, error: { message: e.message, code: e.code } };
  }
  throw new Error(`beklenmeyen RPC: ${name}`);
};

function cronRoute(db, job, opts) {
  const client = adminClient(db, { rpc: jobRpc(db, opts) });
  return load('app/api/cron/siparis-isleri/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/jobs/runs': runs,
    '@/lib/mail': { publicOrigin: (o) => o },
    '@/lib/orders/jobs': { runScheduledJobs: async () => job() },
    '@/lib/supabase/server': { createServiceRoleClient: () => client },
  });
}
const cronRequest = (authorization) => ({
  headers: new Map(authorization === null ? [] : [['authorization', authorization]]),
  nextUrl: new URL('https://skytechgreen.com/api/cron/siparis-isleri'),
  url: 'https://skytechgreen.com/api/cron/siparis-isleri',
});
async function withSecret(fn) {
  const before = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
  try { return await fn(); } finally { if (before === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = before; }
}
const rows = async (db) => (await db.query(`SELECT trigger, ok, error, finished_at IS NOT NULL AS bitti FROM job_runs WHERE job = 'siparis-isleri' ORDER BY started_at`)).rows;
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
/** console.log/error çıktısını toplar (gizli değer denetimi için). */
function captureLogs(t) {
  const lines = [];
  for (const m of ['log', 'error', 'warn']) t.mock.method(console, m, (...a) => lines.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')));
  return lines;
}

test('zamanlayıcı: çakışan ikinci teslim işi ikinci kez başlatmaz (tek çalışma kilidi); ilk çalışma kayda tek satır düşer', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  captureLogs(t);
  const db = await createDb();
  try {
    await withSecret(async () => {
      const gate = deferred();
      let ran = 0;
      const route = cronRoute(db, async () => { ran++; await gate.promise; return { expired: 1 }; });
      const first = route.GET(cronRequest(`Bearer ${SECRET}`));
      await new Promise((r) => setTimeout(r, 20));
      const second = await route.GET(cronRequest(`Bearer ${SECRET}`));
      assert.equal(second.status, 200);
      assert.deepEqual(await second.json(), { ok: true, skipped: 'job_running' });
      gate.resolve();
      const done = await first;
      assert.equal(done.status, 200);
      assert.deepEqual(await done.json(), { ok: true, expired: 1 });
      assert.equal(ran, 1, 'iş bir kez çalıştı');
      assert.deepEqual(await rows(db), [{ trigger: 'cron', ok: true, error: null, bitti: true }], 'atlanan teslim kayıt bırakmaz');
    });
  } finally { await db.close(); }
});

test('zamanlayıcı: yönetimden elle başlatılmış çalışma sürerken zamanlayıcı atlanır; sıradaki teslim normal çalışır', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  captureLogs(t);
  const db = await createDb();
  try {
    await withSecret(async () => {
      const gate = deferred();
      const admin = adminClient(db, { rpc: jobRpc(db) });
      const manual = runs.runRecorded(admin, 'siparis-isleri', 'admin', 'status', IDS.superAdmin, async () => { await gate.promise; return { confirmed: 1 }; });
      await new Promise((r) => setTimeout(r, 20));
      let ran = 0;
      const route = cronRoute(db, () => { ran++; return { expired: 0 }; });
      const skipped = await route.GET(cronRequest(`Bearer ${SECRET}`));
      assert.deepEqual([skipped.status, await skipped.json()], [200, { ok: true, skipped: 'job_running' }]);
      assert.equal(ran, 0);
      gate.resolve();
      assert.equal((await manual).status, 'done');
      const next = await route.GET(cronRequest(`Bearer ${SECRET}`));
      assert.equal(next.status, 200);
      assert.equal(ran, 1);
      assert.deepEqual((await rows(db)).map((r) => [r.trigger, r.ok]), [['admin', true], ['cron', true]]);
    });
  } finally { await db.close(); }
});

test('zamanlayıcı: aynı çalışmanın ardışık yinelenen teslimi yeniden çalışır ve ayrı kayda geçer (iş gövdesi yinelenebilir olmalı)', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  captureLogs(t);
  const db = await createDb();
  try {
    await withSecret(async () => {
      let ran = 0;
      const route = cronRoute(db, () => { ran++; return { expired: 0, confirmed: 0 }; });
      for (let i = 0; i < 2; i++) assert.equal((await route.GET(cronRequest(`Bearer ${SECRET}`))).status, 200);
      assert.equal(ran, 2, 'uç teslimleri tekilleştirmez: koruma işlerin yinelenebilirliğidir (lib/orders/jobs.ts sözleşmesi)');
      assert.deepEqual((await rows(db)).map((r) => [r.trigger, r.ok]), [['cron', true], ['cron', true]]);
    });
  } finally { await db.close(); }
});

test('zamanlayıcı: süre sınırında yarıda kalmış (10 dk+) çalışma kilidi tutmaz; "abandoned" olarak kapanır, yeni çalışma başlar', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  captureLogs(t);
  const db = await createDb();
  try {
    await db.query(`INSERT INTO job_runs (job, trigger, scope, started_at) VALUES ('siparis-isleri', 'cron', 'all', now() - interval '11 minutes')`);
    await withSecret(async () => {
      let ran = 0;
      const route = cronRoute(db, () => { ran++; return {}; });
      assert.equal((await route.GET(cronRequest(`Bearer ${SECRET}`))).status, 200);
      assert.equal(ran, 1);
      assert.deepEqual((await rows(db)).map((r) => [r.trigger, r.ok, r.error, r.bitti]), [['cron', false, 'abandoned', true], ['cron', true, null, true]]);
      const health = await runs.jobHealth(adminClient(db), 'siparis-isleri', process.env);
      assert.equal(health.status, 'ok', 'son biten çalışma başarılı');
    });
  } finally { await db.close(); }
});

test('zamanlayıcı: iş kaydı işlevleri yoksa (020 uygulanmamış) iş yine bir kez çalışır; kayıtsız olduğu günlükte görünür', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  const logs = captureLogs(t);
  const db = await createDb();
  try {
    await withSecret(async () => {
      let ran = 0;
      const route = cronRoute(db, () => { ran++; return { expired: 2 }; }, { missing: true });
      const res = await route.GET(cronRequest(`Bearer ${SECRET}`));
      assert.deepEqual([res.status, await res.json()], [200, { ok: true, expired: 2 }]);
      assert.equal(ran, 1);
      assert.deepEqual(await rows(db), [], 'kayıt yok');
      assert.ok(logs.some((l) => l.includes('çalışma kaydı açılamadı')), 'kayıtsız çalışma günlükte');
      // Hazırlık bu durumda "doğrulandı" diyemez: kanıt yalnız job_runs'taki cron/ok kaydıdır (release-readiness-local).
    });
  } finally { await db.close(); }
});

test('zamanlayıcı: hata 500 ve kayıtta görünür; yanıt ayrıntı ve gizli değer taşımaz; günlükte gizli değer yok', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  const logs = captureLogs(t);
  const db = await createDb();
  try {
    await withSecret(async () => {
      const long = `veritabanı zaman aşımı ${'x'.repeat(700)}`;
      const route = cronRoute(db, () => { throw new Error(long); });
      const res = await route.GET(cronRequest(`Bearer ${SECRET}`));
      const text = await res.text();
      assert.equal(res.status, 500);
      assert.deepEqual(JSON.parse(text), { error: 'failed' }, 'iç hata yanıta yazılmaz');
      const [row] = await rows(db);
      assert.deepEqual([row.trigger, row.ok, row.bitti], ['cron', false, true]);
      assert.equal(row.error.length, 500, 'hata metni kayıtta, 500 karakterle sınırlı');
      assert.ok(row.error.startsWith('veritabanı zaman aşımı'));
      assert.ok(logs.some((l) => l.includes('[cron] siparis-isleri hata:')), 'hata günlükte');
      for (const s of [text, ...logs]) assert.ok(!s.includes(SECRET), 'gizli değer yanıtta ve günlükte yok');
      const health = await runs.jobHealth(adminClient(db), 'siparis-isleri', process.env);
      assert.equal(health.status, 'failing', 'sağlık ekranı hatayı gösterir');
    });
  } finally { await db.close(); }
});

test('zamanlayıcı: yetki başlığı birebir "Bearer <anahtar>" olmalı; biçim sapmaları işi çalıştırmaz', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  const logs = captureLogs(t);
  const db = await createDb();
  try {
    await withSecret(async () => {
      let ran = 0;
      const route = cronRoute(db, () => { ran++; return {}; });
      for (const h of [`bearer ${SECRET}`, `Bearer  ${SECRET}`, `Bearer ${SECRET} `, SECRET, `Bearer ${SECRET.slice(0, -1)}`, `Bearer ${SECRET}x`, 'Bearer ', '', `Basic ${Buffer.from(`x:${SECRET}`).toString('base64')}`]) {
        const res = await route.GET(cronRequest(h));
        assert.equal(res.status, 401, JSON.stringify(h.replace(SECRET, '‹anahtar›')));
        assert.deepEqual(await res.json(), { error: 'unauthorized' });
      }
      assert.equal(ran, 0);
      assert.deepEqual(await rows(db), []);
      for (const l of logs) assert.ok(!l.includes(SECRET));
    });
  } finally { await db.close(); }
});
