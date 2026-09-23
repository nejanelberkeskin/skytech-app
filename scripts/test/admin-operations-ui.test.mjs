import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
import { REFUND_VIEW_FIXTURES } from '../../lib/refunds/fixtures.ts';
import * as model from '../../lib/refunds/model.ts';
import { canAccessPath, getModulesForRole } from '../../lib/rbac.ts';
const form = load('components/admin/operations/refund-form.ts', {'@/lib/refunds/model':model});
const client = load('components/admin/operations/client.ts');
const completeDraft = { refundId:'provider-123',source:'provider_panel',reference:'ref-1',note:'Sağlayıcı panelinden işlem doğrulandı.' };

test('İade formu: kanıt, gerekçe ve başarılı iade kimliği zorunlu',()=>{
 assert.deepEqual(Object.keys(form.resolutionErrors('resolve_succeeded',form.EMPTY_RESOLUTION)).sort(),['note','refundId','source']);
 assert.deepEqual(Object.keys(form.resolutionErrors('resolve_failed',form.EMPTY_RESOLUTION)).sort(),['note','source']);
 assert.deepEqual(form.resolutionErrors('resolve_succeeded',completeDraft),{});
 assert.ok(form.resolutionErrors('resolve_succeeded',{...completeDraft,refundId:'<script>'}).refundId);
 assert.ok(form.resolutionErrors('resolve_failed',{...completeDraft,note:'a'.repeat(1001)}).note);
});
test('İade isteği: sunucu izinleri esas; tutar hiçbir isteğe eklenmez',()=>{
 const op={...REFUND_VIEW_FIXTURES.needsReview.operations[0],allowedActions:['resolve_succeeded'],attempt:4};
 const req=form.refundRequest('order',op,'resolve_succeeded',completeDraft);
 assert.equal(req.body.expectedAttempt,4);
 assert.equal(req.body.outcome,'provider_succeeded');
 assert.equal('amountKurus' in req.body,false);
 assert.equal(req.url,`/api/admin/refunds/operations/${op.id}/resolve`);
 assert.throws(()=>form.refundRequest('order',op,'retry',completeDraft));
});
test('İlk sipariş ve çift tahsilat çağrıları sadece kendi kimliklerini taşır; finalize para çağrısı değildir',()=>{
 const op={...REFUND_VIEW_FIXTURES.needsReview.operations[0],allowedActions:['execute'],id:null,state:'none',attempt:0};
 assert.deepEqual(form.refundRequest('order',op,'execute',completeDraft).body,{kind:'order'});
 assert.deepEqual(form.refundRequest('order',{...op,kind:'duplicate'},'execute',completeDraft).body,{kind:'duplicate',paymentId:op.paymentId});
 const finalized=form.refundRequest('order',{...op,id:'op',allowedActions:['finalize']},'finalize',completeDraft);
 assert.deepEqual(finalized,{url:'/api/admin/refunds/operations/op/finalize',body:{}});
});
test('Salt okuma görünümü ve operasyon/mühendis rolü iade işlemi başlatamaz',()=>{
 assert.equal(canAccessPath('FINANCE','/admin/iadeler/123'),true);
 for(const role of ['OPERATIONS','ENGINEER']){
  assert.equal(canAccessPath(role,'/admin/iadeler'),false);
  assert.equal(getModulesForRole(role).some(m=>m.id==='iadeler'),false);
 }
 const op={...REFUND_VIEW_FIXTURES.needsReview.operations[0],allowedActions:[]};
 assert.throws(()=>form.refundRequest('order',op,'resolve_succeeded',completeDraft));
});
test('Transport: 200 belirsiz sonucu başarı diye dönüştürmez, null view ve uyarıyı korur',async()=>{
 const original=globalThis.fetch; const body={view:null,result:{outcome:'needs_review'}};
 try {
  globalThis.fetch=async()=>Response.json({ok:true,data:body,warnings:[{code:'result_not_recorded',message:'Mutabakat gerekli.'}]});
  const response=await client.adminRequest('/api/test',{});
  assert.deepEqual(response.data,body); assert.equal(response.warnings[0].code,'result_not_recorded');
 } finally {globalThis.fetch=original;}
});
test('Transport: ağ hatasında POST otomatik tekrarlanmaz ve belirsizlik açıklanır',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw new Error('network');};
  await assert.rejects(client.adminRequest('/api/test',{}),e=>e.code==='network' && /gerçekleşmiş olabilir/.test(e.message));
  assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
test('Transport: 409 sürüm bilgisi, 403 yetki ve 503 hata boş veriyle maskelenmez',async()=>{
 const original=globalThis.fetch;
 try{
  for(const [status,code] of [[409,'attempt_changed'],[403,'forbidden'],[503,'unavailable']]){
   globalThis.fetch=async()=>Response.json({ok:false,error:{code,message:'Beklenen hata',details:{availableAt:'2026-09-23T10:00:00Z'}}},{status});
   await assert.rejects(client.adminRequest('/api/test'),e=>e.code===code && e.status===status && !!e.details.availableAt);
  }
 }finally{globalThis.fetch=original;}
});
