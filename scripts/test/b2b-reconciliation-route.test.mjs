import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
const runs=await import('../../lib/jobs/runs.ts');
test('B2B reconciliation cron denies missing/wrong secret before creating a client',async t=>{
 const old=process.env.CRON_SECRET;t.after(()=>{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;});let clients=0;
 const route=load('app/api/cron/b2b-odeme-mutabakati/route.ts',{'next/server':{NextResponse:Response},'@/lib/jobs/runs':runs,'@/lib/b2b/reconcile':{},'@/lib/supabase/server':{createServiceRoleClient:()=>{clients++;throw new Error('must not run');}}});
 const req=token=>({headers:new Headers(token?{authorization:token}:{})});
 delete process.env.CRON_SECRET;assert.equal((await route.GET(req())).status,503);
 process.env.CRON_SECRET='local-secret';for(const token of [null,'Bearer wrong','local-secret'])assert.equal((await route.GET(req(token))).status,401);
 assert.equal(clients,0);
});
test('B2B recorded job fails closed when job_runs is unavailable; no unrecorded provider work',async()=>{
 let calls=0;const run=await runs.runRecorded({rpc:async()=>({error:{message:'missing'}})},'b2b-odeme-mutabakati','cron','all',null,async()=>{calls++;return {};});
 assert.equal(run.status,'unavailable');assert.equal(calls,0);
});
test('B2B cron returns only aggregate counts; job lock skips and unfinished run is not success',async t=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='local-secret';t.after(()=>{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;});
 for(const [run,status] of [[{status:'running'},200],[{status:'unavailable'},503],[{status:'failed',error:'PRIVATE'},503],[{status:'done',recorded:false,report:{}},503],[{status:'done',recorded:true,report:{checked:2,paid:1,review:1,unavailable:0}},200]]){
  const route=load('app/api/cron/b2b-odeme-mutabakati/route.ts',{'next/server':{NextResponse:Response},'@/lib/jobs/runs':{runRecorded:async()=>run},'@/lib/b2b/reconcile':{},'@/lib/supabase/server':{createServiceRoleClient:()=>({})}});
  const res=await route.GET({headers:new Headers({authorization:'Bearer local-secret'})});assert.equal(res.status,status);assert.ok(!(await res.text()).includes('PRIVATE'));
 }
});
test('admin job dispatcher requires system.jobs.run and executes B2B reconciliation instead of order expiry/email jobs',async()=>{
 let permitted=false,worker=0,orders=0;
 const route=load('app/api/admin/jobs/[job]/run/route.ts',{'next/server':{},zod:await import('zod'),'@/lib/admin/permissions':{requirePermission:async(_r,p)=>{assert.equal(p,'system.jobs.run');return permitted?{admin:{user_id:'local-admin'}}:{error:new Response(null,{status:403})};}},'@/lib/api/envelope':{ok:data=>Response.json(data),fail:(status,code)=>Response.json({code},{status})},'@/lib/jobs/runs':{...runs,runRecorded:async(_db,job,trigger,_scope,_actor,fn)=>{assert.equal(job,'b2b-odeme-mutabakati');assert.equal(trigger,'admin');return {status:'done',runId:'local-run',report:await fn()};},jobHealth:async()=>null},'@/lib/orders/notification-outbox':{runConfiguredNotifications:async()=>{throw new Error('notification worker must not run for B2B');}},'@/lib/b2b/reconcile':{reconcileB2bPayments:async()=>{worker++;return {checked:1,paid:1,review:0,unavailable:0};}},'@/lib/mail':{publicOrigin:()=>{throw new Error('email origin unused');}},'@/lib/orders/admin-actions':{confirmDueOrders:async()=>orders++},'@/lib/orders/create':{expireStaleOrders:async()=>orders++},'@/lib/orders/jobs':{runScheduledJobs:async()=>orders++,startMonitoringDue:async()=>orders++},'@/lib/supabase/server':{createServiceRoleClient:()=>({})}});
 const req=()=>({json:async()=>({scope:'all'})});const ctx={params:Promise.resolve({job:'b2b-odeme-mutabakati'})};
 assert.equal((await route.POST(req(),ctx)).status,403);assert.equal(worker,0);
 permitted=true;assert.equal((await route.POST(req(),ctx)).status,200);assert.equal(worker,1);assert.equal(orders,0);
});
test('B2B recorded job does not announce success if final audit write fails',async()=>{
 const db={rpc:async name=>name==='start_job_run'?{data:'local-run'}:{error:{code:'LOCAL'}}};
 const r=await runs.runRecorded(db,'b2b-odeme-mutabakati','cron','all',null,async()=>({checked:1}),()=>{});
 assert.equal(r.status,'failed');assert.equal(r.error,'b2b_job_result_record_failed');
});
