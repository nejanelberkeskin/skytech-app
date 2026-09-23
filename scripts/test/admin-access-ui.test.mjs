import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFullPermission, canVisit, visibleModules, activeAssignment } from '../../components/admin/access/policy.ts';
import { toExpiry, expiryInput } from '../../components/admin/access/labels.ts';
import { accessRequest } from '../../components/admin/access/transport.ts';
import { ME_OWNER, ME_SCOPED } from '../../lib/admin/fixtures/permissions.ts';

test('admin UI: scope and inactive status fail closed; paths need a slash boundary', () => {
  assert.equal(hasFullPermission(ME_SCOPED, 'sites.read'), false);
  assert.equal(canVisit(ME_SCOPED, '/admin/kullanicilar'), false);
  assert.equal(canVisit(ME_SCOPED, '/admin/guvenlik'), true);
  assert.equal(canVisit(ME_OWNER, '/admin/kullanicilar/abc'), true);
  assert.equal(canVisit(ME_OWNER, '/admin/kullanicilar-secrets'), false);
  assert.deepEqual(visibleModules({...ME_OWNER, admin:{...ME_OWNER.admin,isActive:false}}), []);
  assert.deepEqual(visibleModules(null), []);
});
test('assignment validity excludes future, expired and revoked access', () => {
  const now=Date.parse('2026-09-23T12:00:00Z');
  const a={startsAt:'2026-09-20T00:00:00Z',endsAt:null};
  assert.equal(activeAssignment(a,now),true);
  assert.equal(activeAssignment({...a,startsAt:'2026-10-01T00:00:00Z'},now),false);
  assert.equal(activeAssignment({...a,endsAt:new Date(now).toISOString()},now),false);
  assert.equal(activeAssignment({...a,revokedAt:'2026-09-22T00:00:00Z'},now),false);
});
test('expiry editor is explicit Turkey time, preserves an ISO instant and rejects past dates', () => {
  assert.equal(toExpiry('2099-06-20T10:30'),'2099-06-20T07:30:00.000Z');
  assert.equal(expiryInput('2099-06-20T07:30:00.000Z'),'2099-06-20T10:30:00');
  assert.equal(toExpiry(''),null);
  assert.throws(()=>toExpiry('2000-01-01T00:00'));
  assert.throws(()=>toExpiry('invalid'));
});
test('permission transport never retries a lost mutation response', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw new TypeError('connection lost');});
  await assert.rejects(accessRequest('/api/admin/staff/x','PATCH',{isActive:false}),e=>e.code==='network'&&e.status===0);
  assert.equal(calls,1);
});
test('unexpected HTTP 200 is uncertain; 409 retains conflict and warnings survive success',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('<html>not json</html>'));
  await assert.rejects(accessRequest('/api/admin/staff/x','PATCH',{}),e=>e.status===0);
  globalThis.fetch=async()=>Response.json({ok:false,error:{code:'version_changed',message:'Changed'}},{status:409});
  await assert.rejects(accessRequest('/api/admin/staff/x','PATCH',{}),e=>e.status===409&&e.code==='version_changed');
  globalThis.fetch=async()=>Response.json({ok:true,data:{id:'fixture'},warnings:[{code:'email_not_sent',message:'Gönderilemedi'}]});
  assert.equal((await accessRequest('/api/admin/invitations','POST',{})).warnings[0].code,'email_not_sent');
});
