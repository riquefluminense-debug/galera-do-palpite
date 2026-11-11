const {test}=require('node:test');const a=require('node:assert/strict');const {calcularPremiacao,premioCampeoes}=require('../premiacao');
test('70/18/2/10 divide arrecadação sem perder centavos',()=>{
 const p=calcularPremiacao({},1000);a.equal(p.normal,700);a.equal(p.acumulado,180);a.equal(p.total,880);a.equal(p.banco,20);a.equal(p.lucro,100);
 const q=calcularPremiacao({},10.07);a.equal(Math.round((q.normal+q.aporte+q.banco+q.lucro)*100),1007);
});
test('19% acumulado com taxa de 1%',()=>{const p=calcularPremiacao({percentuais:{acumulado:19,banco:1}},1000);a.equal(p.total,890);a.equal(p.banco,10)});
test('valores manuais incluem reserva anterior e aceitam zero explícito',()=>{
 const p=calcularPremiacao({normal:700,acumulado:500,total:1200},1000);a.equal(p.total,1200);a.equal(p.acumulado,500);
 a.equal(calcularPremiacao({normal:0,acumulado:0},1000).total,0);
});
test('8 pontos leva total; sete ou menos leva somente normal',()=>{
 const p=calcularPremiacao({normal:700,acumulado:500},1000);
 a.equal(premioCampeoes(p,[{pontos:8}],true).valor,1200);
 for(const pts of [7,6,0])a.equal(premioCampeoes(p,[{pontos:pts}],true).valor,700);
});
test('empate divide uma única faixa; resultado parcial não confirma prêmio',()=>{
 const p=calcularPremiacao({normal:700,acumulado:500},1000);
 a.equal(premioCampeoes(p,[{pontos:8},{pontos:8},{pontos:7}],true).porVencedor,600);
 a.equal(premioCampeoes(p,[{pontos:7},{pontos:7}],true).porVencedor,350);
 a.equal(premioCampeoes(p,[{pontos:8}],false),null);
 a.equal(premioCampeoes(p,[],true),null);
});
