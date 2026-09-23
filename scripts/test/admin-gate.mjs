// Yönetim uçları için GERÇEK izin kapısı: yalnız oturum/MFA durumu taklittir; etkili yetki,
// kapsam ve MFA kuralı gerçek kaynak koddan (lib/admin/permissions.ts) ve gerçek SQL'den gelir.
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import { restClient } from './pglite-db.mjs';

const response = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };
export const envelope = load('lib/api/envelope.ts', { 'next/server': { NextResponse: response } });
export const permissionKeys = load('lib/admin/permission-keys.ts');
export const pagination = load('lib/admin/pagination.ts');

export const AAL1 = { aal: 'aal1', verifiedAt: null, enrolled: false };
export const AAL2_FRESH = () => ({ aal: 'aal2', verifiedAt: new Date().toISOString(), enrolled: true });

/** `access`: veritabanı yerine sabit etkili yetki (birim testleri); verilmezse `db` üzerinden gerçek SQL. */
export function realGate({ db = null, userId, assurance = AAL1, access = null }) {
  const rpcDb = access
    ? { rpc: async () => ({ data: access, error: null }) }
    : restClient(db);
  return load('lib/admin/permissions.ts', {
    '@/lib/admin-auth': {
      requireAdmin: async () => ({ admin: { user_id: userId, full_name: 'Deneme', email: 'deneme@example.invalid' }, error: null }),
    },
    '@/lib/api/envelope': envelope,
    '@/lib/supabase/server': { createServiceRoleClient: () => rpcDb },
    './mfa': { sessionAssurance: async () => assurance },
    './permission-keys': permissionKeys,
  });
}

/** Rol/saha uçlarını gerçek servis + gerçek kapı ile yükler. */
export async function loadAdminRoute(file, { db, userId, assurance = AAL1, extra = {} }) {
  const staff = await import('../../lib/admin/staff.ts');
  const { createRolesService } = await import('../../lib/admin/roles.ts');
  const staffHttp = load('lib/admin/staff-http.ts', {
    zod: { z },
    '@/lib/api/envelope': envelope,
    '@/lib/supabase/server': { createServiceRoleClient: () => restClient(db) },
    './staff': staff,
  });
  return load(file, {
    zod: { z },
    '@/lib/admin/permissions': realGate({ db, userId, assurance }),
    '@/lib/admin/roles-http': { rolesService: () => createRolesService({ db: restClient(db) }) },
    '@/lib/admin/staff-http': staffHttp,
    '@/lib/admin/pagination': pagination,
    '@/lib/api/envelope': envelope,
    '@/lib/supabase/server': { createServiceRoleClient: () => restClient(db) },
    ...extra,
  });
}

/** Next isteği yerine geçen en küçük nesne. */
export const request = ({ query = {}, body } = {}) => ({
  nextUrl: { searchParams: new URLSearchParams(query), origin: 'https://skytechgreen.com' },
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});
export const params = (key) => ({ params: Promise.resolve({ key }) });

/** `ADMIN_MFA_ENFORCED` yalnız fonksiyon süresince açılır. */
export async function withMfaEnforced(fn) {
  const before = process.env.ADMIN_MFA_ENFORCED;
  process.env.ADMIN_MFA_ENFORCED = '1';
  try { return await fn(); } finally {
    if (before === undefined) delete process.env.ADMIN_MFA_ENFORCED; else process.env.ADMIN_MFA_ENFORCED = before;
  }
}
