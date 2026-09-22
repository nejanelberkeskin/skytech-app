import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './load-source.mjs';
import {withdrawalRequestSchema} from '../../lib/orders/schema.ts';
import {ORDER_VIEW_FIXTURES} from '../../lib/orders/view.ts';
test('withdrawal remains available when new sales are disabled (in-memory route, no HTTP)',async()=>{
 const previous=process.env.NEXT_PUBLIC_SALES_ENABLED;process.env.NEXT_PUBLIC_SALES_ENABLED='false';
 try{
 let recorded=0;const route=loadSource('app/api/public/cayma/route.ts',{
 'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status??200})},after:()=>{}},
 '@/lib/admin-auth':{getClientIP:()=> 'local',rateLimit:()=>null},
 '@/lib/requests/schema':{issuesToFieldErrors:()=>({}),MIN_FILL_MS:3000},
 '@/lib/requests/server':{hashIp:()=>null,sanitizeUserAgent:()=>null},
 '@/lib/orders/schema':{withdrawalRequestSchema},'@/lib/orders/view':{ORDER_VIEW_FIXTURES},
 '@/lib/orders/withdrawal':{recordWithdrawal:async()=>{recorded++;return {ok:true,order:{order_no:'SG-2026-TEST23'},receivedAt:'2026-09-22T12:00:00Z',refundDueOn:'2026-10-06'};},refundDueDay:()=> '2026-10-06',sendWithdrawalEmails:async()=>{}},
 });
 const result=await route.POST({text:async()=>JSON.stringify({orderNo:'SG-2026-TEST23',email:'test@example.com',locale:'tr',elapsedMs:5000}),headers:new Headers()});
 assert.equal(result.status,200);assert.equal(recorded,1);
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SALES_ENABLED;else process.env.NEXT_PUBLIC_SALES_ENABLED=previous;}
});
