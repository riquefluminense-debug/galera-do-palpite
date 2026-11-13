// Execute somente no servidor com as variáveis de teste configuradas.
require('dotenv').config();
const fs=require('node:fs');
const {createClient,payload}=require('../pagbank');
(async()=>{
 if(process.env.PAGBANK_ENV && process.env.PAGBANK_ENV!=='sandbox') throw new Error('Este script aceita apenas sandbox');
 const client=createClient({...process.env,PAGBANK_ENV:'sandbox'});
 const codigo=`GDP-${Date.now()}`;
 const body=payload({codigo,nome:'Teste de integração',valor:10},{email:process.env.PAGBANK_TEST_EMAIL,cpf:process.env.PAGBANK_TEST_CPF},process.env.PAGBANK_WEBHOOK_URL);
 const logs=[];
 function redact(value){
  if(Array.isArray(value)) return value.map(redact);
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,['customer','tax_id','email','phones','text'].includes(k)?'[REMOVIDO]':redact(v)]));
  return value;
 }
 async function call(method,route,body){
  const response=await client.call(method,route,body,method==='POST'?codigo:undefined);
  logs.push({data:new Date().toISOString(),ambiente:'sandbox',method,route,request:redact(body || null),response:redact(response)});
  fs.writeFileSync('pagbank-evidencias-sandbox.json',JSON.stringify(logs,null,2),{mode:0o600});
  return response;
 }
 const order=await call('POST','/orders',body);
 console.log('Cobrança de teste criada. Aguardando simulador do PagBank.');
 // R$10: sucesso automático segundo as regras oficiais do Sandbox.
 for(let i=0;i<12;i++){
  const current=await call('GET',`/orders/${encodeURIComponent(order.id)}`);
  if(current.charges?.some(c=>c.status==='PAID')){console.log('Pagamento simulado PAID. Evidências gravadas, sem token nem dados do pagador.');return;}
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 console.log('Ainda pendente. Evidências reais gravadas; não afirmar que houve aprovação.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
