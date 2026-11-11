const {test}=require('node:test'),a=require('node:assert/strict');
const install=require('../jogos-admin-routes');
async function run({tickets=[],deleted=[{id:42}],id='42',round='61',admin={usuario:'admin',modulo:'campeoes'}}={}){
 process.env.JWT_SECRET='test';let handler,guard;const calls=[];
 install({delete(path,middleware,fn){guard=middleware;handler=fn}},()=>{}, {url:'https://db.example',key:'secret',fetcher:async(url,o)=>{calls.push([url,o]);return {ok:true,json:async()=>url.includes('/bilhetes')?tickets:o.method==='DELETE'?deleted:calls.some(c=>c[1].method==='DELETE')?[]:[{id:42}]}}});
 const res={code:200,status(c){this.code=c;return this},json(data){this.data=data;return this}};
 await handler({params:{id},query:{rodada_id:round},admin},res);return {res,calls,guard};
}
test('exclusão do servidor filtra jogo e rodada e verifica retorno',async()=>{const {res,calls,guard}=await run();a.equal(typeof guard,'function');a.equal(res.data.ok,true);const del=calls.find(c=>c[1].method==='DELETE');a.match(del[0],/id=eq.42&rodada_id=eq.61/)});
test('servidor bloqueia exclusão quando há bilhetes',async()=>{const {res,calls}=await run({tickets:[{id:1}]});a.equal(res.code,409);a.equal(calls.some(c=>c[1].method==='DELETE'),false)});
test('servidor recusa acesso sem identidade administrativa e IDs inválidos',async()=>{a.equal((await run({admin:{}})).res.code,403);a.equal((await run({id:'42&delete=all'})).res.code,400)});
test('DELETE sem registro removido não retorna sucesso',async()=>{const {res}=await run({deleted:[]});a.equal(res.code,403);a.equal(res.data.ok,undefined)});
