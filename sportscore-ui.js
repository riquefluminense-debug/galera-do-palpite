/* SportScore binding panel and read-only updates for visitors. */
(()=>{
 const base=()=> (window.GDP_SPORTSCORE_API_URL || API_URL.replace(/\/api\/?$/,'')).replace(/\/$/,'');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let found=[],loading=false;
 async function request(path){const r=await fetch(base()+path,{signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.erro||'Serviço de placares indisponível');return d}
 function panel(){
  if(!adminLiberado)return;
  const parent=document.getElementById('adminJogos');if(!parent||document.getElementById('sportscore-panel'))return;
  const el=document.createElement('section');el.id='sportscore-panel';el.className='ss-panel';
  el.innerHTML='<h3>⚽ Placar automático · SportScore</h3><p>Cadastre os jogos normalmente. Depois escolha um jogo da rodada e a partida correspondente na fonte.</p><label>Jogo da rodada<select id="ss-game"></select></label><label>Data dos jogos<input id="ss-date" type="date"></label><button id="ss-search">Buscar partidas</button><input id="ss-filter" placeholder="Filtrar por time ou competição" aria-label="Filtrar partidas"><p id="ss-message" role="status"></p><div id="ss-results"></div><div id="ss-links"></div>';
  parent.after(el);
  el.querySelector('#ss-game').innerHTML=jogos.filter(j=>j.dbId).map(j=>`<option value="${esc(j.dbId)}">${esc(j.casa)} × ${esc(j.fora)}</option>`).join('');
  el.querySelector('#ss-date').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
  el.querySelector('#ss-search').onclick=search;
  el.querySelector('#ss-filter').oninput=renderResults;
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
  renderResults();message(`${found.length} partida(s). Confira os dois times, mando e horário antes de vincular.`);
 }catch(e){found=[];renderResults();message(e.message)}finally{b.disabled=false}}
 function renderResults(){const box=document.getElementById('ss-results');if(!box)return;box.replaceChildren();const q=document.getElementById('ss-filter').value.toLocaleLowerCase('pt-BR');
  for(const m of found.filter(m=>`${m.casa} ${m.fora} ${m.competicao}`.toLocaleLowerCase('pt-BR').includes(q))){
   const row=document.createElement('div');row.className='ss-match';const text=document.createElement('span');text.textContent=`${m.casa} × ${m.fora} · ${new Date(m.inicio).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · ${m.competicao} · ${m.status}`;
   const b=document.createElement('button');b.textContent='Vincular';b.onclick=()=>bind(m,b);row.append(text,b);box.append(row);
  }
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
