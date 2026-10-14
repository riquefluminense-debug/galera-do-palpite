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
 el.innerHTML=`<div class="campeoes-podio">${lista.slice(0,3).map((c,i)=>`<article class="cp-medalha cp-${i}"><span>${['🥇','🥈','🥉'][i]}</span><h2>${cpEscape(c.nome)}</h2><strong>${cpDinheiro(c.totalCentavos)}</strong></article>`).join('')}</div><div class="campeoes-scroll"><table class="campeoes-table"><caption>Top 10 — maiores ganhadores</caption><thead><tr><th>Posição</th><th>Campeão</th><th>Total recebido</th></tr></thead><tbody>${lista.map((c,i)=>`<tr><td>${['🥇','🥈','🥉'][i]||`${i+1}º`}</td><td>${cpEscape(c.nome)}</td><td>${cpDinheiro(c.totalCentavos)}</td></tr>`).join('')}</tbody></table></div><p>Ordem pelo total recebido. Desempate: nome em ordem alfabética.</p>`;
 }catch(e){el.textContent='Não foi possível carregar os campeões. Tente atualizar em instantes.';}
}
function cpMensagem(texto){document.getElementById('campeoesMensagem').textContent=texto;}
function encerrarCampeoes(){
 campeoesToken='';sessionStorage.removeItem('campeoesToken');
 document.getElementById('premiosLinhas').replaceChildren();
}
async function carregarPremiosAdmin(){
 if(document.querySelector('#premiosLinhas tr[data-dirty="true"]') && !confirm('Existem linhas não salvas. Descartar as alterações e atualizar?')) return;
 try{if(!campeoesToken){const sessao=await cpRequest('/login','POST',{usuario:USUARIO_ADMIN,senha:SENHA_ADMIN});campeoesToken=sessao.token;sessionStorage.setItem('campeoesToken',campeoesToken);} const premios=await cpRequest('/premios');document.getElementById('premiosLinhas').replaceChildren();premios.forEach(adicionarPremio);document.getElementById('nomesCampeoes').innerHTML=[...new Set(premios.map(p=>p.nome))].map(n=>`<option value="${cpEscape(n)}">`).join('');cpMensagem('Lançamentos carregados.');}catch(e){cpMensagem(e.message);}
}
function adicionarPremio(premio={}){
 const tr=document.createElement('tr');tr.dataset.id=premio.id||crypto.randomUUID();tr.dataset.saved=premio.id?'true':'false';tr.dataset.dirty=premio.id?'false':'true';
 tr.innerHTML=`<td><input aria-label="Nome e sobrenome" list="nomesCampeoes" maxlength="120" value="${cpEscape(premio.nome)}"></td><td><input aria-label="Valor do prêmio" inputmode="decimal" placeholder="0,00" value="${premio.valor_centavos?(premio.valor_centavos/100).toFixed(2).replace('.',','):''}"></td><td><button type="button" class="cp-save">Salvar</button><button type="button" class="cp-delete">Excluir</button><small class="cp-status" role="status">${premio.id?'Salvo':'Não salvo'}</small></td>`;
 tr.addEventListener('input',()=>{tr.dataset.dirty='true';tr.querySelector('.cp-status').textContent='Não salvo';});
 tr.querySelector('.cp-save').onclick=()=>salvarPremio(tr);tr.querySelector('.cp-delete').onclick=()=>excluirPremio(tr);document.getElementById('premiosLinhas').append(tr);
}
async function salvarPremio(tr){
 const [nome,valor]=[...tr.querySelectorAll('input')].map(e=>e.value.trim());
 const numero=valor.replace(',','.'); if(!/^\d+(\.\d{1,2})?$/.test(numero)){cpMensagem('Informe o valor como 90,00, sem separador de milhar.');return;}
 const body={id:tr.dataset.id,nome,valor_centavos:Math.round(Number(numero)*100)};
 const botoes=tr.querySelectorAll('button,input');botoes.forEach(b=>b.disabled=true);
 try{if(!campeoesToken){const sessao=await cpRequest('/login','POST',{usuario:USUARIO_ADMIN,senha:SENHA_ADMIN});campeoesToken=sessao.token;sessionStorage.setItem('campeoesToken',campeoesToken);} await cpRequest('/premios'+(tr.dataset.saved==='true'?`/${tr.dataset.id}`:''),tr.dataset.saved==='true'?'PUT':'POST',body);tr.dataset.saved='true';tr.dataset.dirty='false';tr.querySelector('.cp-status').textContent='Salvo';cpMensagem('Prêmio salvo. Ranking atualizado.');const op=document.createElement('option');op.value=nome;document.getElementById('nomesCampeoes').append(op);}catch(e){cpMensagem(e.message+' A linha continua na tela para tentar novamente.');}finally{botoes.forEach(b=>b.disabled=false);}
}
async function excluirPremio(tr){if(!confirm('Excluir este lançamento de prêmio?'))return;const botoes=tr.querySelectorAll('button,input');botoes.forEach(b=>b.disabled=true);try{if(tr.dataset.saved==='true')await cpRequest(`/premios/${tr.dataset.id}`,'DELETE');tr.remove();cpMensagem('Lançamento excluído.');}catch(e){cpMensagem(e.message);}finally{botoes.forEach(b=>b.disabled=false);}}
window.addEventListener('beforeunload',e=>{if(document.querySelector('#premiosLinhas tr[data-dirty="true"]')){e.preventDefault();e.returnValue='';}});


if(typeof adminLiberado!=='undefined' && adminLiberado) carregarPremiosAdmin();
