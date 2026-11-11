const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../sportscore-ui.js'),'utf8');
const env={};vm.createContext(env);vm.runInContext(source.slice(0,source.indexOf('/* SportScore binding panel')),env);
const fixture=(casa,fora,status='AGENDADO',competicao='International')=>({casa,fora,status,competicao,inicio:'2026-11-11T17:00:00Z'});
const jogo={casa:'TURQUIA',fora:'BÉLGICA'};
const fixtures=[fixture('Turkey','Belgium'),fixture('Turkey','Belgium','ENCERRADO'),fixture('Belgium U19','Kosovo U19'),fixture('Adana','Outro','AGENDADO','Turkish Third League')];
test('padrão exclui encerradas e prioriza o confronto com os dois times',()=>{const lista=env.ssFiltrar(fixtures,{jogo});a.equal(lista.length,2);a.equal(lista[0].casa,'Turkey');a.equal(lista.some(m=>m.status==='ENCERRADO'),false)});
test('encerradas continuam acessíveis por filtro explícito',()=>{const lista=env.ssFiltrar(fixtures,{jogo,status:'ENCERRADO'});a.equal(lista.length,1);a.equal(lista[0].status,'ENCERRADO')});
test('busca por time não inclui nome da competição e ignora acento e idioma',()=>{
 a.equal(env.ssFiltrar(fixtures,{escopo:'todos',busca:'TUR'}).length,1);
 a.equal(env.ssFiltrar(fixtures,{escopo:'todos',busca:'Turquia Bélgica'}).length,1);
 a.equal(env.ssNormalizar('Türkiye'),env.ssNormalizar('TURQUIA'));
 a.equal(env.ssFiltrar([fixture('Armenia','Cyprus')],{busca:'Armênia Chipre'}).length,1);
});
test('competição é um filtro independente; categoria permanece visível',()=>{
 const lista=env.ssFiltrar(fixtures,{escopo:'todos',competicao:'Turkish'});a.equal(lista.length,1);a.equal(lista[0].casa,'Adana');
 a.equal(env.ssNormalizar('Belgium U19'),'belgium u19');
 a.equal(env.ssFiltrar(fixtures,{jogo,busca:'U19'}).length,1);
});
