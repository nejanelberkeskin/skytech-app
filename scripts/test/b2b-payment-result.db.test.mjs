import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { loadSource as load } from './load-source.mjs';
import { createRequire } from 'node:module';
const server = createRequire(import.meta.url)('next/server');
const fixture = await readFile(new URL('./fixtures/b2b-payment-schema.sql',import.meta.url),'utf8');
const upgrade = (await readFile(new URL('../../supabase/migrations/004_corporate_quotes_upgrade.sql',import.meta.url),'utf8')).split('-- ── Email Log Table')[0];
const migration = await readFile(new URL('../../supabase/migrations/034_b2b_payment_result.sql',import.meta.url),'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [user,order,quote,payment] = [1,2,3,4].map(id);
const result = { status:'success',payment_status:'SUCCESS',payment_id:'provider-local',basket_id:order,conversation_id:payment,currency:'TRY',price_kurus:20000,paid_kurus:20000,fraud_status:1 };
const one = async (db,sql,params=[]) => (await db.query(sql,params)).rows[0];
async function setup(t) {
 t.mock.method(globalThis,'fetch',()=>{ throw new Error('external calls forbidden'); });
 const db=new PGlite(); t.after(()=>db.close()); await db.exec(fixture);await db.exec(upgrade);await db.exec('BEGIN;\n'+migration+'\nCOMMIT;');
 await db.query("INSERT INTO orders(id,user_id,buyer_email,total_seeds,total_price) VALUES($1,$2,'test@example.invalid',20,200)",[order,user]);
 await db.query("INSERT INTO corporate_quotes(id,user_id,status,approved_price,approved_seed_count,order_id) VALUES($1,$2,'QUOTED',200,20,$3)",[quote,user,order]);
 await db.query("INSERT INTO payments(id,order_id,user_id,amount,metadata) VALUES($1,$2,$3,200,$4)",[payment,order,user,JSON.stringify({checkout_type:'b2b',quote_id:quote,is_test:true,iyzico_token:'local-token'})]);
 const call = (r=result,mode=true,p=payment) => one(db,'SELECT record_b2b_payment_result($1,$2,$3) AS value',[p,mode,JSON.stringify(r)]).then(r=>r.value);
 const state=()=>one(db,`SELECT p.status payment,o.status::text AS order,q.status quote,(SELECT count(*)::int FROM b2b_payment_observations) observations FROM payments p JOIN orders o ON o.id=p.order_id JOIN corporate_quotes q ON q.id=$1 WHERE p.id=$2`,[quote,payment]);
 return {db,call,state};
}
test('B2B atomic callback: valid success, repeated success and stale failure do not repeat or downgrade writes', async t=>{
 const h=await setup(t);assert.deepEqual(await h.call(),{status:'paid'});
 assert.deepEqual(await h.state(),{payment:'success',order:'confirmed',quote:'PAID',observations:1});
 assert.deepEqual(await h.call(),{status:'already_paid'});
 assert.deepEqual(await h.call({status:'failure'}),{status:'already_paid'});
 assert.equal((await h.state()).observations,1);
});
test('B2B validation: missing/wrong amount, currency, identities and fraud remain pending with durable review evidence', async t=>{
 const h=await setup(t);
 const invalid=[{price_kurus:19999},{price_kurus:null},{paid_kurus:20001},{paid_kurus:0},{paid_kurus:'20000'},{paid_kurus:9007199254740992},
 {currency:'USD'},{basket_id:id(9)},{conversation_id:id(8)},{payment_id:''},{fraud_status:0},{fraud_status:-1},{fraud_status:null},
 {payment_status:'FAILURE'},{status:'failure'},{status:null}];
 for(const patch of invalid){assert.deepEqual(await h.call({...result,...patch}),{status:'review'},JSON.stringify(patch));}
 const s=await h.state();assert.equal(s.payment,'pending');assert.equal(s.order,'pending');assert.equal(s.quote,'QUOTED');assert.equal(s.observations,invalid.length);
 assert.deepEqual(await h.call(),{status:'paid'},'later verified result completes held payment');
 assert.equal((await one(h.db,'SELECT metadata FROM payments')).metadata.payment_review_required,false);
});
test('B2B state mismatch and cancellation never revive orders or overwrite another payment',async t=>{
 const h=await setup(t);await h.db.exec("UPDATE orders SET status='cancelled'");
 assert.equal((await h.call()).status,'review');assert.equal((await h.state()).order,'cancelled');
 await h.db.exec("UPDATE payments SET status='cancelled'");assert.equal((await h.call()).status,'closed');
 assert.equal((await h.state()).observations,1);
});
test('B2B mode mismatch and old records without mode fail closed without any write',async t=>{
 const h=await setup(t);assert.equal((await h.call(result,false)).status,'rejected');
 await h.db.exec("UPDATE payments SET metadata=metadata-'is_test'");assert.equal((await h.call()).status,'rejected');assert.equal((await h.state()).observations,0);
});
test('B2B atomicity: failure in quote update rolls payment, order and observation back',async t=>{
 const h=await setup(t);await h.db.exec("CREATE FUNCTION fail_quote() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced_quote_error'; END $$; CREATE TRIGGER force_failure BEFORE UPDATE ON corporate_quotes FOR EACH ROW EXECUTE FUNCTION fail_quote();");
 await assert.rejects(h.call(),/forced_quote_error/);assert.deepEqual(await h.state(),{payment:'pending',order:'pending',quote:'QUOTED',observations:0});
});
test('B2B service role is sole public caller; observation rows unavailable to customer roles',async t=>{
 const h=await setup(t);
 for(const role of ['anon','authenticated']){
  assert.equal((await one(h.db,"SELECT has_function_privilege($1,'record_b2b_payment_result(uuid,boolean,jsonb)','EXECUTE') permitted",[role])).permitted,false);
  assert.equal((await one(h.db,"SELECT has_table_privilege($1,'b2b_payment_observations','SELECT') permitted",[role])).permitted,false);
 }
 await h.db.exec('SET ROLE service_role');assert.equal((await h.call()).status,'paid');await h.db.exec('RESET ROLE');
});
test('B2B HTTP callback uses the real SQL result; database error never redirects as success',async t=>{
 const h=await setup(t);let calls=0,fail=false;
 const db={from(){return{select(){return this;},eq(){return this;},single:async()=>({data:await one(h.db,'SELECT * FROM payments WHERE id=$1',[payment])})};},rpc:async(_n,args)=>fail?{error:{message:'PRIVATE'}}:{data:await h.call(args.p_result,args.p_is_test,args.p_payment)}};
 const route=load('app/api/payment/callback/route.ts',{'next/server':server,'@/lib/supabase/server':{createServiceRoleClient:()=>db},'@/lib/payments/iyzico-config':{iyzicoConfig:()=>({isTest:true})},'@/lib/b2b/payment-result':{b2bPaymentResult:r=>r},'@/lib/payments/iyzico':{callIyzico:async()=>{calls++;return result;}}});
 const post=()=>route.POST(new server.NextRequest('https://test.invalid/api/payment/callback',{method:'POST',body:new URLSearchParams({token:'local-token'})}));
 fail=true;t.mock.method(console,'error',()=>{});let r=await post();assert.equal(new URL(r.headers.get('location')).pathname,'/odeme/hata');assert.equal((await h.state()).payment,'pending');
 fail=false;r=await post();assert.equal(new URL(r.headers.get('location')).searchParams.get('status'),'success');assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.status,303);
 await post();assert.equal(calls,2,'terminal repeat avoids provider');assert.equal((await h.state()).observations,1);
});
test('B2B observed charge remains in history when subsequent response is ambiguous',async t=>{
 const h=await setup(t);await h.call({...result,fraud_status:0});await h.call({status:'failure'});
 const evidence=await one(h.db,"SELECT result FROM b2b_payment_observations WHERE provider_payment_id='provider-local'");assert.equal(evidence.result.paid_kurus,20000);assert.equal(evidence.result.fraud_status,0);
});
async function newQuote(h) {
 const q=id(23);await h.db.query("INSERT INTO corporate_quotes(id,user_id,status,approved_price,approved_seed_count,corporate_email) VALUES($1,$2,'QUOTED',300,30,'new@example.invalid')",[q,user]);
 const claim=(amount=300,seeds=30,u=user)=>one(h.db,'SELECT claim_b2b_checkout($1,$2,$3,$4,true) value',[q,u,amount,seeds]).then(r=>r.value);
 return {q,claim};
}
test('B2B checkout claim is atomic and a second attempt cannot create another order or payment',async t=>{
 const h=await setup(t),q=await newQuote(h);const first=await q.claim();assert.equal(first.status,'claimed');
 assert.equal((await q.claim()).status,'checkout_in_progress');
 assert.equal((await one(h.db,'SELECT count(*)::int n FROM payments')).n,2);
 assert.equal((await one(h.db,'SELECT count(*)::int n FROM orders')).n,2);
 assert.equal((await one(h.db,'SELECT order_id FROM corporate_quotes WHERE id=$1',[q.q])).order_id,first.order_id);
 const recorded=await one(h.db,'SELECT metadata FROM payments WHERE id=$1',[first.payment_id]);assert.equal(recorded.metadata.is_test,true);
});
test('B2B checkout claim rejects price/owner changes before writes and rolls back failed linkage',async t=>{
 const h=await setup(t),q=await newQuote(h);
 assert.equal((await q.claim(301)).status,'quote_changed');assert.equal((await q.claim(300,31)).status,'quote_changed');assert.equal((await q.claim(300,30,id(9))).status,'rejected');
 await h.db.exec("CREATE FUNCTION fail_quote() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced_claim_error'; END $$; CREATE TRIGGER force_failure BEFORE UPDATE ON corporate_quotes FOR EACH ROW EXECUTE FUNCTION fail_quote();");
 await assert.rejects(q.claim(),/forced_claim_error/);assert.equal((await one(h.db,'SELECT count(*)::int n FROM payments')).n,1);assert.equal((await one(h.db,'SELECT count(*)::int n FROM orders')).n,1);
});
test('B2B terminal cancelled/refunded record stays closed after a formerly valid success',async t=>{
 const h=await setup(t);await h.call();await h.db.exec("UPDATE payments SET status='cancelled'; UPDATE orders SET status='cancelled'");
 assert.equal((await h.call()).status,'closed');assert.equal((await h.state()).order,'cancelled');assert.equal((await h.state()).observations,1);
});
test('B2B provider payment reference already attached to another local payment is review, not lost or applied',async t=>{
 const h=await setup(t);await h.db.query("INSERT INTO payments(id,order_id,amount,status,iyzico_payment_id) VALUES($1,$2,200,'success','provider-local')",[id(10),order]);
 assert.equal((await h.call()).status,'review');assert.equal((await h.state()).payment,'pending');
 assert.equal((await one(h.db,'SELECT reason FROM b2b_payment_observations')).reason,'duplicate_provider_payment');
});

async function reconciliation(h) {
 const sql=await readFile(new URL('../../supabase/migrations/035_b2b_reconciliation.sql',import.meta.url),'utf8');await h.db.exec('BEGIN;\n'+sql+'\nCOMMIT;');
 const rpc=async(name,a)=>{
  try {
   if(name==='b2b_reconciliation_summary')return {data:(await one(h.db,'SELECT b2b_reconciliation_summary() value')).value};
   if(name==='claim_b2b_reconciliation')return {data:(await h.db.query('SELECT * FROM claim_b2b_reconciliation($1)',[a.p_is_test])).rows};
   if(name==='record_b2b_payment_result')return {data:await h.call(a.p_result,a.p_is_test,a.p_payment)};
   if(name==='finish_b2b_reconciliation')return {data:(await one(h.db,'SELECT finish_b2b_reconciliation($1,$2,$3) value',[a.p_payment,a.p_attempt,a.p_outcome])).value};
   throw new Error('unexpected RPC');
  }catch(e){return {error:{message:e.message}};}
 };
 return {rpc};
}
test('B2B reconciliation: missing browser callback is recovered by provider lookup and the same atomic recorder',async t=>{
 const h=await setup(t),db=await reconciliation(h);const calls=[];
 const worker=load('lib/b2b/reconcile.ts',{'@/lib/payments/iyzico-config':{iyzicoConfig:()=>({isTest:true})},'@/lib/payments/iyzico':{callIyzico:async(...a)=>{calls.push(a);return result;}},'./payment-result':{b2bPaymentResult:r=>r}});
 assert.deepEqual(await worker.reconcileB2bPayments(db),{checked:1,paid:1,review:0,unavailable:0,needsReview:0,unlinked:0});
 assert.equal((await h.state()).payment,'success');assert.equal(calls[0][1],'retrieve');
 assert.deepEqual(await worker.reconcileB2bPayments(db),{checked:0,paid:0,review:0,unavailable:0,needsReview:0,unlinked:0});assert.equal(calls.length,1);
 assert.equal((await one(h.db,'SELECT state FROM b2b_reconciliation_queue')).state,'done');
});
test('B2B reconciliation: lease, eight-attempt cap, wrong environment and stale finish are safe',async t=>{
 const h=await setup(t),db=await reconciliation(h);
 assert.equal((await db.rpc('claim_b2b_reconciliation',{p_is_test:false})).data.length,0);
 assert.equal((await db.rpc('claim_b2b_reconciliation',{p_is_test:true})).data[0].attempt,1);
 assert.equal((await db.rpc('claim_b2b_reconciliation',{p_is_test:true})).data.length,0);
 for(let attempt=2;attempt<=8;attempt++){
  await h.db.exec("UPDATE b2b_reconciliation_queue SET next_check_at=now()-interval '1 second'");
  assert.equal((await db.rpc('claim_b2b_reconciliation',{p_is_test:true})).data[0].attempt,attempt);
 }
 assert.equal((await db.rpc('finish_b2b_reconciliation',{p_payment:payment,p_attempt:1,p_outcome:'paid'})).data,false);
 assert.equal((await one(h.db,'SELECT state FROM b2b_reconciliation_queue')).state,'needs_review');
 await h.db.exec("UPDATE b2b_reconciliation_queue SET next_check_at=now()-interval '1 second'");assert.equal((await db.rpc('claim_b2b_reconciliation',{p_is_test:true})).data.length,0);
 assert.equal((await h.state()).payment,'pending');
});
test('B2B reconciliation: provider timeout remains pending, records bounded retry and does not leak token',async t=>{
 const h=await setup(t),db=await reconciliation(h);
 const worker=load('lib/b2b/reconcile.ts',{'@/lib/payments/iyzico-config':{iyzicoConfig:()=>({isTest:true})},'@/lib/payments/iyzico':{callIyzico:async()=>({errorCode:'timeout',errorMessage:'PRIVATE-TOKEN'})},'./payment-result':{b2bPaymentResult:r=>r}});
 await assert.rejects(worker.reconcileB2bPayments(db),/^Error: b2b_reconciliation_incomplete$/);
 assert.equal((await h.state()).payment,'pending');const q=await one(h.db,'SELECT last_outcome,attempts FROM b2b_reconciliation_queue');assert.deepEqual(q,{last_outcome:'provider_unavailable',attempts:1});
});
