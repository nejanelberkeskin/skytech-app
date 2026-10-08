import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { loadSource } from './load-source.mjs';
import { createDb, one, IDS } from './pglite-db.mjs';
const fixture=(await readFile(new URL('./fixtures/b2b-payment-schema.sql',import.meta.url),'utf8')).replace('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;','');
const upgrade=(await readFile(new URL('../../supabase/migrations/004_corporate_quotes_upgrade.sql',import.meta.url),'utf8')).split('-- ── Email Log Table')[0];
const migrations=await Promise.all(['034_b2b_payment_result.sql','035_b2b_reconciliation.sql','037_b2b_resolution.sql'].map(f=>readFile(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8')));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const quote=id(3),user=id(1);
async function setup(t){
 t.mock.method(globalThis,'fetch',()=>{throw Error('external_forbidden');});
 const db=await createDb();t.after(()=>db.close());await db.exec(fixture);await db.exec(upgrade);
 for(const sql of migrations) await db.exec('BEGIN;\n'+sql+'\nCOMMIT;');
 await db.query("INSERT INTO corporate_quotes(id,user_id,status,approved_price,approved_seed_count,corporate_email) VALUES($1,$2,'QUOTED',200,20,'test@example.invalid')",[quote,user]);
 const claim=async()=> (await one(db,'SELECT claim_b2b_checkout($1,$2,200,20,true) v',[quote,user])).v;
 const first=await claim();assert.equal(first.status,'claimed');
 await db.query("UPDATE payments SET metadata=metadata||'{\"iyzico_token\":\"fixture-token\"}'::jsonb WHERE id=$1",[first.payment_id]);
 const payload={status:'success',payment_status:'FAILURE',payment_id:'provider-local',basket_id:first.order_id,conversation_id:first.payment_id,currency:'TRY',price_kurus:20000,paid_kurus:0,fraud_status:null};
 const begin=async(action='release',actor=IDS.superAdmin,confirmed=true,mfa=new Date().toISOString())=>(await one(db,'SELECT begin_b2b_resolution($1,$2,$3,$4,$5,$6,true) v',[first.payment_id,actor,mfa,action,'Provider support case LOCAL-123: session closed',confirmed])).v;
 const finish=async(op,result=payload,actor=IDS.superAdmin)=>(await one(db,'SELECT finish_b2b_resolution($1,$2,now(),true,$3) v',[op.operationId,actor,JSON.stringify(result)])).v;
 const record=async(result=payload,payment=first.payment_id)=>(await one(db,'SELECT record_b2b_payment_result($1,true,$2) v',[payment,JSON.stringify(result)])).v;
 const success={...payload,payment_status:'SUCCESS',paid_kurus:20000,fraud_status:1};
 return {db,first,claim,begin,finish,record,payload,success};
}
test('C1: verified terminal rejection + operator evidence closes only old attempt atomically and permits new claim',async t=>{
 const h=await setup(t),op=await h.begin();assert.equal(op.status,'started');
 assert.deepEqual(await h.finish(op),{status:'released'});
 assert.deepEqual(await h.finish(op),{status:'released'},'same operation does not duplicate audit');
 const next=await h.claim();assert.equal(next.status,'claimed');assert.notEqual(next.payment_id,h.first.payment_id);
 assert.equal((await one(h.db,'SELECT status FROM payments WHERE id=$1',[h.first.payment_id])).status,'failed');
 assert.equal((await one(h.db,'SELECT status FROM orders WHERE id=$1',[h.first.order_id])).status,'cancelled');
 assert.equal((await one(h.db,"SELECT count(*)::int n FROM admin_audit_logs WHERE entity='b2b_payment_resolution'")).n,1);
});
test('C1: missing/short evidence, unconfirmed closure, stale MFA and narrow permissions cannot open a resolution',async t=>{
 const h=await setup(t);
 await assert.rejects(h.begin('release',IDS.finance),/forbidden/);
 await assert.rejects(h.begin('release',IDS.superAdmin,false),/terminal_evidence_required/);
 await assert.rejects(h.begin('release',IDS.superAdmin,true,'2000-01-01T00:00:00Z'),/forbidden/);
 await assert.rejects(h.db.query("SELECT begin_b2b_resolution($1,$2,now(),'release','short',true,true)",[h.first.payment_id,IDS.superAdmin]),/invalid_evidence/);
 assert.equal((await one(h.db,'SELECT count(*)::int n FROM b2b_resolution_operations')).n,0);
});
test('C1: unknown result and not-found are never terminal evidence or timeout release',async t=>{
 const h=await setup(t);const op=await h.begin();
 assert.deepEqual(await h.finish(op,{status:'failure',errorCode:'not_found'}),{status:'review'});
 assert.deepEqual(await h.claim(),{status:'checkout_in_progress'});
 assert.equal((await one(h.db,'SELECT status FROM payments')).status,'pending');
});
test('C1: mismatched basket, conversation, amount or currency cannot release',async t=>{
 const h=await setup(t);
 for(const bad of [{basket_id:id(9)},{conversation_id:null},{price_kurus:19999},{currency:'USD'}]){
  const op=await h.begin();assert.equal(op.status,'started');assert.deepEqual(await h.finish(op,{...h.payload,...bad}),{status:'review'});
  assert.deepEqual(await h.claim(),{status:'checkout_in_progress'});
 }
});
test('C1: provider success during release request is applied as success, never cancelled',async t=>{
 const h=await setup(t),op=await h.begin();assert.deepEqual(await h.finish(op,h.success),{status:'paid'});
 assert.equal((await one(h.db,'SELECT status FROM corporate_quotes')).status,'PAID');
});
test('C1: callback changing state during external query invalidates operator snapshot',async t=>{
 const h=await setup(t),op=await h.begin();assert.deepEqual(await h.record(h.success),{status:'paid'});
 assert.deepEqual(await h.finish(op),{status:'stale'});
 assert.equal((await one(h.db,'SELECT status FROM payments')).status,'success');
});
test('C1: active operations serialize; expired operator cannot finish after replacement',async t=>{
 const h=await setup(t),old=await h.begin();assert.equal((await h.begin()).status,'busy');
 await h.db.query("UPDATE b2b_resolution_operations SET expires_at=now()-interval '1 second' WHERE id=$1",[old.operationId]);
 const next=await h.begin();assert.equal(next.status,'started');assert.deepEqual(await h.finish(old),{status:'stale'});
 assert.deepEqual(await h.finish(next),{status:'released'});
});
test('C1: late success on released attempt holds quote and cannot revive old order or apply new success',async t=>{
 const h=await setup(t);await h.finish(await h.begin());const next=await h.claim();
 assert.deepEqual(await h.record(h.success),{status:'review'});assert.deepEqual(await h.record(h.success),{status:'review'});
 assert.equal((await one(h.db,"SELECT count(*)::int n FROM b2b_payment_observations WHERE reason='late_success_after_release'")).n,1);
 assert.equal((await one(h.db,'SELECT status FROM orders WHERE id=$1',[h.first.order_id])).status,'cancelled');
 assert.deepEqual(await h.record({...h.success,payment_id:'new-provider',conversation_id:next.payment_id,basket_id:next.order_id},next.payment_id),{status:'review'});
 assert.equal((await one(h.db,'SELECT status FROM corporate_quotes')).status,'QUOTED');
 assert.deepEqual(await h.claim(),{status:'checkout_in_progress'});
});
test('C1: prior SUCCESS observation or unresolved hold prevents verified-release override',async t=>{
 const h=await setup(t);await h.record({...h.success,fraud_status:0});const op=await h.begin();
 assert.deepEqual(await h.finish(op),{status:'review'});assert.deepEqual(await h.claim(),{status:'checkout_in_progress'});
});
test('C1: mandatory audit failure rolls release and operation result back together',async t=>{
 const h=await setup(t),op=await h.begin();
 await h.db.exec("CREATE FUNCTION fail_b2b_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_failed'; END $$; CREATE TRIGGER fail_b2b_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION fail_b2b_audit();");
 await assert.rejects(h.finish(op),/audit_failed/);
 assert.equal((await one(h.db,'SELECT status FROM payments')).status,'pending');
 assert.equal((await one(h.db,'SELECT state FROM b2b_resolution_operations')).state,'pending');
 assert.deepEqual(await h.claim(),{status:'checkout_in_progress'});
});
test('C1: RPC grants deny customers and the original recorder cannot bypass holds',async t=>{
 const h=await setup(t);
 for(const role of ['anon','authenticated']) {
  assert.equal((await one(h.db,"SELECT has_function_privilege($1,'finish_b2b_resolution(uuid,uuid,timestamptz,boolean,jsonb)','EXECUTE') yes",[role])).yes,false);
  assert.equal((await one(h.db,"SELECT has_table_privilege($1,'b2b_resolution_operations','SELECT') yes",[role])).yes,false);
 }
 assert.equal((await one(h.db,"SELECT has_function_privilege('service_role','record_b2b_payment_result_core(uuid,boolean,jsonb)','EXECUTE') yes")).yes,false);
});

test('C1: dedicated permission starts with owner only; site-scoped grants cannot resolve globally',async t=>{
 const h=await setup(t);
 assert.equal((await one(h.db,"SELECT admin_has_permission($1,'finance.b2b_payment.resolve') yes",[IDS.finance])).yes,false);
 const role=(await one(h.db,"INSERT INTO admin_roles(key,label,permissions) VALUES('b2b_limited','B2B limited',ARRAY['finance.read','finance.b2b_payment.resolve']) RETURNING id")).id;
 const admin=(await one(h.db,'SELECT id FROM admin_users WHERE user_id=$1',[IDS.operations])).id;
 await h.db.query("INSERT INTO admin_role_assignments(admin_user_id,role_id,scope) VALUES($1,$2,$3)",[admin,role,JSON.stringify({kind:'sites',siteIds:[IDS.land]})]);
 await assert.rejects(h.begin('release',IDS.operations),/forbidden/);
 await assert.rejects(h.db.exec("UPDATE admin_roles SET label='override' WHERE key='owner'"),/system_role_readonly/);
});
test('C1: revocation while provider query runs blocks finish; later verified result can still arrive by callback',async t=>{
 const h=await setup(t);
 const role=(await one(h.db,"INSERT INTO admin_roles(key,label,permissions) VALUES('b2b_operator','B2B operator',ARRAY['finance.read','finance.b2b_payment.resolve']) RETURNING id")).id;
 const admin=(await one(h.db,'SELECT id FROM admin_users WHERE user_id=$1',[IDS.operations])).id;
 await h.db.query("INSERT INTO admin_role_assignments(admin_user_id,role_id,scope) VALUES($1,$2,'{\"kind\":\"all\"}'::jsonb)",[admin,role]);
 const op=await h.begin('release',IDS.operations);assert.equal(op.status,'started');
 await h.db.query('UPDATE admin_users SET is_active=false WHERE user_id=$1',[IDS.operations]);
 await assert.rejects(h.finish(op,h.payload,IDS.operations),/forbidden/);
 assert.equal((await one(h.db,'SELECT status FROM payments')).status,'pending');
 assert.equal((await h.record(h.success)).status,'paid');
});

test('C1: historical failure without explicit retry authorization remains locked even if its quote pointer is missing',async t=>{
 const h=await setup(t);
 await h.db.query("UPDATE payments SET status='failed' WHERE id=$1",[h.first.payment_id]);
 await h.db.query('UPDATE corporate_quotes SET order_id=NULL WHERE id=$1',[quote]);
 assert.deepEqual(await h.claim(),{status:'checkout_in_progress'});
});
test('C1: a positive paid amount or unresolved/approved fraud state cannot authorize a failure release',async t=>{
 const h=await setup(t);
 for(const bad of [{paid_kurus:100},{fraud_status:1},{fraud_status:0}]) {
  const op=await h.begin();assert.deepEqual(await h.finish(op,{...h.payload,...bad}),{status:'review'});
  assert.deepEqual(await h.claim(),{status:'checkout_in_progress'});
 }
});

for (const uppercase of [false, true]) {
 test(`C1 B1: checkout ${uppercase ? 'uppercase' : 'canonical'} quote ID preserves callback and manual success recording`, async t => {
  const h = await setup(t);
  await h.db.exec('BEGIN;\n'+await readFile(new URL('../../supabase/migrations/039_b2b_checkout_start.sql',import.meta.url),'utf8')+'\nCOMMIT;');
  const quoteId = '5a5a5a5a-0000-4000-8000-0000000000ab';
  await h.db.query("INSERT INTO corporate_quotes(id,user_id,status,approved_price,approved_seed_count,corporate_email) VALUES($1,$2,'QUOTED',200,20,'local@example.invalid')", [quoteId,user]);
  const server = createRequire(import.meta.url)('next/server');
  const rpc = [], provider = [];
  const service = {
   from(table) {
    assert.ok(['corporate_quotes','payments'].includes(table));
    let lookup, update;
    return {
     select() { return this; },
     update(value) { update = value; return this; },
     eq(column, value) {
      assert.equal(column,'id');lookup=value;
      if (update) return h.db.query('UPDATE payments SET metadata=$2::jsonb WHERE id=$1',[value,JSON.stringify(update.metadata)]).then(()=>({error:null}));
      return this;
     },
     async maybeSingle() { return {data:await one(h.db,'SELECT * FROM corporate_quotes WHERE id=$1',[lookup]),error:null}; },
    };
   },
   async rpc(name,args) {
    if(name==='begin_b2b_checkout_start')return {data:(await one(h.db,'SELECT begin_b2b_checkout_start($1,$2,$3,$4) v',[args.p_payment,args.p_user,args.p_is_test,args.p_locale])).v};
    if(name==='finish_b2b_checkout_start')return {data:(await one(h.db,'SELECT finish_b2b_checkout_start($1,$2,$3,$4,$5,$6) v',[args.p_payment,args.p_user,args.p_is_test,args.p_origin,args.p_token,args.p_form_ready])).v};
    assert.equal(name,'claim_b2b_checkout');rpc.push(args);
    return {data:(await one(h.db,'SELECT claim_b2b_checkout($1,$2,$3,$4,$5) v',[args.p_quote,args.p_user,args.p_amount,args.p_seeds,args.p_is_test])).v,error:null};
   },
  };
  const route = loadSource('app/api/payment/b2b-checkout/route.ts', {
   'next/server':server,
   '@/lib/supabase/server':{createServiceRoleClient:()=>service,createSupabaseServer:async()=>({auth:{getUser:async()=>({data:{user:{id:user,email:'local@example.invalid'}},error:null})}})},
   iyzipay:{default:{LOCALE:{TR:'tr'},CURRENCY:{TRY:'TRY'},PAYMENT_GROUP:{PRODUCT:'PRODUCT'},BASKET_ITEM_TYPE:{VIRTUAL:'VIRTUAL'}}},
   '@/lib/admin-auth':{rateLimit:()=>null,getClientIP:()=> '127.0.0.1'},
   '@/lib/payments/iyzico-config':{iyzicoConfig:()=>({isTest:true})},
   '@/lib/payments/iyzico':{priceToKurus:p=>Math.round(Number(p)*100),callIyzicoObserved:async(...args)=>{provider.push(args);return {origin:'provider_response',result:{status:'success',token:'local-test-token',checkoutFormContent:'<div>Mock only</div>'}};}},
   '@/lib/utils/format':{formatDateForIyzico:()=> '2026-10-02 12:00:00'},
  });
  const r = await route.POST(new server.NextRequest('https://local.invalid/api/payment/b2b-checkout',{method:'POST',body:JSON.stringify({quoteId:uppercase?quoteId.toUpperCase():quoteId})}));
  assert.equal(r.status,200);
  const body = await r.json();
  assert.equal(provider.length,1);
  const result = {...h.success,payment_id:'provider-B1',basket_id:body.orderId,conversation_id:body.paymentId};
  // Exercise the real result recorder, not a handcrafted metadata approximation.
  assert.deepEqual(await h.record(result,body.paymentId),{status:'paid'});
  const op = (await one(h.db,"SELECT begin_b2b_resolution($1,$2,now(),'refresh','Local provider case B1',false,true) v",[body.paymentId,IDS.superAdmin])).v;
  assert.deepEqual(await h.finish(op,result),{status:'already_paid'});
  assert.equal((await one(h.db,'SELECT status FROM corporate_quotes WHERE id=$1',[quoteId])).status,'PAID');
  assert.equal((await one(h.db,'SELECT metadata FROM payments WHERE id=$1',[body.paymentId])).metadata.quote_id,quoteId);
  assert.equal(rpc[0].p_quote,quoteId);
 });
}
