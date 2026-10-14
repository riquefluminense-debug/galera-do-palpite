let campeoesToken = sessionStorage.getItem('campeoesToken') || '';
const cpEscape = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cpDinheiro = n => (n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function cpRequest(caminho='',method='GET',body) {
 const resp=await fetch(`${API_URL}/campeoes${caminho}`,{method,headers:{'Content-Type':'application/json',...(campeoesToken?{Authorization:`Bearer ${campeoesToken}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await resp.json().catch(()=>({erro:'Resposta inválida do servidor.'}));
 if(!resp.ok) {if(resp.status===401){campeoesToken='';sessionStorage.removeItem('campeoesToken');} throw new Error(data.erro||'Não foi possível salvar.');} return data;
}
async function carregarCampeoesPublico(){
 const el=document.getElementById('campeoesPublico'); el.textContent='Carregando campeões…';
 try {const lista=await cpRequest(); if(!lista.length){el.textContent='Os primeiros campeões aparecerão aqui após o cadastro dos prêmios.';return;}
 el.innerHTML=`<div class="cp-league"><div class="cp-league-head"><div><span class="cp-eyebrow">GALERA DO PALPITE</span><h2>RANKING DOS CAMPEÕES</h2><p>Quem mais ganhou tem lugar no topo.</p></div><span class="cp-top-badge">TOP 10</span></div><table class="cp-standings"><caption class="cp-sr-only">Classificação por total recebido em prêmios</caption><thead><tr><th scope="col">POS.</th><th scope="col">CAMPEÃO</th><th scope="col">TOTAL GANHO</th></tr></thead><tbody>${lista.map((c,i)=>`<tr class="${i<3?'cp-place-'+i:''}"><td><span class="cp-position">${i<3?`<span aria-hidden="true">${['🥇','🥈','🥉'][i]}</span>`:''}<b>${String(i+1).padStart(2,'0')}</b></span></td><td><strong class="cp-player">${cpEscape(c.nome)}</strong>${i<3?`<span class="cp-rank-label">${['OURO','PRATA','BRONZE'][i]}</span>`:''}</td><td><strong class="cp-prize">${cpDinheiro(c.totalCentavos)}</strong></td></tr>`).join('')}</tbody></table><footer class="cp-league-footer"><span>💰 Prêmios pagos e acumulados</span><span>Classificação pelo maior valor recebido</span></footer></div>`;

 }catch(e){el.textContent='Não foi possível carregar os campeões. Tente atualizar em instantes.';}
}
function cpMensagem(texto){document.getElementById('campeoesMensagem').textContent=texto;}
function encerrarCampeoes(){
 campeoesToken='';sessionStorage.removeItem('campeoesToken');
 document.getElementById('premiosLinhas').replaceChildren();
}
async function carregarPremiosAdmin(){
 if(document.querySelector('#premiosLinhas tr[data-dirty="true"]') && !confirm('Existem linhas não salvas. Descartar as alterações e atualizar?')) return;
 try{if(!campeoesToken){const sessao=await cpRequest('/login','POST',{usuario:USUARIO_ADMIN,senha:SENHA_ADMIN});campeoesToken=sessao.token;sessionStorage.setItem('campeoesToken',campeoesToken);} const premios=await cpRequest('/premios');document.getElementById('premiosLinhas').replaceChildren();premios.forEach(adicionarPremio);document.getElementById('nomesCampeoes').innerHTML=[...new Set(premios.map(p=>p.nome))].map(n=>`<option value="${cpEscape(n)}">`).join('');cpMensagem('Lançamentos carregados.');cpAtualizarLista(premios);}catch(e){cpMensagem(e.message);}
}
function adicionarPremio(premio={}){
 const tr=document.createElement('tr');tr.dataset.id=premio.id||crypto.randomUUID();tr.dataset.saved=premio.id?'true':'false';tr.dataset.dirty='false';
 tr.innerHTML=`<td><input aria-label="Nome e sobrenome" list="nomesCampeoes" maxlength="120" value="${cpEscape(premio.nome)}"></td><td><input aria-label="Valor do prêmio" inputmode="decimal" placeholder="0,00" value="${premio.valor_centavos?(premio.valor_centavos/100).toFixed(2).replace('.',','):''}"></td><td><button type="button" class="cp-edit" ${premio.id?'':'hidden'}>Editar</button><button type="button" class="cp-save" ${premio.id?'hidden':''}>Salvar</button><button type="button" class="cp-delete">Excluir</button><small class="cp-status" role="status">${premio.id?'Salvo':'Não salvo'}</small></td>`;
 if(premio.id) tr.querySelectorAll('input').forEach(el=>el.readOnly=true);
 tr.querySelector('.cp-edit').onclick=()=>{tr.querySelectorAll('input').forEach(el=>el.readOnly=false);tr.querySelector('.cp-save').hidden=false;tr.querySelector('.cp-edit').hidden=true;tr.querySelector('input').focus();};
 tr.addEventListener('input',()=>{tr.dataset.dirty='true';tr.querySelector('.cp-status').textContent='Não salvo';});
 tr.querySelector('.cp-save').onclick=()=>salvarPremio(tr);tr.querySelector('.cp-delete').onclick=()=>excluirPremio(tr);document.getElementById('premiosLinhas').append(tr);return tr;
}
async function salvarPremio(tr){
 const [nome,valor]=[...tr.querySelectorAll('input')].map(e=>e.value.trim());
 const numero=valor.replace(',','.'); if(!/^\d+(\.\d{1,2})?$/.test(numero)){cpMensagem('Informe o valor como 90,00, sem separador de milhar.');return;}
 const novo=tr.dataset.saved!=='true';
 const body={id:tr.dataset.id,nome,valor_centavos:Math.round(Number(numero)*100)};
 const botoes=tr.querySelectorAll('button,input');botoes.forEach(b=>b.disabled=true);
 try{if(!campeoesToken){const sessao=await cpRequest('/login','POST',{usuario:USUARIO_ADMIN,senha:SENHA_ADMIN});campeoesToken=sessao.token;sessionStorage.setItem('campeoesToken',campeoesToken);} await cpRequest('/premios'+(tr.dataset.saved==='true'?`/${tr.dataset.id}`:''),tr.dataset.saved==='true'?'PUT':'POST',body);tr.dataset.saved='true';tr.dataset.dirty='false';tr.querySelector('.cp-status').textContent='Salvo';tr.querySelectorAll('input').forEach(el=>el.readOnly=true);tr.querySelector('.cp-save').hidden=true;tr.querySelector('.cp-edit').hidden=false;cpMensagem('Prêmio salvo. Para outra pessoa, use uma nova linha.');await cpRecarregarLista();if(novo && !document.querySelector('#premiosLinhas tr[data-saved="false"]')) adicionarPremio();const op=document.createElement('option');op.value=nome;document.getElementById('nomesCampeoes').append(op);}catch(e){cpMensagem(e.message+' A linha continua na tela para tentar novamente.');}finally{botoes.forEach(b=>b.disabled=false);}
}
async function excluirPremio(tr){if(!confirm('Excluir este lançamento de prêmio?'))return;const botoes=tr.querySelectorAll('button,input');botoes.forEach(b=>b.disabled=true);try{if(tr.dataset.saved==='true')await cpRequest(`/premios/${tr.dataset.id}`,'DELETE');tr.remove();cpMensagem('Lançamento excluído.');await cpRecarregarLista();}catch(e){cpMensagem(e.message);}finally{botoes.forEach(b=>b.disabled=false);}}
window.addEventListener('beforeunload',e=>{if(document.querySelector('#premiosLinhas tr[data-dirty="true"]')){e.preventDefault();e.returnValue='';}});


if(typeof adminLiberado!=='undefined' && adminLiberado) carregarPremiosAdmin();

function cpAtualizarLista(premios){
 const el=document.getElementById('cpListaSalvos');if(!el)return;
 const grupos=new Map();
 premios.forEach(p=>{const chave=p.nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');const c=grupos.get(chave)||{nome:p.nome,total:0,quantidade:0};c.total+=Number(p.valor_centavos);c.quantidade++;grupos.set(chave,c);});
 const lista=[...grupos.values()].sort((a,b)=>b.total-a.total||a.nome.localeCompare(b.nome,'pt-BR'));
 el.innerHTML=`<h3>Campeões cadastrados</h3><p>${lista.length} participante(s) · ${premios.length} prêmio(s) salvo(s)</p><div class="campeoes-scroll"><table class="cp-saved-table"><thead><tr><th>Posição</th><th>Nome e sobrenome</th><th>Prêmios</th><th>Total pago</th></tr></thead><tbody>${lista.map((c,i)=>`<tr><td>${i+1}º</td><td>${cpEscape(c.nome)}</td><td>${c.quantidade}</td><td>${cpDinheiro(c.total)}</td></tr>`).join('')||'<tr><td colspan="4">Nenhum campeão cadastrado ainda.</td></tr>'}</tbody><tfoot><tr><th colspan="3">Total pago</th><th>${cpDinheiro(lista.reduce((s,c)=>s+c.total,0))}</th></tr></tfoot></table></div>`;
}
async function cpRecarregarLista(){try{cpAtualizarLista(await cpRequest('/premios'));}catch(e){cpMensagem('Prêmio atualizado. Não foi possível atualizar a lista: '+e.message);}}
function cpImprimirLista(){
 const el=document.getElementById('cpListaSalvos');if(!el||!el.innerHTML)return;
 const janela=window.open('','_blank');if(!janela){cpMensagem('Permita a abertura da janela para imprimir a lista.');return;}
 janela.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Campeões — Galera do Palpite</title><style>body{font:14px Arial;margin:32px;color:#17251c}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{padding:12px;border:1px solid #bbb;text-align:left}thead,tfoot{background:#e8f0ea}td:last-child,th:last-child{text-align:right}@page{size:A4;margin:15mm}</style></head><body><h1>Galera do Palpite</h1>'+el.innerHTML+'</body></html>');janela.document.close();janela.focus();janela.print();
}
