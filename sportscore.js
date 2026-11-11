// Public SportScore feed. Keep provider failures separate from match results.
const BASE='https://sportscore.com';
const cache=new Map();
function matchPath(value){
 if(typeof value!=='string')return null;
 try{const u=new URL(value,BASE);if(u.origin!==BASE||!/^\/football\/match\/[a-z0-9-]+\/[a-z0-9]+\/$/.test(u.pathname))return null;return u.pathname}catch{return null}
}
function score(v){return v!==null&&v!==undefined&&/^\d+$/.test(String(v))?Number(v):null}
function normalize(m){
 const url=matchPath(m.url),kickoff=m.time,home=score(m.home_score),away=score(m.away_score);
 if(!url||typeof m.home!=='string'||typeof m.away!=='string'||!Number.isFinite(Date.parse(kickoff)))return null;
 const raw=String(m.status||'').toLowerCase();
 const status=raw==='live'?'AO_VIVO':raw==='finished'?'ENCERRADO':raw==='upcoming'?'AGENDADO':'INDEFINIDO';
 return {url,casa:m.home,fora:m.away,inicio:kickoff,competicao:String(m.competition||''),golsCasa:home,golsFora:away,status,detalhe:String(m.status_text||'')};
}
// The fixture feed combines shootout goals with the match score. The match
// page exposes the regulation result in its Note (e.g. FT[1-1],PEN[4-5]).
function regulationFromHtml(html,match){
 const note=html.match(/<span[^>]*class="label"[^>]*>\s*Note:\s*<\/span>([^<]*)/i)?.[1] || '';
 const ft=note.match(/\bFT\[\s*(\d+)\s*[-–:]\s*(\d+)\s*\]/i);
 if(ft)return {...match,golsCasa:Number(ft[1]),golsFora:Number(ft[2]),status:'ENCERRADO',detalhe:'90 minutos + acréscimos · confirmado'};
 const label=html.match(/data-live="status-label"[^>]*>([\s\S]*?)<\/span>/i)?.[1].replace(/<[^>]*>/g,'').trim() || '';
 const h=html.match(/data-live="home-score"[^>]*>\s*(\d+)\s*</i);
 const a=html.match(/data-live="away-score"[^>]*>\s*(\d+)\s*</i);
 const minute=label.match(/^(\d{1,3})(?:\s*\+\s*\d+)?['′]?$/);
 const regularLive=match.status==='AO_VIVO' && (label==='HT' || (minute && Number(minute[1])<=90));
 const regularFinal=match.status==='ENCERRADO' && label==='FT' && !/PEN|AET|ET\[|extra|shootout/i.test(note);
 if(h && a && (regularLive || regularFinal) && Number(h[1])===match.golsCasa && Number(a[1])===match.golsFora){
  return {...match,detalhe:regularFinal?'90 minutos + acréscimos · confirmado':label+' · tempo regulamentar'};
 }
 return {...match,status:'PENDENTE',golsCasa:null,golsFora:null,detalhe:'Conferir placar dos 90 minutos; prorrogação e pênaltis não contam'};
}
async function regulation(match,fetcher){
 try{
  const r=await fetcher(BASE+match.url,{signal:AbortSignal.timeout(15000),headers:{Accept:'text/html'}});
  if(!r.ok)throw Error('Detalhes indisponíveis');
  return regulationFromHtml(await r.text(),match);
 }catch{
  return {...match,status:'PENDENTE',golsCasa:null,golsFora:null,detalhe:'Aguardando confirmação do placar dos 90 minutos'};
 }
}
async function fixtures(date,fetcher=fetch){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z')))throw Error('Data inválida');
 const old=cache.get(date);if(old&&Date.now()-old.at<60000)return old;
 const response=await fetcher(`${BASE}/api/v1/fixtures/?sport=football&date=${date}&limit=200`,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
 if(!response.ok)throw Error(`SportScore indisponível (HTTP ${response.status})`);
 const data=await response.json();if(!Array.isArray(data.matches))throw Error('Resposta inesperada do SportScore');
 if(data.count>data.matches.length)throw Error('Lista incompleta do fornecedor; sincronização interrompida para evitar omissões');
 const result={at:Date.now(),items:data.matches.map(normalize).filter(Boolean)};
 cache.set(date,result);if(cache.size>8)cache.delete(cache.keys().next().value);return result;
}
function patchFor(row,match){
 if(matchPath(row.sportscore_url)!==match.url)return null;
 if(row.placar_status==='ENCERRADO'&&match.status!=='ENCERRADO'&&String(row.placar_detalhe||'').includes('90 minutos + acréscimos · confirmado'))return null;
 const patch={placar_status:match.status,placar_detalhe:match.detalhe,placar_atualizado_em:new Date().toISOString()};
 if(['AO_VIVO','ENCERRADO'].includes(match.status)){
  if(match.golsCasa===null||match.golsFora===null)return null;
  Object.assign(patch,{gols_casa:match.golsCasa,gols_fora:match.golsFora});
 }else if(match.status==='AGENDADO'||match.status==='PENDENTE'){
  // A scheduled 0-0 must never award a point.
  Object.assign(patch,{gols_casa:null,gols_fora:null});
 }else return null;
 return patch;
}
function install(app,{supabaseUrl,key,enabled=false,fetcher=fetch}){
 let running=false,lastError='',lastSync=null;
 app.get('/api/sportscore/partidas',async(req,res)=>{try{const r=await fixtures(String(req.query.data||''),fetcher);res.json({items:r.items,atualizadoEm:new Date(r.at).toISOString()})}catch(e){res.status(502).json({erro:e.message})}});
 app.get('/api/sportscore/status',(req,res)=>res.json({automatico:!!(enabled&&supabaseUrl&&key),ultimaSincronizacao:lastSync,erro:lastError}));
 async function db(query,method='GET',body){
  const r=await fetcher(`${supabaseUrl}/rest/v1/jogos${query}`,{method,signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw Error(`Sincronização do banco falhou (HTTP ${r.status}); confira migração e configuração`);
  return method==='GET'?r.json():null;
 }
 async function sync(){
  if(running||!enabled||!supabaseUrl||!key)return;running=true;
  try{
   const rows=await db('?sportscore_ativo=eq.true&sportscore_url=not.is.null&select=id,sportscore_url,sportscore_inicio,placar_status,placar_detalhe');
   const now=Date.now();const active=rows.filter(r=>{const t=Date.parse(r.sportscore_inicio);return Number.isFinite(t)&&now>=t-15*60000&&(now<=t+12*3600000 || (now<=t+7*86400000 && !String(r.placar_detalhe||'').includes('90 minutos + acréscimos · confirmado')))});
   const dates=new Set();for(const r of active){const t=Date.parse(r.sportscore_inicio);dates.add(new Date(t).toISOString().slice(0,10));dates.add(new Date(t+3*3600000).toISOString().slice(0,10))}
   const matches=new Map();for(const day of dates){const result=await fixtures(day,fetcher);for(const m of result.items)matches.set(m.url,m)}
   for(const row of active){const m=matches.get(matchPath(row.sportscore_url));if(!m)continue;const checked=['AO_VIVO','ENCERRADO'].includes(m.status)?await regulation(m,fetcher):m;const patch=patchFor(row,checked);if(patch)await db(`?id=eq.${encodeURIComponent(row.id)}&sportscore_ativo=eq.true&sportscore_url=eq.${encodeURIComponent(row.sportscore_url)}`,'PATCH',patch)}
   lastSync=new Date().toISOString();lastError='';
  }catch(e){lastError=e.message;console.warn('[SportScore]',e.message)}finally{running=false}
 }
 if(enabled&&supabaseUrl&&key){setTimeout(sync,3000).unref();setInterval(sync,60000).unref()}
 return {sync};
}
module.exports={matchPath,normalize,fixtures,patchFor,regulationFromHtml,regulation,install};
