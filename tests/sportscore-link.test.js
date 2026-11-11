const {test}=require('node:test'),a=require('node:assert/strict');
const {matchFromHtml,directMatch,install}=require('../sportscore');
const path='/football/match/nautico-pe-vs-londrina-pr/test123/';
const html=(label='22:00',startDate='2026-11-11T22:00:00Z')=>'<script type="application/ld+json">'+JSON.stringify({'@type':'SportsEvent',url:'https://sportscore.com'+path,homeTeam:{name:'Londrina PR'},awayTeam:{name:'Nautico (PE)'},startDate,eventStatus:'https://schema.org/EventScheduled',superEvent:{name:'Brazilian Serie B'}})+'</script><span data-live="home-score">2</span><span data-live="away-score">1</span><span data-live="status-label">'+label+'</span>';
test('link usa times da página e horário com fuso; agendado não atribui pontos',()=>{const m=matchFromHtml(html(),path);a.equal(m.casa,'Londrina PR');a.equal(m.fora,'Nautico (PE)');a.equal(m.inicio,'2026-11-11T22:00:00Z');a.equal(m.golsCasa,null)});
test('link lê placar ao vivo e final com confirmação regulamentar',()=>{for(const [label,status] of [['45','AO_VIVO'],['FT','ENCERRADO']]){const m=matchFromHtml(html(label),path);a.equal(m.status,status);a.equal(m.golsCasa,2);a.equal(m.golsFora,1)}});
test('não usa jogo relacionado nem página sem dados',()=>{a.throws(()=>matchFromHtml(html(),'/football/match/outro-jogo/xyz/'));a.throws(()=>matchFromHtml('<html></html>',path))});
test('consulta rejeita domínio externo antes de chamar rede e recusa redirecionamento',async()=>{let chamou=false;await a.rejects(directMatch('https://example.com'+path,async()=>{chamou=true}));a.equal(chamou,false);await a.rejects(directMatch(path,async(url,opts)=>{a.equal(opts.redirect,'error');return {ok:false,status:428}}),/428/)});
test('sincronização consulta link quando jogo está ausente da lista diária',async()=>{
 const agora=new Date().toISOString();const patches=[];
 const fetcher=async(url,opts={})=>{
  if(url.includes('/rest/v1/jogos')){if(opts.method==='PATCH'){patches.push(JSON.parse(opts.body));return {ok:true,json:async()=>[{id:1}]}}return {ok:true,json:async()=>[{id:1,sportscore_url:path,sportscore_inicio:agora}]};}
  if(url.includes('/api/v1/fixtures'))return {ok:true,json:async()=>({count:0,matches:[]})};
  return {ok:true,text:async()=>html('22:00',agora)};
 };
 const app={get(){}};const {sync}=install(app,{supabaseUrl:'https://db.example',key:'test',enabled:true,fetcher});await sync();a.equal(patches.length,1);a.equal(patches[0].placar_status,'AGENDADO');a.equal(patches[0].gols_casa,null);
});

test('90+ é ao vivo e aceita o placar regulamentar',()=>{const m=matchFromHtml(html('90+'),path);a.equal(m.status,'AO_VIVO');a.equal(m.golsCasa,2);a.equal(m.golsFora,1)});
