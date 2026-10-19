// Paraşüt otomatik fatura: sahte Paraşüt sunucusu + bellek içi veritabanı ile akış; 045 gerçek SQL (PGlite).
// Gerçek Paraşüt, gerçek fatura ya da ağ çağrısı yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createParasutClient, parasutConfig } from '../../lib/invoicing/parasut.ts';
import { runParasutInvoices, netUnitPrice, totalsMatch, MAX_ATTEMPTS, PLACEHOLDER_TCKN } from '../../lib/invoicing/issue.ts';
import { createDb, insertOrder, sqlError } from './pglite-db.mjs';

const CFG = { clientId: 'c', clientSecret: 's', username: 'u@x.com', password: 'p', companyId: '115' };

/** Sahte Paraşüt: durum + çağrı kaydı. `opts.jobStatuses` sırayla döner; `inbox` VKN → e-Fatura etiketi. */
function fakeParasut(opts = {}) {
  const calls = [];
  const st = { contacts: [], products: [], invoices: new Map(), docs: new Map(), jobs: new Map(), seq: 1, jobPolls: 0 };
  const statuses = [...(opts.jobStatuses ?? ['done'])];
  const json = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method, path: u.pathname + u.search, body });
    if (opts.network && calls.length > 1) throw new TypeError('fetch failed');
    if (u.pathname === '/oauth/token') return json(200, { access_token: 'tok', expires_in: 7200, refresh_token: 'r' });
    assert.equal(init.headers.Authorization, 'Bearer tok');
    const p = u.pathname.replace('/v4/115', '');
    if (p === '/contacts' && method === 'GET') {
      const tax = u.searchParams.get('filter[tax_number]'); const email = u.searchParams.get('filter[email]');
      return json(200, { data: st.contacts.filter((c) => (tax && c.attributes.tax_number === tax) || (email && c.attributes.email === email)) });
    }
    if (p === '/contacts' && method === 'POST') { const c = { id: `c${st.seq++}`, type: 'contacts', attributes: body.data.attributes }; st.contacts.push(c); return json(201, { data: c }); }
    if (p === '/products' && method === 'GET') return json(200, { data: st.products });
    if (p === '/products' && method === 'POST') { const r = { id: `p${st.seq++}`, type: 'products', attributes: body.data.attributes }; st.products.push(r); return json(201, { data: r }); }
    if (p === '/sales_invoices' && method === 'POST') {
      const d = body.data.relationships.details.data[0].attributes;
      const net = Math.round(d.quantity * Number(d.unit_price) * 100) / 100;
      const vat = Math.round(net * d.vat_rate) / 100;
      const gross = opts.grossOverride ?? (net + vat).toFixed(2);
      const id = `si${st.seq++}`;
      st.invoices.set(id, { id, type: 'sales_invoices', attributes: { ...body.data.attributes, gross_total: String(gross), invoice_no: null }, body });
      return json(201, { data: st.invoices.get(id) });
    }
    const m = p.match(/^\/sales_invoices\/(\w+)$/);
    if (m && method === 'GET') {
      const inv = st.invoices.get(m[1]); const d = st.docs.get(m[1]);
      return json(200, { data: { ...inv, relationships: { active_e_document: { data: d ? { id: d.id, type: d.type } : null } } }, included: d ? [d] : [] });
    }
    if (p === '/e_invoice_inboxes') {
      const alias = opts.inbox?.[u.searchParams.get('filter[vkn]')];
      return json(200, { data: alias ? [{ id: 'ib1', type: 'e_invoice_inboxes', attributes: { e_invoice_address: alias } }] : [] });
    }
    if ((p === '/e_archives' || p === '/e_invoices') && method === 'POST') {
      const invId = (body.data.relationships.sales_invoice ?? body.data.relationships.invoice).data.id;
      const jobId = `j${st.seq++}`; st.jobs.set(jobId, { invId, type: p === '/e_archives' ? 'e_archives' : 'e_invoices' });
      return json(201, { data: { id: jobId, type: 'trackable_jobs', attributes: { status: 'pending' } } });
    }
    const j = p.match(/^\/trackable_jobs\/(\w+)$/);
    if (j) {
      const job = st.jobs.get(j[1]); const status = statuses.length > 1 ? statuses.shift() : statuses[0];
      st.jobPolls++;
      if (status === 'done' && !st.docs.has(job.invId)) {
        const inv = st.invoices.get(job.invId); inv.attributes.invoice_no = 'GIB2026000000001';
        st.docs.set(job.invId, { id: `ed${st.seq++}`, type: job.type, attributes: { uuid: '11111111-2222-3333-4444-555555555555', invoice_number: 'GIB2026000000001' } });
      }
      return json(200, { data: { id: j[1], type: 'trackable_jobs', attributes: { status, errors: status === 'error' ? ['Alıcı VKN hatalı'] : [] } } });
    }
    return json(404, { errors: [{ title: 'Not found', detail: p }] });
  };
  return { calls, st, client: createParasutClient(CFG, { fetchImpl, minIntervalMs: 0 }) };
}

/** Bellek içi veritabanı: yalnız işin kullandığı zincirler. */
function memDb(invoices, orders) {
  const events = [];
  const tables = { order_invoices: invoices, release_orders: orders, order_events: events };
  const from = (name) => {
    const rows = tables[name]; const filters = []; let patch = null; let lim = null;
    const match = () => rows.filter((r) => filters.every(([k, v]) => String(r[k]) === String(v)));
    const q = {
      select() { return q; }, order() { return q; }, limit(n) { lim = n; return q; },
      eq(k, v) { filters.push([k, v]); return q; },
      update(p) { patch = p; return q; },
      insert(row) { rows.push(row); return Promise.resolve({ error: null }); },
      async maybeSingle() { return { data: match()[0] ?? null, error: null }; },
      then(res, rej) {
        try {
          if (patch) { for (const r of match()) Object.assign(r, patch); return Promise.resolve({ error: null }).then(res, rej); }
          const data = match(); return Promise.resolve({ data: lim ? data.slice(0, lim) : data, error: null }).then(res, rej);
        } catch (e) { return Promise.reject(e).then(res, rej); }
      },
    };
    return q;
  };
  return { from, events };
}

const order = (over = {}) => ({
  id: 'o1', order_no: 'SG-2026-ABCDEF', is_test: false, buyer_type: 'individual', buyer_first_name: 'Ayşe', buyer_last_name: 'Yılmaz',
  buyer_email: 'ayse@example.com', buyer_phone: '+905321234567', quantity: 100, unit_price_kurus: 1000, total_kurus: 100000, vat_rate: '20.00',
  paid_at: '2026-10-10T08:00:00Z', site_snapshot: { name: 'İzmir Proje Uygulama Sahası' },
  invoice: { type: 'individual', address: { province: '35', district: 'Karşıyaka', line: 'Deneme Mah. 1. Sok. No 1', postalCode: null }, tckn: null },
  ...over,
});
const pending = (over = {}) => ({ id: 'i1', order_id: 'o1', kind: 'sale', status: 'pending', provider: 'manual', external_id: null, document_type: null, job_id: null, attempts: 0, ...over });
const run = (db, client, extra = {}) => runParasutInvoices(db, client, { siteUrl: 'https://skytechgreen.com', now: new Date('2026-10-19T09:00:00Z'), pollJob: { tries: 2, sleep: async () => {} }, ...extra });

test('KDV dâhil 10 TL → KDV hariç birim; toplam denetimi ±1 kuruş', () => {
  assert.equal(netUnitPrice(1000, 20), '8.33333333');
  assert.equal(totalsMatch('1000.00', 100000), true);
  assert.equal(totalsMatch('999.98', 100000), false);
});

test('yapılandırma: eksik bilgi ya da sayısal olmayan firma numarası → kapalı', () => {
  assert.equal(parasutConfig({}), null);
  assert.equal(parasutConfig({ PARASUT_CLIENT_ID: 'a', PARASUT_CLIENT_SECRET: 'b', PARASUT_USERNAME: 'c', PARASUT_PASSWORD: 'd', PARASUT_COMPANY_ID: 'x1' }), null);
  assert.ok(parasutConfig({ PARASUT_CLIENT_ID: 'a', PARASUT_CLIENT_SECRET: 'b', PARASUT_USERNAME: 'c', PARASUT_PASSWORD: 'd', PARASUT_COMPANY_ID: '115' }));
});

test('bireysel alıcı: e-Arşiv (internet satışı), TCKN yoksa yer tutucu; numara ve ETTN kaydedilir', async () => {
  const f = fakeParasut();
  const inv = [pending()]; const db = memDb(inv, [order()]);
  const report = await run(db, f.client);
  assert.deepEqual({ issued: report.issued, failed: report.failed }, { issued: 1, failed: 0 });
  assert.equal(inv[0].status, 'issued'); assert.equal(inv[0].provider, 'parasut'); assert.equal(inv[0].document_type, 'e_archive');
  assert.equal(inv[0].invoice_no, 'GIB2026000000001'); assert.equal(inv[0].ettn, '11111111-2222-3333-4444-555555555555');
  const contact = f.calls.find((c) => c.method === 'POST' && c.path.endsWith('/contacts')).body.data.attributes;
  assert.equal(contact.tax_number, PLACEHOLDER_TCKN); assert.equal(contact.contact_type, 'person'); assert.equal(contact.city, 'İzmir');
  const si = f.calls.find((c) => c.method === 'POST' && c.path.endsWith('/sales_invoices')).body.data;
  assert.equal(si.attributes.order_no, 'SG-2026-ABCDEF'); assert.equal(si.attributes.order_date, '2026-10-10');
  assert.equal(si.relationships.details.data[0].attributes.quantity, 100);
  const ea = f.calls.find((c) => c.method === 'POST' && c.path.endsWith('/e_archives')).body.data;
  assert.deepEqual(ea.attributes.internet_sale, { url: 'https://skytechgreen.com', payment_type: 'KREDIKARTI/BANKAKARTI', payment_platform: 'iyzico', payment_date: '2026-10-10' });
  assert.equal(db.events[0].type, 'invoice_issued');
});

test('e-Fatura kayıtlı kurum: e-Fatura (etiket alıcı adresi, ilişki adı "invoice")', async () => {
  const f = fakeParasut({ inbox: { '1234567890': 'urn:mail:defaultpk@ornek.com.tr' } });
  const inv = [pending()];
  const corp = order({ buyer_type: 'corporate', invoice: { type: 'corporate', companyTitle: 'Örnek A.Ş.', taxId: '1234567890', taxOffice: 'Çankaya', address: { province: '06', district: 'Çankaya', line: 'Atatürk Bulvarı No 1', postalCode: null }, authorizedPerson: 'Ali', mersis: null, kep: null, poNumber: null, eInvoiceUser: true } });
  await run(memDb(inv, [corp]), f.client);
  assert.equal(inv[0].status, 'issued'); assert.equal(inv[0].document_type, 'e_invoice');
  const ei = f.calls.find((c) => c.method === 'POST' && c.path.endsWith('/e_invoices')).body.data;
  assert.equal(ei.attributes.to, 'urn:mail:defaultpk@ornek.com.tr'); assert.equal(ei.relationships.invoice.data.type, 'sales_invoices');
  assert.equal(f.calls.find((c) => c.method === 'POST' && c.path.endsWith('/contacts')).body.data.attributes.contact_type, 'company');
});

test('iş sürerken bekler; sonraki çalışmada ikinci fatura ya da ikinci resmîleştirme gönderilmez', async () => {
  const f = fakeParasut({ jobStatuses: ['running', 'running', 'done'] });
  const inv = [pending()]; const db = memDb(inv, [order()]);
  let r = await run(db, f.client);
  assert.equal(r.waiting, 1); assert.equal(inv[0].status, 'pending'); assert.ok(inv[0].external_id && inv[0].job_id);
  r = await run(db, f.client);
  assert.equal(r.issued, 1); assert.equal(inv[0].status, 'issued');
  const posts = (p) => f.calls.filter((c) => c.method === 'POST' && c.path.endsWith(p)).length;
  assert.equal(posts('/sales_invoices'), 1); assert.equal(posts('/e_archives'), 1);
});

test('Paraşüt toplamı siparişle uyuşmazsa resmîleştirilmez, satır başarısız olur', async () => {
  const f = fakeParasut({ grossOverride: '999.98' });
  const inv = [pending()];
  const r = await run(memDb(inv, [order()]), f.client);
  assert.equal(r.failed, 1); assert.equal(inv[0].status, 'failed'); assert.match(inv[0].error, /uyuşmuyor/);
  assert.equal(f.calls.some((c) => c.path.includes('/e_archives') || c.path.includes('/e_invoices')), false);
});

test('Paraşüt resmîleştirme hatası satıra yazılır', async () => {
  const f = fakeParasut({ jobStatuses: ['error'] });
  const inv = [pending()];
  await run(memDb(inv, [order()]), f.client);
  assert.equal(inv[0].status, 'failed'); assert.match(inv[0].error, /Alıcı VKN hatalı/);
});

test('test siparişi atlanır; Paraşüt\'e hiç istek gitmez', async () => {
  const f = fakeParasut();
  const inv = [pending()];
  const r = await run(memDb(inv, [order({ is_test: true })]), f.client);
  assert.equal(r.skipped, 1); assert.equal(inv[0].status, 'pending'); assert.equal(f.calls.length, 0);
});

test('ağ hatası: deneme sayılır, sınırda başarısız olur', async () => {
  const f = fakeParasut({ network: true });
  const inv = [pending({ attempts: MAX_ATTEMPTS - 2 })]; const db = memDb(inv, [order()]);
  await run(db, f.client);
  assert.equal(inv[0].status, 'pending'); assert.equal(inv[0].attempts, MAX_ATTEMPTS - 1); assert.ok(inv[0].error);
  await run(db, f.client);
  assert.equal(inv[0].status, 'failed'); assert.match(inv[0].error, /deneme/);
});

test('Paraşüt yapılandırılmamışsa iş hiçbir şey yapmaz', async () => {
  const inv = [pending()];
  const r = await run(memDb(inv, [order()]), null);
  assert.equal(r.configured, false); assert.equal(inv[0].status, 'pending');
});

test('045: bir siparişte tek açık satış faturası; aynı Paraşüt faturası iki satıra bağlanamaz', async () => {
  const db = await createDb({ upTo: '016_release_orders.sql' });
  try {
    await db.exec(`BEGIN;\n${await readFile(new URL('../../supabase/migrations/045_invoice_provider_tracking.sql', import.meta.url), 'utf8')}\nCOMMIT;`);
    const o = await insertOrder(db, { status: 'released', withdrawal_requested_at: null });
    await db.query(`INSERT INTO order_invoices(order_id, kind, status) VALUES ($1, 'sale', 'pending')`, [o]);
    assert.match(await sqlError(db.query(`INSERT INTO order_invoices(order_id, kind, status) VALUES ($1, 'sale', 'issued')`, [o])), /duplicate|unique/i);
    await db.query(`INSERT INTO order_invoices(order_id, kind, status) VALUES ($1, 'sale', 'failed')`, [o]);
    await db.query(`UPDATE order_invoices SET external_id = 'si1', provider = 'parasut' WHERE status = 'pending'`);
    assert.match(await sqlError(db.query(`UPDATE order_invoices SET external_id = 'si1', provider = 'parasut' WHERE status = 'failed'`)), /duplicate|unique/i);
    assert.match(await sqlError(db.query(`UPDATE order_invoices SET document_type = 'pdf' WHERE status = 'pending'`)), /check/i);
  } finally { await db.close(); }
});
