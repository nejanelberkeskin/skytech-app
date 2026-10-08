import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource as load} from './load-source.mjs';
import {runRecorded} from '../../lib/jobs/runs.ts';
const forbidden=()=>{throw new Error('unexpected external or financial dependency');};
test('notification job refuses to run without its audit lock; a lost final write is not success',async()=>{
 let work=0;
 assert.equal((await runRecorded({rpc:async()=>({error:{message:'missing'}})},'bildirimler','cron','all',null,async()=>{work++;return {};})).status,'unavailable');
 assert.equal(work,0);
 const r=await runRecorded({rpc:async name=>name==='start_job_run'?{data:'fixture'}:{error:{code:'LOCAL'}}},'bildirimler','cron','all',null,async()=>({sent:1}),()=>{});
 assert.equal(r.status,'failed'); assert.equal(r.error,'notification_job_result_record_failed');
});
test('admin notification job requires permission and explicit all scope; it never runs order expiry or payment jobs',async()=>{
 let allowed=false,worker=0,clients=0;
 const route=load('app/api/admin/jobs/[job]/run/route.ts',{
  zod:await import('zod'),'@/lib/admin/permissions':{requirePermission:async(_r,p)=>{assert.equal(p,'system.jobs.run');return allowed?{admin:{user_id:'test-admin'}}:{error:new Response(null,{status:403})};}},
  '@/lib/api/envelope':{fail:(status,code)=>Response.json({code},{status}),ok:data=>Response.json(data)},
  '@/lib/jobs/runs':{isJobName:x=>x==='bildirimler',jobHealth:async()=>null,runRecorded:async(_db,job,trigger,scope,actor,fn)=>{
   assert.deepEqual([job,trigger,scope,actor],['bildirimler','admin','all','test-admin']);return {status:'done',runId:'fixture',report:await fn()};}},
  '@/lib/orders/notification-outbox':{runConfiguredNotifications:async()=>{worker++;return {sent:1,health:{pending:0,needsReview:2}};}},
  '@/lib/mail':{publicOrigin:()=> 'https://local.invalid'},'@/lib/b2b/reconcile':{reconcileB2bPayments:forbidden},
  '@/lib/orders/admin-actions':{confirmDueOrders:forbidden},'@/lib/orders/create':{expireStaleOrders:forbidden},
  '@/lib/orders/jobs':{runScheduledJobs:forbidden,startMonitoringDue:forbidden},
  '@/lib/supabase/server':{createServiceRoleClient:()=>{clients++;return {};}}
 });
 const req=scope=>({nextUrl:{origin:'https://local.invalid'},json:async()=>({scope})}),ctx={params:Promise.resolve({job:'bildirimler'})};
 assert.equal((await route.POST(req('all'),ctx)).status,403);assert.equal(clients,0);
 allowed=true; assert.equal((await route.POST(req('status'),ctx)).status,400);assert.equal(clients,0);
 const r=await route.POST(req('all'),ctx);assert.equal(r.status,200);assert.equal(worker,1);assert.equal(clients,1);
});
