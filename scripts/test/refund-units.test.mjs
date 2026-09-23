// İade görünümü, sağlayıcı sınıflandırması, izinler, finans normalizasyonu, iş sağlığı — ağ/DB yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource, loadSource as load } from './load-source.mjs';
import { REFUND_VIEW_FIXTURES as F, REFUND_QUEUE_FIXTURE, FIXTURE_NOW } from '../../lib/refunds/fixtures.ts';
import { actionsFor } from '../../lib/refunds/model.ts';
import { mapSqlError } from '../../lib/refunds/service.ts';
import { normalizeOverview, monthLabel, istanbulMonthKey } from '../../lib/finance/overview.ts';
import { healthFrom, runRecorded } from '../../lib/jobs/runs.ts';

test('görünüm: her durumda izinli/engelli eylemler ve son tarih', () => {
  const first = (v) => v.operations[0];
  assert.deepEqual(first(F.notStarted).allowedActions, ['execute']);
  assert.equal(F.notStarted.due.dueAt, '2026-10-04T09:00:00.000Z');
  assert.equal(F.notStarted.due.daysLeft, 11);
  assert.equal(F.notStarted.due.overdue, false);
  assert.deepEqual(first(F.needsReview).allowedActions, ['resolve_succeeded']);
  assert.deepEqual(first(F.needsReview).blockedActions, [{ action: 'resolve_failed', reason: 'too_early', availableAt: '2026-09-22T14:30:00.000Z' }]);
  assert.deepEqual(first(F.failed).allowedActions, ['retry']);
  assert.deepEqual(first(F.providerSucceeded).allowedActions, ['finalize']);
  assert.deepEqual(first(F.completed).allowedActions, []);
  assert.equal(first(F.completed).completedAt, '2026-09-22T14:00:17.000Z');
  assert.equal(F.completed.due.overdue, false, 'tamamlanmış iade gecikmiş sayılmaz');
  assert.equal(F.overdueWithDuplicate.due.overdue, true);
  assert.equal(F.overdueWithDuplicate.due.basis, 'seller_cancellation');
  assert.deepEqual(F.overdueWithDuplicate.operations.map((o) => [o.kind, o.state, o.allowedActions.join()]), [['order', 'none', 'execute'], ['duplicate', 'none', 'execute']]);
  assert.deepEqual(first(F.readOnly).allowedActions, []);
  assert.deepEqual(first(F.readOnly).blockedActions, [{ action: 'execute', reason: 'forbidden' }]);
});

test('görünüm: geçmiş Türkçe özetleri ve yönetici etiketi', () => {
  const h = F.needsReview.history;
  assert.equal(h[0].type, 'refund_attempt_result');
  assert.equal(h[0].summary, '1. deneme: sonuç belirsiz (zaman aşımı). Mutabakat gerekli.');
  assert.equal(h[1].summary, 'İade başlatıldı: 200,00 TL.');
  assert.deepEqual(h[1].actor, { kind: 'admin', adminId: '10000000-0000-0000-0000-00000000000f', label: 'Finans Kullanıcısı' });
  assert.match(F.completed.history[0].summary, /^İade tamamlandı: 200,00 TL\.$/);
});

test('görünüm: 15 dk sonra "başladı" belirsiz sayılır; dikkat işaretli başarısızda yeniden deneme yok', () => {
  const now = FIXTURE_NOW;
  const startedAt = new Date(now.getTime() - 16 * 60_000).toISOString();
  const stale = actionsFor('started', { kind: 'order', attention: false, stale: true, attemptStartedAt: startedAt }, { now, canExecute: true, orderRefundable: true });
  assert.deepEqual(stale.allowedActions, ['resolve_succeeded']);
  const fresh = actionsFor('started', { kind: 'order', attention: false, stale: false, attemptStartedAt: now.toISOString() }, { now, canExecute: true, orderRefundable: true });
  assert.deepEqual(fresh.allowedActions, []);
  const attention = actionsFor('failed', { kind: 'order', attention: true, stale: false, attemptStartedAt: new Date(now.getTime() - 40 * 60_000).toISOString() }, { now, canExecute: true, orderRefundable: true });
  assert.deepEqual(attention.allowedActions, ['resolve_succeeded', 'resolve_failed']);
  const gone = actionsFor('failed', { kind: 'order', attention: false, stale: false, attemptStartedAt: null }, { now, canExecute: true, orderRefundable: false });
  assert.deepEqual(gone.blockedActions, [{ action: 'retry', reason: 'order_not_refundable' }]);
});

test('kuyruk: son tarihi geçen en üstte', () => {
  assert.equal(REFUND_QUEUE_FIXTURE.length, 2);
  assert.equal(REFUND_QUEUE_FIXTURE[0].due.overdue, true);
  assert.equal(REFUND_QUEUE_FIXTURE[0].state, 'none');
  assert.equal(REFUND_QUEUE_FIXTURE[1].state, 'needs_review');
});

test('SQL hata eşlemesi: bilinen kodlar ve bilinmeyen → 503', () => {
  assert.deepEqual(mapSqlError({ message: 'too_early', details: '2026-09-22T14:30:00.000Z' }),
    { ok: false, status: 409, code: 'too_early', message: '"İade yapılmadı" kararı deneme başlangıcından 30 dakika sonra verilebilir.', details: { availableAt: '2026-09-22T14:30:00.000Z' } });
  assert.equal(mapSqlError({ message: 'attempt_changed' }).status, 409);
  assert.equal(mapSqlError({ message: 'forbidden' }).status, 403);
  assert.equal(mapSqlError({ message: 'Could not find the function public.claim_refund_operation', code: 'PGRST202' }).code, 'unavailable');
});

/* ── iyzico iade şelalesi ─────────────────────────────────────────────── */

function iyzico(responses) {
  const calls = [];
  const sdk = {};
  for (const resource of ['refundV2', 'refund', 'cancel']) {
    sdk[resource] = {
      create(request, cb) {
        calls.push(resource);
        const r = responses[resource];
        if (r === 'throw') throw new Error('SDK yapılandırılmamış');
        if (r === 'network') return cb(new Error('socket hang up'));
        cb(null, r ?? { status: 'failure', errorCode: '9999', errorMessage: 'bilinmeyen' });
      },
    };
  }
  const mod = loadSource('lib/payments/iyzico.ts', { '@/lib/iyzico': { default: sdk }, '@/lib/tr-iller': { ilAdi: () => null } });
  return { mod, calls };
}
const input = { paymentId: 'P1', amountKurus: 20000, orderNo: 'SG-2026-AAAAAA', meta: { paymentTransactionIds: ['T1'] }, ip: null };

test('iyzico: başarı, iptal yöntemi ve kimlik', async () => {
  const ok = iyzico({ refundV2: { status: 'success', paymentId: 'P1' } });
  assert.deepEqual(await ok.mod.refundWithIyzico(input), { ok: true, refundId: 'P1', method: 'refund' });
  assert.deepEqual(ok.calls, ['refundV2']);
  const cancel = iyzico({ refundV2: { status: 'failure', errorCode: '5001' }, refund: { status: 'failure', errorCode: '5002' }, cancel: { status: 'success', paymentId: 'P1' } });
  assert.deepEqual(await cancel.mod.refundWithIyzico(input), { ok: true, refundId: 'P1', method: 'cancel' });
  assert.deepEqual(cancel.calls, ['refundV2', 'refund', 'cancel']);
});

test('iyzico: bağlantı hatasında şelale durur, sonuç belirsiz (ikinci para işlemi yok)', async () => {
  const x = iyzico({ refundV2: 'network' });
  const r = await x.mod.refundWithIyzico(input);
  assert.equal(r.ok, false);
  assert.equal(r.outcome, 'unknown');
  assert.equal(r.errorCode, 'network');
  assert.deepEqual(x.calls, ['refundV2']);
});

test('iyzico: açık hatalar doğrulanmış listede değilse belirsiz, listedeyse kesin ret; SDK çağrılamazsa gönderilmedi', async () => {
  const explicit = { refundV2: { status: 'failure', errorCode: '5001' }, refund: { status: 'failure', errorCode: '5002' }, cancel: { status: 'failure', errorCode: '5003' } };
  const a = iyzico(explicit);
  const unknown = await a.mod.refundWithIyzico(input);
  assert.equal(unknown.outcome, 'unknown');
  assert.equal(unknown.errorCode, '5003');
  assert.equal(a.mod.DEFINITIVE_REFUND_ERROR_CODES.size, 0, 'liste sandbox kabulüne kadar boş');
  const b = iyzico(explicit);
  const rejected = await b.mod.refundWithIyzico(input, undefined, new Set(['5001', '5002', '5003']));
  assert.equal(rejected.outcome, 'rejected');
  const c = iyzico({ refundV2: 'throw', refund: 'throw', cancel: 'throw' });
  const notSent = await c.mod.refundWithIyzico(input);
  assert.equal(notSent.outcome, 'not_sent');
  assert.equal(notSent.errorCode, 'config');
});

test('taklit sağlayıcı: MOCK_REFUND_OUTCOME kipleri, canlıda kapalı', async () => {
  const { mockProvider } = await import('../../lib/payments/mock.ts');
  const prev = { mode: process.env.MOCK_REFUND_OUTCOME, env: process.env.VERCEL_ENV };
  try {
    delete process.env.VERCEL_ENV;
    for (const [mode, expected] of [[undefined, 'ok'], ['rejected', 'rejected'], ['unknown', 'unknown'], ['not_sent', 'not_sent']]) {
      if (mode) process.env.MOCK_REFUND_OUTCOME = mode; else delete process.env.MOCK_REFUND_OUTCOME;
      const r = await mockProvider.refund();
      assert.equal(r.ok ? 'ok' : r.outcome, expected);
    }
    process.env.VERCEL_ENV = 'production';
    const off = await mockProvider.refund();
    assert.equal(off.ok, false);
    assert.equal(off.error, 'mock_disabled');
  } finally {
    if (prev.mode === undefined) delete process.env.MOCK_REFUND_OUTCOME; else process.env.MOCK_REFUND_OUTCOME = prev.mode;
    if (prev.env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = prev.env;
  }
});

/* ── İzinler ──────────────────────────────────────────────────────────── */

test('izinler: çözümlenmiş erişimle kontrol (rol eşlemesi artık veritabanında, 021)', async () => {
  const keys = load('lib/admin/permission-keys.ts');
  const permissions = load('lib/admin/permissions.ts', {
    'next/server': {}, '@/lib/rbac': {}, '@/lib/admin-auth': {},
    '@/lib/api/envelope': { fail: (status, code) => ({ status, code }) },
    '@/lib/supabase/server': { createServiceRoleClient: () => ({}) },
    './mfa': { sessionAssurance: async () => ({ aal: 'aal1', verifiedAt: null, enrolled: false }) },
    './permission-keys': keys,
  });
  const access = keys.toEffectiveAccess({ adminId: 'a', permissions: [{ key: 'refunds.execute', scopes: [{ kind: 'all' }] }], roles: [], limits: {} });
  assert.equal(permissions.can(access, 'refunds.execute'), true);
  assert.equal(permissions.can(access, 'staff.manage'), false);
  assert.equal(permissions.can(null, 'refunds.execute'), false);
});

/* ── Finans ve iş sağlığı ─────────────────────────────────────────────── */

test('finans: normalizasyon, ay etiketi, İstanbul ayı', () => {
  assert.throws(() => normalizeOverview({ months: [] }), /malformed/);
  const o = normalizeOverview({ currentMonth: { key: '2026-09', netCashKurus: '1500' }, months: [{ key: '2026-09', paidQuantity: 20 }], liabilities: {} });
  assert.equal(o.currentMonth.netCashKurus, 1500);
  assert.equal(o.liabilities.duplicateLiabilityKurus, 0);
  assert.equal(monthLabel('2026-09'), 'Eyl 26');
  assert.equal(istanbulMonthKey('2026-08-31T21:30:00Z'), '2026-09');
});

test('iş sağlığı: durumlar', () => {
  const now = new Date('2026-09-22T12:00:00Z');
  const run = (over) => ({ id: 'r', trigger: 'cron', scope: 'all', actor: null, started_at: '2026-09-22T03:00:00Z', finished_at: '2026-09-22T03:00:30Z', ok: true, error: null, report: {}, ...over });
  assert.equal(healthFrom('siparis-isleri', [run()], false, now).status, 'not_configured');
  assert.equal(healthFrom('siparis-isleri', [], true, now).status, 'never_run');
  assert.equal(healthFrom('siparis-isleri', [run({ ok: false, error: 'x' })], true, now).status, 'failing');
  assert.equal(healthFrom('siparis-isleri', [run({ started_at: '2026-09-20T03:00:00Z', finished_at: '2026-09-20T03:00:30Z' })], true, now).status, 'stale');
  const ok = healthFrom('siparis-isleri', [run(), run({ id: 'x', started_at: '2026-09-22T11:55:00Z', finished_at: null, ok: null })], true, now);
  assert.equal(ok.status, 'ok');
  assert.equal(ok.running, true);
  assert.equal(ok.listViewSideEffects, true);
  assert.equal(JSON.stringify(ok).includes('SECRET'), false);
});

test('iş kaydı: kilit, kayıtsız cron, elle çalıştırmada kilitsiz çalışma yok, hata kaydı', async () => {
  const calls = [];
  const db = (start) => ({ rpc: async (name, args) => { calls.push([name, args]); return name === 'start_job_run' ? start : { data: null, error: null }; } });
  assert.deepEqual(await runRecorded(db({ error: { message: 'job_running' } }), 'siparis-isleri', 'admin', 'status', 'u', async () => ({})), { status: 'running' });
  assert.deepEqual(await runRecorded(db({ error: { message: 'function missing' } }), 'siparis-isleri', 'admin', 'status', 'u', async () => ({ a: 1 })), { status: 'unavailable' });
  const logs = [];
  const cron = await runRecorded(db({ error: { message: 'function missing', code: 'PGRST202' } }), 'siparis-isleri', 'cron', 'all', null, async () => ({ a: 1 }), (m) => logs.push(m));
  assert.deepEqual(cron, { status: 'done', runId: null, recorded: false, report: { a: 1 } });
  assert.equal(logs.length, 1);
  calls.length = 0;
  const done = await runRecorded(db({ data: 'run-1', error: null }), 'siparis-isleri', 'admin', 'status', 'u', async () => ({ expired: 2 }));
  assert.deepEqual(done, { status: 'done', runId: 'run-1', recorded: true, report: { expired: 2 } });
  assert.deepEqual(calls[1], ['finish_job_run', { p_id: 'run-1', p_ok: true, p_report: { expired: 2 }, p_error: null }]);
  const failed = await runRecorded(db({ data: 'run-2', error: null }), 'siparis-isleri', 'admin', 'all', 'u', async () => { throw new Error('patladı'); });
  assert.deepEqual(failed, { status: 'failed', runId: 'run-2', error: 'patladı' });
});
