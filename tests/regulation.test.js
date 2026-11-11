const {test}=require('node:test');const assert=require('node:assert/strict');
const {regulationFromHtml,patchFor,regulation}=require('../sportscore');
const match={url:'/football/match/a-vs-b/abc/',status:'ENCERRADO',golsCasa:5,golsFora:6,detalhe:'Finished'};
test('shootout is replaced by regulation score, including a draw',()=>{
 const m=regulationFromHtml('<span class="label">Note:</span> FT[1-1],PEN[4-5],Away win',match);
 assert.equal(m.golsCasa,1);assert.equal(m.golsFora,1);
 const patch=patchFor({sportscore_url:match.url,placar_status:'ENCERRADO'},m);
 assert.equal(patch.gols_casa,1);assert.equal(patch.gols_fora,1);
});
test('extra-time result uses the explicit FT score',()=>{
 const m=regulationFromHtml('<span class="label">Note:</span> FT[0-0],ET[1-0]',match);
 assert.equal(m.golsCasa,0);assert.equal(m.golsFora,0);
});
test('ordinary final is accepted only when detailed score agrees',()=>{
 const html='<span data-live="status-label">FT</span><span data-live="home-score">5</span><span data-live="away-score">6</span>';
 assert.equal(regulationFromHtml(html,match).status,'ENCERRADO');
 assert.equal(regulationFromHtml(html,{...match,golsCasa:4}).status,'PENDENTE');
});
test('missing detail clears unsafe scores and prevents points',async()=>{
 const m=await regulation(match,async()=>{throw Error('offline')});
 const p=patchFor({sportscore_url:match.url,placar_status:'ENCERRADO'},m);
 assert.equal(p.placar_status,'PENDENTE');assert.equal(p.gols_casa,null);
});
test('extra time and shootout live scores cannot enter ranking',()=>{
 for(const label of ['105','PEN','AET']){
  const html=`<span data-live="status-label">${label}</span><span data-live="home-score">5</span><span data-live="away-score">6</span>`;
  assert.equal(regulationFromHtml(html,{...match,status:'AO_VIVO'}).status,'PENDENTE');
 }
});
