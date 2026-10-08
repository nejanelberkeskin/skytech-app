// 35: yayına hazırlık — yerelde doğrulanabilen zincirler. Dış servis yok (ağ yasak), canlı kurulum yok.
//   1. Migration dizisi 019–023 (ve 016/017/020) test tabanında sırayla temiz uygulanır; izin ve iş kaydı işlevleri var.
//   2. Zamanlayıcı ucu: anahtar yoksa kapalı (503), yanlış anahtar 401, doğru anahtarla iş bir kez çalışır ve
//      job_runs'a gerçek 020 işlevleriyle yazılır; hazırlık ancak bu kayıttan sonra "doğrulandı" der.
//      Hata "failed", elle çalıştırma kanıt değil. (Asıl iş taklit: e-posta gönderen gövde ayrı sahiplikte ve testli.)
//   3. Bırakmada satış faturası kuyruğa girer (gerçek lib/orders/batches.ts); kesim elle (provider manual).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
import { createDb, IDS } from './pglite-db.mjs';
import { orderAt } from './order-admin-helpers.mjs';
import { adminClient } from './admin-rest-client.mjs';

const runs = await import('../../lib/jobs/runs.ts');
const readiness = await import('../../lib/orders/readiness.ts');
const schedule = load('lib/orders/schedule.ts');

/** RPC köprüsü: runRecorded'ın çağırdığı gerçek 020 işlevleri. */
const jobRpc = (db) => async (name, args) => {
  try {
    if (name === 'start_job_run') {
      const r = await db.query('SELECT public.start_job_run($1, $2, $3, $4) AS id', [args.p_job, args.p_trigger, args.p_scope, args.p_actor]);
      return { data: r.rows[0].id, error: null };
    }
    if (name === 'finish_job_run') {
      await db.query('SELECT public.finish_job_run($1, $2, $3::jsonb, $4)', [args.p_id, args.p_ok, args.p_report === null ? null : JSON.stringify(args.p_report), args.p_error]);
      return { data: null, error: null };
    }
    if (name === 'commit_reserved_capacity') {
      await db.query('SELECT public.commit_reserved_capacity($1, $2)', [args.p_land_id, args.p_quantity]);
      return { data: null, error: null };
    }
  } catch (e) {
    return { data: null, error: { message: e.message, code: e.code } };
  }
  throw new Error(`beklenmeyen RPC: ${name}`);
};

function cronRoute(db, job) {
  const client = adminClient(db, { rpc: jobRpc(db) });
  return load('app/api/cron/siparis-isleri/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/jobs/runs': runs,
    '@/lib/mail': { publicOrigin: (o) => o },
    '@/lib/orders/jobs': { runScheduledJobs: async () => job() },
    '@/lib/supabase/server': { createServiceRoleClient: () => client },
  });
}
const cronRequest = (authorization) => ({
  headers: new Map(authorization ? [['authorization', authorization]] : []),
  nextUrl: new URL('https://skytechgreen.com/api/cron/siparis-isleri'),
  url: 'https://skytechgreen.com/api/cron/siparis-isleri',
});
async function withEnv(vars, fn) {
  const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}
const cronItem = async (db, env) => {
  const evidence = await readiness.loadReadinessEvidence(adminClient(db));
  return readiness.salesReadiness({ ordersPaused: false }, env, evidence).items.find((i) => i.key === 'cron');
};
const jobRows = async (db) => (await db.query(`SELECT trigger, ok, error FROM job_runs WHERE job = 'siparis-isleri' ORDER BY started_at`)).rows;

test('35: 019–023 test tabanında sırayla temiz uygulanır; izin ve iş kaydı işlevleri hazır', async () => {
  const db = await createDb();
  try {
    const fns = (await db.query(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
      AND proname IN ('admin_effective_permissions','start_job_run','finish_job_run','admin_permission_keys','assign_admin_role','reserve_release_capacity')
      ORDER BY 1`)).rows.map((r) => r.proname);
    assert.deepEqual(fns, ['admin_effective_permissions', 'admin_permission_keys', 'assign_admin_role', 'finish_job_run', 'reserve_release_capacity', 'start_job_run']);
    const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      AND table_name IN ('job_runs','admin_roles','admin_role_assignments','admin_invitations') ORDER BY 1`)).rows.map((r) => r.table_name);
    assert.deepEqual(tables, ['admin_invitations', 'admin_role_assignments', 'admin_roles', 'job_runs']);
  } finally { await db.close(); }
});

test('35: zamanlayıcı ucu — anahtarsız kapalı, yanlış anahtar 401, doğru anahtarla tek çalışma ve job_runs kaydı; hazırlık yalnız bundan sonra doğrulandı', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  const db = await createDb();
  try {
    let ran = 0;
    const route = cronRoute(db, () => { ran++; return { expired: 0, confirmed: 2, monitoring: 0 }; });
    await withEnv({ CRON_SECRET: undefined }, async () => {
      const closed = await route.GET(cronRequest('Bearer herhangi'));
      assert.equal(closed.status, 503);
      assert.deepEqual(await closed.json(), { error: 'not_configured' });
    });
    await withEnv({ CRON_SECRET: 'yerel-deneme-anahtari' }, async () => {
      assert.equal((await route.GET(cronRequest('Bearer yanlis'))).status, 401);
      assert.equal((await route.GET(cronRequest(null))).status, 401);
      assert.equal(ran, 0, 'kimliksiz istek işi çalıştırmaz');
      assert.deepEqual(await jobRows(db), []);
      const before = await cronItem(db, process.env);
      assert.deepEqual([before.configured, before.verification, before.level], [true, 'not_verified', 'warning'], 'anahtar var ama kanıt yok');

      const okRun = await route.GET(cronRequest('Bearer yerel-deneme-anahtari'));
      assert.equal(okRun.status, 200);
      assert.deepEqual(await okRun.json(), { ok: true, expired: 0, confirmed: 2, monitoring: 0 });
      assert.equal(ran, 1);
      assert.deepEqual(await jobRows(db), [{ trigger: 'cron', ok: true, error: null }]);
      const after = await cronItem(db, process.env);
      assert.deepEqual([after.verification, after.level, after.lastResult.source], ['verified', 'ok', 'cron']);
      const health = await runs.jobHealth(adminClient(db), 'siparis-isleri', process.env);
      assert.deepEqual([health.status, health.cronConfigured, health.listViewSideEffects], ['ok', true, false]);
    });
  } finally { await db.close(); }
});

test('35: zamanlayıcı hatası kayda "failed" düşer; elle çalıştırma zamanlayıcıyı kanıtlamaz', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('ağ çağrısı yasak'); });
  const db = await createDb();
  try {
    await withEnv({ CRON_SECRET: 'yerel-deneme-anahtari' }, async () => {
      const manual = await runs.runRecorded(adminClient(db, { rpc: jobRpc(db) }), 'siparis-isleri', 'admin', 'status', IDS.superAdmin, async () => ({ confirmed: 1 }));
      assert.equal(manual.status, 'done');
      const item = await cronItem(db, process.env);
      assert.deepEqual([item.verification, item.lastResult.source], ['not_verified', 'admin']);

      const failing = cronRoute(db, () => { throw new Error('deneme hatası'); });
      const r = await failing.GET(cronRequest('Bearer yerel-deneme-anahtari'));
      assert.equal(r.status, 500);
      assert.deepEqual((await jobRows(db)).map((x) => [x.trigger, x.ok]), [['admin', true], ['cron', false]]);
      const failed = await cronItem(db, process.env);
      assert.deepEqual([failed.verification, failed.level, failed.lastResult.ok], ['failed', 'warning', false]);
    });
  } finally { await db.close(); }
});

test('35: bırakmada satış faturası kuyruğa girer (kesim elle); ikinci kez eklenmez', async () => {
  const db = await createDb();
  try {
    const state = load('lib/orders/state.ts');
    const store = load('lib/orders/store.ts', { '@/lib/supabase/server': { createServiceRoleClient: () => { throw new Error('istemci verilmeli'); } }, './state': state });
    const batches = load('lib/orders/batches.ts', { './certificates': { issueCertificate: async () => {} }, './schedule': schedule, './store': store });
    const client = adminClient(db, { rpc: jobRpc(db) });
    const confirmed = async () => {
      const id = await orderAt(db, IDS.land);
      await db.query(`UPDATE release_orders SET status='confirmed', confirmed_at=now() - interval '1 day', withdrawal_deadline=now() - interval '20 days' WHERE id=$1`, [id]);
      return id;
    };
    const order = await confirmed();
    // "Ödemede" kipinde faturası ödeme anında kuyruğa girmiş sipariş: bırakmada ikinci fatura eklenmez.
    const paidMode = await confirmed();
    await db.query(`INSERT INTO order_invoices(order_id, kind, provider, status, created_by) VALUES ($1, 'sale', 'manual', 'pending', 'payment')`, [paidMode]);
    const batch = (await db.query(`INSERT INTO release_batches(land_id, season_label) VALUES ($1, '2026-2027') RETURNING id`, [IDS.land])).rows[0].id;
    assert.deepEqual(await batches.assignOrders(batch, [order, paidMode], IDS.superAdmin, client), { ok: true, assigned: 2 });
    const released = await batches.completeRelease(batch, new Date().toISOString().slice(0, 10), IDS.superAdmin, client);
    assert.deepEqual(released, { ok: true, released: 2, skipped: [] });
    const invoicesOf = async (id) => (await db.query(`SELECT kind, provider, status, created_by FROM order_invoices WHERE order_id = $1`, [id])).rows;
    assert.deepEqual(await invoicesOf(order), [{ kind: 'sale', provider: 'manual', status: 'pending', created_by: 'system' }]);
    assert.deepEqual(await invoicesOf(paidMode), [{ kind: 'sale', provider: 'manual', status: 'pending', created_by: 'payment' }], 'ikinci fatura eklenmedi');
  } finally { await db.close(); }
});
