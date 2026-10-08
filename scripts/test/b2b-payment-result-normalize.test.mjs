import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource as load } from './load-source.mjs';
const money=load('lib/payments/iyzico.ts',{'@/lib/iyzico':{default:{}},'./iyzico-config':{iyzicoConfig:()=>null},'@/lib/tr-iller':{}});
const {b2bPaymentResult}=load('lib/b2b/payment-result.ts',{'@/lib/payments/iyzico':money});
test('B2B SDK normalization accepts documented number/string variants and removes token/card/error fields',()=>{
 const raw={status:'success',paymentStatus:'SUCCESS',paymentId:'local-id',basketId:'local-order',conversationId:'local-payment',currency:'TRY',price:'200.0000',paidPrice:200,fraudStatus:'1',token:'SECRET',cardNumber:'SECRET',errorMessage:'SECRET',lastFourDigits:'9999'};
 const r=b2bPaymentResult(raw);
 assert.deepEqual(r,{status:'success',payment_status:'SUCCESS',payment_id:'local-id',basket_id:'local-order',conversation_id:'local-payment',currency:'TRY',price_kurus:20000,paid_kurus:20000,fraud_status:1});
 for(const fraud of [0,'0',-1,'-1',null,'',true,2]) assert.equal(b2bPaymentResult({...raw,fraudStatus:fraud}).fraud_status,[0,'0',-1,'-1'].includes(fraud)?Number(fraud):null);
});
test('B2B malformed money/identities are null and cannot turn into an accepted amount',()=>{
 for(const price of ['200.001',-1,Infinity,NaN,true,{},'999999999999999999999',null]) assert.equal(b2bPaymentResult({price,paidPrice:price}).price_kurus,null);
 for(const paymentId of [null,10,{},'x'.repeat(201)]) assert.equal(b2bPaymentResult({paymentId}).payment_id,null);
});
