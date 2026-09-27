import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';

// Use the real shared envelope and web Response. Every side-effect dependency is
// in-memory and throws when touched; unknown imports also fail in loadSource.
function retiredRoute(calls) {
  const forbidden = name => () => { calls.push(name); throw new Error(`Forbidden side effect: ${name}`); };
  const db = {
    from: forbidden('database/table/audit'),
    rpc: forbidden('rpc'),
    auth: { admin: Object.fromEntries(
      ['createUser', 'deleteUser', 'updateUserById', 'listUsers', 'inviteUserByEmail']
        .map(name => [name, forbidden(`auth.${name}`)]),
    ) },
  };
  const envelope = load('lib/api/envelope.ts', { 'next/server': { NextResponse: Response } });
  return load('app/api/admin/users/route.ts', {
    '@/lib/api/envelope': envelope,
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': { createServiceRoleClient: () => { calls.push('service client'); return db; }, createClient: forbidden('session client') },
    '@/lib/admin-auth': { requireAdmin: forbidden('session/authorization') },
    '@/lib/admin/audit': { auditLog: forbidden('audit') },
    '@/lib/mail': { sendStaffInvitation: forbidden('email') },
  });
}

for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
  test(`legacy users ${method}: 410 without body/auth reads, writes, email or redirect`, async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', () => { calls.push('network'); throw new Error('Network forbidden'); });
    const api = retiredRoute(calls);
    // Include old privileged payloads, malformed JSON, empty/large input, and
    // both credential presence and absence. No request is sent over the network.
    const bodies = method === 'GET' ? [undefined] : [
      JSON.stringify({ email: 'test@example.invalid', full_name: 'Test', role: 'SUPER_ADMIN', password: 'must-never-be-used' }),
      JSON.stringify({ id: '10000000-0000-0000-0000-000000000001', role: 'SUPER_ADMIN', is_active: false }),
      '{ malformed', '', 'null', '[]', 'x'.repeat(100_000),
    ];
    for (const authenticated of [false, true]) {
      for (const body of bodies) {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        if (authenticated) headers.set('Authorization', 'Bearer inert-fixture-token');
        const request = new Request('http://test.invalid/api/admin/users?role=SUPER_ADMIN', { method, headers, body });
        const result = await api[method](request);
        assert.equal(result.status, 410);
        assert.deepEqual(await result.json(), {
          ok: false,
          error: {
            code: 'endpoint_retired',
            message: 'Bu personel yönetimi uç noktası kullanımdan kaldırıldı. Personel ve Davetler ekranlarını kullanın.',
          },
        });
        assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
        assert.equal(result.headers.get('Location'), null);
        assert.equal(result.headers.get('Refresh'), null);
        assert.equal(result.headers.get('Set-Cookie'), null);
        assert.equal(result.headers.get('Retry-After'), null);
        assert.equal(request.bodyUsed, false);
      }
    }
    // A request whose fields cannot be accessed also succeeds: retirement does
    // not even inspect cookies, session, JSON, URL, or headers.
    const unreadable = new Proxy({}, { get: () => { calls.push('request read'); throw new Error('Request must not be read'); } });
    assert.equal((await api[method](unreadable)).status, 410);
    assert.deepEqual(calls, []);
  });
}
