import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSource} from './load-source.mjs';
import {hasPermission,hasFullScope} from '../../lib/admin/permission-keys.ts';
const server=createRequire(import.meta.url)('next/server');
const {DOCUMENT_PERMISSIONS}=loadSource('lib/orders/admin-access.ts',{'@/lib/admin/permissions':{hasFullScope}});
const access=()=>({permissions:DOCUMENT_PERMISSIONS.map(key=>({key,scopes:[{kind:'all'}]}))});
function harness({caller='owner',owner='owner',userError=false,guardError=null,permissions=access(),adminId=caller,failedTable=null,throwAuth=false,reassigned=false}={}){
 const queries=[];let guards=0,verified=0;
 const rows={orders:{id:'order',user_id:owner,buyer_email:'buyer@example.invalid',shipping_address:{address:'PRIVATE-ADDRESS'},total_price:200},order_allocations:[],profiles:{full_name:'Synthetic buyer'},corporate_quotes:{tax_no:'PRIVATE-TAX'}};
 const db={from(table){const q={table,columns:null,filters:[]};queries.push(q);const answer=()=>({data:reassigned&&q.columns!=='id, user_id'&&table==='orders'?null:rows[table],error:failedTable===table?{message:'PRIVATE-DATABASE-ERROR'}:null});return {select(c){q.columns=c;return this;},eq(c,v){q.filters.push(['eq',c,v]);return this;},is(c,v){q.filters.push(['is',c,v]);return this;},maybeSingle:async()=>answer(),then(ok,bad){return Promise.resolve(answer()).then(ok,bad);}};}};
 const auth={auth:{getSession:()=>{throw Error('unverified_session_forbidden');},getUser:async()=>{verified++;if(throwAuth)throw Error('PRIVATE-AUTH-ERROR');return {data:{user:caller?{id:caller}:null},error:userError?{message:'PRIVATE-AUTH-ERROR'}:null};}}};
 const route=loadSource('app/api/orders/invoice/[orderId]/route.ts',{
  'next/server':server,
  '@/lib/supabase/server':{createSupabaseServer:async()=>auth,createServiceRoleClient:()=>db},
  '@/lib/admin/permissions':{hasPermission,hasFullScope,requirePermission:async(_r,key)=>{guards++;assert.equal(key,'orders.documents.read');return guardError?{error:server.NextResponse.json({error:{code:guardError}},{status:403})}:{error:null,admin:{user_id:adminId},access:permissions};}},
  '@/lib/orders/admin-access':{DOCUMENT_PERMISSIONS},
 });
 return {queries,get guards(){return guards;},get verified(){return verified;},get:()=>route.GET(new server.NextRequest('https://local.invalid/api/orders/invoice/order'),{params:Promise.resolve({orderId:'order'})})};
}
const checkPrivate=r=>{assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');};
async function denied(h,status=403){const r=await h.get();assert.equal(r.status,status);checkPrivate(r);const body=await r.json();assert.equal(typeof body.error,'string');assert.ok(!JSON.stringify(body).includes('PRIVATE-'));assert.ok(h.queries.every(q=>q.columns==='id, user_id'),'no sensitive fields queried before permission');}
test.beforeEach(t=>{t.mock.method(globalThis,'fetch',()=>{throw Error('external_forbidden');});});
test('invoice: verified owner retains unchanged DTO without staff permissions',async()=>{const h=harness();const r=await h.get();assert.equal(r.status,200);checkPrivate(r);const d=await r.json();assert.equal(d.corporateQuote.tax_no,'PRIVATE-TAX');assert.deepEqual(Object.keys(d).sort(),['allocations','buyerProfile','corporateQuote','order']);assert.equal(h.guards,0);assert.equal(h.verified,1);});
test('invoice: absent or invalid verified user never opens service reads',async()=>{for(const opts of [{caller:null},{userError:true}]){const h=harness(opts);await denied(h,401);assert.equal(h.queries.length,0);}});
test('invoice: active staff without permissions cannot read another customer document',async()=>{await denied(harness({caller:'staff',permissions:{permissions:[]}}));});
for(const missing of DOCUMENT_PERMISSIONS)test(`invoice: missing ${missing} blocks the whole document`,async()=>{const p=access();p.permissions=p.permissions.filter(x=>x.key!==missing);await denied(harness({caller:'staff',permissions:p}));});
test('invoice: each permission needs its own global scope, including assigned-only',async()=>{for(const key of DOCUMENT_PERMISSIONS)for(const scope of [{kind:'sites',siteIds:['site']},{kind:'assigned'}]){const p=access();p.permissions.find(x=>x.key===key).scopes=[scope];await denied(harness({caller:'staff',permissions:p}));}});
test('invoice: MFA rejection remains a plain-string page error and stops private reads',async()=>{const h=harness({caller:'staff',guardError:'mfa_required'});const r=await h.get();assert.equal(r.status,403);checkPrivate(r);const body=await r.json();assert.equal(body.code,'mfa_required');assert.equal(typeof body.error,'string');assert.equal(h.queries.length,1);});
test('invoice: fully authorized staff receives the same DTO',async()=>{const h=harness({caller:'staff'});const r=await h.get();assert.equal(r.status,200);assert.equal(h.guards,1);assert.equal((await r.json()).corporateQuote.tax_no,'PRIVATE-TAX');});
test('invoice: a changed identity between authentication and permission cannot borrow access',async()=>{await denied(harness({caller:'staff',adminId:'different-staff'}));});
test('invoice: ownership reassignment is fenced in the document read',async()=>{const h=harness({reassigned:true});const r=await h.get();assert.equal(r.status,404);assert.deepEqual(h.queries[1].filters,[['eq','id','order'],['eq','user_id','owner']]);assert.equal(h.queries.length,2);});
test('invoice: guest-owned order uses null-safe ownership fencing for authorized staff',async()=>{const h=harness({caller:'staff',owner:null});assert.equal((await h.get()).status,200);assert.deepEqual(h.queries[1].filters.at(-1),['is','user_id',null]);assert.ok(!h.queries.some(q=>q.table==='profiles'));});
test('invoice: dependency failures never return partial financial/personal data',async()=>{for(const failedTable of ['orders','order_allocations','profiles','corporate_quotes']){const h=harness({failedTable});const r=await h.get();assert.equal(r.status,503);checkPrivate(r);const body=await r.json();assert.equal(typeof body.error,'string');assert.ok(!JSON.stringify(body).includes('PRIVATE-'));}});
test('invoice: thrown auth failure is private 503 without service reads',async()=>{const h=harness({throwAuth:true});await denied(h,503);assert.equal(h.queries.length,0);});
