const USUARIO_ADMIN = 'HenriqueN1998';
const SENHA_ADMIN = '26549542Hn@';
let adminLiberado = sessionStorage.getItem('adminLiberado') === 'sim';
let rodada={nome:'',valor:10,status:'Aberta',criadaEm:Date.now(),premioEstimadoManual:'',dataRodada:'',horaRodada:''};
let rodadas=[];
let rodadaAtualId=null;
let pixConfig={chave:'11999999999',nome:'Galera do Palpite',msg:'Pagamento de bilhete Galera do Palpite'};
let jogos=[];
let bilhetes=[];
let ranking=[];
let historico=[];
let financeiro={entradasExtras:0,saidas:0,percentualPremio:70,transacoes:[]};
let simulacaoAtiva=false;
let simulacaoResultados={};
const palpites={};
let pixAtualCodigo=null;
let pixTimer=null;
const API_PIX_URL = (window.GDP_API_PIX_URL || window.location.origin).replace(/\/$/, '');
const SUPABASE_URL = 'https://ieqeravzlrmggsgbrskz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZP_vMzA6o9DWgFkN3P8cdg_JQ3BQD9X';

async function supabaseRequest(tabela, metodo='GET', dados=null, query=''){
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}${query}`, {
    method: metodo,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: dados ? JSON.stringify(dados) : null
  });
  const json = await resp.json().catch(() => null);
  if(!resp.ok){
    console.error('Erro Supabase:', tabela, metodo, json);
    alert(JSON.stringify(json));
    throw new Error('Falha ao acessar Supabase');
  }
  return json;
}
async function carregarRodadasSupabase(){
  try{
    const dados = await supabaseRequest('rodadas','GET',null,'?select=*&order=created_at.desc');
    const jogosBanco = await supabaseRequest('jogos','GET',null,'?select=*&order=id.asc');
    const bilhetesBanco = await supabaseRequest('bilhetes','GET',null,'?select=*&order=id.asc');
    
    rodadas = (dados || []).map(r => ({
      id: String(r.id),
      nome: r.nome,
      valor: Number(r.valor) || 10,
      status: r.status || 'Aberta',
      criadaEm: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      premioEstimadoManual: r.premio_estimado ? String(r.premio_estimado) : '',
      dataRodada: r.data_rodada || '',
      horaRodada: r.hora_rodada || '',
      pixConfig: {...pixConfig},
      jogos: (jogosBanco || [])
  .filter(j => String(j.rodada_id) === String(r.id))
  .map((j,idx) => ({
    id: idx + 1,
    dbId: j.id,
    data: j.data_jogo || '',
    casa: j.casa || '',
    fora: j.fora || '',
    logoCasa: j.logo_casa || '',
    logoFora: j.logo_fora || '',
    odds: [j.odd_casa || '1.80', j.odd_empate || '3.20', j.odd_fora || '4.20'],
    golsCasa: j.gols_casa ?? null,
    golsFora: j.gols_fora ?? null
    
})),
      bilhetes: (bilhetesBanco || [])
  .filter(b => String(b.rodada_id) === String(r.id))
  .map(b => ({
    codigo: b.codigo,
    nome: b.nome,
    tel: b.telefone,
    rodadaId: String(b.rodada_id),
    rodadaNome: r.nome,
    status: b.status || 'Aguardando Pix',
    valor: Number(b.valor) || 0,
    pontos: Number(b.acertos) || 0,
    acertos: Number(b.acertos) || 0,
    palpites: b.palpites || {},
    combinacoes: b.combinacoes || [],
    data: b.created_at ? new Date(b.created_at).toLocaleString('pt-BR') : ''
  })),
      ranking: [],
      financeiro:{entradasExtras:0,saidas:0,percentualPremio:70,transacoes:[]}
    }));

    rodadaAtualId = rodadas[0]?.id || null;

    if(rodadas.length){
      aplicarRodada(rodadas[0]);
    }else{
      jogos=[];
      bilhetes=[];
      ranking=[];
    }

    renderRodadas();
    renderTicket();
    if(adminLiberado) renderAdmin();

  }catch(e){
    console.error('Erro ao carregar rodadas do Supabase:', e);
  }
  }
function novaRodadaBase(nome='Nova Rodada', valor=10, status='Aberta', premioEstimadoManual='', dataRodada='', horaRodada=''){
  const dh=extrairDataHoraJogos(jogos);
  return {
    id:'ROD-'+Date.now()+'-'+Math.floor(Math.random()*9999),
    nome,
    valor:Number(valor)||10,
    status,
    criadaEm:Date.now(),
    premioEstimadoManual:premioEstimadoManual||'',
    dataRodada:dataRodada||dh.data||'26/05/2026',
    horaRodada:horaRodada||dh.hora||'21:30',
    pixConfig:{...pixConfig},
    jogos:JSON.parse(JSON.stringify(jogos)),
    bilhetes:[],
    ranking:[],
    financeiro:{entradasExtras:0,saidas:0,percentualPremio:70,transacoes:[]}
  };
}
function sincronizarRodadaAtual(){
  const r=rodadas.find(x=>x.id===rodadaAtualId);
  if(!r) return;
  r.nome=rodada.nome;
  r.valor=rodada.valor;
  r.status=rodada.status;
  r.premioEstimadoManual=rodada.premioEstimadoManual||'';
  r.dataRodada=rodada.dataRodada||'';
  r.horaRodada=rodada.horaRodada||'';
  r.pixConfig=pixConfig;
  r.jogos=jogos;
  r.bilhetes=bilhetes;
  r.ranking=ranking;
  r.financeiro=financeiro;
}
function aplicarRodada(r){
  if(!r) return;
  rodadaAtualId=r.id;
  { const dh=extrairDataHoraJogos(r.jogos||jogos); rodada={nome:r.nome,valor:Number(r.valor)||10,status:r.status||'Aberta',criadaEm:r.criadaEm||Date.now(),premioEstimadoManual:r.premioEstimadoManual||'',dataRodada:r.dataRodada||dh.data||'26/05/2026',horaRodada:r.horaRodada||dh.hora||'21:30'}; }
  pixConfig=r.pixConfig||pixConfig;
  jogos=r.jogos||[];
  bilhetes=r.bilhetes||[];
  ranking=r.ranking||[];
  financeiro=r.financeiro||{entradasExtras:0,saidas:0,percentualPremio:70,transacoes:[]};
  Object.keys(palpites).forEach(k=>delete palpites[k]);
  simulacaoAtiva=false;
  simulacaoResultados={};
}
function selecionarRodada(id){
  sincronizarRodadaAtual();
  const r=rodadas.find(x=>x.id===id);
  if(!r) return;
  aplicarRodada(r);
  salvarDados(false);
  renderRodadas();
  renderTicket();
  renderAdmin();
}
function carregarDados(){
  const raw=localStorage.getItem('gdp_dados_v6') || localStorage.getItem('gdp_dados_v5');
  if(raw){
    try{
      const d=JSON.parse(raw);
      historico=d.historico||[];
      if(Array.isArray(d.rodadas) && d.rodadas.length){
        rodadas=d.rodadas;
        rodadaAtualId=d.rodadaAtualId || rodadas[0].id;
        aplicarRodada(rodadas.find(r=>r.id===rodadaAtualId)||rodadas[0]);
        return;
      }
      rodada=d.rodada||rodada; rodada.premioEstimadoManual=rodada.premioEstimadoManual||''; { const dh=extrairDataHoraJogos(d.jogos||jogos); rodada.dataRodada=rodada.dataRodada||dh.data||'26/05/2026'; rodada.horaRodada=rodada.horaRodada||dh.hora||'21:30'; } pixConfig=d.pixConfig||pixConfig; jogos=d.jogos||jogos; bilhetes=d.bilhetes||[]; ranking=d.ranking||[]; financeiro=d.financeiro||financeiro;
    }catch(e){console.warn('Falha ao carregar dados',e)}
  }
  rodadas=[];
rodadaAtualId=null;
jogos=[];
bilhetes=[];
ranking=[];
salvarDados(false);
return;
}
async function salvarDados(sync=true){
  if(sync) sincronizarRodadaAtual();

  localStorage.setItem('gdp_dados_v6', JSON.stringify({rodadas,rodadaAtualId,historico}));

  try {
    const rodada = rodadas.find(r => r.id === rodadaAtualId);
    if (!rodada) return;

    const respRodada = await fetch(`${API_PIX_URL}/api/rodadas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: rodada.nome,
        status: rodada.status || 'Aberta',
        valor: Number(rodada.valor || 10),
        dataRodada: rodada.dataRodada || '',
        horaRodada: rodada.horaRodada || '',
        premioEstimadoManual: rodada.premioEstimadoManual || ''
      })
    });

    const rodadaSalva = await respRodada.json();

    for (const jogo of (rodada.jogos || [])) {
      await fetch(`${API_PIX_URL}/api/jogos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rodadaId: rodadaSalva._id,
          rodadaNome: rodada.nome,
          casa: jogo.casa,
          fora: jogo.fora,
          logo_casa: jogo.logoCasa || jogo.logo_casa || '',
          logo_fora: jogo.logoFora || jogo.logo_fora || '',
          data_jogo: jogo.data_jogo || jogo.dataJogo || '',
          gols_casa: jogo.gols_casa ?? null,
          gols_fora: jogo.gols_fora ?? null
        })
      });
    }

    console.log('RODADA E JOGOS SALVOS NO MONGO:', rodada.nome);
  } catch (e) {
    console.warn('Erro ao salvar rodada/jogos no Mongo:', e);
  }
}
function mostrarTela(id, salvarHistorico = true){
  document.querySelectorAll('.tela').forEach(t=>t.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');

  if(salvarHistorico && location.hash !== '#' + id){
    history.pushState({ tela: id }, '', '#' + id);
  }

  if(id==='admin'){verificarAdmin(); if(adminLiberado) renderAdmin();}
  if(id==='buscar') buscarBilhete();
  if(id==='mercado') renderMercadoInicial();
  if(id==='ranking') renderRankingPublico();
  if(id==='historico') renderHistorico();
}
window.addEventListener('popstate', () => {
  const tela = location.hash.replace('#', '') || 'inicio';
  mostrarTela(tela, false);
});
function verificarAdmin(){
  const login=document.getElementById('adminLogin'), conteudo=document.getElementById('adminConteudo'); if(!login||!conteudo)return;
  if(adminLiberado){login.style.display='none';conteudo.classList.add('liberado')} else{login.style.display='block';conteudo.classList.remove('liberado')}
}
function entrarAdmin(){
  const usuario=document.getElementById('usuarioAdmin').value.trim();
  const senha=document.getElementById('senhaAdmin').value;
  const erro=document.getElementById('erroAdmin');
  if(usuario===USUARIO_ADMIN && senha===SENHA_ADMIN){adminLiberado=true;sessionStorage.setItem('adminLiberado','sim');erro.textContent='';verificarAdmin();renderAdmin()} else erro.textContent='Usuário ou senha incorretos.';
}
function sairAdmin(){adminLiberado=false;sessionStorage.removeItem('adminLiberado');document.getElementById('senhaAdmin').value='';document.getElementById('usuarioAdmin').value=USUARIO_ADMIN;verificarAdmin()}
function abrirBilhete(){if(rodada.status!=='Aberta'){alert('Rodada encerrada.');return}document.getElementById('pixBox').classList.remove('show');document.getElementById('overlay').classList.add('active')}
function fecharFora(e){if(e.target.id==='overlay')e.target.classList.remove('active')}
function escudo(nome){
  const base=(nome||'TIME').replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ]/gi,' ').trim();
  const sigla=base.split(/\s|-/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'FC';
  return `<span class="team-crest">${sigla}</span>`;
}
function extrairDataHoraJogos(lista=[]){
  const primeira=(lista[0]&&lista[0].data)||'';
  const m=primeira.match(/(\d{2}\/\d{2})(?:\/(\d{4}))?\s*(\d{2}:\d{2})/);
  if(!m) return {data:'',hora:''};
  const ano=m[2]||new Date().getFullYear();
  return {data:`${m[1]}/${ano}`,hora:m[3]};
}
function dataHoraRodada(r=null){
  const alvo=r||rodada;
  const dh=extrairDataHoraJogos(alvo?.jogos||jogos);
  const data=alvo?.dataRodada||dh.data||'26/05/2026';
  const hora=alvo?.horaRodada||dh.hora||'21:30';
  return `${data} • ${hora}`;
}
function premioEstimadoRodada(r=null){
  const alvo=r||rodada;
  const manual=Number(String(alvo?.premioEstimadoManual||'').replace(',','.'));
  if(manual>0) return manual.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const listaBilhetes=r?.bilhetes||bilhetes;
  const fin=r?.financeiro||financeiro;
  const pagos=listaBilhetes.filter(b=>b.status==='Pago').reduce((s,b)=>s+(Number(b.valor)||0),0);
  const perc=Number(fin?.percentualPremio ?? 70);
  const estimado=pagos>0 ? pagos*(perc/100) : 0;
  return estimado.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function renderRodadas(){
  sincronizarRodadaAtual();
  const ordenadas=[...rodadas].sort((a,b)=>(b.criadaEm||0)-(a.criadaEm||0));
  const el=document.getElementById('listaRodadas');
  if(!el) return;
  if(!rodadas.length){
  el.innerHTML='<p style="text-align:center;color:#9eb6a5;font-weight:900;">Nenhum bolão disponível no momento.</p>';
  return;
}
  el.innerHTML=ordenadas.map(r=>{
    const qtd=(r.jogos||[]).length;
    const valor=Number(r.valor||10).toFixed(2).replace('.',',');
    const aberta=(r.status||'Aberta')==='Aberta';
    const premio=premioEstimadoRodada(r);
    return `<div class="rodada-card premium-card ${aberta?'rodada-aberta':'rodada-fechada'} ${r.id===rodadaAtualId?'rodada-atual':''}">
      <div class="status-bolinha ${aberta?'verde':'vermelha'}" title="${aberta?'Aberta para palpites':'Fechada para palpites'}"></div>
      <div class="gdp-card-logo"><img src="logo-galera-do-palpite.png" alt="Galera do Palpite"></div>
      <div class="rodada-data">🗓️ ${dataHoraRodada(r)}</div>
      <span class="live-badge small">${aberta?'Aberta para palpites':'Fechada para palpites'}</span>
      <h3>${r.nome}</h3>
      <p>${qtd} jogos obrigatórios • Cartela R$ ${valor}</p>
      <div class="premio-estimado">PRÊMIO ESTIMADO: ${premio}</div>
      ${aberta
        ? `<button onclick="selecionarRodada('${r.id}');abrirBilhete()">🎟️ Palpitar agora</button>`
        : `<button class="btn-ranking-publico" onclick="verRankingRodada('${r.id}')">🏆 Ver ranking</button>`}
    </div>`
  }).join('')
}



function getPalpiteArray(id){
  const atual=palpites[id];
  if(Array.isArray(atual)) return atual;
  if(atual) return [atual];
  return [];
}
function totalCombinacoes(){
  let total=1, secos=0, duplos=0, triplos=0, feitos=0;
  jogos.forEach(j=>{
    const qtd=getPalpiteArray(j.id).length;
    if(qtd>0) feitos++;
    if(qtd===1) secos++;
    if(qtd===2){duplos++; total*=2;}
    if(qtd===3){triplos++; total*=3;}
  });
  return {total,secos,duplos,triplos,feitos};
}
function renderTicket(){
  document.getElementById('totalObrigatorios').textContent=jogos.length;
  document.getElementById('ticketList').innerHTML=jogos.map(j=>{
    const sel=getPalpiteArray(j.id);
    return `<div class="jogo"><div class="numero">${j.id}</div><div class="linha-jogo"><div class="info">🔍 ${j.data}</div><button class="opcao time-casa ${sel.includes('casa')?'active':''}" onclick="marcar(${j.id},'casa',this)">${timeComLogo(j.casa, j.logoCasa)}</button><button class="opcao empate ${sel.includes('empate')?'active':''}" onclick="marcar(${j.id},'empate',this)">EMPATE</button><button class="opcao time-fora ${sel.includes('fora')?'active':''}" onclick="marcar(${j.id},'fora',this)">${timeComLogo(j.fora, j.logoFora)}</button></div></div>`
  }).join('');
  atualizar();
}
function marcar(id,tipo,btn){
  const msg=document.getElementById('mensagem');
  if(msg) msg.textContent='';
  let arr=getPalpiteArray(id);
  if(arr.includes(tipo)){
    arr=arr.filter(x=>x!==tipo);
  }else{
    const tentativa=[...arr,tipo];
    const backup=palpites[id];
    palpites[id]=tentativa;
    const calc=totalCombinacoes();
    if(calc.total>256){
      palpites[id]=backup;
      if(msg){msg.style.color='#c98900';msg.textContent='⚠️ Limite máximo de 256 bilhetes por aposta atingido.';}
      return;
    }
    arr=tentativa;
  }
  if(arr.length) palpites[id]=arr; else delete palpites[id];
  renderTicket();
}
function atualizar(){
  const c=totalCombinacoes();
  document.getElementById('totalFeitos').textContent=c.feitos;
  document.getElementById('secos').textContent=c.secos;
  const d=document.getElementById('duplos'); if(d) d.textContent=c.duplos;
  const t=document.getElementById('triplos'); if(t) t.textContent=c.triplos;
  const e=document.getElementById('equivalenteBilhetes'); if(e) e.textContent=c.total;
  document.getElementById('valorTotal').textContent=(c.total*rodada.valor).toFixed(2).replace('.',',')+' R$';
  document.getElementById('cartBadge').textContent=c.feitos;
}
function gerarCombinacoes(){
  let combos=[{}];
  jogos.forEach(j=>{
    const opcoes=getPalpiteArray(j.id);
    const novas=[];
    combos.forEach(base=>opcoes.forEach(op=>novas.push({...base,[j.id]:op})));
    combos=novas;
  });
  return combos;
}
function limparPalpites(){Object.keys(palpites).forEach(k=>delete palpites[k]);renderTicket();document.getElementById('mensagem').textContent=''}
function voltarInicioPalpite(){
    limparPalpites();
    mostrarTela('inicio');
    fecharFora({target: document.getElementById('overlay')});
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}
async function confirmarAposta(){
  const msg=document.getElementById('mensagem');
  const c=totalCombinacoes();
  if(c.feitos<jogos.length){msg.style.color='#c98900';msg.textContent=`Faltam ${jogos.length-c.feitos} jogo(s) para marcar.`;return}
  if(c.total>256){msg.style.color='#c98900';msg.textContent='⚠️ Limite máximo de 256 bilhetes por aposta atingido.';return}
  const nome=document.getElementById('nome').value.trim(), tel=document.getElementById('telefone').value.trim(); if(!nome||!tel){msg.style.color='#c98900';msg.textContent='Preencha nome e telefone.';return}
  let codigo = null;
  const valorTotal=c.total*rodada.valor;
const palpitesSeguro = JSON.parse(JSON.stringify(palpites || {}));
const combinacoesSeguro = JSON.parse(JSON.stringify(c.combos || c.combinacoes || []));
codigo = `GDP-${Date.now()}`;
pixAtualCodigo = codigo;

  await supabaseRequest('bilhetes','POST',{
  codigo: codigo,
  nome: nome,
  telefone: tel,
  rodada_id: Number(String(rodada._id || rodada.id || rodadaAtualId).replace(/\D/g,'')),
  status: 'Pendente',
  valor: valorTotal,
  acertos: 0,
  palpites: palpitesSeguro,
  combinacoes: combinacoesSeguro
});

salvarDados();

msg.style.color='#108000';
msg.textContent='Aposta confirmada!';

pixAtualCodigo = codigo;
mostrarPix(codigo,nome,tel,valorTotal);
  
}

async function salvarRodada(){
  rodada.nome = document.getElementById('rodadaNome').value || rodada.nome;
  rodada.valor = Number(document.getElementById('rodadaValor').value) || rodada.valor || 10;
  rodada.status = document.getElementById('rodadaStatus').value;
  rodada.premioEstimadoManual = document.getElementById('rodadaPremioEstimado')?.value || '';
  rodada.dataRodada = (document.getElementById('rodadaData')?.value || rodada.dataRodada || '').trim();
  rodada.horaRodada = (document.getElementById('rodadaHora')?.value || rodada.horaRodada || '').trim();

  if(!rodadaAtualId){
  alert('Nenhuma rodada selecionada');
  return;
}
  const { error } = await supabaseRequest(
    `rodadas?id=eq.${rodadaAtualId}`,
    'PATCH',
    {
      nome: rodada.nome,
      valor: rodada.valor,
      status: rodada.status,
      premio_estimado: rodada.premioEstimadoManual === ''
    ? null
    : Number(rodada.premioEstimadoManual),
    data_rodada: rodada.dataRodada,
    hora_rodada: rodada.horaRodada
    }
  );

  if(error){
    alert('Erro ao salvar rodada: ' + error.message);
    return;
  }

  await carregarSupabase();
  renderRodadas();
  renderTicket();
  renderAdmin();
  alert('Rodada atualizada!');
}
async function criarNovaRodadaAdmin(){
  sincronizarRodadaAtual();

  const nome=(document.getElementById('novaRodadaNome')?.value||'Nova rodada').trim();
  const valor=Number(document.getElementById('novaRodadaValor')?.value||10)||10;
  const premio=document.getElementById('novaRodadaPremio')?.value||'';
  const data=(document.getElementById('novaRodadaData')?.value||'').trim();
  const hora=(document.getElementById('novaRodadaHora')?.value||'').trim();

  try{
    const salvo = await supabaseRequest('rodadas','POST',{
      nome:nome,
      valor:valor,
      status:'Aberta',
      data_rodada:data,
      hora_rodada:hora,
      premio_estimado:Number(String(premio||0).replace(',','.'))||0
    });

    const r=novaRodadaBase(nome,valor,'Aberta',premio,data,hora);
    r.id=String(salvo[0].id);
    r.jogos=[];

    rodadas.unshift(r);
    aplicarRodada(r);

    salvarDados();
    renderRodadas();
    renderTicket();
    renderAdmin();

    alert('Nova rodada criada e salva no Supabase!');
  }catch(e){
    console.error(e);
    alert('Erro ao salvar rodada no Supabase. Confira a Publishable Key.');
  }
}
async function fecharRodadaAtual(){
  if(!rodadaAtualId) return;
  rodada.status='Encerrada';

  await supabaseRequest(
    'rodadas',
    'PATCH',
    { status:'Encerrada' },
    '?id=eq.'+Number(String(rodadaAtualId).replace(/\D/g,''))
  );

  salvarDados(false);
  renderRodadas();
  renderAdmin();
}
async function abrirRodadaAtual(){
  if(!rodadaAtualId) return;
  rodada.status='Aberta';

  await supabaseRequest(
    'rodadas',
    'PATCH',
    { status:'Aberta' },
    '?id=eq.'+Number(String(rodadaAtualId).replace(/\D/g,''))
  );

  salvarDados(false);
  renderRodadas();
  renderAdmin();
}

async function adicionarJogoAdmin(){
  const casa=document.getElementById('jogoCasa').value.trim();
  const fora=document.getElementById('jogoFora').value.trim();
  const logoCasa=document.getElementById('jogoLogoCasa')?.value.trim() || '';
  const logoFora=document.getElementById('jogoLogoFora')?.value.trim() || '';
  const dataBase=document.getElementById('jogoData').value.trim();
  const select=document.getElementById('jogoRodadaSelect');
  const alvoId=(select&&select.value)||rodadaAtualId;
  if(!casa||!fora) return alert('Preencha os times.');
  const r=rodadas.find(x=>x.id===alvoId);
  if(!r) return alert('Escolha uma competição/rodada válida.');
  const nomeRodada=(r.nome||'').trim();
  const data=dataBase ? `${dataBase} - ${nomeRodada}` : `${r.dataRodada||''} ${r.horaRodada||''} - ${nomeRodada}`.trim();
  const novo={id:(r.jogos||[]).length+1,data,casa,fora,logoCasa,logoFora,odds:['1.80','3.20','4.20'],golsCasa:null,golsFora:null};
  await supabaseRequest('jogos','POST',{
  rodada_id: Number(String(alvoId).replace(/\D/g,'')),
  casa: casa,
  fora: fora,
  logo_casa: logoCasa,
  logo_fora: logoFora,
  data_jogo: data,
  gols_casa: null,
  gols_fora: null
});
  r.jogos=r.jogos||[];
  r.jogos.push(novo);
  if(r.id===rodadaAtualId){ aplicarRodada(r); }
  salvarDados(false);
  document.getElementById('jogoCasa').value='';
  document.getElementById('jogoFora').value='';
  renderRodadas();renderTicket();renderAdmin();
  alert('Jogo adicionado na rodada: '+r.nome);
}
function excluirJogo(id){jogos=jogos.filter(j=>j.id!==id).map((j,i)=>({...j,id:i+1}));delete palpites[id];salvarDados();renderRodadas();renderTicket();renderAdmin()}
async function confirmarPagamento(cod, origem='manual', abrirBilheteDepois=false){
  let b=bilhetes.find(x=>String(x.codigo)===String(cod));

if(!b){
  b=todosBilhetesSistema().find(x=>String(x.codigo)===String(cod));
}

if(!b){
  const resp = await supabaseRequest('bilhetes','PATCH',{
  status:'Pago',
  acertos:0
},'?codigo=eq.'+encodeURIComponent(cod));

console.log('PATCH retorno:', resp);
console.log('Atualizando bilhete:', cod);

  await carregarRodadasSupabase();
  renderAdmin();
  buscarBilhete();
  renderRodadas();
  renderRankingPublico();
  return;
}
  if(b.status==='Pago'){
    salvarDados(); renderAdmin(); buscarBilhete();
    if(abrirBilheteDepois) imprimirBilhete(cod);
    return;
  }
  b.status='Pago';
  b.pagoEm=new Date().toLocaleString('pt-BR');
  b.pagamentoOrigem=origem;
 const resp = await supabaseRequest('bilhetes','PATCH',{
  status:'Pago',
  acertos:Number(b.acertos) || 0
}, '?codigo=eq.'+encodeURIComponent(cod));

console.log('PATCH retorno:', resp);
console.log('Atualizando bilhete:', cod);
  financeiro.transacoes.unshift({tipo:'Entrada',desc:(origem==='webhook'?'Pix automático recebido ':'Pagamento confirmado ')+cod,valor:Number(b.valor)||0,data:new Date().toLocaleString('pt-BR')});
  salvarDados();renderAdmin();buscarBilhete();renderRodadas();renderRankingPublico();
  if(abrirBilheteDepois) imprimirBilhete(cod);
}
function confirmarPagamentoManual(cod){
  if(confirm('Confirmar pagamento manual deste bilhete?')) confirmarPagamento(cod,'manual',true);
}
async function criarPixMercadoPago(codigo,nome,tel,valorPix){
  const resp=await fetch(`${API_PIX_URL}/api/pix/criar`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      codigo,
      nome,
      telefone:tel,
      valor:Number(valorPix)||Number(rodada.valor)||10,
      rodadaId:rodadaAtualId,
      rodadaNome:rodada.nome
    })
  });
  const data=await resp.json().catch(()=>({}));
  if(!resp.ok || !data.ok) throw new Error(data.error||'Falha ao gerar Pix real.');
  return data;
}
async function consultarPixReal(cod,abrirDepois=false){
  const status=document.getElementById('pixStatus');
  const btn=document.getElementById('pixAutoBtn');
  if(btn) btn.disabled=true;
  try{
    if(status) status.innerHTML='<b>🔄 Consultando pagamento no Mercado Pago...</b><span>Aguardando retorno automático.</span>';
    const resp=await fetch(`${API_PIX_URL}/api/pix/status/${encodeURIComponent(cod)}`);
    const data=await resp.json().catch(()=>({}));
    if(data.status==='approved' || data.status==='paid'){
      await confirmarPagamento(cod,'webhook',false);
      if(status) status.innerHTML='<b>✅ Pagamento aprovado automaticamente</b><span>Bilhete ativo no ranking. O comprovante amarelo já foi liberado.</span>';
      const ticketBtn=document.getElementById('pixTicketBtn');
      if(ticketBtn) ticketBtn.style.display='block';
      const modalMsg=document.getElementById('mensagem');
      if(modalMsg){modalMsg.style.color='#00e676';modalMsg.textContent='Pagamento aprovado! Seu bilhete já está concorrendo.';}
      if(abrirDepois) imprimirBilhete(cod);
      return true;
    }
    if(status) status.innerHTML='<b>⏳ Aguardando pagamento Pix</b><span>Ainda não consta aprovado. O sistema verifica sozinho em alguns segundos.</span>';
    return false;
  }catch(e){
    if(status) status.innerHTML='<b>⚠️ Backend Pix não conectado</b><span>Abra pelo servidor Node e configure o Access Token do Mercado Pago.</span>';
    console.warn(e);
    return false;
  }finally{
    if(btn) btn.disabled=false;
  }
}
function iniciarMonitoramentoPix(cod){
  if(pixTimer) clearInterval(pixTimer);

  pixTimer = setInterval(async () => {
    const ok = await consultarPixReal(cod, false);
    if(ok) clearInterval(pixTimer);
  }, 5000);
}
function simularWebhookPix(cod){
  consultarPixReal(cod,false);
}
function abrirBilhetePagoAtual(){
  if(pixAtualCodigo) imprimirBilhete(pixAtualCodigo);
}

function salvarPixAdmin(){pixConfig.chave=document.getElementById('pixChave').value.trim()||pixConfig.chave;pixConfig.nome=document.getElementById('pixNome').value.trim()||pixConfig.nome;pixConfig.msg=document.getElementById('pixMsg').value.trim()||pixConfig.msg;salvarDados();alert('Configuração Pix salva!')}
function carregarPixAdmin(){if(document.getElementById('pixChave')){document.getElementById('pixChave').value=pixConfig.chave;document.getElementById('pixNome').value=pixConfig.nome;document.getElementById('pixMsg').value=pixConfig.msg;}}

function emv(id,valor){const v=String(valor);return id+String(v.length).padStart(2,'0')+v}
function crc16(payload){let crc=0xFFFF;for(let i=0;i<payload.length;i++){crc^=payload.charCodeAt(i)<<8;for(let j=0;j<8;j++){crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xFFFF;}}return crc.toString(16).toUpperCase().padStart(4,'0')}
function gerarPixCopiaCola({chave,nome,cidade,valor,txid,descricao}){
  const merchantAccount=emv('00','BR.GOV.BCB.PIX')+emv('01',chave)+emv('02',descricao.slice(0,72));
  const payloadSemCRC=emv('00','01')+emv('26',merchantAccount)+emv('52','0000')+emv('53','986')+emv('54',Number(valor).toFixed(2))+emv('58','BR')+emv('59',nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,25).toUpperCase())+emv('60',cidade.normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,15).toUpperCase())+emv('62',emv('05',txid.slice(0,25)))+'6304';
  return payloadSemCRC+crc16(payloadSemCRC);
}
async function mostrarPix(codigo,nome,tel,valorPix=rodada.valor){
  pixAtualCodigo=codigo;
  const status=document.getElementById('pixStatus');
  const btn=document.getElementById('pixAutoBtn');
  const ticketBtn=document.getElementById('pixTicketBtn');
  if(status) status.innerHTML='<b>🔄 Gerando Pix real...</b><span>Conectando ao Mercado Pago.</span>';
  if(btn){btn.disabled=true;btn.textContent='Verificar pagamento';btn.onclick=()=>consultarPixReal(codigo,false);}
  if(ticketBtn){ticketBtn.style.display='none';ticketBtn.onclick=abrirBilhetePagoAtual;}
  const box=document.getElementById('pixBox');
  box.classList.add('show');
  const msg=encodeURIComponent(`Olá! Fiz o bilhete ${codigo} no Galera do Palpite e estou com dúvida no pagamento Pix.`);
  document.getElementById('whatsComprovante').href=`https://wa.me/559985114440?text=${msg}`;
  try{
    const data=await criarPixMercadoPago(codigo,nome,tel,valorPix);
    if(data.codigo) codigo = data.codigo;
    const msg = document.getElementById('mensagem');
if (msg) msg.textContent = `Aposta confirmada! Código do bilhete: ${codigo}. Agora faça o Pix.`;
    const bLocal = bilhetes.find(x => x.codigo === null || x.codigo === undefined || x.codigo === '');
if (bLocal) {
  bLocal.codigo = codigo;
  bLocal.payment_id = data.payment_id;
  bLocal.external_reference = data.external_reference;
  bLocal.status = 'Aguardando Pix';
  bLocal.valor = valorPix;
  salvarDados();
}
    pixAtualCodigo = codigo;
    document.getElementById('pixCopia').value=data.pix_copia_cola||'';
    const qr=document.getElementById('pixQrImg');
    if(qr){qr.src=data.qr_base64 ? `data:image/png;base64,${data.qr_base64}` : `https://quickchart.io/qr?text=${encodeURIComponent(data.pix_copia_cola||'')}&size=240&margin=2`;}
    const b=bilhetes.find(x=>x.codigo===codigo);
    if(b){b.payment_id=data.payment_id;b.external_reference=data.external_reference;salvarDados();}
    if(status) status.innerHTML='<b>⏳ Aguardando pagamento Pix</b><span>Assim que pagar, o Mercado Pago avisa o sistema e o bilhete libera automaticamente.</span>';
    if(btn) btn.disabled=false;
    iniciarMonitoramentoPix(codigo);
  }catch(e){
    console.warn(e);
    const texto=gerarPixCopiaCola({chave:pixConfig.chave,nome:pixConfig.nome,cidade:'RIO DE JANEIRO',valor:valorPix,txid:codigo.replace(/[^A-Za-z0-9]/g,''),descricao:pixConfig.msg});
    document.getElementById('pixCopia').value=texto;
    const qr=document.getElementById('pixQrImg');
    if(qr){qr.src=`https://quickchart.io/qr?text=${encodeURIComponent(texto)}&size=240&margin=2`;}
    if(status) status.innerHTML='<b>⚠️ Pix real ainda não conectado</b><span>Use o servidor Node com MERCADO_PAGO_ACCESS_TOKEN. Este QR é apenas Pix copia e cola sem confirmação automática.</span>';
    if(btn) btn.disabled=false;
  }
}
function copiarPix(){const campo=document.getElementById('pixCopia');campo.select();document.execCommand('copy');alert('Pix copiado!')}
function resultadoJogo(j){
  if(!j || j.golsCasa===null || j.golsFora===null || j.golsCasa==='' || j.golsFora==='' || typeof j.golsCasa==='undefined' || typeof j.golsFora==='undefined') return null;
  const casa = Number(j.golsCasa);
  const fora = Number(j.golsFora);
  if(Number.isNaN(casa) || Number.isNaN(fora)) return null;
  if(casa > fora) return 'casa';
  if(casa < fora) return 'fora';
  return 'empate';
}
function normalizarOpcaoPalpite(op){
  if(op===null || typeof op==='undefined') return '';
  const v=String(op).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(['casa','mandante','home','1'].includes(v)) return 'casa';
  if(['empate','meio','x','draw','0'].includes(v)) return 'empate';
  if(['fora','visitante','away','2'].includes(v)) return 'fora';
  return v;
}
function listaPalpitesNormalizada(p){
  const arr=Array.isArray(p)?p:(p?[p]:[]);
  return arr.map(normalizarOpcaoPalpite).filter(Boolean);
}
function palpiteAcertou(palpite,resultado){
  const res=normalizarOpcaoPalpite(resultado);
  if(!res) return false;
  return listaPalpitesNormalizada(palpite).includes(res);
}

function resultadoJogoSimulado(j){
  const real=resultadoJogo(j);
  if(real) return real;
  if(simulacaoAtiva && simulacaoResultados[j.id]) return simulacaoResultados[j.id];
  return null;
}
function iniciarSimulacaoRanking(){
    simulacaoAtiva = true;
    renderRankingPublico();
}
function cancelarSimulacaoRanking(){
  simulacaoAtiva=false;
  simulacaoResultados={};
  renderRankingPublico();
}
function confirmarSimulacaoRanking(){
  // Simulação é somente visual/temporária para o cliente testar cenários.
  // Não grava placar, não encerra jogos, não recalcula ranking oficial e não altera histórico.
  if(!simulacaoAtiva) return;
  renderRankingPublico();
}
function alterarSimulacaoResultado(id,valor){
  if(!simulacaoAtiva) return;
  const j=jogos.find(x=>String(x.id)===String(id));
  if(!j || resultadoJogo(j)) return;
  simulacaoResultados[id]=valor;
  renderRankingPublico();
}
function gerarBilhetesRanking(listaBase=bilhetes, usarSimulacao=false){
  const entradas=[];
  listaBase.filter(b=>b.status==='Pago').forEach(b=>{
    let pts=0;
    jogos.forEach(j=>{
      const r=usarSimulacao?resultadoJogoSimulado(j):resultadoJogo(j);
      const p=b.palpites?.[j.id];
      if(r && palpiteAcertou(p,r)) pts++;
    });
    entradas.push({
      ...b,
      codigoOriginal:b.codigo,
      codigoExibicao:b.codigo,
      comboRanking:null,
      combinacaoNumero:1,
      totalCombinacoesRanking:1,
      pontos:pts,
      acertos:pts
    });
  });
  return entradas.sort((a,b)=>b.pontos-a.pontos||b.acertos-a.acertos||String(a.codigo).localeCompare(String(b.codigo)));
}
function rankingComResultadosSimulados(){
  return gerarBilhetesRanking(bilhetes,true);
}

function setResultado(id,campo,valor){
  const j=jogos.find(x=>x.id===id); 
  if(!j)return; 
  j[campo]=valor===''?null:Number(valor);
  const linha=document.getElementById('jogoAdminLinha'+id);
  if(linha) linha.classList.add('resultado-pendente');
  const status=document.getElementById('statusResultado'+id);
  if(status){status.textContent='Não salvo';status.className='status-resultado pendente';}
}
async function salvarResultadoJogo(id){
  const j = jogos.find(x => String(x.id) === String(id));
  if(!j) return;

  const golsCasa = Number(j.golsCasa ?? 0);
  const golsFora = Number(j.golsFora ?? 0);

  const { error } = await supabaseRequest(
    `jogos?id=eq.${j.dbId}`,
    'PATCH',
    {
      gols_casa: golsCasa,
      gols_fora: golsFora,
    },
  );

  if(error){
    alert('Erro ao salvar resultado: ' + error.message);
    return;
  }

  j.golsCasa = golsCasa;
  j.golsFora = golsFora;

  ranking = calcularRankingParcial();

  const status = document.getElementById('statusResultado' + id);
  if(status){
    status.textContent = 'Salvo';
    status.className = 'status-resultado salvo';
  }

  await carregarSupabase();
  renderAdmin();
  renderRankingPublico();
}
async function salvarTodosResultados(){
  for(const j of jogos){
    if(j.golsCasa !== undefined && j.golsCasa !== '' && j.golsFora !== undefined && j.golsFora !== ''){
      await salvarResultadoJogo(j.id);
    }
  }

  ranking = calcularRankingParcial();
  renderAdmin();
  renderRankingPublico();

  alert('Resultados salvos no Supabase!');
}

async function calcularRanking(){
  const faltam=jogos.filter(j=>resultadoJogo(j)===null).length;
  if(faltam>0 && !confirm(`Ainda faltam ${faltam} resultado(s). Calcular ranking parcial mesmo assim?`)) return;
  ranking=calcularRankingParcial();

await supabaseRequest('ranking','DELETE',null,'?id=gte.0');

for(const item of ranking){
  await supabaseRequest('ranking','POST',{
    nome: item.nome || '',
    pontos: Number(item.pontos) || 0,
    bilhetes: Number(item.totalBilhetes) || 1
  });
}

salvarDados();
renderAdmin();
renderRankingPublico();
alert('Ranking calculado e salvo no Supabase!');
}

function calcularRankingParcial(){
  const todosBilhetes = todosBilhetesSistema();
const lista=gerarBilhetesRanking(todosBilhetes.filter(b=>bilhetePago(b)),false);

todosBilhetes.forEach(b=>{
    const doBilhete=lista.filter(x=>x.codigoOriginal===b.codigo);
    const melhor=doBilhete.length?Math.max(...doBilhete.map(x=>Number(x.pontos||0))):0;
    b.pontos=melhor;
    b.acertos=melhor;
  });
  return lista;
}
function campeaoJaSalvo(id=rodadaAtualId){
  return historico.some(h=>h.rodadaId===id);
}
function salvarCampeaoHistorico(silencioso=false){
  if(!ranking.length){if(!silencioso) alert('Calcule o ranking antes.'); return false;}
  if(campeaoJaSalvo()){if(!silencioso) alert('Campeão desta rodada já está salvo no histórico.'); return true;}
  const maior=ranking[0].pontos;
  const vencedores=ranking.filter(x=>x.pontos===maior);
  historico.unshift({rodadaId:rodadaAtualId,rodada:rodada.nome,nome:vencedores.map(v=>v.nome).join(' / '),pontos:maior,acertos:maior,data:new Date().toLocaleDateString('pt-BR'),divisao:vencedores.length});
  salvarDados(); renderHistorico();
  if(!silencioso) alert(`Campeão salvo: ${vencedores.map(v=>v.nome).join(' / ')}${vencedores.length>1?' - prêmio dividido':''}`);
  return true;
}
async function apagarRodadaAtual(){
  if(!rodadaAtualId) return;
  if(rodadas.length<=1){alert('Você precisa ter pelo menos uma rodada ativa no sistema. Crie uma nova antes de apagar esta.');return;}
  const temRanking=ranking && ranking.length>0;
  const campeaoSalvo=campeaoJaSalvo();
  let aviso=`Apagar a rodada "${rodada.nome}"?\n\nEla vai sair dos bolões disponíveis e do Admin.`;
  if(temRanking && !campeaoSalvo) aviso+='\n\nO campeão será salvo automaticamente no histórico antes de apagar.';
  if(!temRanking) aviso+='\n\nAtenção: esta rodada não tem ranking calculado, então nenhum campeão será salvo no histórico.';
  if(!confirm(aviso)) return;
  if(temRanking && !campeaoSalvo) salvarCampeaoHistorico(true);
  const apagada=rodadaAtualId;
  await supabaseRequest('rodadas','DELETE',null,`?id=eq.${apagada}`);
  rodadas=rodadas.filter(r=>r.id!==apagada);
  const proxima=[...rodadas].sort((a,b)=>(b.criadaEm||0)-(a.criadaEm||0))[0];
  aplicarRodada(proxima);
  salvarDados(false);
  renderRodadas(); renderTicket(); renderAdmin(); renderHistorico(); renderRankingPublico();
  alert('Rodada apagada. O campeão permaneceu no histórico, se já havia ranking calculado.');
}

function renderRankingTabela(lista,limite=10){
  if(!lista.length)return '<p>Nenhum ranking calculado ainda. Confirme pagamentos e lance os resultados no admin.</p>';
  const maior=lista[0]?.pontos ?? 0;
  return lista.slice(0,limite).map((b,i)=>`<div class="linha ranking-row ${b.pontos===maior?'winner-row':''}"><span class="posicao">${b.pontos===maior?'🏆':(i+1)+'º'}</span><span><b>${b.nome}</b><br><small>${b.codigoExibicao||b.codigo} • ${b.tel}${b.totalCombinacoesRanking>1?' • '+b.combinacaoNumero+'/'+b.totalCombinacoesRanking:''}${b.pontos===maior && lista.filter(x=>x.pontos===maior).length>1?' • prêmio dividido':''}</small></span><span class="pontos">${b.pontos} pts</span><span class="tag pago">${b.acertos} acertos</span></div>`).join('');
}


function textoPalpite(op,j){
  if(op==='casa') return j.casa;
  if(op==='fora') return j.fora;
  if(op==='empate') return 'Empate';
  return '-';
}
function nomePalpite(b,j){
  const p=b.palpites[j.id];
  const arr=Array.isArray(p)?p:(p?[p]:[]);
  return arr.map(op=>textoPalpite(op,j)).join(' / ') || '-';
}
function encontrarBilheteGlobal(cod){
  const lista = todosBilhetesSistema();
  const b = lista.find(x => String(x.codigo) === String(cod));
  return b ? { bilhete: b, rodada: rodadas.find(r => String(r.id) === String(b.rodadaId)) || rodada || null } : null;
}

function htmlComprovante(b){
  const dataValidade = new Date(Date.now()+24*60*60*1000).toLocaleString('pt-BR');
  const rBilhete = rodadas.find(r=>r.id===b.rodadaId) || rodadas.find(r=>r.nome===b.rodadaNome) || {nome:b.rodadaNome||rodada.nome,jogos:jogos};
  const jogosDoBilhete = (rBilhete.jogos&&rBilhete.jogos.length?rBilhete.jogos:jogos);
  const jogosHtml = jogosDoBilhete.map(j=>`<div class="rec-jogo"><b>${j.casa} x ${j.fora}</b><br>Palpite: <b>${nomePalpite(b,j)}</b><br>Data/Hora: ${j.data||''}</div>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Bilhete ${b.codigo}</title><style>
    *{box-sizing:border-box} body{margin:0;background:#ddd;font-family:Arial,Helvetica,sans-serif;color:#111}.recibo{width:310px;min-height:100vh;background:#f4f26d;margin:0 auto;padding:18px 12px;font-size:13px;line-height:1.35}.recibo h1{text-align:center;font-size:22px;margin:0 0 2px}.site{text-align:center;font-weight:bold;font-size:12px;margin-bottom:28px}.meta{font-weight:bold;margin-bottom:22px}.titulo{text-align:center;font-weight:bold;margin:14px 0 8px}.rec-jogo{border-bottom:1px dashed #111;padding:7px 0;font-weight:500}.footer{font-weight:bold;margin-top:28px}.print-actions{position:fixed;right:20px;top:20px;display:flex;gap:8px}.print-actions button{border:0;border-radius:8px;padding:10px 14px;font-weight:800;cursor:pointer}.print{background:#118000;color:#fff}.close{background:#222;color:#fff}@media print{body{background:#fff}.recibo{margin:0;width:80mm;min-height:auto}.print-actions{display:none}@page{size:80mm auto;margin:0}}
  </style></head><body><div class="print-actions"><button class="print" onclick="window.print()">IMPRIMIR</button><button class="close" onclick="window.close()">FECHAR</button></div><div class="recibo"><h1>GALERA DO PALPITE</h1><div class="site">www.GaleraDoPalpite.com</div><div class="meta">COD BILHETE: ${b.codigo}<br>ID DA RODADA: ${b.rodadaNome||rodada.nome}<br>DATA: ${b.data}<br>CLIENTE: ${b.nome}<br>VALIDADO EM: ${dataValidade}<br>CORRETOR: online<br>VALOR: R$ ${Number(b.valor).toFixed(2).replace('.',',')}</div><div class="titulo">PALPITES</div>${jogosHtml}<div class="footer">Acesse www.GaleraDoPalpite.com e conheça o regulamento!</div></div><script>setTimeout(()=>window.print(),300)<\/script></body></html>`;
}
function imprimirBilhete(cod){
  const achado=encontrarBilheteGlobal(cod);
  const b=achado?.bilhete;
  if(!b){alert('Bilhete não encontrado.');return}
  if(!(b.pago === true || b.statusPagamento === 'PAGO' || b.status === 'Pago')){
    alert('Só é possível imprimir após confirmar o pagamento.');
    return;
  }
  const w=window.open('', '_blank', 'width=420,height=760');
  w.document.open();
  w.document.write(htmlComprovante(b));
  w.document.close();
}

function verRankingRodada(id){selecionarRodada(id);mostrarTela('ranking');setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),50);}
function palpiteCurto(op){
  if(op==='casa') return 'CASA';
  if(op==='empate') return 'EMPATE';
  if(op==='fora') return 'FORA';
  return '-';
}
function palpiteNomeResultado(op){
  if(op==='casa') return 'CASA';
  if(op==='empate') return 'EMPATE';
  if(op==='fora') return 'FORA';
  return '-';
}
function resultadoClasse(b,j){
  // Na tabela pública, a cor precisa validar exatamente o palpite exibido na célula.
  // Antes usava comboRanking em alguns casos, e isso deixava CASA verde mesmo quando
  // o resultado real era EMPATE. Agora valida sempre pelo palpite original/exibido.
  const res = simulacaoAtiva ? resultadoJogoSimulado(j) : resultadoJogo(j);
  if(!res) return 'neutro';
  const p=b.palpites?.[j.id];
  return palpiteAcertou(p,res)?'acerto':'erro';
}
function rankingResumo(lista){
  if(!lista.length) return '<p>Nenhum bilhete pago entrou no ranking ainda.</p>';
  const contagem={};
  lista.forEach(b=>{const pts=Number(b.pontos||0);contagem[pts]=(contagem[pts]||0)+1});
  return Object.keys(contagem).map(Number).sort((a,b)=>b-a).map(pts=>`<p><b>${contagem[pts]}</b> bilhete(s) com <b>${pts}</b> ponto(s)</p>`).join('');
}
function timeComLogo(nome, logo){
  const src = logo || '';
  if(!src) return nome || '';
  return `<span class="team-logo-wrap">
    <img src="${src}" class="team-logo" onerror="this.style.display='none'">
    <span>${nome || ''}</span>
  </span>`;
}
function renderJogosRanking(){
  return jogos.map(j=>{
    const temResultado=j.golsCasa!==null && j.golsCasa!=='' && j.golsFora!==null && j.golsFora!=='';
    const vencedor=temResultado?resultadoJogo(j):(simulacaoAtiva?simulacaoResultados[j.id]:'');
    const status=temResultado?'ENCERRADO':(simulacaoAtiva?'SIMULAÇÃO':'AGUARDANDO');
    const simControls=(!temResultado && simulacaoAtiva)?`<div class="sim-opcoes">
      <button class="${vencedor==='casa'?'ativo':''}" onclick="alterarSimulacaoResultado(${j.id},'casa')">CASA</button>
      <button class="${vencedor==='empate'?'ativo':''}" onclick="alterarSimulacaoResultado(${j.id},'empate')">EMPATE</button>
      <button class="${vencedor==='fora'?'ativo':''}" onclick="alterarSimulacaoResultado(${j.id},'fora')">FORA</button>
    </div>`:'';
    return `<div class="rank-game-row ${simulacaoAtiva&&!temResultado?'simulando':''}">
      <span class="rank-game-status">${status}</span>
      <span class="rank-team">${timeComLogo(j.casa, j.logoCasa)}</span>
      <span class="rank-crest">${escudo(j.casa)}</span>
      <span class="rank-score ${vencedor==='casa'?'win':''}">${temResultado?j.golsCasa:(vencedor==='casa'?'1':'-')}</span>
      <b>x</b>
      <span class="rank-score ${vencedor==='fora'?'win':''}">${temResultado?j.golsFora:(vencedor==='fora'?'1':'-')}</span>
      <span class="rank-team">${timeComLogo(j.fora, j.logoFora)}</span>
      <span class="rank-crest">${escudo(j.fora)}</span>
      <small>${(j.data || '').split(' - ')[0]}</small>
      ${simControls}
    </div>`
  }).join('') || '<p>Nenhum jogo cadastrado para esta rodada.</p>';
}
function renderTabelaCompletaRanking(lista){
  if(!lista.length) return '<div class="ranking-empty">Nenhum ranking calculado ainda.</div>';
  const headers=jogos.map((j,i)=>`<th>P${i+1}</th>`).join('');
  const linhas=lista.map(b=>{
    const cells=jogos.map(j=>{
      const combo=b.comboRanking||null;
      const p=b.palpites?.[j.id];
      const arr=Array.isArray(p)?p:(p?[p]:[]);
      const texto=arr.map(palpiteCurto).join('/')||'-';
      return `<td class="${resultadoClasse(b,j)}">${texto}</td>`;
    }).join('');
    return `<tr class="${b.pontos===lista[0].pontos?'vencedor':''}"><td><button class="rank-bilhete-link" onclick="abrirDetalheRankingBilhete('${b.codigo}')"><b>${b.codigo}</b><br><small>${b.nome}</small></button></td>${cells}<td class="pts-col ${b.pontos===lista[0].pontos?'pts-lider':'pts-normal'}"><b>${b.pontos||0}</b></td></tr>`;
  }).join('');
  return `<div class="ranking-table-wrap"><table class="ranking-full-table"><thead><tr><th>Bilhete / Nome</th>${headers}<th>Pts</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
}

function calcularPontosCombo(combo){
  let pts=0;
  jogos.forEach(j=>{
    const r = simulacaoAtiva ? resultadoJogoSimulado(j) : resultadoJogo(j);
    if(r && combo && normalizarOpcaoPalpite(combo[j.id])===normalizarOpcaoPalpite(r)) pts++;
  });
  return pts;
}
function melhorCombinacaoBilhete(b){
  const combos=b.combinacoes&&b.combinacoes.length?b.combinacoes:[b.palpites];
  let melhor=combos[0]||{}, melhorPts=-1, melhorNumero=1;
  combos.forEach((combo,idx)=>{
    const pts=calcularPontosCombo(combo);
    if(pts>melhorPts){melhorPts=pts; melhor=combo; melhorNumero=idx+1;}
  });
  return {combo:melhor,pontos:Math.max(0,melhorPts),numero:melhorNumero,total:combos.length};
}
function resolverBilheteRanking(codigo){
  const listaAtual = simulacaoAtiva ? rankingComResultadosSimulados() : (ranking.length ? ranking : calcularRankingParcial());
  let entrada = listaAtual.find(x=>String(x.codigoExibicao)===String(codigo));
  if(entrada) return entrada;
  entrada = listaAtual.find(x=>String(x.codigo)===String(codigo));
  if(entrada) return entrada;
  const base = bilhetes.find(x=>String(x.codigo)===String(codigo));
  if(!base) return null;
  const melhor=melhorCombinacaoBilhete(base);
  return {...base,codigoOriginal:base.codigo,codigoExibicao:base.codigo,comboRanking:melhor.combo,combinacaoNumero:melhor.numero,totalCombinacoesRanking:melhor.total,pontos:melhor.pontos,acertos:melhor.pontos};
}
function linhasBilheteRanking(b){
  return jogos.map((j,i)=>{
    const p=b.palpites?.[j.id];
    const arr=Array.isArray(p)?p:(p?[p]:[]);
    const textoPalpites=arr.map(palpiteNomeResultado).join('/') || '-';
    const res = simulacaoAtiva ? resultadoJogoSimulado(j) : resultadoJogo(j);
    const acertou=res && palpiteAcertou(arr,res);
    const placar=(j.golsCasa!==null&&j.golsFora!==null&&j.golsCasa!==''&&j.golsFora!=='')?`${j.golsCasa} x ${j.golsFora}`:'- x -';
    const classe = !res ? 'neutro' : (acertou?'acerto':'erro');
    return `<tr class="${classe}"><td>${i+1}</td><td>${j.casa}</td><td>${placar}</td><td>${j.fora}</td><td>${textoPalpites}</td><td>${res?palpiteNomeResultado(res):'-'}</td></tr>`;
  }).join('');
}
function abrirDetalheRankingBilhete(codigo){
  const b=resolverBilheteRanking(codigo);
  if(!b){alert('Bilhete não encontrado.');return;}
  const pontos=Number(b.pontos ?? calcularPontosCombo(b.comboRanking||b.palpites));
  const codigoTela=b.codigoExibicao||b.codigo;
  const complemento=(b.totalCombinacoesRanking>1)?`<p><span>APOSTA ORIGINAL:</span><b>${b.codigoOriginal||b.codigo}</b></p><p><span>BILHETE EQUIVALENTE:</span><b>${b.combinacaoNumero}/${b.totalCombinacoesRanking}</b></p>`:'';
  const existente=document.getElementById('modalBilheteRanking');
  if(existente) existente.remove();
  document.body.insertAdjacentHTML('beforeend',`<div id="modalBilheteRanking" class="rank-ticket-overlay" onclick="if(event.target.id==='modalBilheteRanking')fecharDetalheRankingBilhete()">
    <div class="rank-ticket-modal">
      <button class="rank-ticket-close" onclick="fecharDetalheRankingBilhete()">×</button>
      <div class="rank-ticket-head"><b>Bilhete ${codigoTela}</b><span>${b.status==='Pago'?'VALIDADO':b.status}</span></div>
      <div class="rank-ticket-actions"><button onclick="window.print()">🖨️ Imprimir</button><button onclick="navigator.clipboard&&navigator.clipboard.writeText('${codigoTela}')">📋 Copiar código</button></div>
      <div class="rank-ticket-paper">
        <h3>DADOS DO BILHETE</h3>
        <p><span>COD BILHETE:</span><b>${codigoTela}</b></p>
        ${complemento}
        <p><span>RODADA:</span><b>${b.rodadaNome||rodada.nome}</b></p>
        <p><span>CLIENTE:</span><b>${b.nome}</b></p>
        <p><span>VALOR DA APOSTA:</span><b>R$ ${Number(b.valor||0).toFixed(2).replace('.',',')}</b></p>
        <div class="rank-ticket-points">Este bilhete acertou ${pontos} ponto(s)</div>
        <table><thead><tr><th>#</th><th>Casa</th><th>Placar</th><th>Fora</th><th>Palpite</th><th>Resultado</th></tr></thead><tbody>${linhasBilheteRanking(b)}</tbody></table>
        <small class="rank-ticket-note">Verde = acerto | Vermelho = erro. Duplo e triplo aparecem no mesmo bilhete como CASA/EMPATE, EMPATE/FORA ou CASA/FORA.</small>
      </div>
    </div>
  </div>`);
}
function fecharDetalheRankingBilhete(){const el=document.getElementById('modalBilheteRanking'); if(el) el.remove();}

function renderRankingPublico(){
  const el=document.getElementById('rankingPublico'); if(!el)return;
  const fechado=rodada.status!=='Aberta';
  if(!fechado){
    el.innerHTML=`<div class="ranking-publico-top"><span class="live-badge small">🟢 Rodada aberta</span><h2>${rodada.nome}</h2><p class="sub">Esta rodada ainda está aberta para palpites. O ranking será liberado quando a rodada for fechada.</p></div>`;
    return;
  }
  const lista=simulacaoAtiva ? rankingComResultadosSimulados() : calcularRankingParcial();
  const bilhetesConfirmados=todosBilhetesSistema().filter(b=>bilhetePago(b));
  const totalBilhetes=bilhetesConfirmados.reduce((s,b)=>s+(Number(b.totalBilhetes)||1),0);
  const pagos=totalBilhetes;
  const campeoes=lista.length?lista.filter(b=>b.pontos===lista[0].pontos):[];
  el.innerHTML=`
    <div class="ranking-page-modelo">
      <div class="rank-title-line"><span></span><b>Ranking da Rodada</b><small>(${rodada.nome} | ${jogos.length} Jogos)</small><span></span></div>
      <div class="rank-actions-top"><button onclick="mostrarTela('inicio')">🏠 TELA INICIAL</button><button onclick="window.print()">📄 PDF / IMPRIMIR</button></div>
      <div class="rank-premio-card"><h3>🏆 PREMIAÇÃO DA RODADA</h3><div class="premio-total"><small>PREMIAÇÃO TOTAL</small><b>${premioEstimadoRodada()}</b></div><p><span>🏆 Campeão</span><b>${premioEstimadoRodada()}</b></p><p><span>🎟️ Bilhetes confirmados no site</span><b>${pagos}</b></p><p><span>📋 Total de bilhetes confirmados</span><b>${totalBilhetes}</b></p></div>
      <div class="rank-simulador"><h3>📊 Simulador de jogos</h3><p>Use nos jogos que ainda não começaram para calcular possíveis resultados e ver quem ficaria campeão.</p><div class="sim-actions"><button onclick="iniciarSimulacaoRanking()">📈 Iniciar simulação</button><button class="cancel" onclick="cancelarSimulacaoRanking()" ${simulacaoAtiva?'':'disabled'}>✕ Cancelar simulação</button></div>${simulacaoAtiva?'<small class="sim-aviso">Simulação temporária ativa: clique em 1, X ou 2 nos jogos aguardando. Nada será salvo no ranking oficial.</small>':''}</div>
      <div class="rank-games-box"><h3>⚽ # Jogos</h3><div class="rank-games-list">${renderJogosRanking()}</div></div>
      <div class="rank-resumos"><div class="rank-resumo-card"><h3>Resumo do Ranking</h3>${rankingResumo(lista)}</div><div class="rank-legenda"><h3>Legenda de Cores</h3><p><span class="leg acerto"></span> Acertos</p><p><span class="leg erro"></span> Erros</p><p><span class="leg vencedor"></span> Vencedores</p></div></div>
      <div class="rank-search-bar"><input id="rankBusca" placeholder="Nome ou código" oninput="filtrarRankingPublico()"><button onclick="filtrarRankingPublico()">BUSCAR</button><button onclick="document.getElementById('rankBusca').value='';filtrarRankingPublico()">×</button></div>
      <div id="rankTabelaCompleta">${renderTabelaCompletaRanking(lista)}</div>
    </div>`;
}
function filtrarRankingPublico(){
  const alvo=document.getElementById('rankTabelaCompleta'); if(!alvo) return;
  const q=(document.getElementById('rankBusca')?.value||'').toLowerCase().trim();
  const lista=(simulacaoAtiva?rankingComResultadosSimulados():calcularRankingParcial()).filter(b=>{
    if(!q) return true;
    return String(b.codigo||'').toLowerCase().includes(q)||String(b.nome||'').toLowerCase().includes(q)||String(b.tel||'').toLowerCase().includes(q);
  });
  alvo.innerHTML=renderTabelaCompletaRanking(lista);
}
function renderHistorico(){const el=document.getElementById('historicoVitorias'); if(!el)return; el.innerHTML=historico.map(h=>`<div class="linha"><span><b>${h.nome}</b><br><small>${h.rodada} • ${h.data}</small></span><span class="tag pago">${h.pontos} pts</span><span>${h.acertos} acertos</span></div>`).join('')||'<p>Nenhum campeão salvo ainda.</p>'}

function dinheiro(v){return 'R$ '+Number(v||0).toFixed(2).replace('.',',')}
function financeiroTotaisDaRodada(r=null){
  const listaBilhetes = r ? (r.bilhetes||[]) : bilhetes;
  const fin = r ? (r.financeiro||{entradasExtras:0,saidas:0,percentualPremio:70,transacoes:[]}) : financeiro;
  const pagos=listaBilhetes.filter(b=>b.status==='Pago');
  const pendentes=listaBilhetes.filter(b=>b.status!=='Pago');
  const entradasBilhetes=pagos.reduce((s,b)=>s+(Number(b.valor)||0),0);
  const entradas=entradasBilhetes+(Number(fin.entradasExtras)||0);
  const pendenteValor=pendentes.reduce((s,b)=>s+(Number(b.valor)||0),0);
  const saidas=Number(fin.saidas)||0;
  const saldo=entradas-saidas;
  const premiacao=entradas*(Number(fin.percentualPremio)||0)/100;
  const equivPagos=pagos.reduce((s,b)=>s+(Number(b.totalBilhetes)||1),0);
  const ticketMedio=pagos.length?entradasBilhetes/pagos.length:0;
  return {pagos,pendentes,entradas,entradasBilhetes,pendenteValor,saidas,saldo,premiacao,equivPagos,ticketMedio,fin};
}
function financeiroTotais(){return financeiroTotaisDaRodada(null)}
function financeiroTotaisGeral(){
  sincronizarRodadaAtual();
  const geral={entradas:0,pendenteValor:0,saidas:0,saldo:0,pagos:0,pendentes:0,equivPagos:0,premiacao:0};
  rodadas.forEach(r=>{
    const t=financeiroTotaisDaRodada(r);
    geral.entradas+=t.entradas; geral.pendenteValor+=t.pendenteValor; geral.saidas+=t.saidas; geral.saldo+=t.saldo;
    geral.pagos+=t.pagos.length; geral.pendentes+=t.pendentes.length; geral.equivPagos+=t.equivPagos; geral.premiacao+=t.premiacao;
  });
  return geral;
}
function selecionarRodadaFinanceiro(id){
  selecionarRodada(id);
  setTimeout(()=>document.querySelector('.rodada-atual-fin')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
}
function renderFinanceiroAdmin(){
  sincronizarRodadaAtual();
  const t=financeiroTotais();
  const g=financeiroTotaisGeral();
  const set=(id,txt)=>{const el=document.getElementById(id); if(el) el.textContent=txt};
  set('finGeralEntradas',dinheiro(g.entradas));
  set('finGeralPendentes',dinheiro(g.pendenteValor));
  set('finGeralSaidas',dinheiro(g.saidas));
  set('finGeralSaldo',dinheiro(g.saldo));
  set('finRodadaNome',rodada.nome||'-');
  set('finEntradas',dinheiro(t.entradas));
  set('finPendentes',dinheiro(t.pendenteValor));
  set('finSaidas',dinheiro(t.saidas));
  set('finSaldo',dinheiro(t.saldo));
  set('finPremiacao',dinheiro(t.premiacao));
  set('finQtdPagos',String(t.pagos.length));
  set('finQtdPendentes',String(t.pendentes.length));
  set('finEquivPagos',String(t.equivPagos));
  set('finTicketMedio',dinheiro(t.ticketMedio));
  const perc=document.getElementById('finPercentualPremio'); if(perc) perc.value=financeiro.percentualPremio;
  const trans=document.getElementById('finTransacoes');
  if(trans){
    trans.innerHTML=(financeiro.transacoes||[]).slice(0,6).map((x,i)=>`<div class="fin-row"><span><b>${x.tipo}</b><small>${x.desc}<br>${x.data}</small></span><b class="${x.tipo==='Saída'?'red-text':'green-text'}">${x.tipo==='Saída'?'-':'+'} ${dinheiro(x.valor)}</b><button onclick="removerTransacaoFinanceira(${i})">×</button></div>`).join('')||'<p class="sub">Nenhum lançamento manual ainda.</p>';
  }
  const lista=document.getElementById('finRodadasResumo');
  if(lista){
    lista.innerHTML=[...rodadas].sort((a,b)=>(b.criadaEm||0)-(a.criadaEm||0)).map(r=>{
      const rt=financeiroTotaisDaRodada(r);
      const ativa=r.id===rodadaAtualId;
      return `<div class="fin-rodada-card ${ativa?'ativa':''}">
        <div><small>${r.status==='Aberta'?'🟢 Aberta':'🔴 Encerrada'}</small><h4>${r.nome}</h4></div>
        <p><span>Arrecadado</span><b>${dinheiro(rt.entradas)}</b></p>
        <p><span>Pendentes</span><b>${dinheiro(rt.pendenteValor)}</b></p>
        <p><span>Saídas</span><b class="red-text">${dinheiro(rt.saidas)}</b></p>
        <p><span>Saldo</span><b>${dinheiro(rt.saldo)}</b></p>
        <button onclick="selecionarRodadaFinanceiro('${r.id}')">Abrir financeiro</button>
      </div>`;
    }).join('') || '<p class="sub">Nenhuma rodada criada ainda.</p>';
  }
}
function salvarPercentualPremio(){
  const v=Number(document.getElementById('finPercentualPremio')?.value||70);
  financeiro.percentualPremio=Math.max(0,Math.min(100,v));
  salvarDados(); renderFinanceiroAdmin();
}
async function adicionarEntradaFinanceira(){
  const el=document.getElementById('finEntradaManual'); const v=Number(el?.value||0);
  if(v<=0) return alert('Informe um valor de entrada maior que zero.');
  financeiro.entradasExtras=(Number(financeiro.entradasExtras)||0)+v;
  financeiro.transacoes.unshift({tipo:'Entrada',desc:'Entrada manual',valor:v,data:new Date().toLocaleString('pt-BR')});
  await supabaseRequest('financeiro','POST',{
  rodada_id: Number(String(rodadaAtualId).replace(/\D/g,'')),
  tipo: 'Entrada',
  descricao: 'Entrada manual',
  valor: v
});
  if(el) el.value=''; salvarDados(); renderFinanceiroAdmin();
}
function adicionarSaidaFinanceira(){
  const el=document.getElementById('finSaidaManual'); const v=Number(el?.value||0);
  if(v<=0) return alert('Informe um valor de saída maior que zero.');
  financeiro.saidas=(Number(financeiro.saidas)||0)+v;
  financeiro.transacoes.unshift({tipo:'Saída',desc:'Saída / pagamento registrado',valor:v,data:new Date().toLocaleString('pt-BR')});
  if(el) el.value=''; salvarDados(); renderFinanceiroAdmin();
}
function removerTransacaoFinanceira(i){
  const x=(financeiro.transacoes||[])[i]; if(!x) return;
  if(!confirm('Remover este lançamento financeiro?')) return;
  if(x.tipo==='Entrada') financeiro.entradasExtras=Math.max(0,(Number(financeiro.entradasExtras)||0)-Number(x.valor||0));
  if(x.tipo==='Saída') financeiro.saidas=Math.max(0,(Number(financeiro.saidas)||0)-Number(x.valor||0));
  financeiro.transacoes.splice(i,1); salvarDados(); renderFinanceiroAdmin();
}

function limparFinanceiroRodadaAtual(){
  if(!confirm('Limpar entradas manuais, saídas e lançamentos financeiros desta rodada? Bilhetes recebidos e pagamentos confirmados serão mantidos.')) return;
  financeiro.entradasExtras=0;
  financeiro.saidas=0;
  financeiro.transacoes=[];
  salvarDados();
  renderFinanceiroAdmin();
  alert('Valores financeiros manuais da rodada limpos com sucesso.');
}
function limparFinanceiroGeral(){
  if(!confirm('Limpar entradas manuais, saídas e lançamentos financeiros de TODAS as rodadas? Bilhetes e pagamentos confirmados serão mantidos.')) return;
  sincronizarRodadaAtual();
  rodadas.forEach(r=>{
    r.financeiro=r.financeiro||{};
    r.financeiro.entradasExtras=0;
    r.financeiro.saidas=0;
    r.financeiro.transacoes=[];
  });
  aplicarRodada(rodadas.find(r=>r.id===rodadaAtualId)||rodadas[0]);
  salvarDados(false);
  renderAdmin();
  alert('Valores financeiros manuais de todas as rodadas foram limpos.');
}
function renderBilhetesPorRodadaAdmin(){
  const ordenadas=[...rodadas].sort((a,b)=>(b.criadaEm||0)-(a.criadaEm||0));
  return ordenadas.map(r=>{
    const lista=(r.bilhetes||[]).slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
    const pendentes = lista.filter(b => !(b.pago === true || b.statusPagamento === 'PAGO' || b.status === 'Pago'));
    const pagos = lista.filter(b => (b.pago === true || b.statusPagamento === 'PAGO' || b.status === 'Pago'));
    const totalPendente=pendentes.reduce((s,b)=>s+(Number(b.valor)||0),0);
    const totalPago=pagos.reduce((s,b)=>s+(Number(b.valor)||0),0);
    const cards=lista.map(b=>`<div class="linha bilhete-admin-row ${b.status==='Pago'?'bilhete-pago':'bilhete-pendente'}">
      <span><b>${b.codigo}</b> - ${b.nome} ${b.origem==='Manual'?'<em class="manual-badge">📝 MANUAL</em>':''}<br><small>${b.totalBilhetes||1} bilhete(s) • ${dinheiro(b.valor)} • ${b.pontos||0} pts • ${b.data||''}</small></span>
      <span class="tag ${(b.pago === true || b.statusPagamento === 'PAGO' || b.status === 'Pago') ? 'pago' : 'pendente'}">
    ${(b.pago === true || b.statusPagamento === 'PAGO' || b.status === 'Pago') ? 'Pago' : 'Pendente'}
    </span>
      <span class="bilhete-actions">${(b.pago === true || b.statusPagamento === 'PAGO' || b.status === 'Pago')
 ? `<button onclick="imprimirBilhete('${b.codigo}')">Imprimir</button>`
 : `<button onclick="confirmarPagamentoManual('${b.codigo}')">Confirmar PG</button>`}</span>
    </div>`).join('') || '<p class="sub admin-empty">Nenhum bilhete recebido nesta rodada.</p>';
    return `<div class="rodada-bilhetes-card ${r.id===rodadaAtualId?'ativa':''}">
      <div class="rodada-bilhetes-head">
        <div><small>${r.status==='Aberta'?'🟢 Aberta':'🔴 Encerrada'}</small><h3>${r.nome}</h3><p>${dataHoraRodada(r)}</p></div>
        <div class="bilhete-kpis"><span><b>${pendentes.length}</b> pendente(s)</span><span><b>${pagos.length}</b> pago(s)</span><span><b>${dinheiro(totalPendente)}</b> a confirmar</span><span><b>${dinheiro(totalPago)}</b> recebido</span></div>
      </div>
      <div class="bilhetes-lista-admin">${cards}</div>
    </div>`;
  }).join('') || '<p>Nenhuma rodada criada ainda.</p>';
}


function selecionarRodadaResultado(id){
  selecionarRodada(id);
  setTimeout(()=>{
    const sel=document.getElementById('resultadoRodadaSelect');
    if(sel) sel.value=id;
  },0);
}


function getRodadaManualSelecionada(){
  const sel=document.getElementById('manualRodadaSelect');
  const id=(sel&&sel.value)||rodadaAtualId;
  return rodadas.find(r=>r.id===id)||rodadas.find(r=>r.id===rodadaAtualId)||null;
}
function renderManualForm(){
  const box=document.getElementById('manualJogos');
  if(!box) return;
  const r=getRodadaManualSelecionada();
  const valor=document.getElementById('manualValor');
  if(r && valor && !valor.value) valor.value=Number(r.valor||rodada.valor||10).toFixed(2);
  if(!r){box.innerHTML='<div class="manual-empty">Nenhuma rodada encontrada.</div>';return;}
  const lista=(r.jogos||[]).filter(j=>j&&j.casa&&j.fora);
  if(!lista.length){box.innerHTML='<div class="manual-empty">Essa rodada ainda não tem jogos cadastrados.</div>';return;}
  box.innerHTML=lista.map((j,i)=>`<div class="manual-jogo-row">
    <div class="manual-time casa"><b>${i+1}. ${escaparHtml(j.casa)}</b><small>${escaparHtml(j.data||'')}</small></div>
    <div class="manual-opcoes" data-jogo="${j.id}">
      <input id="manual_${j.id}_casa" type="radio" name="manual_${j.id}" value="casa"><label for="manual_${j.id}_casa" title="Casa">C</label>
      <input id="manual_${j.id}_empate" type="radio" name="manual_${j.id}" value="empate"><label for="manual_${j.id}_empate" title="Empate">E</label>
      <input id="manual_${j.id}_fora" type="radio" name="manual_${j.id}" value="fora"><label for="manual_${j.id}_fora" title="Fora">F</label>
    </div>
    <div class="manual-time fora"><b>${escaparHtml(j.fora)}</b><small>Casa • Empate • Fora</small></div>
  </div>`).join('');
}
function limparBilheteManual(){
  document.querySelectorAll('#manualJogos input[type="radio"]').forEach(i=>i.checked=false);
  const n=document.getElementById('manualNome'); if(n) n.value='';
  const t=document.getElementById('manualTelefone'); if(t) t.value='';
}
function proximoCodigoBilhete(prefixo='GDP'){
  const todos=rodadas.flatMap(r=>r.bilhetes||[]).concat(bilhetes||[]);
  let maior=0;
  todos.forEach(b=>{const m=String(b.codigo||'').match(/(\d+)$/); if(m) maior=Math.max(maior,Number(m[1]));});
  return `${prefixo}-${String(maior+1).padStart(4,'0')}`;
}
async function salvarBilheteManual(){
  const r=getRodadaManualSelecionada();
  if(!r) return alert('Escolha uma rodada.');
  const lista=(r.jogos||[]).filter(j=>j&&j.casa&&j.fora);
  if(!lista.length) return alert('Essa rodada ainda não tem jogos.');
  const nome=(document.getElementById('manualNome')?.value||'').trim();
  const tel=(document.getElementById('manualTelefone')?.value||'').trim();
  const valorInput=Number(document.getElementById('manualValor')?.value||r.valor||rodada.valor||10);
  if(!nome||!tel) return alert('Preencha nome e celular do cliente.');
  const palpitesManual={};
  for(const j of lista){
    const marcado=document.querySelector(`input[name="manual_${j.id}"]:checked`);
    if(!marcado) return alert(`Falta marcar o jogo: ${j.casa} x ${j.fora}`);
    palpitesManual[j.id]=marcado.value;
  }
  const codigo=proximoCodigoBilhete('GDP');
  const b={
    codigo,nome,tel,
    rodadaId:r.id,rodadaNome:r.nome,
    status:'Pago',origem:'Manual',pagamentoMetodo:'Manual/papel',txid:'MANUAL-'+codigo.replace(/[^A-Za-z0-9]/g,''),
    valor:valorInput,valorBase:Number(r.valor)||valorInput,totalBilhetes:1,secos:lista.length,duplos:0,triplos:0,
    palpites:palpitesManual,combinacoes:[JSON.parse(JSON.stringify(palpitesManual))],pontos:0,acertos:0,
    data:new Date().toLocaleString('pt-BR')
  };
  r.bilhetes=r.bilhetes||[];
  r.bilhetes.push(b);
  if(r.id===rodadaAtualId){bilhetes=r.bilhetes;}
  await supabaseRequest('bilhetes','POST',{
  codigo: codigo,
  nome: nome,
  telefone: tel,
  rodada_id: Number(String(r.id).replace(/\D/g,'')),
  status: 'Pago',
  valor: valorInput,
  acertos: 0,
  palpites: palpitesManual,
  combinacoes: [JSON.parse(JSON.stringify(palpitesManual))]
});
  salvarDados();
  renderAdmin();
  renderRankingPublico();
  if(confirm(`Bilhete manual salvo com sucesso! Código: ${codigo}\n\nDeseja imprimir o comprovante amarelo agora?`)){
    imprimirBilhete(codigo);
  }
}

async function renderAdmin(){
 
 carregarPixAdmin();
  rodadas.forEach(r => {
  const nomeRodada = String(r.nome || '').trim().toUpperCase();

  r.bilhetes = bilhetes.filter(b => {
    const nomeBilhete = String(b.rodadaNome || '').trim().toUpperCase();

    return (
      String(b.rodadaId) === String(r.id) ||
      nomeBilhete === nomeRodada ||
      nomeBilhete.includes(nomeRodada) ||
      nomeRodada.includes(nomeBilhete)
    );
  });
});

  const sel=document.getElementById('rodadaAdminSelect');
  if(sel){
    sel.innerHTML=[...rodadas].sort((a,b)=>(b.criadaEm||0)-(a.criadaEm||0)).map(r=>`<option value="${r.id}" ${r.id===rodadaAtualId?'selected':''}>${r.status==='Aberta'?'🟢':'🔴'} ${r.nome}</option>`).join('');
  }
  const optsRodadas=[...rodadas].sort((a,b)=>(b.criadaEm||0)-(a.criadaEm||0)).map(r=>`<option value="${r.id}" ${r.id===rodadaAtualId?'selected':''}>${r.status==='Aberta'?'🟢':'🔴'} ${r.nome}</option>`).join('');
  const jogoSel=document.getElementById('jogoRodadaSelect');
  if(jogoSel){ jogoSel.innerHTML=optsRodadas; }
  const resultadoSel=document.getElementById('resultadoRodadaSelect');
  if(resultadoSel){ resultadoSel.innerHTML=optsRodadas; resultadoSel.value=rodadaAtualId; }
  const manualSel=document.getElementById('manualRodadaSelect');
  if(manualSel){ const atual=manualSel.value||rodadaAtualId; manualSel.innerHTML=optsRodadas; manualSel.value=rodadas.some(r=>r.id===atual)?atual:rodadaAtualId; }
  const rn=document.getElementById('rodadaNome'); if(rn) rn.value=rodada.nome;
  const rv=document.getElementById('rodadaValor'); if(rv) rv.value=rodada.valor;
  const rs=document.getElementById('rodadaStatus'); if(rs) rs.value=rodada.status;
  const rp=document.getElementById('rodadaPremioEstimado'); if(rp) rp.value=rodada.premioEstimadoManual||'';
  const rd=document.getElementById('rodadaData'); if(rd) rd.value=rodada.dataRodada||'';
  const rh=document.getElementById('rodadaHora'); if(rh) rh.value=rodada.horaRodada||'';

  const jogosHtml=(jogos.length?`<div class="resultado-toolbar"><small><b>Rodada selecionada:</b> ${rodada.nome}<br>Digite os placares finais e salve. O ranking fica ao lado para conferir rápido.</small><button onclick="salvarTodosResultados()">Salvar todos resultados</button></div>`:'') + (jogos.map(j=>`<div class="resultado-jogo-card jogo-admin" id="jogoAdminLinha${j.id}"><div class="resultado-num">${j.id}</div><div class="resultado-times"><b>${j.casa}</b> <span>x</span> <b>${j.fora}</b><br><small>${j.data||''}</small><br><em id="statusResultado${j.id}" class="status-resultado salvo">SALVO</em></div><span class="placar-admin"><input type="number" min="0" placeholder="Casa" value="${j.golsCasa??''}" onchange="setResultado(${j.id},'golsCasa',this.value)"><b>x</b><input type="number" min="0" placeholder="Fora" value="${j.golsFora??''}" onchange="setResultado(${j.id},'golsFora',this.value)"></span><button class="btn-save-result" onclick="salvarResultadoJogo(${j.id})">Salvar</button><button class="excluir" onclick="excluirJogo(${j.id})">Excluir</button></div>`).join('')||'<p>Nenhum jogo cadastrado nessa competição/rodada.</p>');
  document.getElementById('adminJogos').innerHTML=jogosHtml;
  rodadas.forEach(r => {
  r.bilhetes = bilhetes.filter(b =>
    String(b.rodadaId) === String(r.id)
  );
});
  document.getElementById('adminBilhetes').innerHTML=renderBilhetesPorRodadaAdmin();
  document.getElementById('adminRanking').innerHTML=renderRankingTabela(ranking,10);
  renderFinanceiroAdmin();
  renderManualForm();
}
let mercadoFiltro='todos';
let mercadoUltimaLista=[];
function unicosPorCodigo(lista){
  const mapa = {};
  lista.forEach(b=>{
    if(b && b.codigo) mapa[b.codigo] = b;
  });
  return Object.values(mapa);
}

function todosBilhetesSistema(){
  return unicosPorCodigo([
    ...(bilhetes || []),
    ...((rodadas || []).flatMap(r => r.bilhetes || []))
  ]);
}

function bilhetePago(b){
  return b.pago === true || b.statusPagamento === 'PAGO' || b.status === 'Pago';
}

function filtrarPorCodigoOuCelular(q){
  const termo=(q||'').trim().toLowerCase();
  const numeros=termo.replace(/\D/g,'');

  const todosBilhetes = todosBilhetesSistema();

  if(!termo) return [];

  return todosBilhetes.filter(b=>{
    const codigo=(b.codigo||'').toLowerCase();
    const tel=(b.tel||b.telefone||'').replace(/\D/g,'');
    return codigo.includes(termo) || (numeros.length>=4 && tel.includes(numeros));
  });
}

function buscarBilhete(){
  const q=(document.getElementById('buscaBilhete')?.value||'');
  const alvo=document.getElementById('resultadoBusca');
  if(!alvo) return;
  const lista=filtrarPorCodigoOuCelular(q);
  if(!q.trim()){alvo.innerHTML='<p>Digite o código do bilhete ou celular para buscar.</p>';return}
  alvo.innerHTML=lista.map(b=>`<div class="linha"><span><b>${b.codigo}</b> - ${b.nome}<br><small>${b.pontos||0} pts</small></span><span class="tag ${b.status==='Pago'?'pago':'pendente'}">${b.status}</span><span>R$ ${b.valor.toFixed(2).replace('.',',')}</span>${b.status==='Pago'?`<button onclick="imprimirBilhete('${b.codigo}')">Imprimir</button>`:''}</div>`).join('')||'<p>Nenhum bilhete encontrado.</p>';
}

function renderMercadoInicial(){
  const out=document.getElementById('mercadoResultado');
  if(!out) return;
  mercadoUltimaLista=[];
  document.getElementById('mercadoQtd').textContent='0';
  document.getElementById('mercadoPendentes').textContent='0';
  document.getElementById('mercadoValidados').textContent='0';
  out.className='mercado-lista vazio';
  out.innerHTML=`<div class="empty-market"><div>🛒</div><h2>Busque seu bilhete</h2><p>Use o código ou celular para visualizar somente seus próprios bilhetes.</p></div>`;
}

function setMercadoFiltro(filtro,btn){
  mercadoFiltro=filtro;
  document.querySelectorAll('.mercado-tabs button').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderMercadoLista();
}

function buscarMercado(){
  const q=document.getElementById('mercadoBusca')?.value||'';
  mercadoUltimaLista=filtrarPorCodigoOuCelular(q);
  mercadoFiltro='todos';
  document.querySelectorAll('.mercado-tabs button').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderMercadoLista();
}

function renderMercadoLista(){
  const out=document.getElementById('mercadoResultado');
  if(!out) return;
  const pendentes=mercadoUltimaLista.filter(b=>b.status!=='Pago').length;
  const validados=mercadoUltimaLista.filter(b=>b.status==='Pago').length;
  document.getElementById('mercadoQtd').textContent=mercadoUltimaLista.length;
  document.getElementById('mercadoPendentes').textContent=pendentes;
  document.getElementById('mercadoValidados').textContent=validados;
  let lista=mercadoUltimaLista;
  if(mercadoFiltro==='pendentes') lista=lista.filter(b=>b.status!=='Pago');
  if(mercadoFiltro==='validados') lista=lista.filter(b=>b.status==='Pago');
  if(!lista.length){
    out.className='mercado-lista vazio';
    out.innerHTML='<div class="empty-market"><div>🔎</div><h2>Nenhum bilhete encontrado</h2><p>Confira o código ou celular digitado.</p></div>';
    return;
  }
  out.className='mercado-lista';
  out.innerHTML=lista.map(b=>`<div class="mercado-card">
    <div class="mercado-card-top"><div><small>Código</small><h2>${b.codigo}</h2></div><span class="tag ${b.status==='Pago'?'pago':'pendente'}">${b.status==='Pago'?'VALIDADO':'PENDENTE'}</span></div>
    <div class="mercado-info">
      <span><b>Cliente</b>${b.nome}</span>
      <span><b>Rodada</b>${b.rodadaNome||rodada.nome}</span>
      <span><b>Pontos</b>${b.pontos||0}</span>
      <span><b>Bilhetes</b>${b.totalBilhetes||1}</span><span><b>Valor</b>R$ ${b.valor.toFixed(2).replace('.',',')}</span>
    </div>
    <div class="mercado-actions">
      <button onclick="verResumoBilhete('${b.codigo}')">Ver bilhete</button>
      ${b.status==='Pago'?`<button onclick="imprimirBilhete('${b.codigo}')">Imprimir</button>`:`<button onclick="alert('Bilhete aguardando confirmação do pagamento pelo administrador.')">Aguardando pagamento</button>`}
    </div>
  </div>`).join('');
}

function verResumoBilhete(cod){
  const b=bilhetes.find(x=>x.codigo===cod);
  if(!b) return alert('Bilhete não encontrado.');
  const linhas=jogos.map(j=>`${j.id}. ${j.casa} x ${j.fora}: ${nomePalpite(b,j)}`).join('\n');
  alert(`Bilhete ${b.codigo}\nCliente: ${b.nome}\nStatus: ${b.status}\nValor: R$ ${b.valor.toFixed(2).replace('.',',')}\n\n${linhas}`);
}

carregarRodadasSupabase(); renderRodadas(); renderTicket(); renderAdmin(); renderRankingPublico(); renderHistorico();

/* Impressão A4 de cartelas manuais por rodada */
function escaparHtml(txt){
  return String(txt ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function imprimirRodadaA4(){
  sincronizarRodadaAtual();
  const sel=document.getElementById('resultadoRodadaSelect') || document.getElementById('rodadaAdminSelect');
  const id=(sel && sel.value) || rodadaAtualId;
  const r=rodadas.find(x=>x.id===id) || rodadas.find(x=>x.id===rodadaAtualId);
  if(!r) return alert('Escolha uma competição/rodada para imprimir.');

  const lista=(r.jogos||[]).filter(j=>j && j.casa && j.fora).slice(0,9);
  if(!lista.length) return alert('Essa rodada ainda não tem jogos cadastrados para imprimir.');

  const dataExibida=[r.dataRodada,r.horaRodada].filter(Boolean).join(' • ');
  const qtd=9;

  const linhas=lista.map(j=>`<tr>
      <td class="time casa">${escaparHtml(j.casa)}</td>
      <td class="marcar"><span class="circle"></span></td>
      <td class="marcar"><span class="circle"></span></td>
      <td class="marcar"><span class="circle"></span></td>
      <td class="time fora">${escaparHtml(j.fora)}</td>
    </tr>`).join('');

  const cartela = (n)=>`<section class="cartela-manual">
    <div class="cartela-head"><span>Nº ____</span><b>${escaparHtml(r.nome)}</b></div>
    <div class="icons"><span class="ico casa-ico">⌂</span><span class="ico empate-ico">=</span><span class="ico fora-ico">✈</span></div>
    <table class="tabela-palpites"><tbody>${linhas}</tbody></table>
    <div class="cartela-footer"><label>NOME:</label><span></span></div>
    <div class="cartela-footer"><label>FONE:</label><span></span></div>
  </section>`;

  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Imprimir Rodada A4 - ${escaparHtml(r.nome)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#e9e9e9;font-family:Arial,Helvetica,sans-serif;color:#111}
    .actions{position:fixed;right:18px;top:18px;display:flex;gap:8px;z-index:9}
    .actions button{border:0;border-radius:8px;padding:11px 14px;font-weight:900;cursor:pointer}
    .print{background:#049b40;color:#fff}.close{background:#222;color:#fff}
    .page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:7mm 7mm 6mm;box-shadow:0 10px 35px #0004}
    .header{display:flex;align-items:center;justify-content:space-between;border-bottom:1.6px solid #111;padding-bottom:4mm;margin-bottom:4mm}
    .header-left{display:flex;align-items:center;gap:8px}.header img{width:24mm;height:auto}
    .header h1{font-size:19pt;margin:0;text-transform:uppercase;letter-spacing:.2px}.header p{margin:1.5mm 0 0;font-size:10pt;font-weight:800}
    .header .meta{border:1px solid #111;border-radius:3mm;padding:2.2mm 4mm;text-align:right;font-size:10pt;font-weight:900;line-height:1.25}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm 3.2mm}
    .cartela-manual{border:1.2px solid #111;border-radius:2mm;padding:2.1mm;break-inside:avoid;background:#fff;min-height:77mm;position:relative}
    .cartela-manual:after{content:"";position:absolute;inset:-1.8mm;border:1px dashed #aaa;border-radius:2.5mm;pointer-events:none}
    .cartela-head{display:flex;justify-content:space-between;align-items:center;font-size:8.4pt;font-weight:900;text-transform:uppercase;margin-bottom:1mm}
    .icons{display:grid;grid-template-columns:1fr 1fr 1fr;width:33mm;margin:0 auto 1.3mm;gap:1.8mm;text-align:center}
    .ico{width:6.7mm;height:6.7mm;line-height:6.7mm;border-radius:50%;display:inline-block;color:#fff;font-size:11pt;font-weight:900;text-align:center;border:1px solid #222}
    .casa-ico{background:#2fad35}.empate-ico{background:#f2a000}.fora-ico{background:#d71919}
    .tabela-palpites{width:100%;border-collapse:collapse;table-layout:fixed;font-size:6.9pt;font-weight:900;text-transform:uppercase}
    .tabela-palpites td{border:1px solid #222;height:5.7mm;padding:.45mm;text-align:center;vertical-align:middle;line-height:1.05}
    .time{width:34%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.casa{text-align:right}.fora{text-align:left}.marcar{width:10.66%}
    .circle{display:inline-block;width:3.8mm;height:3.8mm;border:1.2px solid #111;border-radius:50%;background:#fff}
    .cartela-footer{display:flex;align-items:center;gap:1.5mm;margin-top:2mm;font-size:8.4pt;font-weight:900}
    .cartela-footer span{border-bottom:1.2px solid #111;flex:1;height:4mm}
    .recorte{text-align:center;margin-top:5mm;border-top:1px dashed #777;padding-top:1.7mm;font-size:8pt;color:#222}
    @page{size:A4 portrait;margin:5mm}
    @media print{body{background:#fff}.page{margin:0;width:auto;min-height:auto;box-shadow:none;padding:0}.actions{display:none}.cartela-manual{page-break-inside:avoid}}
  </style></head><body><div class="actions"><button class="print" onclick="window.print()">IMPRIMIR A4</button><button class="close" onclick="window.close()">FECHAR</button></div><main class="page"><div class="header"><div class="header-left"><img src="logo-galera-do-palpite.png"><div><h1>Mapa da Rodada</h1><p>${escaparHtml(r.nome)} ${dataExibida ? '• '+escaparHtml(dataExibida) : ''}</p></div></div><div class="meta">Valor: ${dinheiro(r.valor)}<br>Total de jogos: ${lista.length}<br>Cartelas: ${qtd}</div></div><div class="grid">${Array.from({length:qtd},(_,i)=>cartela(i+1)).join('')}</div><div class="recorte">✂ Recorte na linha pontilhada</div></main><script>setTimeout(()=>window.print(),500)<\/script></body></html>`;
  const w=window.open('', '_blank');
  if(!w) return alert('O navegador bloqueou a janela de impressão. Libere pop-ups para este arquivo.');
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function fecharPixModal() {
  const pixBox = document.getElementById("pixBox");
  if (pixBox) {
    pixBox.style.display = "none";
  }
}

function abrirPixModal() {
  const pixBox = document.getElementById("pixBox");
  const pixCopia = document.getElementById("pixCopia");
  const pixQrImg = document.getElementById("pixQrImg");

  if (!pixBox) return;

  const temPix =
    (pixCopia && pixCopia.value && pixCopia.value.trim() !== "") ||
    (pixQrImg && pixQrImg.src && pixQrImg.src.trim() !== "");

  if (temPix) {
    pixBox.style.display = "block";
  }
}
