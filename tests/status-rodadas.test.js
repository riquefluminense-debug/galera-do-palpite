const {test}=require('node:test');const a=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const s=fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');const code=s.slice(s.indexOf('function atualizarStatusRodadasInicio(){'),s.indexOf('function renderRodadas(){'));
for(const [name,rodadas,expected] of [['todas fechadas',[{status:'Encerrada'},{status:'Fechada'}],false],['uma aberta',[{status:'Encerrada'},{status:'Aberta'}],true],['duas abertas',[{status:'Aberta'},{status:'Aberta'}],true],['sem rodadas',[],false]]){
 test(name,()=>{let closed;const badge={textContent:'',classList:{toggle:(k,v)=>closed=v}};const c=vm.createContext({rodadas,document:{getElementById:()=>badge}});vm.runInContext(code,c);vm.runInContext('atualizarStatusRodadasInicio()',c);a.equal(badge.textContent,expected?'● RODADA ABERTA':'● RODADA FECHADA');a.equal(closed,!expected)});
}
