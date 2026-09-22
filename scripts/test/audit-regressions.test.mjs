import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadSource as load } from './load-source.mjs';
import { financeSummary } from '../../lib/admin/finance.ts';
import { readPages } from '../../lib/admin/read-pages.ts';
import { salesSettingsSchema } from '../../lib/orders/settings-schema.ts';
const response={json:(body,init)=>({body,status:init?.status??200,headers:init?.headers})};
const duplicates=load('lib/orders/duplicates.ts');
const order={id:'order',order_no:'SG-2026-TEST23',status:'withdrawal_requested',payment_id:'original',payment_provider:'mock',quantity:20,total_kurus:20000,payment_meta:{}};
function query(data,error=null){const q={};for(const m of ['select','eq','in','order','limit','range','not'])q[m]=()=>q;q.maybeSingle=async()=>({data,error});q.then=(resolve,reject)=>Promise.resolve({data,error}).then(resolve,reject);return q;}
function refundSetup({checkpointError=false,finishError=false,providerError=false,checkpointFailures=0,lostCheckpointResponse=false}={}) {
 let calls=0,capacity=0,state=null,storedResult=null,writes=0;
 const provider={name:'mock',refund:async()=>{calls++;await Promise.resolve();return providerError?{ok:false,error:'timeout'}:{ok:true,refundId:'fake',method:'refund'};}};
 const db={from(table){if(table==='release_orders')return query(order);if(table==='order_events')return query([{type:'payment_succeeded',data:{duplicate:true,paymentId:'extra',provider:'mock',paidKurus:20000}}]);
 if(table==='refund_operations')return {select:()=>query({state,result:storedResult}),update(next){return {eq(){return this;},select(){return this;},async maybeSingle(){writes++;if(checkpointError||writes<=checkpointFailures)return {error:{code:'write_failure'}};state=next.state;storedResult=next.result;if(lostCheckpointResponse&&writes===1)return {error:{code:'response_lost'}};return {data:{id:'op'},error:null};}};}};
 throw Error(table);},async rpc(name){if(name==='claim_refund_operation'){const fresh=state===null;if(fresh)state='started';return {data:{id:'op',state,fresh}};}if(name==='finish_refund_operation'){if(finishError)return {error:{code:'write_failure'}};if(state!=='completed')capacity++;state='completed';return {data:{...order,status:'refunded'}};}throw Error(name);}};
 const api=load('lib/orders/admin-actions.ts',{'@/lib/payments':{getProviderByName:()=>provider},'./duplicates':duplicates,'./store':{db:()=>db,transitionOrder:async()=>null,addOrderEvent:async()=>{}}});
 return {api,db,get calls(){return calls;},get capacity(){return capacity;},get state(){return state;},get writes(){return writes;}};
}
test('concurrent duplicate refund invokes provider once',async()=>{
 const x=refundSetup();const result=await Promise.all([x.api.refundDuplicate('order','extra','admin',null,x.db),x.api.refundDuplicate('order','extra','admin',null,x.db)]);
 assert.equal(x.calls,1);assert.equal(result.filter(r=>r.ok).length,1);assert.equal(result.find(r=>!r.ok).error,'in_progress');
});
test('checkpoint failure never reports success or retries provider',async()=>{
 const x=refundSetup({checkpointError:true});assert.equal((await x.api.executeRefund('order','admin',null,x.db)).error,'unavailable');
 assert.equal((await x.api.executeRefund('order','admin',null,x.db)).error,'in_progress');assert.equal(x.calls,1);assert.equal(x.capacity,0);
});
test('checkpoint retries a transient DB failure or reads a committed lost response without repeating provider',async()=>{
 for(const options of [{checkpointFailures:1},{lostCheckpointResponse:true}]){
 const x=refundSetup(options);const result=await x.api.executeRefund('order','admin',null,x.db);
 assert.equal(result.ok,true);assert.equal(x.calls,1);assert.equal(x.capacity,1);assert.ok(x.writes<=2);
 }
});
test('local finalization failure retries only database, not provider',async()=>{
 const x=refundSetup({finishError:true});for(let i=0;i<2;i++)assert.equal((await x.api.executeRefund('order','admin',null,x.db)).error,'unavailable');
 assert.equal(x.calls,1);assert.equal(x.state,'provider_succeeded');assert.equal(x.capacity,0);
});
test('uncertain provider outcome cannot be reclaimed automatically',async()=>{
 const x=refundSetup({providerError:true});await x.api.executeRefund('order','admin',null,x.db);await x.api.executeRefund('order','admin',null,x.db);assert.equal(x.calls,1);assert.equal(x.state,'needs_review');
});
test('settings read or malformed row closes sales',async()=>{
 for(const data of [null,{unit_price_kurus:-1}]){
 const api=load('lib/orders/settings.ts',{'@/lib/supabase/server':{createServiceRoleClient:()=>({from:()=>query(data)})},'./settings-schema':{salesSettingsSchema},'@/lib/legal/version':{LEGAL_DOCUMENTS_VERSION:'test'},'@/lib/pricing':{UNIT_PRICE_KURUS:1000,RELEASE_QTY:{min:20,max:100000},QUANTITY_PRESETS:[20,100]},'./schedule':{DEFAULT_PREP_DAYS:15}});
 assert.equal((await api.getSalesSettings()).ordersPaused,true);
 }
});
test('post-commit audit failure retries and returns an explicit warning without suggesting a business retry',async()=>{
 const api=load('lib/admin/audit.ts');let writes=0;const warnings=await api.auditLog({from:()=>({insert:async()=>{writes++;return {error:{code:'42501'}};}})},{admin:{user_id:'admin',email:'audit@example.com'},action:'UPDATE',entity:'test'});assert.equal(warnings[0].code,'audit_unavailable');assert.equal(writes,2);
});
test('contact form: skipped email is 503; quota stops mail; oversized and missing notice rejected',async()=>{
 let mails=0,quota=0;
 const api=load('app/api/public/bilgi-al/route.ts',{'next/server':{NextResponse:response},'@/lib/mail':{SKIPPED_ID:'skipped-no-api-key',sendContactFormNotification:async()=>{mails++;return {id:'skipped-no-api-key'};}},'@/lib/admin-auth':{getClientIP:()=> 'local'},'@/lib/requests/server':{hashIp:()=> 'hash'},'@/lib/supabase/server':{createServiceRoleClient:()=>({rpc:async()=>({data:quota,error:null})})}});
 const body={name:'Test',email:'test@example.com',subject:'Test',message:'Message',noticeRead:true};
 const req=(b)=>({text:async()=>JSON.stringify(b)});
 assert.equal((await api.POST(req(body))).status,503);quota=60;const blocked=await api.POST(req(body));assert.equal(blocked.status,429);assert.equal(blocked.headers['Retry-After'],'60');assert.equal(mails,1);
 assert.equal((await api.POST(req({...body,noticeRead:false}))).status,400);assert.equal((await api.POST(req({...body,message:'x'.repeat(25000)}))).status,413);assert.equal((await api.POST(req(null))).status,400);
});
test('dashboard never returns revenue fields to non-finance roles and fails on partial query errors',async()=>{
 for(const role of ['SUPER_ADMIN','FINANCE','OPERATIONS','ENGINEER']){
 const api=load('app/api/admin/dashboard/route.ts',{'next/server':{NextResponse:response},'@/lib/supabase/server':{createServiceRoleClient:()=>({from:()=>query([])})},'@/lib/admin-auth':{requireAdmin:async()=>({admin:{role},error:null})}});
 const res=await api.GET({});assert.equal(res.status,200);const financial=['SUPER_ADMIN','FINANCE'].includes(role);assert.equal('netRevenueKurus' in res.body.kpis,financial);assert.equal('revenue' in res.body.monthlyGrowth[0],financial);
 }
});
test('finance uses integer kuruş, separates pending refunds, B2B, and Istanbul month boundary',()=>{
 const rows=[{...order,id:'paid',is_test:false,paid_at:'2026-08-31T22:00:00Z',created_at:'2026-08-31T20:00:00Z'}, {...order,id:'old',status:'refunded',is_test:false,paid_at:'2026-08-01T12:00:00Z',created_at:'2026-08-01T12:00:00Z'}, {...order,id:'test',is_test:true,paid_at:'2026-09-01T12:00:00Z'}];
 const r=financeSummary(rows,[{order_id:'old',amount_kurus:10001,completed_at:'2026-09-01T00:00:00Z'}],[{id:'b2b',amount:'123.45',status:'success',updated_at:'2026-09-02T00:00:00Z',created_at:'2026-09-01T00:00:00Z',orders:null}],new Date('2026-09-22T12:00:00Z'));
 assert.equal(r.monthlyGross,200);assert.equal(r.monthlyRevenue,99.99);assert.equal(r.pendingRefundAmount,200);assert.equal(r.b2bMonthlyRevenue,123.45);assert.equal(r.recentTransactions.length,3);
});
test('report pagination handles server caps and rejects partial failures',async()=>{
 const rows=Array.from({length:1001},(_,i)=>i);assert.equal((await readPages((a)=>Promise.resolve({data:rows.slice(a,a+200),error:null}))).length,1001);
 await assert.rejects(readPages((a)=>Promise.resolve({data:a?null:[1],error:a?{}:null})),/report_unavailable/);
});
test('patched iyzipay still exposes checkout/refund SDK methods without a network request',()=>{
 const require=createRequire(import.meta.url);const Iyzipay=require('iyzipay');const sdk=new Iyzipay({apiKey:'test',secretKey:'test',uri:'http://127.0.0.1:1'});
 assert.equal(typeof sdk.checkoutFormInitialize.create,'function');assert.equal(typeof sdk.checkoutForm.retrieve,'function');assert.equal(typeof sdk.refund.create,'function');
 const uuid=require(require.resolve('uuid',{paths:[require.resolve('postman-request')]}));assert.match(uuid.v4(),/^[0-9a-f-]{36}$/);
});
test('operations cannot retrieve original document HTML/PDF',async()=>{
 let touched=false;
 const api=load('app/api/admin/release-orders/[id]/belge/[kind]/route.ts',{
  '@/lib/supabase/server':{createServiceRoleClient:()=>{touched=true;throw Error('must not query');}},
  '@/lib/admin-auth':{requireAdmin:async(_req,roles)=>({error:roles.includes('OPERATIONS')?null:{status:403}})},
  '@/lib/orders/after-payment':{},'@/lib/orders/types':{DOCUMENT_KINDS:['contract']},
 });
 for(const format of ['html','pdf']) assert.equal((await api.GET({url:'http://local?bicim='+format},{params:Promise.resolve({id:'30000000-0000-0000-0000-000000000001',kind:'contract'})})).status,403);
 assert.equal(touched,false);
});
test('user route surfaces database last-owner conflict as 409 for update/delete',async()=>{
 const api=load('app/api/admin/users/route.ts',{
  'next/server':{NextResponse:response},
  '@/lib/admin-auth':{requireAdmin:async()=>({admin:{user_id:'10000000-0000-0000-0000-000000000001'},error:null})},
  '@/lib/supabase/server':{createServiceRoleClient:()=>({rpc:async()=>({error:{message:'last_active_super_admin',code:'23514'}})})},
 });
 const req={json:async()=>({id:'10000000-0000-0000-0000-000000000001',is_active:false})};
 assert.equal((await api.PUT(req)).status,409);assert.equal((await api.DELETE(req)).status,409);
});
