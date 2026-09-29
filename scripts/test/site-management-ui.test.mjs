import {test} from 'node:test';import assert from 'node:assert/strict';import {loadSource as load} from './load-source.mjs';
const {statusAllowed,siteAccessKey}=load('components/admin/sites/view.ts');
test('site stage selectors require publish only for storefront changes',()=>{
 const s={status:'open',isPublic:true,capabilities:{edit:true,publish:false}};
 assert.equal(statusAllowed(s,'scheduled'),false);assert.equal(statusAllowed({...s,isPublic:false},'scheduled'),true);
 assert.equal(statusAllowed({...s,status:'scheduled'},'monitoring'),true);assert.equal(statusAllowed({...s,status:'scheduled'},'closed'),false);
 assert.equal(statusAllowed({...s,capabilities:{edit:false,publish:true}},'scheduled'),true);
 assert.equal(statusAllowed({...s,status:'scheduled',capabilities:{edit:false,publish:true}},'monitoring'),false);
});
test('site permission and legacy delete role change reset forms; polling does not',()=>{
 const me={admin:{userId:'u',isActive:true,legacyRole:'SUPER_ADMIN'},permissions:[],checkedAt:'1'};
 assert.equal(siteAccessKey(me),siteAccessKey({...me,checkedAt:'2'}));assert.notEqual(siteAccessKey(me),siteAccessKey({...me,admin:{...me.admin,legacyRole:'NONE'}}));
});
