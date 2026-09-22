import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadSource as load } from './load-source.mjs';
import * as settingsSchema from '../../lib/orders/settings-schema.ts';
const response={json:(body,init)=>({body,status:init?.status??200,headers:init?.headers})};
const admin={user_id:'10000000-0000-0000-0000-000000000001',role:'SUPER_ADMIN',email:'test@example.invalid'};
const auth={requireAdmin:async()=>({admin,error:null}),getClientIP:()=> 'local'};
function query(data){const q={};for(const m of ['select','eq','in','order','limit'])q[m]=()=>q;q.maybeSingle=q.single=async()=>({data,error:null});q.then=(resolve,reject)=>Promise.resolve({data,error:null,count:0}).then(resolve,reject);return q;}
const row={unit_price_kurus:1000,min_quantity:20,max_quantity:1000,quantity_presets:[20,100],vat_rate:20,invoice_timing:'on_performance',prep_days:15,payment_ttl_minutes:45,orders_paused:false,updated_at:'2026-09-22T12:00:00Z',updated_by:null};
function settingsModule(db){return load('lib/orders/settings.ts',{'@/lib/supabase/server':{createServiceRoleClient:()=>db},'./settings-schema':settingsSchema,'@/lib/legal/version':{LEGAL_DOCUMENTS_VERSION:'test'},'@/lib/pricing':{UNIT_PRICE_KURUS:1000,RELEASE_QTY:{min:20,max:1000},QUANTITY_PRESETS:[20,100]},'./schedule':{DEFAULT_PREP_DAYS:15}});}
test('malformed settings remain visible only through admin repair read; binding reads reject',async()=>{
 for(const change of [{unit_price_kurus:99},{invoice_timing:'unexpected'},{orders_paused:null},{quantity_presets:null}]){
 const db={from:()=>query({...row,...change})};const api=settingsModule(db);
 const rec=await api.loadAdminSalesSettings(db);assert.equal(rec.settings,null);assert.ok(Object.keys(rec.fieldErrors).length);assert.equal(rec.updatedAt,row.updated_at);
 await assert.rejects(api.loadSalesSettings(db),/geçersiz/);assert.equal((await api.getSalesSettings()).ordersPaused,true);
 }
});
test('repair route enforces paused sales and version; valid repair survives post-commit audit warning',async()=>{
 let data={...row,unit_price_kurus:99}, writes=0;
 const db={from(table){if(table!=='sales_settings')return query([]);return {...query(data),update(next){writes++;data={...data,...next,updated_at:'2026-09-22T12:01:00Z'};return query([data]);}};}};
 const settings=settingsModule(db);
 const api=load('app/api/admin/sales-settings/route.ts',{'next/server':{NextResponse:response},'next/cache':{revalidateTag:()=>{}},zod:{z},'@/lib/supabase/server':{createServiceRoleClient:()=>db},'@/lib/admin-auth':auth,'@/lib/admin/audit':{auditLog:async()=>[{code:'audit_unavailable'}]},'@/lib/orders/settings':settings,'@/lib/orders/settings-schema':settingsSchema,'@/lib/orders/readiness':{salesReadiness:s=>({accepting:!s.ordersPaused})}});
 const res=await api.GET({});assert.equal(res.status,200);assert.equal(res.body.repairRequired,true);assert.equal(res.body.quoteVersion,null);assert.equal(res.body.readiness.accepting,false);
 const valid={...settings.DEFAULT_SALES_SETTINGS,ordersPaused:false};
 const request=(s,version=row.updated_at)=>({json:async()=>({settings:s,expectedUpdatedAt:version})});
 assert.equal((await api.PUT(request(valid))).body.error,'repair_requires_pause');assert.equal(writes,0);
 assert.equal((await api.PUT(request({...valid,ordersPaused:true},'2026-09-21T12:00:00Z'))).status,409);assert.equal(writes,0);
 const saved=await api.PUT(request({...valid,ordersPaused:true}));assert.equal(saved.status,200);assert.equal(saved.body.ok,true);assert.equal(saved.body.warnings[0].code,'audit_unavailable');assert.equal(writes,1);assert.equal(saved.body.settings.ordersPaused,true);
 assert.equal((await settings.loadSalesSettings(db)).settings.ordersPaused,true);
});
test('catalog creation with real audit helper returns committed record and warning, not retryable failure',async()=>{
 let creates=0,audits=0;const audit=load('lib/admin/audit.ts');
 const db={from(table){return {insert(){if(table==='admin_audit_logs'){audits++;return Promise.resolve({error:{code:'42501'}});}creates++;return query({id:'catalog-id',slug:'test'});}};}};
 const api=load('app/api/admin/catalog/route.ts',{'next/server':{NextResponse:response},'@/lib/supabase/server':{createServiceRoleClient:()=>db},'@/lib/admin-auth':auth,'@/lib/admin/audit':audit});
 const result=await api.POST({json:async()=>({slug:'test',name:'Test',price:1})});
 assert.equal(result.status,201);assert.equal(result.body.id,'catalog-id');assert.equal(result.body.warnings[0].code,'audit_unavailable');assert.equal(creates,1);assert.equal(audits,2);
});
test('existing Auth account is matched by error code, paginated, and its password is never updated',async()=>{
 for(const code of ['email_exists','user_already_exists']){
 let pages=[],rpcCalls=0;
 const db={from:()=>query(null),auth:{admin:{createUser:async()=>({error:{code,message:'Unrelated translated message'}}),listUsers:async({page})=>{pages.push(page);return {data:{users:page===1?Array.from({length:1000},()=>({id:'other',email:'other@example.invalid'})):[{id:'existing-id',email:'known@example.invalid'}]},error:null};}}},rpc:async(name,args)=>{assert.equal(name,'create_admin_user');assert.equal(args.p_user,'existing-id');rpcCalls++;return {data:{id:'staff-id'},error:null};}};
 const api=load('app/api/admin/users/route.ts',{'next/server':{NextResponse:response},'@/lib/supabase/server':{createServiceRoleClient:()=>db},'@/lib/admin-auth':auth});
 const result=await api.POST({json:async()=>({email:'known@example.invalid',full_name:'Known',role:'ENGINEER'})});assert.equal(result.status,201);assert.equal(result.body.temp_password,undefined);assert.deepEqual(pages,[1,2]);assert.equal(rpcCalls,1);
 }
});
test('browser admin client surfaces warning while preserving the original response body',async(t)=>{
 const prior=globalThis.window;let shown=0;globalThis.window={dispatchEvent(event){assert.equal(event.type,'admin:audit-warning');shown++;}};
 t.after(()=>{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;});
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({id:'saved',warnings:[{code:'audit_unavailable'}]}),{status:201}));
 const {adminFetch}=load('lib/admin/client.ts');const res=await adminFetch('/api/admin/catalog',{method:'POST'});assert.equal(res.status,201);assert.equal((await res.json()).id,'saved');assert.equal(shown,1);
 await adminFetch('/api/admin/catalog');assert.equal(shown,1);
});
