import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
const admin={user_id:'verified-admin',email:'admin@example.invalid',role:'FINANCE'};
const quote={id:'quote-fixture',status:'PENDING',corporate_email:'buyer@example.invalid',company_name:'Fixture',contact_person:'Buyer'};
const payload={quoteId:quote.id,action:'approve',approvedPrice:1200,approvedSeedCount:100,adminNote:'Fixture note',adminUserId:'forged-admin'};
function fixture({auth={admin,error:null},mail={id:'accepted-fixture'},updateError=null,status='PENDING',warnings=[]}={}){
 const calls={clients:0,updates:[],mail:[],audit:[],roles:[]};
 // Koşullu durum geçişi (33 §2): update → eq(id) → in(status, bekleyen) → select → maybeSingle.
 const db={from(table){assert.equal(table,'corporate_quotes');return{
   select(){return{eq(){return{single:async()=>({data:{...quote,status},error:null})};}};},
   update(patch){calls.updates.push(patch);return{eq(key,value){assert.equal(key,'id');assert.equal(value,quote.id);return{in(k,v){assert.equal(k,'status');assert.deepEqual(v,['PENDING','pending']);
     return{select(){return{maybeSingle:async()=>({data:updateError?null:{id:quote.id},error:updateError})};}};}};}};},
 };}};
 const route=load('app/api/admin/b2b/route.ts',{
   'next/server':{NextResponse:Response},
   '@/lib/supabase/server':{createServiceRoleClient:()=>{calls.clients++;return db;}},
   '@/lib/admin-auth':{requireAdmin:async(_request,roles)=>{calls.roles.push(roles);return auth;},getClientIP:()=> 'fixture-ip'},
   '@/lib/admin/audit':{auditLog:async(_db,entry)=>{calls.audit.push(entry);return warnings;}},
   '@/lib/mail':{SKIPPED_ID:'skipped-no-api-key',sendB2BQuoteReadyEmail:async input=>{calls.mail.push(input);if(mail instanceof Error)throw mail;return mail;}},
 });
 const put=body=>route.PUT(new Request('http://test.invalid/api/admin/b2b',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
 return{put,calls};
}

test('B2B: approve and reject attribute writes only to verified server identity',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw new Error('live_network_forbidden');});
 for(const action of ['approve','reject']){
  const f=fixture();const response=await f.put({...payload,action});const result=await response.json();
  assert.equal(response.status,200);assert.equal(result.success,true);
  assert.deepEqual(f.calls.roles,[['SUPER_ADMIN','FINANCE']]);
  assert.equal(f.calls.updates.length,1);assert.equal(f.calls.updates[0].quoted_by,admin.user_id);
  assert.equal(f.calls.audit[0].admin,admin);assert.equal(f.calls.audit[0].entityId,quote.id);
  assert.equal(JSON.stringify(f.calls).includes('forged-admin'),false);
  assert.equal(f.calls.mail.length,action==='approve'?1:0);
  if(action==='approve'){
   assert.equal(f.calls.updates[0].approved_price,1200);assert.equal(f.calls.updates[0].approved_seed_count,100);
   assert.equal(f.calls.mail[0].pricePerSeed,12);assert.equal(result.notification.status,'accepted');
   assert.doesNotMatch(result.message,/müşteriye bildirildi/i);
  }
 }
});

test('B2B: denied or absent server identity stops before DB, body or mail access',async()=>{
 for(const auth of [{admin:null,error:Response.json({error:'denied'},{status:403})},{admin:null,error:null},{admin:{...admin,user_id:''},error:null}]){
  const f=fixture({auth});const response=await f.put(payload);
  assert.equal(response.status,auth.error?403:401);assert.equal(f.calls.clients,0);
  assert.deepEqual(f.calls.updates,[]);assert.deepEqual(f.calls.mail,[]);assert.deepEqual(f.calls.audit,[]);
 }
});

test('B2B: skipped, missing, empty or thrown mail result does not undo approval or claim notification success',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw new Error('live_network_forbidden');});
 for(const [mail,expected] of [[{id:'skipped-no-api-key'},'not_configured'],[{},'unconfirmed'],[{id:''},'unconfirmed'],[{id:'   '},'unconfirmed'],[undefined,'unconfirmed'],[new Error('private provider detail'),'unconfirmed']]){
  // Explicit null covers a malformed transport response without default fixture substitution.
  const f=fixture({mail:mail===undefined?null:mail});const response=await f.put(payload);const result=await response.json();
  assert.equal(response.status,200);assert.equal(result.success,true);assert.equal(result.status,'QUOTED');
  assert.equal(result.notification.status,expected);assert.equal(f.calls.updates.length,1);
  assert.equal(f.calls.updates[0].status,'QUOTED');assert.equal(f.calls.audit.length,1);
  assert.match(result.message,/Teklif onaylandı/);assert.match(result.message,/yeniden onaylamayın/);
  assert.doesNotMatch(result.message,/müşteriye bildirildi|gönderim için kabul edildi|private provider detail/);
 }
});

test('B2B: business-write failure and invalid existing status never send; audit warnings survive transport results',async()=>{
 for(const options of [{updateError:{message:'fixture_update_failed'}},{status:'QUOTED'}]){
  const f=fixture(options);const result=await f.put(payload);assert.equal(result.status,options.updateError?500:400);
  assert.equal(f.calls.mail.length,0);assert.equal(f.calls.audit.length,0);
 }
 const warnings=[{code:'audit_unavailable',message:'Fixture audit warning',entity:'quote'}];
 const f=fixture({warnings,mail:{id:'skipped-no-api-key'}});const result=await(await f.put(payload)).json();
 assert.deepEqual(result.warnings,warnings);assert.equal(result.notification.status,'not_configured');
});
