// Genel Bakış ve Finans uçları — tek finans hesabı (SQL 020 sonucu taklit), rol süzmesi, hata → 503.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';

const response = { json: (body, init) => ({ body, status: init?.status ?? 200, headers: init?.headers }) };
function query(data, error = null, count = 0) {
  const q = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'range', 'not', 'neq']) q[m] = () => q;
  q.maybeSingle = async () => ({ data, error });
  q.then = (resolve, reject) => Promise.resolve({ data, error, count }).then(resolve, reject);
  return q;
}
const OVERVIEW = {
  definitionsVersion: 1, timeZone: 'Europe/Istanbul', generatedAt: '2026-09-22T12:00:00Z',
  currentMonth: { key: '2026-09', from: '2026-08-31T21:00:00Z', to: '2026-09-30T21:00:00Z', orderCollectionsKurus: 50000, duplicateChargesKurus: 20000,
    orderRefundsKurus: 20000, duplicateRefundsKurus: 10000, netCashKurus: 40000, paidQuantity: 50, paidOrderCount: 2 },
  allTime: { heldOrderValueKurus: 70000, heldOrderCount: 3, releasedQuantity: 50, refundedOrderCount: 1 },
  liabilities: { orderRefundLiabilityKurus: 30000, orderRefundLiabilityCount: 1, duplicateLiabilityKurus: 20000, duplicateLiabilityCount: 1, overdueRefundCount: 1 },
  pending: { payableKurus: 20000, payableCount: 1 },
  operations: { awaitingBatchCount: 2 },
  months: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((key, i) => ({ key, orderCollectionsKurus: i * 1000, duplicateChargesKurus: 0, refundsKurus: 0, netCashKurus: i * 1000, paidQuantity: i })),
};
const overviewModule = load('lib/finance/overview.ts', {});
// İzin modülü taklit edilir: gerçek modül veritabanından etkili yetki okur (021).
const ROLE_PERMISSIONS = { SUPER_ADMIN: ['finance.read', 'refunds.execute'], FINANCE: ['finance.read', 'refunds.execute'], OPERATIONS: [], ENGINEER: [] };
const guardFor = (role) => ({ admin: { role, is_active: true, user_id: 'u', id: 'a', full_name: 'T', email: 't@example.invalid' },
  access: { adminId: 'a', permissions: ROLE_PERMISSIONS[role].map((key) => ({ key, scope: { kind: 'all' } })), roles: [], limits: { refundKurus: null } }, error: null });
const permissionsFor = (role) => ({
  can: (access, key) => Boolean(access?.permissions?.some((p) => p.key === key)),
  requireAdminAccess: async () => guardFor(role),
  requirePermission: async (_request, key) =>
    ROLE_PERMISSIONS[role].includes(key) ? guardFor(role) : { admin: null, access: null, error: response.json({ ok: false, error: { code: 'forbidden', message: 'Bu işlem için yetkiniz yok.' } }, { status: 403 }) },
});

function db({ rpcError = null, tableErrors = {}, tables = {} } = {}) {
  return {
    rpc: async (name) => (name === 'admin_finance_overview' ? (rpcError ? { data: null, error: rpcError } : { data: OVERVIEW, error: null }) : { data: null, error: { message: 'unexpected' } }),
    from: (table) => query(tables[table] ?? [], tableErrors[table] ?? null, 3),
  };
}

function dashboard(role, client) {
  return load('app/api/admin/dashboard/route.ts', {
    'next/server': { NextResponse: response },
    '@/lib/supabase/server': { createServiceRoleClient: () => client },
    '@/lib/admin/permissions': permissionsFor(role),
    '@/lib/finance/overview': overviewModule,
  });
}

test('Genel Bakış: finans rolüne tek hesaptan tutarlar; diğer rollere yalnız sayılar', async () => {
  const fin = await dashboard('FINANCE', db()).GET({});
  assert.equal(fin.status, 200);
  assert.equal(fin.body.kpis.netRevenueKurus, 70000, 'elde tutulan sipariş tutarı (tüm zamanlar)');
  assert.equal(fin.body.kpis.pendingRefunds, 1);
  assert.equal(fin.body.kpis.pendingDuplicateRefunds, 1);
  assert.equal(fin.body.kpis.overdueRefunds, 1);
  assert.equal(fin.body.kpis.awaitingBatch, 2);
  assert.equal(fin.body.monthlyGrowth.length, 6);
  assert.deepEqual(fin.body.monthlyGrowth[5], { month: 'Eyl 26', seeds: 5, revenue: 50 });
  assert.equal(fin.body.overview.currentMonth.netCashKurus, 40000);
  const ops = await dashboard('OPERATIONS', db()).GET({});
  assert.equal(ops.status, 200);
  assert.equal('netRevenueKurus' in ops.body.kpis, false);
  assert.equal('revenue' in ops.body.monthlyGrowth[0], false);
  assert.equal('overview' in ops.body, false);
  assert.equal(ops.body.kpis.orderCount, 3);
});

test('Genel Bakış: finans hesabı ya da alt sorgu okunamazsa 503 (sıfır gösterilmez)', async () => {
  assert.equal((await dashboard('SUPER_ADMIN', db({ rpcError: { message: 'boom' } })).GET({})).status, 503);
  assert.equal((await dashboard('SUPER_ADMIN', db({ tableErrors: { lands: { message: 'boom' } } })).GET({})).status, 503);
});

function finance(role, client) {
  return load('app/api/admin/finance/route.ts', {
    'next/server': { NextResponse: response },
    '@/lib/admin/permissions': permissionsFor(role),
    '@/lib/supabase/server': { createServiceRoleClient: () => client },
    '@/lib/admin/read-pages': load('lib/admin/read-pages.ts', {}),
    '@/lib/finance/overview': overviewModule,
  });
}

test('Finans: eski alanlar tek hesaptan; çift tahsilat hem tahsilatta hem yükümlülükte; B2B ayrı', async () => {
  const tables = {
    payments: [
      { id: 'b2b-1', amount: '123.45', status: 'success', updated_at: '2026-08-31T21:30:00Z', created_at: '2026-08-30T10:00:00Z', orders: { buyer_email: 'kurum@example.com', total_seeds: 500 } },
      { id: 'b2b-2', amount: '99.00', status: 'success', updated_at: '2026-08-31T20:30:00Z', created_at: '2026-08-30T10:00:00Z', orders: null },
    ],
    release_orders: [{ order_no: 'SG-2026-AAAAAA', buyer_email: 'a@example.com', quantity: 20, total_kurus: 20000, status: 'confirmed', paid_at: '2026-09-02T10:00:00Z', created_at: '2026-09-02T09:00:00Z' }],
  };
  const client = db({ tables });
  // readPages ilk sayfada veriyi, ikinci sayfada boş listeyi görmeli.
  let page = 0;
  const from = client.from;
  client.from = (table) => (table === 'payments' ? query(page++ === 0 ? tables.payments : []) : from(table));
  const res = await finance('FINANCE', client).GET({});
  assert.equal(res.status, 200);
  const b = res.body;
  assert.equal(b.monthlyRevenue, 400);
  assert.equal(b.monthlyGross, 700, 'sipariş + çift tahsilat');
  assert.equal(b.monthlyRefunds, 300, 'sipariş + çift tahsilat iadeleri');
  assert.equal(b.pendingRefundAmount, 500, 'iade bekleyen sipariş + iade edilmemiş çift tahsilat');
  assert.equal(b.pendingAmount, 200, 'yalnız ödenebilir bekleyen');
  assert.equal(b.b2bMonthlyRevenue, 123.45, 'B2B: İstanbul ayına göre (31 Ağu 21:30 UTC = 1 Eyl TSİ)');
  assert.equal(b.recentTransactions.length, 3);
  assert.equal(b.recentTransactions[0].id, 'SG-2026-AAAAAA');
  assert.equal(b.overview.definitionsVersion, 1);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});

test('Finans: yetkisiz rol 403, veri hatası 503', async () => {
  assert.equal((await finance('OPERATIONS', db()).GET({})).status, 403);
  assert.equal((await finance('FINANCE', db({ rpcError: { message: 'boom' } })).GET({})).status, 503);
  assert.equal((await finance('FINANCE', db({ tableErrors: { corporate_quotes: { message: 'boom' } } })).GET({})).status, 503);
});
