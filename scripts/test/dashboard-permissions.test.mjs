// Real permission guard/normalizer + real route. Only session, DB and response adapter are mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource as load} from './load-source.mjs';

const response = {json: (body, init) => ({body, status: init?.status ?? 200, headers: init?.headers})};
const permissionKeys = load('lib/admin/permission-keys.ts');
const envelope = load('lib/api/envelope.ts', {'next/server': {NextResponse: response}});
const overviewModule = load('lib/finance/overview.ts');
const overview = {
  definitionsVersion: 1, generatedAt: '2026-09-27T12:00:00Z', currentMonth: {key: '2026-09'},
  allTime: {heldOrderValueKurus: 75000, heldOrderCount: 7, releasedQuantity: 240},
  liabilities: {orderRefundLiabilityCount: 2, duplicateLiabilityCount: 3, overdueRefundCount: 1},
  operations: {awaitingBatchCount: 4},
  months: [{key: '2026-09', paidQuantity: 80, netCashKurus: -12345}],
};
const lands = [
  {id: 's1', name: 'Saha 1', capacity_seeds: 100, filled_seeds: 70, reserved_seeds: 25, status: 'active', is_public: true},
  {id: 's2', name: 'Saha 2', capacity_seeds: 100, filled_seeds: 200, reserved_seeds: 0, status: 'active', is_public: true},
  {id: 's3', name: 'Özel', capacity_seeds: 1000, filled_seeds: 999, reserved_seeds: 0, status: 'active', is_public: false},
];
const full = (...keys) => keys.map(key => ({key, scopes: [{kind: 'all'}]}));
const scoped = (key, kind = 'assigned') => ({key, scopes: [kind === 'sites' ? {kind, siteIds: ['s1']} : {kind}]});
const relevant = ['orders.read', 'batches.read', 'sites.read', 'requests.read', 'invoices.read', 'finance.read'];

function setup({permissions = [], role = 'NONE', errors = {}, authStatus, accessError = false, throwTable, tableData = {}, serverCap = 1000, respond} = {}) {
  const calls = [];
  const db = {
    rpc: async (name, args) => {
      calls.push({rpc: name, args});
      if (name === 'admin_effective_permissions') return {data: {adminId: 'admin', permissions, roles: []}, error: accessError ? {code: 'test_access_error'} : null};
      assert.equal(name, 'admin_finance_overview');
      return {data: overview, error: errors.overview ?? null};
    },
    from: (table) => {
      calls.push({table});
      if (table === throwTable) throw new Error('secret provider detail');
      const filters = []; let from = 0, to = Infinity;
      const q = {
        select: (...args) => {calls.push({select: table, args}); return q;},
        eq: (key, value) => {filters.push([key, value]); calls.push({filter: table, key, value}); return q;},
        in: (key, value) => {filters.push([key, value]); calls.push({filter: table, key, value}); return q;},
        order: (key, opts) => {calls.push({order: table, key, opts}); return q;},
        range: (start, end) => {from = start; to = end; calls.push({range: table, from, to}); return q;},
        then: (resolve, reject) => {
          const source = tableData[table] ?? (table === 'lands' ? lands : table === 'corporate_quotes' ? [{status: 'PENDING'}, {status: 'quoted'}] : []);
          const filtered = source.filter(row => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
          const result = {
            data: filtered.slice(from, Math.min(to + 1, from + serverCap)),
            count: table === 'corporate_quotes' ? filtered.length : table === 'order_invoices' ? 6 : filters.some(([k,v]) => k === 'status' && v === 'new') ? 8 : 9,
            error: errors[table] ?? null,
          };
          return Promise.resolve(respond ? respond(table, {from, to, filters}, result) : result).then(resolve, reject);
        },
      };
      return q;
    },
  };
  const gate = load('lib/admin/permissions.ts', {
    '@/lib/admin-auth': {requireAdmin: async () => authStatus
      ? {admin: null, error: response.json({}, {status: authStatus})}
      : {admin: {id: 'admin', user_id: 'user', role, is_active: true}, error: null}},
    '@/lib/api/envelope': envelope,
    '@/lib/supabase/server': {createServiceRoleClient: () => db},
    './mfa': {sessionAssurance: async () => ({aal: 'aal1', verifiedAt: null, enrolled: false})},
    './permission-keys': permissionKeys,
  });
  const route = load('app/api/admin/dashboard/route.ts', {
    'next/server': {NextResponse: response},
    '@/lib/supabase/server': {createServiceRoleClient: () => db},
    '@/lib/admin/permissions': gate,
    '@/lib/finance/overview': overviewModule,
    '@/lib/admin/read-pages': load('lib/admin/read-pages.ts'),
  });
  return {get: () => route.GET({}), calls, operational: () => calls.filter(c => c.table || c.rpc === 'admin_finance_overview')};
}
function noStore(res) { assert.equal(res.headers['Cache-Control'], 'private, no-store'); }
function noRaw(res) { assert.equal('overview' in res.body, false); }

test('Dashboard: NONE, invite-only and narrow scopes return empty shell without operational queries', async () => {
  for (const permissions of [[], full('staff.invite'), relevant.map(k => scoped(k)), relevant.map(k => scoped(k, 'sites')),
    relevant.map(key => ({key, scopes: [{kind: 'unknown'}]}))]) {
    const app = setup({permissions}); const res = await app.get();
    assert.equal(res.status, 200); assert.deepEqual(res.body.kpis, {});
    assert.deepEqual(Object.keys(res.body).sort(), ['definitionsVersion', 'generatedAt', 'kpis']);
    assert.ok(Number.isFinite(Date.parse(res.body.generatedAt)));
    assert.deepEqual(app.operational(), []); noStore(res);
  }
});

test('Dashboard: sites-only queries only lands; capacity excludes private sites and never becomes negative', async () => {
  const app = setup({permissions: full('sites.read'), errors: {overview: {}, corporate_quotes: {}, order_invoices: {}, service_requests: {}}});
  const res = await app.get();
  assert.equal(res.status, 200); assert.deepEqual(res.body.kpis, {publicSites: 2, freeCapacity: 5});
  assert.deepEqual(res.body.capacityAlerts.map(x => [x.id,x.pct,x.available]), [['s1',95,5],['s2',200,0]]);
  assert.deepEqual(app.operational(), [{table: 'lands'}, {table: 'lands'}]);
  assert.ok(app.calls.some(c => c.filter === 'lands' && c.key === 'is_public' && c.value === true));
  assert.ok(app.calls.some(c => c.order === 'lands' && c.key === 'id' && c.opts.ascending));
  assert.equal('monthlyGrowth' in res.body, false); noRaw(res); noStore(res);
});

test('Dashboard: custom finance gets money/refund metrics without orders, batches, B2B or raw overview', async () => {
  const app = setup({permissions: full('finance.read')}); const res = await app.get();
  assert.deepEqual(res.body.kpis, {netRevenueKurus: 75000, pendingRefunds: 2, pendingDuplicateRefunds: 3, overdueRefunds: 1});
  assert.deepEqual(res.body.monthlyGrowth, [{month: 'Eyl 26', revenue: -123.45}]);
  assert.deepEqual(app.operational(), [{rpc: 'admin_finance_overview', args: {p_months: 6}}]);
  assert.equal(res.body.generatedAt, overview.generatedAt); noRaw(res); noStore(res);
});

test('Dashboard: orders and batches independently receive their own overview subset', async () => {
  const orders = await setup({permissions: full('orders.read')}).get();
  assert.deepEqual(orders.body.kpis, {orderCount: 7, releasedQuantity: 240});
  assert.deepEqual(orders.body.monthlyGrowth, [{month: 'Eyl 26', seeds: 80}]); noRaw(orders);
  const batches = await setup({permissions: full('batches.read')}).get();
  assert.deepEqual(batches.body.kpis, {awaitingBatch: 4});
  assert.equal('monthlyGrowth' in batches.body, false); noRaw(batches);
});

test('Dashboard: mixed full and scoped grants do not promote unrelated scoped metrics', async () => {
  const app = setup({permissions: [...full('sites.read','invoices.read'), scoped('orders.read'), scoped('finance.read','sites'), scoped('requests.read')]});
  const res = await app.get();
  assert.deepEqual(res.body.kpis, {pendingInvoices: 6, publicSites: 2, freeCapacity: 5});
  assert.deepEqual(app.operational(), [{table: 'order_invoices'}, {table: 'lands'}, {table: 'lands'}]);
  assert.ok(app.calls.some(c => c.filter === 'order_invoices' && c.key === 'release_orders.is_test' && c.value === false));
  assert.equal('monthlyGrowth' in res.body, false);
});

test('Dashboard: request counts query only their statuses and preserve exact/head aggregation', async () => {
  const app = setup({permissions: full('requests.read')}); const res = await app.get();
  assert.deepEqual(res.body.kpis, {newRequests: 8, contactedRequests: 9});
  assert.deepEqual(app.operational(), [{table: 'service_requests'}, {table: 'service_requests'}]);
  assert.deepEqual(app.calls.filter(c => c.select).map(c => c.args), [['id', {count: 'exact', head: true}], ['id', {count: 'exact', head: true}]]);
});

test('Dashboard: legacy B2B role is exact and independent of custom finance permission', async () => {
  for (const role of ['SUPER_ADMIN','FINANCE']) {
    const app = setup({role}); const res = await app.get();
    assert.deepEqual(res.body.kpis, {pendingB2b: 1, quotedB2b: 1});
    assert.deepEqual(app.operational(), [{table: 'corporate_quotes'}, {table: 'corporate_quotes'}]);
    assert.deepEqual(app.calls.filter(c => c.select === 'corporate_quotes').map(c => c.args), [['id', {count: 'exact', head: true}], ['id', {count: 'exact', head: true}]]);
  }
  for (const role of ['NONE','OPERATIONS','ENGINEER']) {
    const app = setup({role, permissions: full('finance.read')}); const res = await app.get();
    assert.equal('pendingB2b' in res.body.kpis, false);
    assert.equal(app.calls.some(c => c.table === 'corporate_quotes'), false);
  }
});

test('Dashboard: all full grants include every KPI but never raw overview', async () => {
  const app = setup({role: 'SUPER_ADMIN', permissions: full(...relevant)}); const res = await app.get();
  assert.equal(Object.keys(res.body.kpis).length, 14);
  assert.deepEqual(res.body.monthlyGrowth, [{month: 'Eyl 26', seeds: 80, revenue: -123.45}]);
  noRaw(res); noStore(res);
});

test('Dashboard: permitted table/RPC failure and thrown provider error are 503, private/no-store, without details', async () => {
  for (const [permissions, role, table] of [
    [full('sites.read'),'NONE','lands'], [full('invoices.read'),'NONE','order_invoices'],
    [full('requests.read'),'NONE','service_requests'], [full('finance.read'),'NONE','overview'],
    [full('orders.read'),'NONE','overview'], [full('batches.read'),'NONE','overview'], [[], 'FINANCE','corporate_quotes'],
  ]) {
    const res = await setup({permissions, role, errors: {[table]: {message: 'secret provider detail'}}}).get();
    assert.equal(res.status, 503); assert.deepEqual(res.body, {error: 'unavailable'}); noStore(res);
  }
  const thrown = await setup({permissions: full('sites.read'), throwTable: 'lands'}).get();
  assert.equal(thrown.status, 503); assert.deepEqual(thrown.body, {error: 'unavailable'}); noStore(thrown);
});

test('Dashboard: unauthenticated/inactive session is denied before any metric/permission query', async () => {
  for (const authStatus of [401,403]) {
    const app = setup({authStatus, permissions: full(...relevant), role: 'SUPER_ADMIN'}); const res = await app.get();
    assert.equal(res.status, authStatus); assert.deepEqual(app.calls, []); noStore(res);
  }
});

test('Dashboard: failed effective-permission lookup cannot expose operational data to NONE role', async () => {
  const app = setup({accessError: true, permissions: full(...relevant)}); const res = await app.get();
  assert.equal(res.status, 200); assert.deepEqual(res.body.kpis, {}); assert.deepEqual(app.operational(), []); noStore(res);
});


test('Dashboard: all public sites survive server row caps; private rows never consume pages', async () => {
  const publicSites = Array.from({length: 1001}, (_, i) => ({id: String(i).padStart(5, '0'), name: `Public ${i}`, is_public: true, capacity_seeds: 100, filled_seeds: i === 1000 ? 95 : 0, reserved_seeds: 0, status: 'open'}));
  const privateSites = Array.from({length: 1000}, (_, i) => ({...publicSites[0], id: `private-${i}`, is_public: false}));
  const app = setup({permissions: full('sites.read'), tableData: {lands: [...privateSites, ...publicSites]}, serverCap: 200});
  const res = await app.get(); assert.equal(res.status, 200);
  assert.deepEqual(res.body.kpis, {publicSites: 1001, freeCapacity: 100005});
  assert.deepEqual(res.body.capacityAlerts.map(a => a.id), ['01000']);
  assert.deepEqual(app.calls.filter(c => c.range === 'lands').map(c => c.from), [0,200,400,600,800,1000,1001]);
});

test('Dashboard: B2B exact counts exceed 1000 rows and include both case variants', async () => {
  const quotes = [...Array.from({length: 1001}, (_, i) => ({status: i % 2 ? 'PENDING' : 'pending'})),
    ...Array.from({length: 1002}, (_, i) => ({status: i % 2 ? 'QUOTED' : 'quoted'})), {status: 'rejected'}];
  const app = setup({role: 'FINANCE', tableData: {corporate_quotes: quotes}, serverCap: 100});
  const res = await app.get(); assert.equal(res.status, 200);
  assert.deepEqual(res.body.kpis, {pendingB2b: 1001, quotedB2b: 1002});
  assert.equal(app.calls.some(c => c.range === 'corporate_quotes'), false);
});

test('Dashboard: missing, undefined or malformed exact count responses never become zero', async () => {
  const malformed = [undefined, null, {}, {error: null}, {error: null, count: undefined}, {error: null, count: null},
    {error: null, count: -1}, {error: null, count: '0'}, {error: null, count: NaN}, {error: null, count: 0.5}, {error: null, count: Number.MAX_SAFE_INTEGER + 1}];
  for (const [permissions, role, table] of [[full('invoices.read'), 'NONE', 'order_invoices'], [full('requests.read'), 'NONE', 'service_requests'], [[], 'FINANCE', 'corporate_quotes']]) {
    for (const response of malformed) {
      const app = setup({permissions, role, respond: (name, _query, result) => name === table ? response : result});
      const res = await app.get(); assert.equal(res.status, 503); assert.deepEqual(res.body, {error: 'unavailable'}); noStore(res);
    }
    // HEAD legitimately has no data rows; a present exact zero count is valid.
    const res = await setup({permissions, role, respond: (name, _query, result) => name === table ? {error: null, data: null, count: 0} : result}).get();
    assert.equal(res.status, 200); assert.ok(Object.values(res.body.kpis).every(n => n === 0));
  }
});

test('Dashboard: missing first/late site page and late errors discard every partial total', async () => {
  for (const broken of [undefined, null, {}, {error: null, data: null}, {error: null, data: undefined}, {error: null, data: {}}, {error: {code: 'fixture'}, data: []}]) {
    for (const failAt of [0, 1]) {
      let page = 0;
      const app = setup({permissions: full('sites.read'), serverCap: 1, respond: (name, _query, result) => name === 'lands' && page++ === failAt ? broken : result});
      const res = await app.get(); assert.equal(res.status, 503); assert.deepEqual(res.body, {error: 'unavailable'}); noStore(res);
    }
  }
});


test('Dashboard: missing second status-count result rejects the complete response tuple', async () => {
  for (const [permissions, role, table, targetStatus] of [[[], 'FINANCE', 'corporate_quotes', 'QUOTED'], [full('requests.read'), 'NONE', 'service_requests', 'contacted']]) {
    for (const bad of [undefined, null, {error: null, data: null}]) {
      const app = setup({permissions, role, respond: (name, query, result) => name === table && query.filters.some(([key, value]) => key === 'status' && (Array.isArray(value) ? value.includes(targetStatus) : value === targetStatus)) ? bad : result});
      const res = await app.get(); assert.equal(res.status, 503); assert.deepEqual(res.body, {error: 'unavailable'}); noStore(res);
    }
  }
});
