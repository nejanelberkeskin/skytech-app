import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadSource as load } from './load-source.mjs';
import { financeSummary } from '../../lib/admin/finance.ts';
import { readPages } from '../../lib/admin/read-pages.ts';
import { salesSettingsSchema } from '../../lib/orders/settings-schema.ts';
const response={json:(body,init)=>({body,status:init?.status??200,headers:init?.headers})};
const order={id:'order',order_no:'SG-2026-TEST23',status:'withdrawal_requested',payment_id:'original',payment_provider:'mock',quantity:20,total_kurus:20000,payment_meta:{}};
function query(data,error=null){const q={};for(const m of ['select','eq','in','order','limit','range','not'])q[m]=()=>q;q.maybeSingle=async()=>({data,error});q.then=(resolve,reject)=>Promise.resolve({data,error}).then(resolve,reject);return q;}
// İade testleri (eşzamanlı istek, kontrol noktası hatası, yanıtı kaybolan kayıt, yerel tamamlama, belirsiz sonuç)
// iade uygulaması lib/refunds/service.ts'e taşındığı için scripts/test/refund-legacy-adapter.test.mjs'e taşındı;
// aynı güvenceler orada gerçek 019/020 SQL'i ile sınanıyor.
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
 // Claude (iade-mutabakati): Genel Bakış tek finans hesabına (SQL 020) taşındı; taklitler iki uygulamayla da çalışır.
 const overview={definitionsVersion:1,currentMonth:{key:'2026-09'},allTime:{heldOrderValueKurus:0,heldOrderCount:0,releasedQuantity:0},liabilities:{orderRefundLiabilityCount:0,duplicateLiabilityCount:0,overdueRefundCount:0},operations:{awaitingBatchCount:0},months:[{key:'2026-09',netCashKurus:0,paidQuantity:0}]};
 const permissions=load('lib/admin/permissions.ts',{'@/lib/admin-auth':{},'@/lib/api/envelope':{}});
 for(const role of ['SUPER_ADMIN','FINANCE','OPERATIONS','ENGINEER']){
 const api=load('app/api/admin/dashboard/route.ts',{'next/server':{NextResponse:response},'@/lib/supabase/server':{createServiceRoleClient:()=>({from:()=>query([])})},'@/lib/admin-auth':{requireAdmin:async()=>({admin:{role,is_active:true},error:null})},'@/lib/admin/permissions':permissions,'@/lib/finance/overview':{FINANCE_DEFINITIONS_VERSION:1,monthLabel:(k)=>k,loadFinanceOverview:async()=>overview}});
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
