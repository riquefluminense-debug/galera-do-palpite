// =====================================================================
// GALERA DO PALPITE - INTEGRAÇÃO API PIX EFÍ (ex-Gerencianet)
// ---------------------------------------------------------------------
// - Autenticação OAuth2 (client_credentials) + certificado mTLS (.p12/.pem)
// - Cobrança imediata (cob) com txid próprio
// - QR Code (imagem base64) e Pix Copia e Cola
// - Consulta de status e configuração do webhook
//
// Nada daqui deve ir para o front-end: Client ID, Client Secret e
// certificado ficam somente no servidor (.env / variáveis do host).
// =====================================================================

const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const URLS_EFI = {
  producao: 'https://pix.api.efipay.com.br',
  homologacao: 'https://pix-h.api.efipay.com.br'
};

const STATUS_COB = {
  ATIVA: 'pending',
  CONCLUIDA: 'approved',
  REMOVIDA_PELO_USUARIO_RECEBEDOR: 'cancelled',
  REMOVIDA_PELO_PSP: 'cancelled'
};

function lerConfig(env = process.env) {
  const sandbox = String(env.EFI_SANDBOX ?? 'true').trim().toLowerCase() !== 'false';
  return {
    sandbox,
    baseUrl: String(env.EFI_BASE_URL || (sandbox ? URLS_EFI.homologacao : URLS_EFI.producao)).replace(/\/+$/, ''),
    clientId: (env.EFI_CLIENT_ID || '').trim(),
    clientSecret: (env.EFI_CLIENT_SECRET || '').trim(),
    chave: (env.EFI_PIX_KEY || '').trim(),
    certPath: (env.EFI_CERT_PATH || '').trim(),
    certBase64: (env.EFI_CERT_BASE64 || '').replace(/\s+/g, ''),
    certPassphrase: env.EFI_CERT_PASSPHRASE || '',
    expiracao: Number(env.EFI_PIX_EXPIRACAO) > 0 ? Math.floor(Number(env.EFI_PIX_EXPIRACAO)) : 3600,
    webhookUrl: (env.EFI_WEBHOOK_URL || '').trim(),
    webhookSecret: (env.EFI_WEBHOOK_SECRET || '').trim(),
    webhookSkipMtls: String(env.EFI_WEBHOOK_SKIP_MTLS ?? 'true').trim().toLowerCase() !== 'false',
    timeoutMs: Number(env.EFI_TIMEOUT_MS) > 0 ? Number(env.EFI_TIMEOUT_MS) : 20000
  };
}

function camposFaltando(cfg) {
  const faltando = [];
  if (!cfg.clientId) faltando.push('EFI_CLIENT_ID');
  if (!cfg.clientSecret) faltando.push('EFI_CLIENT_SECRET');
  if (!cfg.chave) faltando.push('EFI_PIX_KEY');
  if (!cfg.certPath && !cfg.certBase64) faltando.push('EFI_CERT_PATH ou EFI_CERT_BASE64');
  return faltando;
}

// ---------------------------------------------------------------------
// Certificado
// ---------------------------------------------------------------------
function lerCertificado(cfg) {
  let buffer;
  if (cfg.certBase64) {
    buffer = Buffer.from(cfg.certBase64, 'base64');
  } else {
    const caminho = path.isAbsolute(cfg.certPath) ? cfg.certPath : path.join(__dirname, cfg.certPath);
    if (!fs.existsSync(caminho)) {
      throw new Error(`Certificado Efí não encontrado em: ${caminho}`);
    }
    buffer = fs.readFileSync(caminho);
  }

  const ehPem = buffer.slice(0, 200).toString('utf8').includes('-----BEGIN');
  const opcoes = ehPem
    ? { cert: buffer, key: buffer, passphrase: cfg.certPassphrase || undefined }
    : { pfx: buffer, passphrase: cfg.certPassphrase };

  // Valida já na inicialização para dar um erro claro (e não um erro
  // genérico de TLS na primeira cobrança).
  try {
    tls.createSecureContext(opcoes);
  } catch (e) {
    const msg = String(e.message || e);
    if (!ehPem && /unsupported|mac verify|pkcs12|pfx/i.test(msg)) {
      throw new Error(
        'Não foi possível ler o certificado .p12 da Efí nesta versão do Node (' + msg + '). ' +
        'Converta para .pem com: openssl pkcs12 -in certificado.p12 -out certificado.pem -nodes -legacy ' +
        '(se pedir senha, apenas pressione Enter) e aponte EFI_CERT_PATH para o .pem.'
      );
    }
    throw new Error('Certificado Efí inválido: ' + msg);
  }

  return opcoes;
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

// txid: 26 a 35 caracteres [a-zA-Z0-9] (padrão Bacen)
function gerarTxid(codigo = '') {
  const base = ('GDP' + String(codigo)).replace(/[^A-Za-z0-9]/g, '').slice(0, 15);
  const aleatorio = crypto.randomBytes(16).toString('hex');
  return (base + aleatorio).slice(0, 35);
}

function txidValido(txid) {
  return /^[a-zA-Z0-9]{26,35}$/.test(String(txid || ''));
}

function formatarValor(valor) {
  const numero = Math.round(Number(valor) * 100) / 100;
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error('Valor do Pix inválido: ' + valor);
  }
  return numero.toFixed(2);
}

function statusParaSite(statusEfi) {
  return STATUS_COB[statusEfi] || 'pending';
}

function cobrancaPaga(cob) {
  return Boolean(cob && cob.status === 'CONCLUIDA');
}

// Efí acrescenta "/pix" ao final da URL do webhook. O parâmetro "ignorar="
// faz o "/pix" virar valor de query string, e o "hmac" identifica a Efí.
function montarUrlWebhook(urlBase, segredo) {
  if (!urlBase) throw new Error('EFI_WEBHOOK_URL não configurada');
  const separador = urlBase.includes('?') ? '&' : '?';
  const partes = [];
  if (segredo) partes.push('hmac=' + encodeURIComponent(segredo));
  partes.push('ignorar=');
  return urlBase + separador + partes.join('&');
}

function segredoWebhookValido(recebido, esperado) {
  if (!esperado) return true; // sem segredo configurado, a segurança fica só na reconsulta
  const a = Buffer.from(String(recebido || ''));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function erroEfi(status, corpo) {
  const detalhe = corpo && typeof corpo === 'object'
    ? (corpo.mensagem || corpo.error_description || corpo.detail || corpo.title || corpo.nome || corpo.error)
    : corpo;
  const err = new Error(`Efí respondeu ${status}${detalhe ? ': ' + detalhe : ''}`);
  err.status = status;
  err.detalhes = corpo;
  return err;
}

// ---------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------
function criarClienteEfi(cfg = lerConfig(), opcoes = {}) {
  const faltando = camposFaltando(cfg);
  let agente = null;
  let tokenCache = null; // { valor, expiraEm }

  function obterAgente() {
    if (agente) return agente;
    agente = new https.Agent({ ...lerCertificado(cfg), keepAlive: true });
    return agente;
  }

  function requisitarHttp({ metodo, caminho, corpo, cabecalhos }) {
    if (opcoes.requisitar) return opcoes.requisitar({ metodo, caminho, corpo, cabecalhos });

    return new Promise((resolve, reject) => {
      const url = new URL(cfg.baseUrl + caminho);
      const dados = corpo === undefined ? null : JSON.stringify(corpo);
      const req = https.request({
        method: metodo,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        agent: obterAgente(),
        timeout: cfg.timeoutMs,
        headers: {
          Accept: 'application/json',
          ...(dados ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dados) } : {}),
          ...cabecalhos
        }
      }, resp => {
        let texto = '';
        resp.setEncoding('utf8');
        resp.on('data', parte => { texto += parte; });
        resp.on('end', () => {
          let json = null;
          try { json = texto ? JSON.parse(texto) : null; } catch { json = texto; }
          resolve({ status: resp.statusCode, corpo: json });
        });
      });
      req.on('timeout', () => req.destroy(new Error('Tempo esgotado ao falar com a Efí')));
      req.on('error', reject);
      if (dados) req.write(dados);
      req.end();
    });
  }

  async function obterToken(forcar = false) {
    if (!forcar && tokenCache && tokenCache.expiraEm > Date.now()) return tokenCache.valor;
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    const resp = await requisitarHttp({
      metodo: 'POST',
      caminho: '/oauth/token',
      corpo: { grant_type: 'client_credentials' },
      cabecalhos: { Authorization: `Basic ${basic}` }
    });
    if (resp.status < 200 || resp.status >= 300 || !resp.corpo?.access_token) {
      throw erroEfi(resp.status, resp.corpo);
    }
    const segundos = Number(resp.corpo.expires_in) || 3600;
    tokenCache = { valor: resp.corpo.access_token, expiraEm: Date.now() + Math.max(segundos - 60, 30) * 1000 };
    return tokenCache.valor;
  }

  async function chamar(metodo, caminho, corpo, cabecalhosExtras = {}) {
    if (faltando.length) throw new Error('Efí não configurada. Faltam: ' + faltando.join(', '));
    let token = await obterToken();
    let resp = await requisitarHttp({ metodo, caminho, corpo, cabecalhos: { Authorization: `Bearer ${token}`, ...cabecalhosExtras } });
    if (resp.status === 401) {
      token = await obterToken(true);
      resp = await requisitarHttp({ metodo, caminho, corpo, cabecalhos: { Authorization: `Bearer ${token}`, ...cabecalhosExtras } });
    }
    if (resp.status < 200 || resp.status >= 300) throw erroEfi(resp.status, resp.corpo);
    return resp.corpo;
  }

  async function criarCobranca({ txid, valor, codigo, descricao }) {
    if (!txidValido(txid)) throw new Error('txid inválido: ' + txid);
    const corpo = {
      calendario: { expiracao: cfg.expiracao },
      valor: { original: formatarValor(valor) },
      chave: cfg.chave,
      solicitacaoPagador: String(descricao || `Bilhete ${codigo} - Galera do Palpite`).slice(0, 140)
    };
    if (codigo) corpo.infoAdicionais = [{ nome: 'Bilhete', valor: String(codigo).slice(0, 200) }];
    return chamar('PUT', `/v2/cob/${encodeURIComponent(txid)}`, corpo);
  }

  async function consultarCobranca(txid) {
    return chamar('GET', `/v2/cob/${encodeURIComponent(txid)}`);
  }

  async function gerarQrCode(locId) {
    return chamar('GET', `/v2/loc/${encodeURIComponent(locId)}/qrcode`);
  }

  // Cria a cobrança e já devolve tudo que o site precisa
  async function criarPix({ codigo, valor, descricao }) {
    const txid = gerarTxid(codigo);
    const cob = await criarCobranca({ txid, valor, codigo, descricao });
    return montarRespostaPix(cob);
  }

  async function montarRespostaPix(cob) {
    let qr = {};
    if (cob?.loc?.id !== undefined) {
      try { qr = await gerarQrCode(cob.loc.id); } catch (e) { console.warn('Efí: falha ao buscar imagem do QR Code:', e.message); }
    }
    return {
      txid: cob.txid,
      status_efi: cob.status,
      status: statusParaSite(cob.status),
      valor: cob?.valor?.original,
      pix_copia_cola: cob.pixCopiaECola || qr.qrcode || '',
      qr_base64: qr.imagemQrcode || '',
      link_visualizacao: qr.linkVisualizacao || '',
      expiracao: cob?.calendario?.expiracao,
      criacao: cob?.calendario?.criacao,
      cob
    };
  }

  async function configurarWebhook(urlWebhook = montarUrlWebhook(cfg.webhookUrl, cfg.webhookSecret)) {
    return chamar(
      'PUT',
      `/v2/webhook/${encodeURIComponent(cfg.chave)}`,
      { webhookUrl: urlWebhook },
      { 'x-skip-mtls-checking': cfg.webhookSkipMtls ? 'true' : 'false' }
    );
  }

  async function consultarWebhook() {
    return chamar('GET', `/v2/webhook/${encodeURIComponent(cfg.chave)}`);
  }

  return {
    config: cfg,
    configurado: faltando.length === 0,
    faltando,
    obterToken,
    criarCobranca,
    consultarCobranca,
    gerarQrCode,
    criarPix,
    montarRespostaPix,
    configurarWebhook,
    consultarWebhook
  };
}

module.exports = {
  URLS_EFI,
  lerConfig,
  camposFaltando,
  criarClienteEfi,
  gerarTxid,
  txidValido,
  formatarValor,
  statusParaSite,
  cobrancaPaga,
  montarUrlWebhook,
  segredoWebhookValido
};
