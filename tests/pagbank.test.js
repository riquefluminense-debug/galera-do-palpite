const {test}=require('node:test');
const a=require('node:assert/strict');
const {createClient,payload,paymentResult}=require('../pagbank');
const saved={orderId:'ORDE_1',codigo:'GDP-123',amount:1000};
const order={id:'ORDE_1',reference_id:'GDP-123',charges:[{reference_id:'GDP-123',status:'PAID',amount:{value:1000,currency:'BRL'},payment_method:{type:'PIX'}}]};
test('confirma somente pedido, referência, moeda e valor esperados',()=>{
 a.equal(paymentResult(order,saved).paid,true);
 for(const invalid of [{...order,id:'outro'},{...order,reference_id:'outro'},{...order,charges:[{...order.charges[0],amount:{value:1,currency:'BRL'}}]}]) a.throws(()=>paymentResult(invalid,saved));
 a.equal(paymentResult({...order,charges:[{...order.charges[0],status:'WAITING'}]},saved).paid,false);
 a.equal(paymentResult({...order,charges:[{...order.charges[0],amount:{value:1000,currency:'BRL',summary:{refunded:1000}}}]},saved).paid,false);
});
test('usa valor persistido e exige dados reais do pagador e webhook HTTPS',()=>{
 const ticket={codigo:'GDP-123',nome:'Teste',valor:10};
 const customer={cpf:'12345678909',email:'teste@example.com',valor:0.01};
 a.equal(payload(ticket,customer,'https://example.com/api/pix/webhook').charges[0].amount.value,1000);
 a.throws(()=>payload(ticket,{},'https://example.com'));
 a.throws(()=>payload(ticket,customer,'http://example.com'));
});
test('sandbox por padrão; token só em header; erro HTTP não aprova',async()=>{
 let url,opts;
 const client=createClient({PAGBANK_TOKEN:'secret'},async(u,o)=>{url=u;opts=o;return {ok:true,json:async()=>order}});
 await client.call('GET','/orders/ORDE_1');
 a.match(url,/^https:\/\/sandbox.api.pagseguro.com\//);a.equal(opts.headers.Authorization,'Bearer secret');
 const denied=createClient({PAGBANK_TOKEN:'secret'},async()=>({ok:false,status:403,json:async()=>({})}));
 await a.rejects(()=>denied.call('GET','/orders/ORDE_1'),/403/);
 a.throws(()=>createClient({PAGBANK_ENV:'outro'}));
});
