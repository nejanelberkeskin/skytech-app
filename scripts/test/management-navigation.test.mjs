import test from 'node:test';import assert from 'node:assert/strict';
import {canVisit} from '../../components/admin/access/policy.ts';import {ME_OWNER} from '../../lib/admin/fixtures/permissions.ts';
const account=(key,scopes,role='NONE')=>({...ME_OWNER,admin:{...ME_OWNER.admin,legacyRole:role},permissions:key?[{key,scopes}]:[]});
test('integrated management navigation preserves each record permission and scope independently',()=>{
 const paths=[['/admin/birakma-siparisleri','orders.read'],['/admin/talepler','requests.read'],['/admin/araziler','sites.read'],['/admin/birakma-partileri','batches.read']];
 for(const [path,key] of paths){
  for(const scopes of [[{kind:'all'}],[{kind:'sites',siteIds:['a']}],[{kind:'assigned'}]])assert.equal(canVisit(account(key,scopes),path),true,path);
  for(const scopes of [[],[{kind:'sites',siteIds:[]}]])assert.equal(canVisit(account(key,scopes),path),false,path);
  assert.equal(canVisit(account(null,[],'SUPER_ADMIN'),path),false,path);
  for(const [other] of paths.filter(([p])=>p!==path))assert.equal(canVisit(account(key,[{kind:'all'}]),other),false,other);
 }
});
test('global sales and unmigrated B2B/catalog stay within their own gates',()=>{
 for(const key of ['sales.pause','sales.resume','sales.pricing.manage','system.readiness.read']){
  assert.equal(canVisit(account(key,[{kind:'all'}]),'/admin/satis-ayarlari'),true);
  assert.equal(canVisit(account(key,[{kind:'sites',siteIds:['a']}]),'/admin/satis-ayarlari'),false);
  assert.equal(canVisit(account(key,[{kind:'assigned'}]),'/admin/satis-ayarlari'),false);
 }
 assert.equal(canVisit(account('finance.read',[{kind:'all'}]),'/admin/b2b'),false);
 assert.equal(canVisit(account('content.edit',[{kind:'all'}]),'/admin/katalog'),false);
 assert.equal(canVisit(account(null,[],'FINANCE'),'/admin/b2b'),true);
 assert.equal(canVisit({...ME_OWNER,admin:{...ME_OWNER.admin,isActive:false}},'/admin/araziler'),false);
});
