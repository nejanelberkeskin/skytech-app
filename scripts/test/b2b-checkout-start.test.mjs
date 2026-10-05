import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createDb, one } from './pglite-db.mjs';
import { loadSource } from './load-source.mjs';
const server=createRequire(import.meta.url)('next/server');
const user='10000000-0000-0000-0000-000000000001', quote='50000000-0000-4000-8000-000000000001';
const fixture=(await readFile(new URL('./fixtures/b2b-payment-schema.sql',import.meta.url),'utf8')).replace('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;','');
const upgrade=(await readFile(new URL('../../supabase/migrations/004_corporate_quotes_upgrade.sql',import.meta.url),'utf8')).split('-- ── Email Log Table')[0];
const migrations=await Promise.all(['034_b2b_payment_result.sql','035_b2b_reconciliation.sql','037_b2b_resolution.sql','039_b2b_checkout_start.sql'].map(f=>readFile(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8')));
async function setup(t){
 t.mock.method(globalThis,'fetch',()=>{throw Error('external_forbidden');});
 const db=await createDb();t.after(()=>db.close());await db.exec(fixture);await db.exec(upgrade);
 for(const sql of migrations)await db.exec('BEGIN;\n'+sql+'\nCOMMIT;');
 await db.query("INSERT INTO corporate_quotes(id,user_id,status,approved_price,approved_seed_count,corporate_email,company_name,contact_person) VALUES($1,$2,'QUOTED',200,20,'local@example.invalid','Local Company','Local Buyer')",[quote,user]);
 const claim=async()=>(await one(db,'SELECT claim_b2b_checkout($1,$2,200,20,true) v',[quote,user])).v;
 const begin=async(p,u=user,mode=true)=>(await one(db,'SELECT begin_b2b_checkout_start($1,$2,$3,\'ru\') v',[p,u,mode])).v;
 const finish=async(p,token=null,ready=false,origin='unknown')=>(await one(db,'SELECT finish_b2b_checkout_start($1,$2,true,$3,$4,$5) v',[p,user,origin,token,ready])).v;
 const expire=async(p)=>db.query("UPDATE b2b_checkout_starts SET expires_at=now()-interval '1 second' WHERE payment_id=$1",[p]);
 const due=async()=>db.exec("UPDATE b2b_reconciliation_queue SET next_check_at=now()-interval '1 second'");
 const candidates=async()=>(await db.query('SELECT * FROM claim_b2b_reconciliation(true)')).rows;
 const record=async(c,over={})=>(await one(db,'SELECT record_b2b_payment_result($1,true,$2) v',[c.payment_id,JSON.stringify({status:'success',payment_status:'SUCCESS',payment_id:'provider-local',basket_id:c.order_id,conversation_id:c.payment_id,currency:'TRY',price_kurus:20000,paid_kurus:20000,fraud_status:1,...over})])).v;
 return {db,claim,begin,finish,expire,due,candidates,record};
}
test('start: prepared lease recovery cancels only unsent order and permanently fences old dispatch',async t=>{
 const h=await setup(t),a=await h.claim();assert.equal(a.status,'claimed');
 assert.equal((await h.claim()).status,'checkout_pending');assert.deepEqual(await h.candidates(),[]);
 await h.expire(a.payment_id);assert.equal((await h.begin(a.payment_id)).status,'rejected');
 const b=await h.claim();assert.equal(b.status,'claimed');assert.notEqual(a.payment_id,b.payment_id);
 assert.equal((await h.begin(a.payment_id)).status,'rejected');assert.equal((await h.begin(b.payment_id)).status,'dispatch');
 assert.equal((await one(h.db,'SELECT status FROM orders WHERE id=$1',[a.order_id])).status,'cancelled');
 assert.equal((await one(h.db,'SELECT metadata FROM payments WHERE id=$1',[a.payment_id])).metadata.init_not_started,true);
 assert.equal((await one(h.db,"SELECT count(*)::int n FROM b2b_payment_observations WHERE reason='init_not_started'")).n,1);
});
test('start: dispatch is one-use; expiry/not-found/unknown never authorizes another attempt',async t=>{
 const h=await setup(t),a=await h.claim();assert.equal((await h.begin(a.payment_id)).status,'dispatch');
 assert.equal((await h.begin(a.payment_id)).status,'rejected');await h.expire(a.payment_id);await h.finish(a.payment_id);
 assert.equal((await h.claim()).status,'checkout_pending');
 assert.deepEqual(await h.record(a,{status:'failure',payment_status:null,payment_id:null}),{status:'review'});
 assert.equal((await h.claim()).status,'checkout_unavailable');
 assert.equal((await one(h.db,'SELECT count(*)::int n FROM payments')).n,1);
});
test('start: crash after dispatch is discovered without a token; prepared/other environment are excluded',async t=>{
 const h=await setup(t),a=await h.claim();assert.deepEqual(await h.candidates(),[]);
 await h.begin(a.payment_id);await h.due();assert.deepEqual((await h.db.query('SELECT * FROM claim_b2b_reconciliation(false)')).rows,[]);
 assert.deepEqual(await h.candidates(),[{payment_id:a.payment_id,token:null,attempt:1}]);assert.deepEqual(await h.candidates(),[]);
});
test('start: missing HTML preserves token/locale/review metadata; late success can settle safely',async t=>{
 const h=await setup(t),a=await h.claim();await h.begin(a.payment_id);
 await h.db.query("UPDATE payments SET metadata=metadata||'{\"concurrent_marker\":true}' WHERE id=$1",[a.payment_id]);
 assert.deepEqual(await h.finish(a.payment_id,'valid-local-token',false,'provider_response'),{status:'unknown'});
 const meta=(await one(h.db,'SELECT metadata FROM payments WHERE id=$1',[a.payment_id])).metadata;
 assert.equal(meta.iyzico_token,'valid-local-token');assert.equal(meta.ui_locale,'ru');assert.equal(meta.concurrent_marker,true);
 await h.due();assert.equal((await h.candidates())[0].token,'valid-local-token');
 assert.deepEqual(await h.record(a),{status:'paid'});assert.equal((await h.claim()).status,'closed');
});
test('start: retry never releases legacy or corrupted prepared attempts',async t=>{
 for(const scenario of ['legacy','token','observation','hold']) {
  const h=await setup(t),a=await h.claim();await h.expire(a.payment_id);
  if(scenario==='legacy')await h.db.query('DELETE FROM b2b_checkout_starts WHERE payment_id=$1',[a.payment_id]);
  if(scenario==='token')await h.db.query("UPDATE payments SET metadata=metadata||'{\"iyzico_token\":\"valid-token\"}' WHERE id=$1",[a.payment_id]);
  if(scenario==='observation')await h.record(a,{payment_status:'FAILURE'});
  if(scenario==='hold')await h.db.query("INSERT INTO b2b_payment_holds(payment_id,quote_id,reason) VALUES($1,$2,'local')",[a.payment_id,quote]);
  assert.notEqual((await h.claim()).status,'claimed',scenario);assert.equal((await one(h.db,'SELECT status FROM payments WHERE id=$1',[a.payment_id])).status,'pending');
 }
});
test('start: owner/environment/state changes cannot dispatch; SQL functions are not customer-accessible',async t=>{
 const h=await setup(t),a=await h.claim();
 assert.equal((await h.begin(a.payment_id,'10000000-0000-0000-0000-000000000002')).status,'rejected');
 assert.equal((await h.begin(a.payment_id,user,false)).status,'rejected');
 await h.db.query('UPDATE corporate_quotes SET approved_price=201 WHERE id=$1',[quote]);assert.equal((await h.begin(a.payment_id)).status,'rejected');
 for(const role of ['anon','authenticated'])for(const fn of ['claim_b2b_checkout(uuid,uuid,numeric,integer,boolean)','begin_b2b_checkout_start(uuid,uuid,boolean,text)','finish_b2b_checkout_start(uuid,uuid,boolean,text,text,boolean)'])assert.equal((await one(h.db,'SELECT has_function_privilege($1,$2,\'EXECUTE\') ok',[role,fn])).ok,false);
 assert.equal((await one(h.db,"SELECT has_function_privilege('service_role','claim_b2b_checkout_core(uuid,uuid,numeric,integer,boolean)','EXECUTE') ok")).ok,false);
});
test('start: audit failure rolls back recovery; no half-cancelled attempt',async t=>{
 const h=await setup(t),a=await h.claim();await h.expire(a.payment_id);
 await h.db.exec("CREATE FUNCTION deny_observation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced_observation_failure'; END $$; CREATE TRIGGER deny_observation BEFORE INSERT ON b2b_payment_observations FOR EACH ROW EXECUTE FUNCTION deny_observation();");
 await assert.rejects(h.claim(),/forced_observation_failure/);
 assert.equal((await one(h.db,'SELECT status FROM payments WHERE id=$1',[a.payment_id])).status,'pending');
 assert.equal((await one(h.db,'SELECT order_id FROM corporate_quotes WHERE id=$1',[quote])).order_id,a.order_id);
});
test('start: stale finish cannot return an HTML form after concurrent success or review',async t=>{
 for(const success of [true,false]){
  const h=await setup(t),a=await h.claim();await h.begin(a.payment_id);await h.record(a,success?{}:{fraud_status:0});
  assert.equal((await h.finish(a.payment_id,'valid-token',true,'provider_response')).status,'unknown');
  assert.equal((await h.finish(a.payment_id,'replacement-token',true,'provider_response')).status,'stale');
  assert.equal((await one(h.db,'SELECT metadata FROM payments WHERE id=$1',[a.payment_id])).metadata.iyzico_token,'valid-token');
 }
});
function routeHarness(h,{result={status:'success',token:'valid-local-token',checkoutFormContent:'<div>local only</div>'},origin='provider_response',failRpc,throwProvider=false,throwFormat=false}={}){
 const calls=[],rpc=[];
 const service={from(){let id;return {select(){return this;},eq(_c,v){id=v;return this;},maybeSingle:async()=>({data:await one(h.db,'SELECT * FROM corporate_quotes WHERE id=$1',[id])})};},async rpc(name,a){rpc.push(name);if(name===failRpc)return {error:{message:'PRIVATE'}};
  let data;
  if(name==='claim_b2b_checkout')data=await h.claim();
  else if(name==='begin_b2b_checkout_start')data=(await one(h.db,'SELECT begin_b2b_checkout_start($1,$2,$3,$4) v',[a.p_payment,a.p_user,a.p_is_test,a.p_locale])).v;
  else if(name==='finish_b2b_checkout_start')data=await h.finish(a.p_payment,a.p_token,a.p_form_ready,a.p_origin);
  else throw Error(name);return {data};}};
 const route=loadSource('app/api/payment/b2b-checkout/route.ts',{
  'next/server':server,'@/lib/supabase/server':{createServiceRoleClient:()=>service,createSupabaseServer:async()=>({auth:{getUser:async()=>({data:{user:{id:user,email:'local@example.invalid'}}})}})},
  iyzipay:{default:{LOCALE:{TR:'tr'},CURRENCY:{TRY:'TRY'},PAYMENT_GROUP:{PRODUCT:'PRODUCT'},BASKET_ITEM_TYPE:{VIRTUAL:'VIRTUAL'}}},
  '@/lib/admin-auth':{rateLimit:()=>null,getClientIP:()=> '127.0.0.1'},'@/lib/payments/iyzico-config':{iyzicoConfig:()=>({isTest:true})},
  '@/lib/payments/iyzico':{priceToKurus:n=>Number(n)*100,callIyzicoObserved:async(...a)=>{calls.push(a);if(throwProvider)throw Error('PRIVATE');return {origin,result};}},
  '@/lib/utils/format':{formatDateForIyzico:()=>{if(throwFormat)throw Error('PRIVATE');return '2026-10-05 12:00:00';}},
 });
 return {calls,rpc,post:()=>route.POST(new server.NextRequest('https://local.invalid/api/payment/b2b-checkout',{method:'POST',body:JSON.stringify({quoteId:quote,locale:'ru'})}))};
}
test('start route: local request-building failure happens before claim or provider call',async t=>{
 t.mock.method(console,'error',()=>{});const h=await setup(t),r=routeHarness(h,{throwFormat:true});
 assert.equal((await r.post()).status,503);assert.deepEqual(r.rpc,[]);assert.deepEqual(r.calls,[]);
 assert.equal((await one(h.db,'SELECT count(*)::int n FROM payments')).n,0);
});
test('start route: token persisted before returning form and second tab cannot call provider',async t=>{
 const h=await setup(t),r=routeHarness(h);assert.equal((await r.post()).status,200);
 const second=await r.post();assert.equal(second.status,409);assert.equal((await second.json()).code,'checkout_pending');assert.equal(r.calls.length,1);
 const meta=(await one(h.db,'SELECT metadata FROM payments')).metadata;assert.equal(meta.iyzico_token,'valid-local-token');assert.equal(meta.ui_locale,'ru');
});
test('start route: timeout, SDK throw, provider failure and malformed success keep lock with pending message',async t=>{
 t.mock.method(console,'error',()=>{});
 for(const opts of [{origin:'unknown',result:{status:'failure',errorCode:'timeout'}},{throwProvider:true},{result:{status:'failure',errorCode:'1001'}},{result:{status:'success',token:'valid-token'}}]){
  const h=await setup(t),r=routeHarness(h,opts),res=await r.post();assert.equal(res.status,503);assert.equal((await res.json()).code,'checkout_pending');
  assert.equal((await one(h.db,'SELECT status FROM payments')).status,'pending');assert.notEqual((await h.claim()).status,'claimed');
 }
});
test('start route: begin RPC failure sends nothing; finish RPC failure never exposes the form',async t=>{
 for(const failRpc of ['begin_b2b_checkout_start','finish_b2b_checkout_start']){
  const h=await setup(t),r=routeHarness(h,{failRpc}),res=await r.post();assert.equal(res.status,503);assert.equal((await res.json()).code,'checkout_pending');assert.equal(r.calls.length,failRpc.startsWith('begin')?0:1);
 }
});
test('start: tokenless reconciliation uses conversation query and can record a fully matched success',async t=>{
 const h=await setup(t),a=await h.claim();await h.begin(a.payment_id);await h.finish(a.payment_id);await h.due();
 const calls=[];const worker=loadSource('lib/b2b/reconcile.ts',{
  '@/lib/payments/iyzico-config':{iyzicoConfig:()=>({isTest:true})},
  '@/lib/payments/iyzico':{callIyzico:async(...args)=>{calls.push(args);return {status:'success',payment_status:'SUCCESS',payment_id:'provider-local',basket_id:a.order_id,conversation_id:a.payment_id,currency:'TRY',price_kurus:20000,paid_kurus:20000,fraud_status:1};}},
  './payment-result':{b2bPaymentResult:r=>r},
 });
 const report=await worker.reconcileB2bPayments({rpc:async(name,args)=>{
  if(name==='claim_b2b_reconciliation')return {data:await h.candidates()};
  if(name==='record_b2b_payment_result')return {data:(await one(h.db,'SELECT record_b2b_payment_result($1,true,$2) v',[args.p_payment,JSON.stringify(args.p_result)])).v};
  if(name==='finish_b2b_reconciliation')return {data:(await one(h.db,'SELECT finish_b2b_reconciliation($1,$2,$3) v',[args.p_payment,args.p_attempt,args.p_outcome])).v};
  if(name==='b2b_reconciliation_summary')return {data:(await one(h.db,'SELECT b2b_reconciliation_summary() v')).v};
  throw Error(name);
 }});
 assert.equal(report.paid,1);assert.deepEqual(calls,[['payment','retrieve',{locale:'tr',paymentConversationId:a.payment_id}]]);
});
test('start: queue exhaustion leaves review and never releases a tokenless attempt',async t=>{
 const h=await setup(t),a=await h.claim();await h.begin(a.payment_id);
 for(let n=1;n<=8;n++){await h.due();const rows=await h.candidates();assert.equal(rows[0].attempt,n);await h.db.query("SELECT finish_b2b_reconciliation($1,$2,'provider_unavailable')",[a.payment_id,n]);}
 await h.due();assert.deepEqual(await h.candidates(),[]);assert.equal((await h.claim()).status,'checkout_unavailable');
});
test('start SDK provenance: provider fields cannot impersonate transport origin; throwing SDK stays unknown',async t=>{
 const cases=[
  [(req,cb)=>cb(null,{status:'failure',errorCode:'timeout'}),'provider_response'],
  [(req,cb)=>cb(Error('PRIVATE')),'unknown'],
  [()=>{throw Error('may have been sent');},'unknown'],
  [(req,cb)=>cb(null,'invalid response'),'unknown'],
 ];
 for(const [create,expected] of cases){
  const sdk=loadSource('lib/payments/iyzico.ts',{'@/lib/iyzico':{default:{checkoutFormInitialize:{create}}},'./iyzico-config':{iyzicoConfig:()=>({isTest:true})},'@/lib/tr-iller':{}});
  const answer=await sdk.callIyzicoObserved('checkoutFormInitialize','create',{});
  assert.equal(answer.origin,expected);assert.ok(!JSON.stringify(answer).includes('PRIVATE'));
 }
 let callback;t.mock.method(globalThis,'setTimeout',fn=>{queueMicrotask(fn);return 0;});
 const sdk=loadSource('lib/payments/iyzico.ts',{'@/lib/iyzico':{default:{checkoutFormInitialize:{create:(_req,cb)=>{callback=cb;}}}},'./iyzico-config':{iyzicoConfig:()=>({isTest:true})},'@/lib/tr-iller':{}});
 const promise=sdk.callIyzicoObserved('checkoutFormInitialize','create',{});assert.equal((await promise).origin,'unknown');
 callback(null,{status:'success',token:'late-local-token'});assert.equal((await promise).origin,'unknown');
});
