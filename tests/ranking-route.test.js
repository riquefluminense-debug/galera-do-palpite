const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');
function functionText(name){const start=source.indexOf(`async function ${name}(`);const end=source.indexOf('\nfunction ',start);return source.slice(start,end);}
test('refresh restores URL round and explicit selection overrides old URL',async()=>{
 const c=vm.createContext({console:{log(){},error(e){throw e}},URLSearchParams,Date,Number,String,location:{hash:'#ranking?rodada=1'},sessionStorage:{getItem(){return null}},rodadas:[],rodadaAtualId:null,rodadaAdminId:null,pixConfig:{},adminLiberado:false,
 supabaseRequest:async name=>name==='rodadas'?[{id:2,nome:'New',status:'Aberta'},{id:1,nome:'Old',status:'Fechada'}]:[],aplicarRodada:r=>{c.current=r},renderRodadas(){},renderTicket(){},renderAdmin(){}});
 vm.runInContext(functionText('carregarRodadasSupabase'),c);
 await vm.runInContext('carregarRodadasSupabase()',c);assert.equal(c.current.id,'1');assert.equal(c.current.status,'Fechada');
 await vm.runInContext('carregarRodadasSupabase(2)',c);assert.equal(c.current.id,'2');
});
