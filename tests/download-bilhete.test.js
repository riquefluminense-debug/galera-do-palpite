const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');
const code=source.slice(source.indexOf('function desenharBilhetePNG('),source.indexOf('function imprimirBilhete('));
test('download bloqueia pendente antes de gerar qualquer imagem',()=>{
 let aviso='',gerou=false;
 const env={encontrarBilheteGlobal:()=>({bilhete:{codigo:'X',status:'Pendente'}}),bilhetePago:b=>b.status==='Pago',alert:m=>aviso=m};
 vm.createContext(env);vm.runInContext(code,env);env.desenharBilhetePNG=()=>{gerou=true};env.baixarBilhete('X');
 a.match(aviso,/confirmação/);a.equal(gerou,false);
});
test('bilhete pago gera PNG e aciona download com nome seguro',()=>{
 let nome='',clicked=false,revoked=false;
 const env={encontrarBilheteGlobal:()=>({bilhete:{codigo:'X/1',status:'Pago'}}),bilhetePago:b=>b.status==='Pago',alert:()=>a.fail('não deve falhar'),URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>revoked=true},document:{createElement:()=>({click(){clicked=true;nome=this.download},remove(){}}),body:{appendChild(){}}},setTimeout:fn=>fn()};
 vm.createContext(env);vm.runInContext(code,env);env.desenharBilhetePNG=()=>({toBlob(fn,tipo){a.equal(tipo,'image/png');fn({})}});env.baixarBilhete('X/1');
 a.equal(clicked,true);a.equal(nome,'bilhete-X1.png');a.equal(revoked,true);
});
