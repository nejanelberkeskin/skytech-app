// Yönetim modülleri için genel PostgREST alt kümesi (web-brifler/29 ve sonraki sunucu paketleri).
// Okuma: select (JSON yolu alias:col->>key / alias:col->key), eq/neq/in/gt/gte/lt/lte/is/or(ilike|eq), order, range,
// limit, count/head, maybeSingle/single. Yazma: update/insert/delete(+select, delete count). Dizi (text[]) ve jsonb
// kolonları gerçek kolon tipine göre yazılır. Dönüşler PostgREST gibi: numeric → sayı, timestamptz → mikro saniyeli
// ISO metin (UTC); ISO zaman değeriyle eşitlik timestamptz olarak karşılaştırılır (sürüm/CAS). Her sorgu koşul ve parametreleriyle `log`a,
// her yazma `writes`a kaydedilir; `failTables` o tabloya giden her sorguyu, `failWhen({table, mode, cols})` true dönen
// sorguyu hata ile düşürür. rpc isteğe bağlı taklit.
const asJson = (value) => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
/** '2026-09-29 19:28:01.577063+00' → '2026-09-29T19:28:01.577063+00:00' (PostgREST biçimi). */
const pgTimestamp = (v) => String(v).replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
const PARSERS = { parsers: { 1700: Number, 1184: pgTimestamp } };
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function adminClient(db, { failTables = [], failWhen = null, log = [], writes = [], rpc = null, afterQuery = null } = {}) {
  const fails = new Set(failTables);
  let utc = null;
  const sqlQuery = async (sql, params) => {
    utc ??= db.exec("SET TIME ZONE 'UTC'");
    await utc;
    return db.query(sql, params, PARSERS);
  };
  const types = new Map();
  const columnType = async (table, column) => {
    const key = `${table}.${column}`;
    if (!types.has(key)) {
      const r = await db.query(`SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, column]);
      types.set(key, r.rows[0]?.data_type ?? null);
    }
    return types.get(key);
  };
  const pgArray = (list) => `{${list.map((x) => `"${String(x).replace(/(["\\])/g, '\\$1')}"`).join(',')}}`;
  const toParam = async (table, column, v) => {
    if (v === null || typeof v !== 'object') return v;
    return Array.isArray(v) && (await columnType(table, column)) === 'ARRAY' ? pgArray(v) : JSON.stringify(v);
  };
  function from(table) {
    const st = { mode: 'select', cols: '*', rawCols: null, count: false, head: false, where: [], params: [], orders: [],
      limit: null, offset: null, values: null };
    const P = (v) => { st.params.push(v); return `$${st.params.length}`; };
    const col = (c) => {
      let m = /^(\w+)->>(\w+)$/.exec(c);
      if (m) return `${m[1]}->>'${m[2]}'`;
      m = /^(\w+)->(\w+)$/.exec(c);
      if (m) return `${m[1]}->'${m[2]}'`;
      if (!/^\w+$/.test(c)) throw new Error(`desteklenmeyen kolon: ${c}`);
      return c;
    };
    const selectSql = (cols) => cols.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
      let m = /^(\w+):(\w+)->>(\w+)$/.exec(x);
      if (m) return `${m[2]}->>'${m[3]}' AS ${m[1]}`;
      m = /^(\w+):(\w+)->(\w+)$/.exec(x);
      if (m) return `${m[2]}->'${m[3]}' AS ${m[1]}`;
      if (x === '*' || /^\w+$/.test(x)) return x;
      throw new Error(`desteklenmeyen seçim: ${x}`);
    }).join(', ');
    const where = () => (st.where.length ? ` WHERE ${st.where.join(' AND ')}` : '');
    const cmp = (c, op, v) => {
      st.where.push(typeof v === 'string' && ISO_TS.test(v) ? `${col(c)} ${op} ${P(v)}::timestamptz` : `${col(c)}::text ${op} ${P(String(v))}::text`);
      return q;
    };
    const run = async () => {
      const result = await execute();
      // Yarış sınaması: sorgu döndükten sonra test verisi değiştirilebilir (ör. kayıt başka sahaya taşınır).
      if (afterQuery) await afterQuery({ table, mode: st.mode, cols: st.rawCols });
      return result;
    };
    const execute = async () => {
      log.push({ table, mode: st.mode, cols: st.rawCols, head: st.head, where: where(), params: [...st.params] });
      if (fails.has(table) || failWhen?.({ table, mode: st.mode, cols: st.rawCols })) return { data: null, error: { message: 'injected' }, count: null };
      try {
        if (st.mode === 'update') {
          writes.push({ table, mode: 'update', values: st.values });
          const whereSql = where();
          const sets = [];
          for (const [k, v] of Object.entries(st.values)) sets.push(`${k} = ${P(await toParam(table, k, v))}`);
          const r = await sqlQuery(`UPDATE ${table} SET ${sets.join(', ')}${whereSql} RETURNING ${st.rawCols ? st.cols : 'id'}`, st.params);
          return { data: asJson(r.rows), error: null, count: null };
        }
        if (st.mode === 'delete') {
          writes.push({ table, mode: 'delete', where: where(), params: [...st.params] });
          const r = await sqlQuery(`DELETE FROM ${table}${where()} RETURNING ${st.rawCols ? st.cols : 'id'}`, st.params);
          return { data: st.rawCols ? asJson(r.rows) : null, error: null, count: st.count ? r.rows.length : null };
        }
        if (st.mode === 'insert') {
          const rowsIn = Array.isArray(st.values) ? st.values : [st.values];
          writes.push({ table, mode: 'insert', values: rowsIn });
          const keys = Object.keys(rowsIn[0]);
          const tuples = [];
          for (const r of rowsIn) {
            const cells = [];
            for (const k of keys) cells.push(P(await toParam(table, k, r[k])));
            tuples.push(`(${cells.join(', ')})`);
          }
          const r = await sqlQuery(`INSERT INTO ${table} (${keys.join(', ')}) VALUES ${tuples.join(', ')} RETURNING ${st.rawCols ? st.cols : 'id'}`, st.params);
          return { data: asJson(r.rows), error: null, count: null };
        }
        let count = null;
        if (st.count) count = (await sqlQuery(`SELECT count(*)::int AS c FROM ${table}${where()}`, st.params)).rows[0].c;
        if (st.head) return { data: null, error: null, count };
        const sql = `SELECT ${st.cols} FROM ${table}${where()}${st.orders.length ? ` ORDER BY ${st.orders.join(', ')}` : ''}` +
          `${st.limit !== null ? ` LIMIT ${st.limit}` : ''}${st.offset !== null ? ` OFFSET ${st.offset}` : ''}`;
        return { data: asJson((await sqlQuery(sql, st.params)).rows), error: null, count };
      } catch (e) {
        return { data: null, error: { message: e.message, code: e.code, details: e.detail ?? null }, count: null };
      }
    };
    const q = {
      select(cols = '*', opts = {}) { st.rawCols = cols; st.cols = selectSql(cols.replace(/\s+/g, ' ')); st.count = opts.count === 'exact'; st.head = !!opts.head; return q; },
      update(values) { st.mode = 'update'; st.values = values; return q; },
      insert(values) { st.mode = 'insert'; st.values = values; return q; },
      delete(opts = {}) { st.mode = 'delete'; st.count = opts.count === 'exact'; return q; },
      eq: (c, v) => cmp(c, '=', v), neq: (c, v) => cmp(c, '<>', v),
      gt(c, v) { st.where.push(`${col(c)} > ${P(v)}`); return q; },
      gte(c, v) { st.where.push(`${col(c)} >= ${P(v)}`); return q; },
      lt(c, v) { st.where.push(`${col(c)} < ${P(v)}`); return q; },
      lte(c, v) { st.where.push(`${col(c)} <= ${P(v)}`); return q; },
      is(c, v) { st.where.push(`${col(c)} IS ${v === null ? 'NULL' : v ? 'TRUE' : 'FALSE'}`); return q; },
      in(c, values) { st.where.push(`${col(c)}::text = ANY(${P(values.map(String))}::text[])`); return q; },
      or(expr) {
        st.where.push(`(${expr.split(',').map((term) => {
          const m = /^([\w>-]+)\.(ilike|eq|is)\.(.*)$/.exec(term);
          if (!m) throw new Error(`desteklenmeyen süzgeç: ${term}`);
          if (m[2] === 'is') return `${col(m[1])} IS ${m[3] === 'null' ? 'NULL' : m[3].toUpperCase()}`;
          return m[2] === 'ilike' ? `${col(m[1])} ILIKE ${P(m[3])}` : `${col(m[1])}::text = ${P(m[3])}`;
        }).join(' OR ')})`);
        return q;
      },
      order(c, o) { st.orders.push(`${col(c)} ${o?.ascending === false ? 'DESC' : 'ASC'}`); return q; },
      range(a, b) { st.offset = a; st.limit = b - a + 1; return q; },
      limit(n) { st.limit = n; return q; },
      async maybeSingle() { const r = await run(); return r.error ? r : { data: r.data[0] ?? null, error: null }; },
      async single() { const r = await run(); if (r.error) return r; return r.data.length === 1 ? { data: r.data[0], error: null } : { data: null, error: { message: 'single' } }; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    return q;
  }
  const callRpc = async (name, args) => {
    writes.push({ rpc: name, args });
    if (!rpc) throw new Error(`beklenmeyen RPC: ${name}`);
    return rpc(name, args);
  };
  return { from, rpc: callRpc };
}
