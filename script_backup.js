const USUARIO_ADMIN = 'HenriqueN1998';
const SENHA_ADMIN = '26549542Hn@';
let adminLiberado = sessionStorage.getItem('adminLiberado') === 'sim';
let rodada={nome:'Libertadores + Sul-Americana',valor:10,status:'Aberta'};
let pixConfig={chave:'11999999999',nome:'Galera do Palpite',msg:'Pagamento de bilhete Galera do Palpite'};
let jogos=[
{id:1,data:'26/05 19:00 - AMÉRICA DO SUL: Copa Sul-Americana - Fase de Grupos',casa:'GRÊMIO-RS',fora:'MONTEVIDEO-URU',odds:['1.57','3.70','5.50'],golsCasa:null,golsFora:null},
{id:2,data:'26/05 19:00 - AMÉRICA DO SUL: Copa Sul-Americana - Fase de Grupos',casa:'MILLONARIOS-COL',fora:"O'HIGGINS-CHI",odds:['1.67','3.50','5.50'],golsCasa:null,golsFora:null},
{id:3,data:'26/05 21:30 - AMÉRICA DO SUL: Copa Libertadores - Fase de Grupos',casa:'ESTUDIANTES-ARG',fora:'IND. MEDELLÍN-COL',odds:['1.75','3.50','4.50'],golsCasa:null,golsFora:null},
{id:4,data:'26/05 21:30 - AMÉRICA DO SUL: Copa Libertadores - Fase de Grupos',casa:'FLAMENGO-RJ',fora:'CUSCO-PER',odds:['1.20','6.00','8.50'],golsCasa:null,golsFora:null},
{id:5,data:'26/05 21:30 - AMÉRICA DO SUL: Copa Libertadores - Fase de Grupos',casa:'NACIONAL-URU',fora:'COQUIMBO-CHI',odds:['1.95','3.20','4.00'],golsCasa:null,golsFora:null},
{id:6,data:'26/05 21:30 - AMÉRICA DO SUL: Copa Libertadores - Fase de Grupos',casa:'UNIVERSITARIO',fora:'TOLIMA-COL',odds:['1.95','3.20','4.00'],golsCasa:null,golsFora:null},
{id:7,data:'26/05 21:30 - AMÉRICA DO SUL: Copa Sul-Americana - Fase de Grupos',casa:'SAN LORENZO-ARG',fora:'RECOLETA-PAR',odds:['1.40','4.33','8.00'],golsCasa:null,golsFora:null},
{id:8,data:'26/05 21:30 - AMÉRICA DO SUL: Copa Sul-Americana - Fase de Grupos',casa:'SANTOS-SP',fora:'DEP. CUENCA-ECU',odds:['1.30','5.50','8.00'],golsCasa:null,golsFora:null}
];
let bilhetes=[];
let ranking=[];
let historico=[];
let financeiro={entradasExtras:0,saidas:0,percentualPremio:70,transacoes:[]};
const palpites={};

function carregarDados(){
  const raw=localStorage.getItem('gdp_dados_v5');
  if(!raw) return;
  try{
    const d=JSON.parse(raw);
    rodada=d.rodada||rodada; pixConfig=d.pixConfig||pixConfig; jogos=d.jogos||jogos; bilhetes=d.bilhetes||[]; ranking=d.ranking||[]; historico=d.historico||[]; financeiro=d.financeiro||financeiro;
  }catch(e){console.warn('Falha ao carregar dados',e)}
}
function salvarDados(){localStorage.setItem('gdp_dados_v5',JSON.stringify({rodada,pixConfig,jogos,bilhetes,ranking,historico,financeiro}))}
function mostrarTela(id){
  document.querySelectorAll('.tela').forEach(t=>t.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
  if(id==='admin'){verificarAdmin(); if(adminLiberado) renderAdmin();}
  if(id==='buscar') buscarBilhete();
  if(id==='mercado') renderMercadoInicial();
  if(id==='ranking') renderRankingPublico();
  if(id==='historico') renderHistorico();
}
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
function dataHoraRodada(){
  const primeira=(jogos[0]&&jogos[0].data)||'';
  const m=primeira.match(/(\d{2}\/\d{2})\s*(\d{2}:\d{2})/);
  if(!m) return '26/05/2026 • 21:30';
  const ano=new Date().getFullYear();
  return `${m[1]}/${ano} • ${m[2]}`;
}
function premioEstimadoRodada(){
  const pagos=bilhetes.filter(b=>b.status==='Pago').reduce((s,b)=>s+(Number(b.valor)||0),0);
  const perc=Number(financeiro?.percentualPremio ?? 70);
  const estimado=pagos>0 ? pagos*(perc/100) : 25000;
  return estimado.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function renderRodadas(){
  document.getElementById('listaRodadas').innerHTML=`
    <div class="rodada-card premium-card">
      <div class="gdp-card-logo"><img src="logo-galera-do-palpite.png" alt="Galera do Palpite"></div>
      <div class="rodada-data">🗓️ ${dataHoraRodada()}</div>
      <span class="live-badge small">${rodada.status}</span>
      <h3>${rodada.nome}</h3>
      <p>${jogos.length} jogos obrigatórios • Cartela R$ ${rodada.valor.toFixed(2).replace('.',',')}</p>
      <div class="premio-estimado">PRÊMIO ESTIMADO: ${premioEstimadoRodada()}</div>
      <button onclick="abrirBilhete()">🎟️ Palpitar agora</button>
    </div>`
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
    return `<div class="jogo"><div class="numero">${j.id}</div><div class="linha-jogo"><div class="info">🔍 ${j.data}</div><button class="opcao ${sel.includes('casa')?'active':''}" onclick="marcar(${j.id},'casa',this)">${escudo(j.casa)}${j.casa}<small>(${j.odds[0]})</small></button><button class="opcao empate ${sel.includes('empate')?'active':''}" onclick="marcar(${j.id},'empate',this)">EMPATE<small>(${j.odds[1]})</small></button><button class="opcao ${sel.includes('fora')?'active':''}" onclick="marcar(${j.id},'fora',this)">${j.fora}${escudo(j.fora)}<small>(${j.odds[2]})</small></button></div></div>`
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
function confirmarAposta(){
  const msg=document.getElementById('mensagem');
  const c=totalCombinacoes();
  if(c.feitos<jogos.length){msg.style.color='#c98900';msg.textContent=`Faltam ${jogos.length-c.feitos} jogo(s) para marcar.`;return}
  if(c.total>256){msg.style.color='#c98900';msg.textContent='⚠️ Limite máximo de 256 bilhetes por aposta atingido.';return}
  const nome=document.getElementById('nome').value.trim(), tel=document.getElementById('telefone').value.trim(); if(!nome||!tel){msg.style.color='#c98900';msg.textContent='Preencha nome e telefone.';return}
  const codigo='GDP-'+String(bilhetes.length+1).padStart(4,'0');
  const valorTotal=c.total*rodada.valor;
  bilhetes.push({codigo,nome,tel,status:'Aguardando Pix',valor:valorTotal,valorBase:rodada.valor,totalBilhetes:c.total,secos:c.secos,duplos:c.duplos,triplos:c.triplos,palpites:JSON.parse(JSON.stringify(palpites)),combinacoes:gerarCombinacoes(),pontos:0,acertos:0,data:new Date().toLocaleString('pt-BR')});
  salvarDados(); msg.style.color='#108000'; msg.textContent=`Aposta confirmada! Código do bilhete: ${codigo}. Agora faça o Pix.`; mostrarPix(codigo,nome,tel,valorTotal); renderAdmin();
}

function salvarRodada(){rodada.nome=document.getElementById('rodadaNome').value||rodada.nome;rodada.valor=Number(document.getElementById('rodadaValor').value)||10;rodada.status=document.getElementById('rodadaStatus').value;salvarDados();renderRodadas();renderTicket();alert('Rodada atualizada!')}
function adicionarJogoAdmin(){const casa=document.getElementById('jogoCasa').value.trim(), fora=document.getElementById('jogoFora').value.trim(), data=document.getElementById('jogoData').value.trim(); if(!casa||!fora)return alert('Preencha os times.');jogos.push({id:jogos.length+1,data,casa,fora,odds:['1.80','3.20','4.20'],golsCasa:null,golsFora:null});salvarDados();document.getElementById('jogoCasa').value='';document.getElementById('jogoFora').value='';renderRodadas();renderTicket();renderAdmin()}
function excluirJogo(id){jogos=jogos.filter(j=>j.id!==id).map((j,i)=>({...j,id:i+1}));delete palpites[id];salvarDados();renderRodadas();renderTicket();renderAdmin()}
function confirmarPagamento(cod){const b=bilhetes.find(x=>x.codigo===cod);if(b){b.status='Pago';financeiro.transacoes.unshift({tipo:'Entrada',desc:'Pagamento confirmado '+cod,valor:Number(b.valor)||0,data:new Date().toLocaleString('pt-BR')}); if(confirm('Pagamento confirmado. Deseja imprimir o bilhete agora?')){salvarDados(); renderAdmin(); buscarBilhete(); imprimirBilhete(cod); return;}}salvarDados();renderAdmin();buscarBilhete()}
function salvarPixAdmin(){pixConfig.chave=document.getElementById('pixChave').value.trim()||pixConfig.chave;pixConfig.nome=document.getElementById('pixNome').value.trim()||pixConfig.nome;pixConfig.msg=document.getElementById('pixMsg').value.trim()||pixConfig.msg;salvarDados();alert('Configuração Pix salva!')}
function carregarPixAdmin(){if(document.getElementById('pixChave')){document.getElementById('pixChave').value=pixConfig.chave;document.getElementById('pixNome').value=pixConfig.nome;document.getElementById('pixMsg').value=pixConfig.msg;}}

function emv(id,valor){const v=String(valor);return id+String(v.length).padStart(2,'0')+v}
function crc16(payload){let crc=0xFFFF;for(let i=0;i<payload.length;i++){crc^=payload.charCodeAt(i)<<8;for(let j=0;j<8;j++){crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xFFFF;}}return crc.toString(16).toUpperCase().padStart(4,'0')}
function gerarPixCopiaCola({chave,nome,cidade,valor,txid,descricao}){
  const merchantAccount=emv('00','BR.GOV.BCB.PIX')+emv('01',chave)+emv('02',descricao.slice(0,72));
  const payloadSemCRC=emv('00','01')+emv('26',merchantAccount)+emv('52','0000')+emv('53','986')+emv('54',Number(valor).toFixed(2))+emv('58','BR')+emv('59',nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,25).toUpperCase())+emv('60',cidade.normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,15).toUpperCase())+emv('62',emv('05',txid.slice(0,25)))+'6304';
  return payloadSemCRC+crc16(payloadSemCRC);
}
function mostrarPix(codigo,nome,tel,valorPix=rodada.valor){
  const texto=gerarPixCopiaCola({chave:pixConfig.chave,nome:pixConfig.nome,cidade:'RIO DE JANEIRO',valor:valorPix,txid:codigo.replace(/[^A-Za-z0-9]/g,''),descricao:pixConfig.msg});
  document.getElementById('pixCopia').value=texto;
  const qr=document.getElementById('pixQrImg');
  if(qr){qr.src=`https://quickchart.io/qr?text=${encodeURIComponent(texto)}&size=240&margin=2`;}
  document.getElementById('pixBox').classList.add('show');
  const msg=encodeURIComponent(`Olá! Acabei de fazer o bilhete ${codigo} no Galera do Palpite. Nome: ${nome}. Telefone: ${tel}. Vou enviar o comprovante Pix.`);
  document.getElementById('whatsComprovante').href=`https://wa.me/55${tel.replace(/\D/g,'')}?text=${msg}`
}
function copiarPix(){const campo=document.getElementById('pixCopia');campo.select();document.execCommand('copy');alert('Pix copiado!')}
function resultadoJogo(j){if(j.golsCasa===null||j.golsFora===null||j.golsCasa===''||j.golsFora==='') return null; const a=Number(j.golsCasa), b=Number(j.golsFora); if(a>b)return 'casa'; if(a<b)return 'fora'; return 'empate'}
function setResultado(id,campo,valor){const j=jogos.find(x=>x.id===id); if(!j)return; j[campo]=valor===''?null:Number(valor); salvarDados();}
function calcularRanking(){
  const faltam=jogos.filter(j=>resultadoJogo(j)===null).length; if(faltam>0 && !confirm(`Ainda faltam ${faltam} resultado(s). Calcular mesmo assim?`)) return;
  ranking=bilhetes.filter(b=>b.status==='Pago').map(b=>{let melhor=0; const combos=b.combinacoes&&b.combinacoes.length?b.combinacoes:[b.palpites]; combos.forEach(combo=>{let pts=0; jogos.forEach(j=>{const r=resultadoJogo(j); if(r && combo[j.id]===r) pts++;}); if(pts>melhor) melhor=pts;}); b.pontos=melhor; b.acertos=melhor; return {...b,pontos:melhor,acertos:melhor};}).sort((a,b)=>b.pontos-a.pontos||b.acertos-a.acertos||a.codigo.localeCompare(b.codigo));
  salvarDados(); renderAdmin(); renderRankingPublico(); alert('Ranking calculado com sucesso!');
}
function salvarCampeaoHistorico(){
  if(!ranking.length){alert('Calcule o ranking antes.');return}
  const maior=ranking[0].pontos;
  const vencedores=ranking.filter(x=>x.pontos===maior);
  historico.unshift({rodada:rodada.nome,nome:vencedores.map(v=>v.nome).join(' / '),pontos:maior,acertos:maior,data:new Date().toLocaleDateString('pt-BR'),divisao:vencedores.length});
  salvarDados(); renderHistorico(); alert(`Campeão salvo: ${vencedores.map(v=>v.nome).join(' / ')}${vencedores.length>1?' - prêmio dividido':''}`);
}

function renderRankingTabela(lista,limite=10){
  if(!lista.length)return '<p>Nenhum ranking calculado ainda. Confirme pagamentos e lance os resultados no admin.</p>';
  const maior=lista[0]?.pontos ?? 0;
  return lista.slice(0,limite).map((b,i)=>`<div class="linha ranking-row ${b.pontos===maior?'winner-row':''}"><span class="posicao">${b.pontos===maior?'🏆':(i+1)+'º'}</span><span><b>${b.nome}</b><br><small>${b.codigo} • ${b.tel}${b.pontos===maior && lista.filter(x=>x.pontos===maior).length>1?' • prêmio dividido':''}</small></span><span class="pontos">${b.pontos} pts</span><span class="tag pago">${b.acertos} acertos</span></div>`).join('');
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
function htmlComprovante(b){
  const dataValidade = new Date(Date.now()+24*60*60*1000).toLocaleString('pt-BR');
  const jogosHtml = jogos.map(j=>`<div class="rec-jogo"><b>${j.casa} x ${j.fora}</b><br>Palpite: <b>${nomePalpite(b,j)}</b><br>Data/Hora: ${j.data}</div>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Bilhete ${b.codigo}</title><style>
    *{box-sizing:border-box} body{margin:0;background:#ddd;font-family:Arial,Helvetica,sans-serif;color:#111}.recibo{width:310px;min-height:100vh;background:#f4f26d;margin:0 auto;padding:18px 12px;font-size:13px;line-height:1.35}.recibo h1{text-align:center;font-size:22px;margin:0 0 2px}.site{text-align:center;font-weight:bold;font-size:12px;margin-bottom:28px}.meta{font-weight:bold;margin-bottom:22px}.titulo{text-align:center;font-weight:bold;margin:14px 0 8px}.rec-jogo{border-bottom:1px dashed #111;padding:7px 0;font-weight:500}.footer{font-weight:bold;margin-top:28px}.print-actions{position:fixed;right:20px;top:20px;display:flex;gap:8px}.print-actions button{border:0;border-radius:8px;padding:10px 14px;font-weight:800;cursor:pointer}.print{background:#118000;color:#fff}.close{background:#222;color:#fff}@media print{body{background:#fff}.recibo{margin:0;width:80mm;min-height:auto}.print-actions{display:none}@page{size:80mm auto;margin:0}}
  </style></head><body><div class="print-actions"><button class="print" onclick="window.print()">IMPRIMIR</button><button class="close" onclick="window.close()">FECHAR</button></div><div class="recibo"><h1>GALERA DO PALPITE</h1><div class="site">www.GaleraDoPalpite.com</div><div class="meta">COD BILHETE: ${b.codigo}<br>ID DA RODADA: ${rodada.nome}<br>DATA: ${b.data}<br>CLIENTE: ${b.nome}<br>VALIDADO EM: ${dataValidade}<br>CORRETOR: online<br>VALOR: R$ ${Number(b.valor).toFixed(2).replace('.',',')}</div><div class="titulo">PALPITES</div>${jogosHtml}<div class="footer">Acesse www.GaleraDoPalpite.com e conheça o regulamento!</div></div><script>setTimeout(()=>window.print(),300)<\/script></body></html>`;
}
function imprimirBilhete(cod){
  const b=bilhetes.find(x=>x.codigo===cod);
  if(!b){alert('Bilhete não encontrado.');return}
  if(b.status!=='Pago'){
    alert('Só é possível imprimir após confirmar o pagamento.');
    return;
  }
  const w=window.open('', '_blank', 'width=420,height=760');
  w.document.open();
  w.document.write(htmlComprovante(b));
  w.document.close();
}

function renderRankingPublico(){const el=document.getElementById('rankingPublico'); if(el) el.innerHTML=renderRankingTabela(ranking,10)}
function renderHistorico(){const el=document.getElementById('historicoVitorias'); if(!el)return; el.innerHTML=historico.map(h=>`<div class="linha"><span><b>${h.nome}</b><br><small>${h.rodada} • ${h.data}</small></span><span class="tag pago">${h.pontos} pts</span><span>${h.acertos} acertos</span></div>`).join('')||'<p>Nenhum campeão salvo ainda.</p>'}

function dinheiro(v){return 'R$ '+Number(v||0).toFixed(2).replace('.',',')}
function financeiroTotais(){
  const pagos=bilhetes.filter(b=>b.status==='Pago');
  const pendentes=bilhetes.filter(b=>b.status!=='Pago');
  const entradasBilhetes=pagos.reduce((s,b)=>s+(Number(b.valor)||0),0);
  const entradas=entradasBilhetes+(Number(financeiro.entradasExtras)||0);
  const pendenteValor=pendentes.reduce((s,b)=>s+(Number(b.valor)||0),0);
  const saidas=Number(financeiro.saidas)||0;
  const saldo=entradas-saidas;
  const premiacao=entradas*(Number(financeiro.percentualPremio)||0)/100;
  const equivPagos=pagos.reduce((s,b)=>s+(Number(b.totalBilhetes)||1),0);
  const ticketMedio=pagos.length?entradasBilhetes/pagos.length:0;
  return {pagos,pendentes,entradas,entradasBilhetes,pendenteValor,saidas,saldo,premiacao,equivPagos,ticketMedio};
}
function renderFinanceiroAdmin(){
  const t=financeiroTotais();
  const set=(id,txt)=>{const el=document.getElementById(id); if(el) el.textContent=txt};
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
}
function salvarPercentualPremio(){
  const v=Number(document.getElementById('finPercentualPremio')?.value||70);
  financeiro.percentualPremio=Math.max(0,Math.min(100,v));
  salvarDados(); renderFinanceiroAdmin();
}
function adicionarEntradaFinanceira(){
  const el=document.getElementById('finEntradaManual'); const v=Number(el?.value||0);
  if(v<=0) return alert('Informe um valor de entrada maior que zero.');
  financeiro.entradasExtras=(Number(financeiro.entradasExtras)||0)+v;
  financeiro.transacoes.unshift({tipo:'Entrada',desc:'Entrada manual',valor:v,data:new Date().toLocaleString('pt-BR')});
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

function renderAdmin(){
  carregarPixAdmin();
  const jogosHtml=jogos.map(j=>`<div class="linha jogo-admin"><span><b>${j.id}. ${j.casa} x ${j.fora}</b><br><small>${j.data}</small></span><span class="placar-admin"><input type="number" min="0" placeholder="${j.casa}" value="${j.golsCasa??''}" onchange="setResultado(${j.id},'golsCasa',this.value)"><b>x</b><input type="number" min="0" placeholder="${j.fora}" value="${j.golsFora??''}" onchange="setResultado(${j.id},'golsFora',this.value)"></span><button class="excluir" onclick="excluirJogo(${j.id})">Excluir</button></div>`).join('')||'<p>Nenhum jogo cadastrado.</p>';
  document.getElementById('adminJogos').innerHTML=jogosHtml;
  document.getElementById('adminBilhetes').innerHTML=bilhetes.map(b=>`<div class="linha"><span><b>${b.codigo}</b> - ${b.nome}<br><small>${b.tel} • ${b.totalBilhetes||1} bilhete(s) • R$ ${b.valor.toFixed(2).replace('.',',')} • ${b.pontos||0} pts</small></span><span class="tag ${b.status==='Pago'?'pago':'pendente'}">${b.status}</span>${b.status==='Pago'?`<button onclick="imprimirBilhete('${b.codigo}')">Imprimir</button>`:`<button onclick="confirmarPagamento('${b.codigo}')">Confirmar PG</button>`}</div>`).join('')||'<p>Nenhum bilhete recebido ainda.</p>';
  document.getElementById('adminRanking').innerHTML=renderRankingTabela(ranking,10);
  renderFinanceiroAdmin();
}
let mercadoFiltro='todos';
let mercadoUltimaLista=[];

function filtrarPorCodigoOuCelular(q){
  const termo=(q||'').trim().toLowerCase();
  const numeros=termo.replace(/\D/g,'');
  if(!termo) return [];
  return bilhetes.filter(b=>{
    const codigo=(b.codigo||'').toLowerCase();
    const tel=(b.tel||'').replace(/\D/g,'');
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
      <span><b>Rodada</b>${rodada.nome}</span>
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

carregarDados(); renderRodadas(); renderTicket(); renderAdmin(); renderRankingPublico(); renderHistorico();
