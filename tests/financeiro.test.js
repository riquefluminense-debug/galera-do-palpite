const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {calcularPremiacao}=require('../premiacao');
const source=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
const totais=source.slice(source.indexOf('function financeiroTotaisDaRodada('),source.indexOf('function selecionarRodadaFinanceiro('));
const premios=source.slice(source.indexOf('function premiosDaRodada('),source.indexOf('function htmlFaixasPremiacao('));
const env=()=>{const e={calcularPremiacao,bilhetePago:b=>b.status==='Pago'||b.pago===true||b.statusPagamento==='PAGO'};vm.createContext(e);vm.runInContext(totais+premios,e);return e;};
test('financeiro soma só bilhetes pagos para arrecadação, lucro e taxa; extras ficam separados',()=>{
 const e=env();e.rodadas=[{premiacaoConfig:{anterior:300},bilhetes:[{status:'Pago',valor:1000},{status:'Pendente',valor:120}],financeiro:{entradasExtras:50,saidas:200}},{premiacaoConfig:{anterior:480,percentuais:{normal:70,acumulado:19,banco:1,lucro:10}},bilhetes:[{pago:true,valor:100}],financeiro:{entradasExtras:0,saidas:0}}];
 const g=e.financeiroTotaisGeral();
 a.equal(g.entradasBilhetes,1100);a.equal(g.extras,50);a.equal(g.entradas,1150);a.equal(g.pendenteValor,120);a.equal(g.lucro,110);a.equal(g.taxas,21);a.equal(g.saldo,950);
 a.equal(e.premiosDaRodada(e.rodadas[1]).acumulado,499);
});
test('financeiro da rodada usa mesma premiação do ranking e aceita zero manual',()=>{
 const e=env(),r={premiacaoConfig:{normal:0,anterior:300},bilhetes:[{statusPagamento:'PAGO',valor:100}],financeiro:{entradasExtras:500,saidas:0,percentualPremio:70}};
 const t=e.financeiroTotaisDaRodada(r);a.equal(t.premiacao,0);a.equal(t.premios.acumulado,318);a.equal(t.premios.lucro,10);a.equal(t.pagos.length,1);
});
