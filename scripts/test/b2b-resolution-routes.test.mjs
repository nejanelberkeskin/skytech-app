import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createRequire} from 'node:module';
import {loadSource as load} from './load-source.mjs';
const server=createRequire(import.meta.url)('next/server');
const payment='00000000-0000-4000-8000-000000000001';
const response=(data,status=200)=>server.NextResponse.json(data,{status});
const envelopes={fail:(status,code,message)=>response({ok:false,error:{code,message}},status),ok:data=>response({ok:true,data})};
const denied={error:envelopes.fail(403,'forbidden','denied')};
const guard={error:null,admin:{user_id:'actor'},assurance:{verifiedAt:new Date().toISOString()}};
function harness({guards=[guard,guard],begin={status:'started',operationId:'op',token:'private-token'},result={status:'success'},finish={status:'released'}}={}){
 const calls=[],provider=[];let checks=0;
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='begin_b2b_resolution'?begin:finish,error:null};}};
 const route=load('app/api/admin/b2b/payments/[paymentId]/resolve/route.ts',{zod:{z},
  '@/lib/b2b/resolution-access':{requireB2bResolution:async()=>guards[checks++]??guard},
  '@/lib/supabase/server':{createServiceRoleClient:()=>db},
  '@/lib/payments/iyzico-config':{iyzicoConfig:()=>({isTest:true})},
  '@/lib/payments/iyzico':{callIyzico:async(...args)=>{provider.push(args);return result;}},
  '@/lib/b2b/payment-result':{b2bPaymentResult:r=>({status:r.status})},
  '@/lib/api/envelope':envelopes,
 });
 const post=(body={action:'release',evidence:'Provider closure evidence LOCAL-1',sessionClosed:true})=>route.POST(new server.NextRequest('https://local.invalid/api/admin/b2b/payments/'+payment+'/resolve',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({paymentId:payment})});
 return {calls,provider,post};
}
test('resolution: permission denial precedes every database and provider call',async()=>{
 const h=harness({guards:[denied]});assert.equal((await h.post()).status,403);assert.deepEqual(h.calls,[]);assert.deepEqual(h.provider,[]);
});
test('resolution: unchecked closure and invalid evidence stop before lease/provider',async()=>{
 const h=harness();for(const body of [{action:'release',evidence:'valid evidence',sessionClosed:false},{action:'refresh',evidence:'short',sessionClosed:false}])assert.equal((await h.post(body)).status,422);
 assert.deepEqual(h.calls,[]);assert.deepEqual(h.provider,[]);
});
test('resolution: query is bracketed by two permission checks and two short RPCs; no charge/refund',async()=>{
 const h=harness();const r=await h.post();assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,data:{status:'released'}});
 assert.deepEqual(h.calls.map(c=>c.name),['begin_b2b_resolution','finish_b2b_resolution']);
 assert.equal(h.provider.length,1);assert.deepEqual(h.provider[0],['checkoutForm','retrieve',{locale:'tr',token:'private-token',conversationId:payment}]);
 assert.equal(h.calls[1].args.p_actor,'actor');
});
test('resolution: permission removed during provider read prevents apply',async()=>{
 const h=harness({guards:[guard,denied]});assert.equal((await h.post()).status,403);assert.equal(h.provider.length,1);assert.equal(h.calls.length,1);
});
test('resolution: tokenless attempt uses conversation lookup; ambiguous outcome stays review',async()=>{
 const h=harness({begin:{status:'started',operationId:'op',token:null},result:{status:'failure',errorMessage:'PRIVATE'},finish:{status:'review'}});
 const r=await h.post();assert.deepEqual(await r.json(),{ok:true,data:{status:'review'}});assert.deepEqual(h.provider[0],['payment','retrieve',{locale:'tr',paymentConversationId:payment}]);
});
test('resolution: stale lease returns conflict without claiming success',async()=>{
 const h=harness({finish:{status:'stale'}});assert.equal((await h.post()).status,409);
});
test('resolution: busy start does not query provider or finish',async()=>{
 const h=harness({begin:{status:'busy'}});assert.equal((await h.post()).status,409);assert.equal(h.provider.length,0);assert.equal(h.calls.length,1);
});

test('access: mandatory fresh MFA and two global permissions even with global rollout disabled',async()=>{
 const perms=['finance.read','finance.b2b_payment.resolve'].map(key=>({key,scopes:[{kind:'all'}]}));
 let current={error:null,admin:{user_id:'actor'},access:{permissions:perms},assurance:{aal:'aal1',verifiedAt:null,enrolled:false}};
 const access=load('lib/b2b/resolution-access.ts',{
  '@/lib/admin/permissions':{requireAdminAccess:async()=>current},
  '@/lib/admin/permission-set':{
   evaluatePermissionSet:(access,assurance,required,enforced)=>{
    assert.equal(enforced,true);assert.equal(required.length,2);assert.ok(required.every(r=>r.target==='all'));
    return assurance.aal==='aal2'?null:{code:'mfa_required'};
   },permissionSetResponse:d=>envelopes.fail(403,d.code,'MFA'),
  },'@/lib/api/envelope':envelopes,
 });
 assert.equal((await access.requireB2bResolution({})).error.status,403);
 current={...current,assurance:{aal:'aal2',verifiedAt:'invalid',enrolled:true}};assert.equal((await access.requireB2bResolution({})).error.status,403);
 current={...current,assurance:{aal:'aal2',verifiedAt:new Date().toISOString(),enrolled:true}};assert.equal((await access.requireB2bResolution({})).error,null);
});

test('callback: closed attempts are actually queried so a late success reaches the protected recorder',async()=>{
 const calls=[],rpc=[];
 const route=load('app/api/payment/callback/route.ts',{
  'next/server':server,
  '@/lib/supabase/server':{createServiceRoleClient:()=>({from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{id:payment,order_id:payment,status:'failed',provider:'iyzico',metadata:{checkout_type:'b2b',is_test:true,ui_locale:'tr'}}})}),rpc:async(name,args)=>{rpc.push({name,args});return {data:{status:'review'}};}})},
  '@/lib/payments/iyzico-config':{iyzicoConfig:()=>({isTest:true})},
  '@/lib/payments/iyzico':{callIyzico:async(...args)=>{calls.push(args);return {paymentStatus:'SUCCESS'};}},
  '@/lib/b2b/payment-result':{b2bPaymentResult:r=>r},
 });
 const r=await route.POST(new server.NextRequest('https://local.invalid/api/payment/callback',{method:'POST',body:new URLSearchParams({token:'old-token-local'})}));
 assert.equal(calls.length,1);assert.equal(rpc[0].args.p_result.paymentStatus,'SUCCESS');assert.equal(r.status,303);assert.ok(!r.headers.get('location').includes('status=success'));
});
test('list: global finance guard precedes reads; DTO drops token, email and metadata',async()=>{
 let reads=0,allow=false;
 const chain={select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:[{id:payment,order_id:payment,amount:200,currency:'TRY',status:'pending',metadata:{quote_id:payment,iyzico_token:'PRIVATE',buyer_email:'secret@example.invalid',payment_review_required:true}}]})};
 const holdChain={select(){return this;},in(){return this;},is:async()=>({data:[]})};
 const route=load('app/api/admin/b2b/payments/route.ts',{
  '@/lib/admin/permissions':{requirePermission:async(_r,key)=>{assert.equal(key,'finance.read');return allow?guard:denied;}},
  '@/lib/supabase/server':{createServiceRoleClient:()=>({from:table=>{reads++;return table==='payments'?chain:holdChain;}})},
  '@/lib/api/envelope':envelopes,
 });
 const request=new server.NextRequest('https://local.invalid/api/admin/b2b/payments?page=0');
 assert.equal((await route.GET(request)).status,403);assert.equal(reads,0);
 allow=true;const r=await route.GET(request);assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('PRIVATE')&&!text.includes('secret@')&&!text.includes('metadata'));assert.equal(JSON.parse(text).data.items[0].linked,true);
});
