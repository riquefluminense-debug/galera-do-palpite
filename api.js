
const API_URL = "http://localhost:3000/api";

async function apiRequest(endpoint, options = {}) {
  const resposta = await fetch(`${API_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...(localStorage.getItem("adminToken") ? { "Authorization": "Bearer " + localStorage.getItem("adminToken") } : {}) },
    ...options
  });
  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({ erro: "Erro de conexão" }));
    throw new Error(erro.erro || "Erro na API");
  }
  return await resposta.json();
}

async function salvarRodadaBanco(rodada) { return await apiRequest("/rodadas", { method: "POST", body: JSON.stringify(rodada) }); }
async function carregarRodadasBanco() { return await apiRequest("/rodadas"); }
async function atualizarRodadaBanco(id, rodada) { return await apiRequest(`/rodadas/${id}`, { method: "PUT", body: JSON.stringify(rodada) }); }
async function excluirRodadaBanco(id) { return await apiRequest(`/rodadas/${id}`, { method: "DELETE" }); }

async function salvarJogoBanco(jogo) { return await apiRequest("/jogos", { method: "POST", body: JSON.stringify(jogo) }); }
async function carregarJogosBanco(rodadaId = "") { return await apiRequest(`/jogos${rodadaId ? `?rodadaId=${rodadaId}` : ""}`); }
async function atualizarJogoBanco(id, jogo) { return await apiRequest(`/jogos/${id}`, { method: "PUT", body: JSON.stringify(jogo) }); }
async function excluirJogoBanco(id) { return await apiRequest(`/jogos/${id}`, { method: "DELETE" }); }

async function salvarBilheteBanco(bilhete) { return await apiRequest("/bilhetes", { method: "POST", body: JSON.stringify(bilhete) }); }
async function salvarBilheteManualBanco(bilhete) { return await apiRequest("/bilhetes/manual", { method: "POST", body: JSON.stringify(bilhete) }); }
async function carregarBilhetesBanco(rodadaId = "") { return await apiRequest(`/bilhetes${rodadaId ? `?rodadaId=${rodadaId}` : ""}`); }
async function buscarBilhetePorCodigoBanco(codigo) { return await apiRequest(`/bilhetes/codigo/${codigo}`); }
async function atualizarBilheteBanco(id, bilhete) { return await apiRequest(`/bilhetes/${id}`, { method: "PUT", body: JSON.stringify(bilhete) }); }
async function confirmarPagamentoBilheteBanco(id, pago = true) { return await apiRequest(`/bilhetes/${id}/pagamento`, { method: "PATCH", body: JSON.stringify({ pago }) }); }
async function excluirBilheteBanco(id) { return await apiRequest(`/bilhetes/${id}`, { method: "DELETE" }); }
async function carregarResumoFinanceiroBanco(rodadaId = "") { return await apiRequest(`/financeiro/resumo${rodadaId ? `?rodadaId=${rodadaId}` : ""}`); }


// AUTH ADMIN
async function loginAdmin(usuario, senha) {
  const dados = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ usuario, senha })
  });
  localStorage.setItem("adminToken", dados.token);
  localStorage.setItem("adminUsuario", dados.usuario);
  return dados;
}

async function verificarAdmin() {
  return await apiRequest("/auth/verificar");
}

function logoutAdmin() {
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUsuario");
  window.location.href = "login-admin.html";
}

async function alterarSenhaAdmin(senhaAtual, novaSenha) {
  return await apiRequest("/auth/alterar-senha", {
    method: "PUT",
    body: JSON.stringify({ senhaAtual, novaSenha })
  });
}


// RANKING AUTOMÁTICO
async function recalcularRankingBanco(rodadaId) {
  return await apiRequest(`/ranking/recalcular/${rodadaId}`, { method: "POST" });
}

async function carregarRankingBanco(rodadaId = "") {
  return await apiRequest(`/ranking${rodadaId ? `/${rodadaId}` : ""}`);
}

// EXPORTAÇÃO PDF/EXCEL E BACKUP
async function baixarArquivo(endpoint, nomePadrao) {
  const resposta = await fetch(`${API_URL}${endpoint}`, {
    headers: localStorage.getItem("adminToken") ? { "Authorization": "Bearer " + localStorage.getItem("adminToken") } : {}
  });
  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({ erro: "Erro ao baixar arquivo" }));
    throw new Error(erro.erro || "Erro ao baixar arquivo");
  }
  const blob = await resposta.blob();
  const cd = resposta.headers.get('Content-Disposition') || '';
  const match = cd.match(/filename="?([^";]+)"?/i);
  const nome = match ? match[1] : nomePadrao;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

async function exportarBilhetesExcel(rodadaId = "") { return baixarArquivo(`/export/bilhetes/excel${rodadaId ? `?rodadaId=${rodadaId}` : ""}`, "bilhetes.xlsx"); }
async function exportarBilhetesPDF(rodadaId = "") { return baixarArquivo(`/export/bilhetes/pdf${rodadaId ? `?rodadaId=${rodadaId}` : ""}`, "bilhetes.pdf"); }
async function exportarRankingExcel(rodadaId = "") { return baixarArquivo(`/export/ranking/excel${rodadaId ? `?rodadaId=${rodadaId}` : ""}`, "ranking.xlsx"); }
async function exportarRankingPDF(rodadaId = "") { return baixarArquivo(`/export/ranking/pdf${rodadaId ? `?rodadaId=${rodadaId}` : ""}`, "ranking.pdf"); }
async function baixarBackupCompleto() { return baixarArquivo('/backup/completo', 'backup-galera.json'); }
