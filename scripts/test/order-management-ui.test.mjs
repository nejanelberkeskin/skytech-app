import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
import { canVisit } from '../../components/admin/access/policy.ts';
import { ME_OWNER } from '../../lib/admin/fixtures/permissions.ts';
const types = load('lib/orders/types.ts');
const view = load('components/admin/orders/view.ts', { '@/lib/orders/types': types });
const account = scopes => ({ ...ME_OWNER, admin: { ...ME_OWNER.admin, legacyRole: 'NONE' }, permissions: [{ key: 'orders.read', scopes }] });
test('order UI: custom/scoped readers reach the screen; legacy role alone never grants access', () => {
  for (const scopes of [[{kind:'all'}], [{kind:'sites',siteIds:['A']}], [{kind:'assigned'}]]) assert.equal(canVisit(account(scopes),'/admin/birakma-siparisleri'),true);
  assert.equal(canVisit(account([]),'/admin/birakma-siparisleri'),false);
  assert.equal(canVisit(account([{kind:'sites',siteIds:[]}]),'/admin/birakma-siparisleri'),false);
  assert.equal(canVisit({...ME_OWNER,permissions:[]},'/admin/birakma-siparisleri'),false);
});
test('order UI: permission, scope, identity and assurance changes reset state, polling timestamp does not', () => {
  const base = account([{kind:'all'}]);
  assert.equal(view.orderAccessKey(base), view.orderAccessKey({...base,checkedAt:'later'}));
  for (const changed of [{...base,permissions:[]}, account([{kind:'sites',siteIds:['A']}]), {...base,admin:{...base.admin,userId:'another'}}, {...base,mfa:{...base.mfa,assuranceLevel:'aal2',verifiedAt:'2026-09-29T12:00:00Z'}}]) assert.notEqual(view.orderAccessKey(base),view.orderAccessKey(changed));
});
test('order UI: missing alert groups never become a zero-valued authorized filter', () => {
  assert.deepEqual(view.availableAlerts({alerts:{capacity:0}}).map(a=>a.flag),['capacity']);
  assert.deepEqual(view.availableAlerts({alerts:{capacity:0,refundPending:0}}).map(a=>a.flag),['capacity','refund_pending']);
});
test('order UI: action capability is enforced independently of other enabled actions', () => {
  const detail={capabilities:{note:true,cancel:false,invoiceQueue:false,reserveCapacity:false}};
  assert.equal(view.canAct(detail,'note'),true);
  for(const action of ['cancel_by_seller','invoice_now','reserve_capacity','refund','unknown',null]) assert.equal(view.canAct(detail,action),false);
});
test('order UI: incomplete or invalid success response cannot confirm a mutation', () => {
  for(const data of [null,{}, {status:'ok'}, {ok:true}, 'paid']) assert.equal(view.validActionResult(data),false);
  assert.equal(view.validActionResult({status:'cancelled_by_seller'}),true);
});
