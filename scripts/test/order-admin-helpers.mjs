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
