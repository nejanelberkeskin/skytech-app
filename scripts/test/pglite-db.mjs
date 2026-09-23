// PGlite üzerinde kontrollü başlangıç şeması + gerçek 007/016/017/019/020 SQL'i.
// Canlı veritabanına, ödeme sağlayıcısına ya da e-postaya hiçbir çağrı yapmaz.
// Not: PGlite tek bağlantılıdır; gerçek eşzamanlılık (iki bağlantı) burada sınanamaz.
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export const IDS = {
  superAdmin: '10000000-0000-0000-0000-000000000001',
  finance: '10000000-0000-0000-0000-000000000002',
  operations: '10000000-0000-0000-0000-000000000003',
  land: '20000000-0000-0000-0000-000000000001',
  siteA: '20000000-0000-0000-0000-0000000000aa',
  siteB: '20000000-0000-0000-0000-0000000000bb',
};

const MIGRATIONS = ['007_admin_audit_log.sql', '016_release_orders.sql', '017_sales_pause.sql', '019_audit_hardening.sql', '020_refund_reconciliation.sql', '021_permission_core.sql', '022_custom_roles.sql'];

export async function createDb({ upTo = '022_custom_roles.sql' } = {}) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
    CREATE TABLE admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE, email text, full_name text, role text, is_active boolean, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE lands(id uuid PRIMARY KEY, name text, slug text, reserved_seeds integer, filled_seeds integer, capacity_seeds integer, is_public boolean, status text);
    CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
    INSERT INTO admin_users(user_id, email, full_name, role, is_active) VALUES
      ('${IDS.superAdmin}', 'owner@example.com', 'Sahip', 'SUPER_ADMIN', true),
      ('${IDS.finance}', 'finans@example.com', 'Finans', 'FINANCE', true),
      ('${IDS.operations}', 'operasyon@example.com', 'Operasyon', 'OPERATIONS', true);
    INSERT INTO lands(id, name, slug, reserved_seeds, filled_seeds, capacity_seeds, is_public, status) VALUES
      ('${IDS.land}', 'Ana Saha', 'ana-saha', 1000, 0, 100000, true, 'open'),
      ('${IDS.siteA}', 'Antalya Sahası', 'antalya-sahasi', 0, 0, 50000, true, 'open'),
      ('${IDS.siteB}', 'Muğla Sahası, Batı', 'mugla-sahasi', 0, 0, 40000, false, 'preparing');`);
  for (const file of MIGRATIONS) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    if (file === upTo) break;
  }
  return db;
}

let seq = 0;
/** Deneme siparişi ekler; alanlar gerçek kısıtlara uyar. Dönen: sipariş kimliği. */
export async function insertOrder(db, over = {}) {
  seq++;
  const id = over.id ?? `30000000-0000-0000-0000-${String(seq).padStart(12, '0')}`;
  const o = {
    status: 'withdrawal_requested', quantity: 20, unit: 1000, paid_at: 'now()', is_test: false,
    payment_provider: 'mock', payment_id: `PAY-${seq}`, withdrawal_requested_at: 'now()', cancelled_at: null,
    payment_expires_at: null, batch_id: null, created_at: 'now()', ...over,
  };
  const lit = (v) => (v === null || v === undefined ? 'NULL' : v === 'now()' || /^now\(\)|^'/.test(String(v)) || /::/.test(String(v)) ? v : `'${v}'`);
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let n = seq, code = '';
  for (let i = 0; i < 6; i++) { code = letters[n % 23] + code; n = Math.floor(n / 23); }
  const orderNo = `SG-2026-${code}`;
  await db.exec(`INSERT INTO release_orders(id, order_no, status, is_test, land_id, site_snapshot, season_label, quantity, unit_price_kurus, total_kurus, vat_rate,
      certificate_name, buyer_type, buyer_first_name, buyer_last_name, buyer_email, buyer_phone, invoice, consents, documents_version,
      payment_provider, payment_id, paid_at, withdrawal_requested_at, cancelled_at, payment_expires_at, created_at)
    VALUES ('${id}', '${orderNo}', '${o.status}', ${o.is_test}, '${IDS.land}', '{}', '2026-2027', ${o.quantity}, ${o.unit}, ${o.quantity * o.unit}, 20,
      'Test Kişi', 'individual', 'Test', 'Kişi', 'test@example.com', '0000', '{}', '{}', 'test',
      ${lit(o.payment_provider)}, ${lit(o.payment_id)}, ${lit(o.paid_at)}, ${lit(o.withdrawal_requested_at)}, ${lit(o.cancelled_at)}, ${lit(o.payment_expires_at)}, ${lit(o.created_at)})`);
  return id;
}

export const one = async (db, sql, params) => (await db.query(sql, params)).rows[0];
export const rows = async (db, sql, params) => (await db.query(sql, params)).rows;

/** SQL fonksiyonu hatasını mesajıyla yakalar (RAISE EXCEPTION 'kod'). */
export async function sqlError(promise) {
  try { await promise; return null; } catch (e) { return String(e.message); }
}

// PostgREST yanıtı gibi: tarihler ISO metin, bigint sayı.
const asJson = (value) => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
const column = (name) => {
  const m = /^(\w+)->>(\w+)$/.exec(name);
  if (m) return `${m[1]}->>'${m[2]}'`;
  if (!/^\w+$/.test(name)) throw new Error(`desteklenmeyen kolon: ${name}`);
  return name;
};

/** PostgREST süzgeç dizgisi → SQL. Desteklenen alt küme: `col.op.value`, `and(...)`, virgülle VEYA. */
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', ilike: 'ILIKE' };
function splitTop(expr) {
  const parts = [];
  let depth = 0, quoted = false, current = '';
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (quoted) {
      if (ch === '\\') { current += ch + expr[++i]; continue; }
      if (ch === '"') quoted = false;
      current += ch; continue;
    }
    if (ch === '"') { quoted = true; current += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; continue; }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}
const unquote = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\(.)/g, '$1') : v);
function parseFilter(expr, params, join = ' OR ') {
  return splitTop(expr)
    .map((term) => {
      const group = /^(and|or)\((.*)\)$/s.exec(term.trim());
      if (group) return `(${parseFilter(group[2], params, group[1] === 'and' ? ' AND ' : ' OR ')})`;
      const m = /^([\w>-]+)\.(\w+)\.(.*)$/s.exec(term.trim());
      if (!m) throw new Error(`desteklenmeyen süzgeç: ${term}`);
      const op = OPS[m[2]];
      if (!op) throw new Error(`desteklenmeyen işleç: ${m[2]}`);
      params.push(unquote(m[3]));
      return `${column(m[1])}::text ${op} $${params.length}::text`;
    })
    .join(join);
}

/**
 * Supabase istemcisinin servislerde kullanılan küçük alt kümesi, PGlite üzerinde (gerçek SQL fonksiyonları).
 * `hooks.rpc(name, args)` bir hata nesnesi dönerse o çağrı çalıştırılmadan hata verir (hata enjeksiyonu).
 * Gömme (embed) sorguları desteklenmez; yalnız düz kolon listeleri.
 */
export function restClient(db, hooks = {}) {
  function from(table) {
    const st = { cols: '*', where: [], params: [], orders: [], limit: null };
    const add = (sql, value) => { st.params.push(value); st.where.push(sql.replace('?', `$${st.params.length}`)); };
    const run = async () => {
      try {
        const sql = `SELECT ${st.cols} FROM ${table}${st.where.length ? ` WHERE ${st.where.join(' AND ')}` : ''}${st.orders.length ? ` ORDER BY ${st.orders.join(', ')}` : ''}${st.limit ? ` LIMIT ${st.limit}` : ''}`;
        const r = await db.query(sql, st.params);
        return { data: asJson(r.rows), error: null };
      } catch (e) {
        return { data: null, error: { message: e.message, details: e.detail ?? null, code: e.code } };
      }
    };
    const q = {
      select(cols) { st.cols = cols.replace(/\s+/g, ' '); return q; },
      eq(col, value) { add(`${column(col)}::text = ?::text`, String(value)); return q; },
      neq(col, value) { add(`${column(col)}::text <> ?::text`, String(value)); return q; },
      in(col, values) { add(`${column(col)}::text = ANY(?::text[])`, values.map(String)); return q; },
      /** PostgREST `or` süzgeci: uçların gönderdiği gerçek dizgi ayrıştırılır (tırnaklı değerler dahil). */
      or(expr) { st.where.push(`(${parseFilter(expr, st.params)})`); return q; },
      order(col, opts) { st.orders.push(`${column(col)} ${opts?.ascending === false ? 'DESC' : 'ASC'}`); return q; },
      limit(n) { st.limit = Number(n); return q; },
      async maybeSingle() { const r = await run(); return r.error ? r : { data: r.data[0] ?? null, error: null }; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    return q;
  }
  const signatures = new Map();
  /** PostgREST gibi: argüman tipleri fonksiyon imzasından okunur (dizi → text[], nesne → jsonb). */
  async function argTypes(name, keys) {
    if (!signatures.has(name)) {
      const r = await db.query(`SELECT p.proargnames AS names, array(SELECT format_type(t, NULL) FROM unnest(p.proargtypes::oid[]) t) AS types
                                  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                 WHERE n.nspname = 'public' AND p.proname = $1`, [name]);
      signatures.set(name, r.rows);
    }
    const match = signatures.get(name).find((s) => keys.every((k) => (s.names ?? []).includes(k)));
    return Object.fromEntries(keys.map((k) => [k, match ? match.types[match.names.indexOf(k)] : null]));
  }
  const pgArray = (values) => `{${values.map((v) => (v === null ? 'NULL' : `"${String(v).replace(/[\\"]/g, (m) => `\\${m}`)}"`)).join(',')}}`;
  async function rpc(name, args = {}) {
    const injected = hooks.rpc?.(name, args);
    if (injected) return { data: null, error: injected };
    const keys = Object.keys(args);
    try {
      // İmza yalnız dizi argüman varsa okunur: diğer çağrılar tek sorgu kalır (zamanlamaya bağlı
      // testlerde — ör. yanıtı kaybolan kayıt — kuyruk sırası değişmesin).
      const types = keys.some((k) => Array.isArray(args[k])) ? await argTypes(name, keys) : {};
      const values = keys.map((k) => {
        const v = args[k];
        if (v === null || v === undefined) return null;
        if (types[k]?.endsWith('[]') && Array.isArray(v)) return pgArray(v);
        return typeof v === 'object' ? JSON.stringify(v) : v;
      });
      const r = await db.query(`SELECT ${name}(${keys.map((k, i) => `${k} => $${i + 1}${types[k] ? `::${types[k]}` : ''}`).join(', ')}) AS r`, values);
      return { data: asJson(r.rows[0].r), error: null };
    } catch (e) {
      return { data: null, error: { message: e.message, details: e.detail ?? null, code: e.code } };
    }
  }
  return { from, rpc };
}
