/* Busca local: nomes equivalentes não removem categoria nem alteram o vínculo. */
const ssAliases={turquia:'turkey',turkiye:'turkey',belgica:'belgium',armenia:'armenia',chipre:'cyprus',brasil:'brazil',alemanha:'germany',espanha:'spain',inglaterra:'england',franca:'france',italia:'italy',holanda:'netherlands',paisesbaixos:'netherlands',suica:'switzerland',croacia:'croatia',grecia:'greece',polonia:'poland',escocia:'scotland',dinamarca:'denmark',suecia:'sweden',noruega:'norway',portugal:'portugal',republicatcheca:'czechia'};
function ssNormalizar(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/sub[ -]?(\d+)/g,'u$1').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).map(w=>ssAliases[w]||w).join(' ');}
function ssRelacionamento(m,j){
 if(!j)return 0;
 const h=ssNormalizar(j.casa),a=ssNormalizar(j.fora),mh=ssNormalizar(m.casa),ma=ssNormalizar(m.fora);
 const proximo=(x,y)=>!!x&&!!y&&(x===y||(' '+x+' ').includes(' '+y+' ')||(' '+y+' ').includes(' '+x+' '));
 return Number(proximo(h,mh)||proximo(h,ma))+Number(proximo(a,mh)||proximo(a,ma));
}
function ssFiltrar(lista,{jogo=null,status='ativos',escopo='relacionadas',busca='',competicao=''}={}){
 const termos=ssNormalizar(busca).split(/\s+/).filter(Boolean),liga=ssNormalizar(competicao);
 return lista.filter(m=>{
  if(status==='ativos'&&!['AGENDADO','AO_VIVO'].includes(m.status))return false;
  if(status!=='ativos'&&status!=='todos'&&m.status!==status)return false;
  if(escopo==='relacionadas'&&jogo&&ssRelacionamento(m,jogo)===0)return false;
  const times=ssNormalizar(m.casa+' '+m.fora);
  return termos.every(t=>times.includes(t))&&(!liga||ssNormalizar(m.competicao).includes(liga));
 }).sort((a,b)=>ssRelacionamento(b,jogo)-ssRelacionamento(a,jogo)||(a.status==='AO_VIVO'?-1:0)-(b.status==='AO_VIVO'?-1:0)||Date.parse(a.inicio)-Date.parse(b.inicio));
}
/* SportScore binding panel and read-only updates for visitors. */
(()=>{
 const base=()=> (window.GDP_SPORTSCORE_API_URL || API_URL.replace(/\/api\/?$/,'')).replace(/\/$/,'');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let found=[],loading=false,jaBuscou=false;
 async function request(path){const r=await fetch(base()+path,{signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.erro||'Serviço de placares indisponível');return d}
 function panel(){
  if(!adminLiberado)return;
  const parent=document.getElementById('adminJogos');if(!parent||document.getElementById('sportscore-panel'))return;
  found=[];jaBuscou=false;
  const el=document.createElement('section');el.id='sportscore-panel';el.className='ss-panel';
  el.innerHTML='<h3>⚽ Placar automático · SportScore</h3><p>Cadastre os jogos normalmente. Depois escolha um jogo da rodada e a partida correspondente na fonte.</p><label>Jogo da rodada<select id="ss-game"></select></label><label>Data dos jogos<input id="ss-date" type="date"></label><button id="ss-search">Buscar partidas</button><div class="ss-filters"><label>Mostrar<select id="ss-status"><option value="ativos">A iniciar e ao vivo</option><option value="AO_VIVO">Somente ao vivo</option><option value="AGENDADO">Somente a iniciar</option><option value="ENCERRADO">Encerradas</option><option value="todos">Todas as situações</option></select></label><label>Confrontos<select id="ss-scope"><option value="relacionadas">Relacionados ao jogo selecionado</option><option value="todos">Todos os jogos da data</option></select></label><label>Buscar time<input id="ss-filter" placeholder="Ex.: Turquia ou Belgium"></label><label>Competição (opcional)<input id="ss-competition" placeholder="Filtrar competição"></label></div><p id="ss-count" aria-live="polite"></p><p id="ss-message" role="status"></p><div id="ss-results"></div><div id="ss-links"></div><div class="ss-direct"><h4>Não encontrou? Consulte pelo link</h4><p>Copie o endereço da partida no SportScore. Confira o jogo selecionado acima antes de vincular.</p><label>Link da partida<input id="ss-direct-url" type="url" placeholder="https://sportscore.com/football/match/..."></label><button id="ss-direct-search" type="button">Consultar link</button><p id="ss-direct-message" role="status"></p><div id="ss-direct-result"></div></div>';
  parent.after(el);
  el.querySelector('#ss-game').innerHTML=jogos.filter(j=>j.dbId).map(j=>`<option value="${esc(j.dbId)}">${esc(j.casa)} × ${esc(j.fora)}</option>`).join('');
  el.querySelector('#ss-date').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
  el.querySelector('#ss-search').onclick=search;
  el.querySelector('#ss-direct-search').onclick=consultarLink;
  el.querySelector('#ss-filter').oninput=renderResults;
  el.querySelector('#ss-competition').oninput=renderResults;
  el.querySelector('#ss-status').onchange=renderResults;
  el.querySelector('#ss-scope').onchange=renderResults;
  el.querySelector('#ss-game').onchange=renderResults;
  const links=el.querySelector('#ss-links');
  for(const j of jogos.filter(j=>j.sportscoreAtivo)){
   const row=document.createElement('p');row.textContent=`${j.casa} × ${j.fora}: ${j.placarStatus||'aguardando sincronização'} `;
   const b=document.createElement('button');b.textContent='Desativar automático';b.onclick=async()=>{try{await supabaseRequest('jogos','PATCH',{sportscore_ativo:false},`?id=eq.${encodeURIComponent(j.dbId)}`);j.sportscoreAtivo=false;row.remove()}catch{message('Não foi possível desativar.')}};row.append(b);links.append(row);
  }
  request('/api/sportscore/status').then(s=>message(s.automatico?`Sincronização automática ativa.${s.erro?' Última tentativa: '+s.erro:''}`:'Busca disponível após atualizar o servidor. Para sincronizar sozinho, configure SPORTSCORE_AUTO_SYNC=true e o acesso do servidor ao Supabase.')).catch(e=>message(e.message+' — atualize também o servidor Node.'));
 }
 function message(t){const e=document.getElementById('ss-message');if(e)e.textContent=t}
 async function search(){const b=document.getElementById('ss-search');b.disabled=true;message('Buscando partidas…');try{
  const date=document.getElementById('ss-date').value;if(!date)throw Error('Selecione a data');
  // São Paulo evening matches may belong to the next UTC day.
  const next=new Date(date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
  const pages=await Promise.all([request('/api/sportscore/partidas?data='+date),request('/api/sportscore/partidas?data='+next.toISOString().slice(0,10))]);
  found=[...new Map(pages.flatMap(p=>p.items).filter(m=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(m.inicio))===date).map(m=>[m.url,m])).values()];
  jaBuscou=true;renderResults();message('Confira os dois times, mando, categoria e horário antes de vincular. O sistema não vincula automaticamente.');
 }catch(e){found=[];jaBuscou=false;renderResults();message(e.message)}finally{b.disabled=false}}
 function renderResults(){
  const box=document.getElementById('ss-results');if(!box)return;box.replaceChildren();box.scrollTop=0;
  const j=jogos.find(j=>String(j.dbId)===document.getElementById('ss-game').value);
  const lista=ssFiltrar(found,{jogo:j,status:document.getElementById('ss-status').value,escopo:document.getElementById('ss-scope').value,busca:document.getElementById('ss-filter').value,competicao:document.getElementById('ss-competition').value});
  document.getElementById('ss-count').textContent=jaBuscou?`${lista.length} resultado(s) exibido(s) de ${found.length} partidas carregadas. ${found.filter(m=>m.status==='ENCERRADO').length} encerrada(s) na lista completa.`:'';
  if(!lista.length&&jaBuscou){const p=document.createElement('p');p.className='ss-empty';p.textContent='Nenhuma partida corresponde aos filtros. Confira a data, limpe a busca ou escolha Todos os jogos da data. Para consultar jogos finalizados, selecione Encerradas.';box.append(p);return;}
  for(const m of lista){
   const row=document.createElement('div');row.className='ss-match';
   const info=document.createElement('div');info.className='ss-match-info';
   const title=document.createElement('strong');title.textContent=`${m.casa} × ${m.fora}`;
   const details=document.createElement('span');details.textContent=`${new Date(m.inicio).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · ${m.competicao}`;
   const tag=document.createElement('span');tag.className='ss-status';tag.textContent=({AO_VIVO:'AO VIVO',AGENDADO:'A INICIAR',ENCERRADO:'ENCERRADO'})[m.status]||m.status;
   const related=ssRelacionamento(m,j);if(related===2){const hint=document.createElement('small');hint.textContent='Dois nomes compatíveis — confira categoria e mando';info.append(hint);}
   info.append(title,details,tag);
   const b=document.createElement('button');b.textContent='Vincular';b.className='ss-bind';b.onclick=()=>bind(m,b);row.append(info,b);box.append(row);
  }
 }

 async function consultarLink(){
  const btn=document.getElementById('ss-direct-search'),out=document.getElementById('ss-direct-result'),msg=document.getElementById('ss-direct-message');
  out.replaceChildren();btn.disabled=true;msg.textContent='Consultando a página da partida…';
  try{
   const url=document.getElementById('ss-direct-url').value.trim();
   const data=await request('/api/sportscore/partida?url='+encodeURIComponent(url));const m=data.item;
   if(!m?.casa||!m?.fora||!Number.isFinite(Date.parse(m.inicio)))throw Error('Resposta inválida da consulta.');
   const row=document.createElement('div');row.className='ss-match';
   const info=document.createElement('div');info.className='ss-match-info';
   const title=document.createElement('strong');title.textContent=m.casa+' × '+m.fora;
   const details=document.createElement('span');details.textContent=new Date(m.inicio).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · '+m.competicao+' · '+m.status;
   info.append(title,details);
   const b=document.createElement('button');b.className='ss-bind';b.textContent='Vincular';b.onclick=()=>bind(m,b);
   row.append(info,b);out.append(row);msg.textContent='Partida encontrada pelo link. Confira times, mando, categoria e horário. A consulta não criou vínculo.';
  }catch(e){msg.textContent=e.message+' Se a rota não existir, publique também sportscore.js no servidor.';}finally{btn.disabled=false;}
 }
 async function bind(m,b){const id=document.getElementById('ss-game').value;const j=jogos.find(j=>String(j.dbId)===id);if(!j)return message('Cadastre e selecione um jogo da rodada.');
  if(!confirm(`Vincular ${j.casa} × ${j.fora} a ${m.casa} × ${m.fora}, ${new Date(m.inicio).toLocaleString('pt-BR')}?\nConfira o mando e a data. O placar passará a ser automático.`))return;
  b.disabled=true;try{
   const data={sportscore_url:m.url,sportscore_inicio:m.inicio,sportscore_ativo:true,placar_status:'AGENDADO',placar_detalhe:'Aguardando primeira sincronização',placar_atualizado_em:null,gols_casa:null,gols_fora:null};
   await supabaseRequest('jogos','PATCH',data,`?id=eq.${encodeURIComponent(j.dbId)}`);
   Object.assign(j,{sportscoreUrl:m.url,sportscoreInicio:m.inicio,sportscoreAtivo:true,placarStatus:'AGENDADO',golsCasa:null,golsFora:null});
   message('Vínculo salvo. O servidor fará a primeira consulta no próximo ciclo, próximo ao início da partida.');
  }catch{message('Falha ao salvar vínculo. Execute SPORTScore_MIGRACAO.sql no Supabase antes de usar.')}finally{b.disabled=false}
 }
 const original=renderAdmin;renderAdmin=async function(...args){await original.apply(this,args);document.getElementById('sportscore-panel')?.remove();panel()};
 const oldRanking=renderRankingPublico;renderRankingPublico=function(...args){const result=oldRanking.apply(this,args);const container=document.getElementById('ranking');if(container){container.querySelector('.ss-credit')?.remove();const p=document.createElement('p');p.className='ss-credit';const live=jogos.some(j=>j.sportscoreAtivo&&j.placarStatus!=='ENCERRADO');p.append(document.createTextNode(live?'Ranking provisório · ':'Placares · '));const a=document.createElement('a');a.href='https://sportscore.com/';a.title='Sports data by SportScore';a.textContent='Powered by SportScore';p.append(a);container.append(p)}return result};
 async function refresh(){if(loading||document.hidden||!rodadas.length)return;const ids=rodadas.flatMap(r=>r.jogos||[]).filter(j=>j.sportscoreAtivo).map(j=>j.dbId);if(!ids.length)return;loading=true;
  try{const r=await fetch(`${SUPABASE_URL}/rest/v1/jogos?sportscore_ativo=eq.true&select=id,gols_casa,gols_fora,placar_status,placar_detalhe,placar_atualizado_em`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Falha ao consultar placares');const rows=await r.json();
   for(const round of rodadas)for(const j of round.jogos||[]){const x=rows.find(x=>String(x.id)===String(j.dbId));if(x&&j.sportscoreAtivo)Object.assign(j,{golsCasa:x.gols_casa,golsFora:x.gols_fora,placarStatus:x.placar_status,placarDetalhe:x.placar_detalhe,placarAtualizado:x.placar_atualizado_em})}
   if(document.getElementById('ranking')?.classList.contains('ativa'))renderRankingPublico();
  }catch(e){console.warn('Placares: mantendo última atualização.',e.message)}finally{loading=false}
 }
 setInterval(refresh,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
