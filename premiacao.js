/* Cálculos em centavos; nenhum pagamento ou transferência é executado aqui. */
(function(root){
 const cents=v=>Math.round(Number(v||0)*100);
 function calcularPremiacao(config={},arrecadacao=0){
  const pct={normal:70,acumulado:18,banco:2,lucro:10,...config.percentuais};
  const revenue=cents(arrecadacao);
  const normalAuto=Math.round(revenue*pct.normal/100);
  const banco=Math.round(revenue*pct.banco/100),lucro=Math.round(revenue*pct.lucro/100);
  const aporte=revenue-normalAuto-banco-lucro;
  const manual=v=>v!==null&&v!==undefined&&v!=='';
  const acumulado=manual(config.acumulado)?cents(config.acumulado):aporte;
  const normal=manual(config.normal)?cents(config.normal):normalAuto;
  const total=manual(config.total)?cents(config.total):normal+acumulado;
  return {normal:normal/100,acumulado:acumulado/100,total:total/100,aporte:aporte/100,banco:banco/100,lucro:lucro/100,percentuais:pct};
 }
 function premioCampeoes(p,lista,jogosFinalizados){
  if(!jogosFinalizados||!lista.length)return null;
  const maior=Math.max(...lista.map(b=>Number(b.pontos)||0));
  const vencedores=lista.filter(b=>Number(b.pontos)===maior);
  const valor=maior===8?p.total:p.normal;
  return {pontos:maior,quantidade:vencedores.length,faixa:maior===8?'CAMPEÃO COM ACUMULADO':'CAMPEÃO',valor,porVencedor:Math.floor(cents(valor)/vencedores.length)/100};
 }
 const api={calcularPremiacao,premioCampeoes};
 if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(typeof window!=='undefined'?window:globalThis);
