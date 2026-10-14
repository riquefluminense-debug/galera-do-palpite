// Valores monetários são somados em centavos.
function normalizarNome(nome) {
  return String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
function montarTopCampeoes(premios) {
  const grupos = new Map();
  for (const premio of premios) {
    const chave = normalizarNome(premio.nome);
    const item = grupos.get(chave) || {nome: premio.nome, totalCentavos: 0, titulos: 0};
    item.totalCentavos += premio.valor_centavos;
    item.titulos++;
    grupos.set(chave, item);
  }
  return [...grupos.values()].sort((a,b) => b.totalCentavos-a.totalCentavos || a.nome.localeCompare(b.nome,'pt-BR')).slice(0,10);
}
module.exports = {normalizarNome, montarTopCampeoes};
