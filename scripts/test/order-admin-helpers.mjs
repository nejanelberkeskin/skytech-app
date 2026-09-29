// Sipariş yönetimi uçları için test yardımcıları (web-brifler/27). Ortak pglite-db.mjs'e dokunmaz.
// Gerçek izin kapısı; oturum ve MFA durumu taklit. Etkili yetki PGlite'taki gerçek SQL'den gelir.
import { loadSource as load } from './load-source.mjs';
import { restClient, insertOrder, one, IDS } from './pglite-db.mjs';

const response = {
  json: (body, init) => ({ body, status: init?.status ?? 200, headers: new Map(Object.entries(init?.headers ?? {})) }),
};
export const envelope = load('lib/api/envelope.ts', { 'next/server': { NextResponse: response } });
export const permissionKeys = load('lib/admin/permission-keys.ts');
export const AAL1 = { aal: 'aal1', verifiedAt: null, enrolled: false };
export const aal2 = (minutesAgo = 0) => ({ aal: 'aal2', verifiedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(), enrolled: true });

/** Gerçek lib/admin/permissions.ts; `role` eski rol aynasıdır (admin_users.role). */
export function gate({ db, userId, role = 'NONE', assurance = AAL1, unauthenticated = false }) {
  return load('lib/admin/permissions.ts', {
    '@/lib/admin-auth': {
      requireAdmin: async () => unauthenticated
        ? { admin: null, error: { status: 401 } }
        : { admin: { user_id: userId, role, full_name: 'Deneme', email: 'deneme@example.invalid' }, error: null },
    },
    '@/lib/api/envelope': envelope,
    '@/lib/supabase/server': { createServiceRoleClient: () => restClient(db) },
    './mfa': { sessionAssurance: async () => assurance },
    './permission-keys': permissionKeys,
  });
}

export const accessModule = (db, userId, role, assurance) => load('lib/orders/admin-access.ts', {
  '@/lib/admin/permissions': gate({ db, userId, role, assurance }),
});

/** Yeni personel + atama (tüm kayıtlar ya da verilen kapsam). */
export async function staffWithRole(db, userId, roleKey, scope = { kind: 'all' }, legacyRole = 'NONE') {
  await db.query(`INSERT INTO auth.users(id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
  await db.query(`INSERT INTO admin_users(user_id, email, full_name, role, is_active) VALUES ($1, $2, 'Personel', $3, true) ON CONFLICT (user_id) DO NOTHING`,
    [userId, `${userId.slice(-4)}@example.invalid`, legacyRole]);
  const staff = await one(db, `SELECT id FROM admin_users WHERE user_id=$1`, [userId]);
  await one(db, `SELECT assign_admin_role($1,$2,$3,$4::jsonb,NULL,'test') a`, [IDS.superAdmin, staff.id, roleKey, JSON.stringify(scope)]);
  // Atama eski rol aynasını yeniler; test, istenen eski rolü açıkça sabitler.
  await db.query(`UPDATE admin_users SET role=$2 WHERE user_id=$1`, [userId, legacyRole]);
  return staff.id;
}

export const customRole = (db, key, permissions) =>
  one(db, `SELECT create_admin_role($1,$2,$3,'',$4::text[],NULL) r`, [IDS.superAdmin, key, `Rol ${key}`, permissions]);

/** Belirli sahada sipariş (varsayılan saha IDS.land). */
export async function orderAt(db, landId = IDS.land, over = {}) {
  const id = await insertOrder(db, over);
  if (landId !== IDS.land) await db.query(`UPDATE release_orders SET land_id=$2 WHERE id=$1`, [id, landId]);
  return id;
}

export const request = ({ body, query = {}, url = 'https://skytechgreen.com/api/admin/release-orders' } = {}) => {
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return {
    url: u.toString(),
    nextUrl: u,
    json: async () => (body === undefined ? null : body),
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    headers: new Map(),
  };
};

export async function withMfaEnforced(fn) {
  const before = process.env.ADMIN_MFA_ENFORCED;
  process.env.ADMIN_MFA_ENFORCED = '1';
  try { return await fn(); } finally {
    if (before === undefined) delete process.env.ADMIN_MFA_ENFORCED; else process.env.ADMIN_MFA_ENFORCED = before;
  }
}

export const USERS = {
  engineer: '10000000-0000-0000-0000-000000000004',
  noter: '10000000-0000-0000-0000-000000000005',
  scoped: '10000000-0000-0000-0000-000000000006',
  docsOnly: '10000000-0000-0000-0000-000000000007',
  refunder: '10000000-0000-0000-0000-000000000008',
};

// ── Okuma uçları için PostgREST alt kümesi (27 §4) ───────────────────────────
// Sayım (count/head), sayfa aralığı, JSON yolu seçimi (alias:col->>key, alias:col->key), `!inner`
// birleştirme (alt → üst: JOIN; üst → alt: EXISTS, PostgREST'in üst satırı süzme anlamı) ve birleştirilmiş
// kolon süzgeci. Her sorgu koşul ve parametreleriyle `log`a yazılır; yazma denemesi `writes`e sayılıp reddedilir.
const asJson = (value) => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
const CHILD_OF_ORDERS = new Set(['order_refunds', 'order_invoices', 'order_events', 'order_documents']);

export function orderClient(db, { failTables = [], log = [], writes = [] } = {}) {
  const fails = new Set(failTables);
  function from(table) {
    const st = { cols: '*', rawCols: '*', count: false, head: false, where: [], params: [], orders: [], limit: null, offset: null,
      parents: [], children: new Map() };
    const P = (v) => { st.params.push(v); return `$${st.params.length}`; };
    const colRef = (c) => {
      let m = /^(\w+)\.(\w+)$/.exec(c);
      if (m) return { rel: m[1], sql: `${m[1]}.${m[2]}` };
      m = /^(\w+)->>(\w+)$/.exec(c);
      if (m) return { rel: null, sql: `t.${m[1]}->>'${m[2]}'` };
      if (!/^\w+$/.test(c)) throw new Error(`desteklenmeyen kolon: ${c}`);
      return { rel: null, sql: `t.${c}` };
    };
    const addWhere = (c, build) => {
      const ref = colRef(c);
      const cond = build(ref.sql);
      if (ref.rel && st.children.has(ref.rel)) st.children.get(ref.rel).push(cond); else st.where.push(cond);
    };
    const selectSql = (cols) => cols.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean).map((x) => {
      let m = /^(\w+)!inner\(([^)]*)\)$/.exec(x);
      if (m) {
        const rel = m[1];
        if (table === 'release_orders' && CHILD_OF_ORDERS.has(rel)) { st.children.set(rel, []); return `'[]'::jsonb AS ${rel}`; }
        st.parents.push(rel);
        return `jsonb_build_object(${m[2].split(',').map((c) => c.trim()).map((c) => `'${c}', ${rel}.${c}`).join(', ')}) AS ${rel}`;
      }
      m = /^(\w+):(\w+)->>(\w+)$/.exec(x);
      if (m) return `t.${m[2]}->>'${m[3]}' AS ${m[1]}`;
      m = /^(\w+):(\w+)->(\w+)$/.exec(x);
      if (m) return `t.${m[2]}->'${m[3]}' AS ${m[1]}`;
      if (!/^\w+$/.test(x)) throw new Error(`desteklenmeyen seçim: ${x}`);
      return `t.${x}`;
    }).join(', ');
    const whereSql = () => {
      const conds = [...st.where];
      for (const [rel, cs] of st.children) conds.push(`EXISTS (SELECT 1 FROM ${rel} ${rel} WHERE ${rel}.order_id = t.id${cs.map((c) => ` AND ${c}`).join('')})`);
      return conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
    };
    const joins = () => st.parents.map((rel) => ` JOIN ${rel} ${rel} ON ${rel}.id = t.order_id`).join('');
    const run = async () => {
      log.push({ table, cols: st.rawCols, head: st.head, where: whereSql(), params: [...st.params] });
      // Birleştirilen (embed) tablonun hatası, PostgREST'teki gibi bütün sorguyu düşürür.
      if ([table, ...st.parents, ...st.children.keys()].some((t) => fails.has(t))) return { data: null, error: { message: 'injected' }, count: null };
      try {
        let count = null;
        if (st.count) count = (await db.query(`SELECT count(*)::int AS c FROM ${table} t${joins()}${whereSql()}`, st.params)).rows[0].c;
        if (st.head) return { data: null, error: null, count };
        const sql = `SELECT ${st.cols} FROM ${table} t${joins()}${whereSql()}${st.orders.length ? ` ORDER BY ${st.orders.join(', ')}` : ''}` +
          `${st.limit !== null ? ` LIMIT ${st.limit}` : ''}${st.offset !== null ? ` OFFSET ${st.offset}` : ''}`;
        return { data: asJson((await db.query(sql, st.params)).rows), error: null, count };
      } catch (e) {
        return { data: null, error: { message: e.message }, count: null };
      }
    };
    const write = (kind) => () => { writes.push({ table, kind }); throw new Error(`okuma testinde yazma denemesi: ${kind} ${table}`); };
    const q = {
      select(cols, opts = {}) { st.rawCols = cols; st.cols = selectSql(cols.replace(/\s+/g, ' ')); st.count = opts.count === 'exact'; st.head = !!opts.head; return q; },
      eq(c, v) { addWhere(c, (col) => `${col}::text = ${P(String(v))}::text`); return q; },
      gt(c, v) { addWhere(c, (col) => `${col} > ${P(v)}`); return q; },
      in(c, values) { addWhere(c, (col) => `${col}::text = ANY(${P(values.map(String))}::text[])`); return q; },
      or(expr) {
        st.where.push(`(${expr.split(',').map((term) => {
          const m = /^([\w>-]+)\.(ilike|eq)\.(.*)$/.exec(term);
          if (!m) throw new Error(`desteklenmeyen süzgeç: ${term}`);
          const { sql } = colRef(m[1]);
          return m[2] === 'ilike' ? `${sql} ILIKE ${P(m[3])}` : `${sql}::text = ${P(m[3])}`;
        }).join(' OR ')})`);
        return q;
      },
      order(c, o) { st.orders.push(`${colRef(c).sql} ${o?.ascending === false ? 'DESC' : 'ASC'}`); return q; },
      range(a, b) { st.offset = a; st.limit = b - a + 1; return q; },
      limit(n) { st.limit = n; return q; },
      insert: write('insert'), update: write('update'), upsert: write('upsert'), delete: write('delete'),
      async maybeSingle() { const r = await run(); return r.error ? r : { data: r.data[0] ?? null, error: null }; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    return q;
  }
  const rpc = async (name) => { writes.push({ rpc: name }); throw new Error(`okuma testinde RPC: ${name}`); };
  return { from, rpc };
}

/** Okuma modülleri: izin yardımcıları saf (permission-keys), diğerleri gerçek kaynak. */
export function readModules() {
  const duplicates = load('lib/orders/duplicates.ts');
  const types = load('lib/orders/types.ts');
  const access = load('lib/orders/admin-access.ts', { '@/lib/admin/permissions': permissionKeys });
  const dto = load('lib/orders/admin-dto.ts', { './duplicates': duplicates });
  const read = load('lib/orders/admin-read.ts', { './admin-access': access, './admin-dto': dto, './duplicates': duplicates, './types': types });
  const detail = load('lib/orders/admin-detail.ts', { './admin-access': access, './admin-dto': dto, '@/lib/admin/permission-keys': permissionKeys });
  return { duplicates, types, access, dto, read, detail };
}

/**
 * Toplu sipariş (hızlı, tek SQL). Sipariş numarası yalnız rakam alfabesinden: `insertOrder`ın harf
 * numaralarıyla çakışmaz. `from`–`to` aralığı çağrılar arasında çakışmamalı.
 */
export async function bulkOrders(db, landId, from, to, meta = { capacityHeld: false }) {
  await db.query(`INSERT INTO release_orders(order_no, status, is_test, land_id, site_snapshot, season_label, quantity, unit_price_kurus,
      total_kurus, vat_rate, certificate_name, buyer_type, buyer_first_name, buyer_last_name, buyer_email, buyer_phone, invoice, consents,
      documents_version, payment_provider, payment_id, paid_at, withdrawal_requested_at, created_at, payment_meta)
    SELECT 'SG-2026-' || (SELECT string_agg(substr('23456789', ((n / (8 ^ (5 - i))::int) % 8) + 1, 1), '' ORDER BY i) FROM generate_series(0, 5) i),
      'paid', false, $1, '{"name":"Toplu Saha"}', '2026-2027', 1, 1000, 1000, 20, 'Toplu Kayıt', 'individual', 'Toplu', 'Kayıt',
      'toplu' || n || '@example.invalid', '0000', '{}', '{}', 'test', 'mock', 'BULK-' || n, now(), now(), now() - make_interval(secs => n), $4::jsonb
    FROM generate_series($2::int, $3::int) n`, [landId, from, to, JSON.stringify(meta)]);
}
