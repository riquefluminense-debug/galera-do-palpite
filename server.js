const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// SERVIR FRONTEND DA PASTA ATUAL1
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/galeradopalpite';
const JWT_SECRET = process.env.JWT_SECRET || 'galera-do-palpite-chave-admin-local';
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Erro MongoDB:', err.message));

const AdminSchema = new mongoose.Schema({
  usuario: { type: String, unique: true, required: true },
  senhaHash: { type: String, required: true },
  criadoEm: { type: Date, default: Date.now }
});

const RodadaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  competicao: String,
  data: String,
  horario: String,
  premioEstimado: Number,
  valorBilhete: Number,
  status: { type: String, default: 'ABERTA' },
  criadaEm: { type: Date, default: Date.now }
});

const JogoSchema = new mongoose.Schema({
  rodadaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rodada', required: true },
  casa: { type: String, required: true },
  fora: { type: String, required: true },
  data: String,
  horario: String,
  golsCasa: Number,
  golsFora: Number,
  status: { type: String, default: 'AGUARDANDO' },
  resultadoEscolha: String,
  criadoEm: { type: Date, default: Date.now }
});

const RankingSchema = new mongoose.Schema({
  rodadaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rodada' },
  rodadaNome: String,
  codigo: String,
  nome: String,
  telefone: String,
  pontos: { type: Number, default: 0 },
  acertos: { type: Number, default: 0 },
  erros: { type: Number, default: 0 },
  pendentes: { type: Number, default: 0 },
  statusPagamento: String,
  pago: Boolean,
  manual: Boolean,
  detalhes: { type: Array, default: [] },
  atualizadoEm: { type: Date, default: Date.now }
});

const BilheteSchema = new mongoose.Schema({
  codigo: { type: String, unique: true, index: true },
  nome: { type: String, required: true },
  telefone: String,
  rodadaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rodada' },
  rodadaNome: String,
  palpites: { type: Array, default: [] },
  quantidade: { type: Number, default: 1 },
  valor: { type: Number, default: 0 },
  pontos: { type: Number, default: 0 },
  manual: { type: Boolean, default: false },
  pago: { type: Boolean, default: false },
  statusPagamento: { type: String, default: 'PENDENTE' },
  origem: { type: String, default: 'SITE' },
  observacao: String,
  criadoEm: { type: Date, default: Date.now },
  atualizadoEm: { type: Date, default: Date.now }
});

BilheteSchema.pre('save', function(next) {
  this.atualizadoEm = new Date();
  if (this.pago) this.statusPagamento = 'PAGO';
  next();
});

const Admin = mongoose.model('Admin', AdminSchema);
const Rodada = mongoose.model('Rodada', RodadaSchema);
const Jogo = mongoose.model('Jogo', JogoSchema);
const Bilhete = mongoose.model('Bilhete', BilheteSchema);
const Ranking = mongoose.model('Ranking', RankingSchema);

async function garantirAdminPadrao() {
  const usuarioAdmin = process.env.ADMIN_USER || 'admin';
  const senhaAdmin = process.env.ADMIN_PASSWORD || '123456';
  const existe = await Admin.findOne({ usuario: usuarioAdmin });

  if (!existe) {
    const senhaHash = await bcrypt.hash(senhaAdmin, 10);
    await Admin.create({ usuario: usuarioAdmin, senhaHash });
    console.log(`🔐 Admin criado: ${usuarioAdmin}`);
  }
}

mongoose.connection.once('open', garantirAdminPadrao);

function autenticarAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: 'Acesso negado. Faça login.' });
  }

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  }
}

async function gerarCodigoGDP() {
  const total = await Bilhete.countDocuments();
  let numero = total + 1;
  let codigo = `GDP-${String(numero).padStart(4, '0')}`;

  while (await Bilhete.exists({ codigo })) {
    numero++;
    codigo = `GDP-${String(numero).padStart(4, '0')}`;
  }

  return codigo;
}

function dataArquivo() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function dinheiroBR(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBR(v) {
  if (!v) return '-';
  return new Date(v).toLocaleString('pt-BR');
}

function limparTexto(v) {
  return String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
}

async function enviarExcel(res, nomeArquivo, nomeAba, colunas, linhas) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Galera do Palpite';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(nomeAba);
  sheet.columns = colunas;

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B301D' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };

  linhas.forEach(l => sheet.addRow(l));

  sheet.columns.forEach(col => {
    let max = 12;
    col.eachCell({ includeEmpty: true }, cell => {
      max = Math.max(max, String(cell.value ?? '').length + 2);
    });
    col.width = Math.min(max, 38);
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);

  await workbook.xlsx.write(res);
  res.end();
}

function iniciarPDF(res, nomeArquivo, titulo, subtitulo) {
  const doc = new PDFDocument({ margin: 35, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);

  doc.pipe(res);
  doc.fontSize(18).text('GALERA DO PALPITE', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(14).text(titulo, { align: 'center' });

  if (subtitulo) {
    doc.fontSize(9).fillColor('#555').text(subtitulo, { align: 'center' }).fillColor('#000');
  }

  doc.moveDown();
  return doc;
}

function linhaPDF(doc, itens) {
  const yInicial = doc.y;

  itens.forEach(([texto, x, largura]) => {
    doc.fontSize(8).text(limparTexto(texto), x, yInicial, { width: largura, lineGap: 1 });
  });

  doc.moveDown(1.2);
  if (doc.y > 760) doc.addPage();
}

// LOGIN ADMIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const admin = await Admin.findOne({ usuario });

    if (!admin) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

    const senhaOk = await bcrypt.compare(senha, admin.senhaHash);
    if (!senhaOk) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

    const token = jwt.sign(
      { id: admin._id, usuario: admin.usuario },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ ok: true, token, usuario: admin.usuario });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/auth/verificar', autenticarAdmin, async (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

app.put('/api/auth/alterar-senha', autenticarAdmin, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    const admin = await Admin.findById(req.admin.id);

    if (!admin) return res.status(404).json({ erro: 'Admin não encontrado' });

    const senhaOk = await bcrypt.compare(senhaAtual, admin.senhaHash);
    if (!senhaOk) return res.status(401).json({ erro: 'Senha atual incorreta' });

    admin.senhaHash = await bcrypt.hash(novaSenha, 10);
    await admin.save();

    res.json({ ok: true, mensagem: 'Senha alterada com sucesso' });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// HOME DO SITE
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// STATUS DA API
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    sistema: 'Galera do Palpite API',
    versao: '1.2',
    modulo: 'bilhetes-banco'
  });
});

// RODADAS
app.post('/api/rodadas', async (req, res) => {
  try {
    res.json(await Rodada.create(req.body));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/rodadas', async (req, res) => {
  res.json(await Rodada.find().sort({ criadaEm: -1 }));
});

app.put('/api/rodadas/:id', async (req, res) => {
  res.json(await Rodada.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete('/api/rodadas/:id', async (req, res) => {
  await Jogo.deleteMany({ rodadaId: req.params.id });
  await Bilhete.deleteMany({ rodadaId: req.params.id });
  await Rodada.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// JOGOS
app.post('/api/jogos', async (req, res) => {
  try {
    res.json(await Jogo.create(req.body));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/jogos', async (req, res) => {
  const filtro = {};
  if (req.query.rodadaId) filtro.rodadaId = req.query.rodadaId;
  res.json(await Jogo.find(filtro).sort({ criadoEm: 1 }));
});

app.put('/api/jogos/:id', async (req, res) => {
  res.json(await Jogo.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete('/api/jogos/:id', async (req, res) => {
  await Jogo.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// BILHETES
app.post('/api/bilhetes', async (req, res) => {
  try {
    const codigo = req.body.codigo || await gerarCodigoGDP();
    const pago = Boolean(req.body.pago || req.body.manual);

    const bilhete = await Bilhete.create({
      ...req.body,
      codigo,
      pago,
      statusPagamento: pago ? 'PAGO' : (req.body.statusPagamento || 'PENDENTE'),
      origem: req.body.manual ? 'MANUAL' : (req.body.origem || 'SITE')
    });

    res.json(bilhete);
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});
// PIX MERCADO PAGO
app.post('/api/pix/criar', async (req, res) => {
  try {
    if (!MP_ACCESS_TOKEN) {
      return res.status(500).json({ erro: 'MERCADO_PAGO_ACCESS_TOKEN não configurado' });
    }

    const { codigo, nome, telefone, valor } = req.body;

    const pagamento = {
      transaction_amount: Number(valor || 1),
      description: `Bilhete ${codigo} - Galera do Palpite`,
      payment_method_id: 'pix',
      payer: {
        email: `${codigo}@galeradopalpite.com.br`,
        first_name: nome || 'Cliente'
      },
      external_reference: codigo,
      notification_url: 'https://galeradopalpite.com.br/api/pix/webhook'
    };

    const resposta = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pagamento)
    });

    const data = await resposta.json();

    if (!resposta.ok) {
      return res.status(400).json({ erro: data.message || 'Erro ao criar Pix', detalhes: data });
    }

    await Bilhete.findOneAndUpdate(
      { codigo },
      {
        payment_id: data.id,
        external_reference: codigo
      }
    );

    res.json({
  ok: true,
  payment_id: data.id,
  status: data.status,
  qr_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
  pix_copia_cola: data.point_of_interaction?.transaction_data?.qr_code
});
    
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/pix/status/:codigo', async (req, res) => {
  try {
    const bilhete = await Bilhete.findOne({ codigo: req.params.codigo });

    if (!bilhete || !bilhete.payment_id) {
      return res.json({ status: 'pending' });
    }

    const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${bilhete.payment_id}`, {
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
      }
    });

    const data = await resposta.json();

    if (data.status === 'approved') {
      bilhete.statusPagamento = 'PAGO';
      bilhete.pago = true;
      bilhete.status = 'Pago';
      bilhete.pagoEm = new Date();
      await bilhete.save();
    }

    res.json({
      status: data.status,
      pago: data.status === 'approved'
    });

  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/pix/webhook', async (req, res) => {
  try {
    const id = req.body?.data?.id || req.query.id;

    if (id && MP_ACCESS_TOKEN) {
      const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
        }
      });

      const data = await resposta.json();

      if (data.status === 'approved' && data.external_reference) {
        const bilhete = await Bilhete.findOne({ codigo: data.external_reference });

        if (bilhete) {
          bilhete.statusPagamento = 'PAGO';
          bilhete.pago = true;
          bilhete.status = 'Pago';
          bilhete.pagoEm = new Date();
          bilhete.payment_id = data.id;
          await bilhete.save();
        }
      }
    }

    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(200);
  }
});

app.post('/api/bilhetes/manual', async (req, res) => {
  try {
    const codigo = req.body.codigo || await gerarCodigoGDP();

    const bilhete = await Bilhete.create({
      ...req.body,
      codigo,
      manual: true,
      origem: 'MANUAL',
      pago: true,
      statusPagamento: 'PAGO'
    });

    res.json(bilhete);
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/bilhetes', async (req, res) => {
  const filtro = {};

  if (req.query.rodadaId) filtro.rodadaId = req.query.rodadaId;
  if (req.query.codigo) filtro.codigo = new RegExp(req.query.codigo, 'i');
  if (req.query.telefone) filtro.telefone = new RegExp(req.query.telefone, 'i');
  if (req.query.statusPagamento) filtro.statusPagamento = req.query.statusPagamento;
  if (req.query.manual === 'true') filtro.manual = true;
  if (req.query.manual === 'false') filtro.manual = false;

  res.json(await Bilhete.find(filtro).sort({ criadoEm: -1 }));
});

app.get('/api/bilhetes/codigo/:codigo', async (req, res) => {
  const bilhete = await Bilhete.findOne({ codigo: req.params.codigo });

  if (!bilhete) return res.status(404).json({ erro: 'Bilhete não encontrado' });

  res.json(bilhete);
});

app.put('/api/bilhetes/:id', async (req, res) => {
  const update = { ...req.body, atualizadoEm: new Date() };

  if (update.pago === true) update.statusPagamento = 'PAGO';
  if (update.pago === false) update.statusPagamento = 'PENDENTE';

  const bilhete = await Bilhete.findByIdAndUpdate(req.params.id, update, { new: true });

  if (!bilhete) return res.status(404).json({ erro: 'Bilhete não encontrado' });

  res.json(bilhete);
});

app.patch('/api/bilhetes/:id/pagamento', async (req, res) => {
  const pago = req.body.pago !== false;

  const bilhete = await Bilhete.findByIdAndUpdate(req.params.id, {
    pago,
    statusPagamento: pago ? 'PAGO' : 'PENDENTE',
    atualizadoEm: new Date()
  }, { new: true });

  if (!bilhete) return res.status(404).json({ erro: 'Bilhete não encontrado' });

  res.json(bilhete);
});

app.delete('/api/bilhetes/:id', async (req, res) => {
  await Bilhete.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// RANKING
function normalizarEscolha(valor) {
  if (!valor) return "";

  return String(valor).toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "");
}

function escolhaAcertou(palpite, resultado) {
  const p = normalizarEscolha(palpite);
  const r = normalizarEscolha(resultado);

  if (!p || !r) return false;

  return p.split(/[\/,-]/).map(x => x.trim()).filter(Boolean).includes(r);
}

async function calcularRankingRodada(rodadaId) {
  const rodada = await Rodada.findById(rodadaId);
  if (!rodada) throw new Error('Rodada não encontrada');

  const jogos = await Jogo.find({ rodadaId }).sort({ criadoEm: 1 });
  const bilhetes = await Bilhete.find({ rodadaId }).sort({ criadoEm: 1 });

  await Ranking.deleteMany({ rodadaId });

  const ranking = [];

  for (const bilhete of bilhetes) {
    let pontos = 0;
    let acertos = 0;
    let erros = 0;
    let pendentes = 0;
    const detalhes = [];

    for (let i = 0; i < jogos.length; i++) {
      const jogo = jogos[i];

      const palpiteObj = (bilhete.palpites || []).find(p =>
        Number(p.jogo) === i + 1 || String(p.jogo) === String(jogo._id)
      );

      const escolha = palpiteObj ? (palpiteObj.escolha || palpiteObj.palpite || palpiteObj.valor || "") : "";

      const resultado = jogo.resultadoEscolha || (
        jogo.status === 'ENCERRADO' &&
        typeof jogo.golsCasa === 'number' &&
        typeof jogo.golsFora === 'number'
          ? (jogo.golsCasa > jogo.golsFora ? 'CASA' : jogo.golsCasa < jogo.golsFora ? 'FORA' : 'EMPATE')
          : ''
      );

      let status = 'PENDENTE';

      if (!resultado || jogo.status !== 'ENCERRADO') {
        pendentes++;
      } else if (escolhaAcertou(escolha, resultado)) {
        pontos++;
        acertos++;
        status = 'ACERTO';
      } else {
        erros++;
        status = 'ERRO';
      }

      detalhes.push({
        jogo: i + 1,
        casa: jogo.casa,
        fora: jogo.fora,
        escolha,
        resultado,
        status
      });
    }

    bilhete.pontos = pontos;
    await bilhete.save();

    const item = await Ranking.create({
      rodadaId,
      rodadaNome: rodada.nome,
      codigo: bilhete.codigo,
      nome: bilhete.nome,
      telefone: bilhete.telefone,
      pontos,
      acertos,
      erros,
      pendentes,
      statusPagamento: bilhete.statusPagamento,
      pago: bilhete.pago,
      manual: bilhete.manual,
      detalhes,
      atualizadoEm: new Date()
    });

    ranking.push(item);
  }

  return ranking.sort((a, b) =>
    (b.pontos || 0) - (a.pontos || 0) ||
    (b.acertos || 0) - (a.acertos || 0)
  );
}

app.get('/api/ranking', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.rodadaId) filtro.rodadaId = req.query.rodadaId;

    const ranking = await Ranking.find(filtro).sort({ pontos: -1, acertos: -1, atualizadoEm: 1 });

    res.json(ranking);
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/ranking/:rodadaId', async (req, res) => {
  try {
    const ranking = await Ranking.find({ rodadaId: req.params.rodadaId }).sort({
      pontos: -1,
      acertos: -1,
      atualizadoEm: 1
    });

    res.json(ranking);
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.post('/api/ranking/recalcular/:rodadaId', async (req, res) => {
  try {
    const ranking = await calcularRankingRodada(req.params.rodadaId);

    res.json({ ok: true, total: ranking.length, ranking });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.post('/api/ranking/recalcular', async (req, res) => {
  try {
    const rodadaId = req.body.rodadaId || req.query.rodadaId;

    if (!rodadaId) return res.status(400).json({ erro: 'rodadaId obrigatório' });

    const ranking = await calcularRankingRodada(rodadaId);

    res.json({ ok: true, total: ranking.length, ranking });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// EXPORTAÇÕES E BACKUP
app.get('/api/export/bilhetes/excel', autenticarAdmin, async (req, res) => {
  try {
    const filtro = {};
    if (req.query.rodadaId) filtro.rodadaId = req.query.rodadaId;

    const bilhetes = await Bilhete.find(filtro).sort({ criadoEm: -1 }).lean();

    await enviarExcel(res, `bilhetes-${dataArquivo()}.xlsx`, 'Bilhetes', [
      { header: 'Código', key: 'codigo' },
      { header: 'Cliente', key: 'nome' },
      { header: 'Telefone', key: 'telefone' },
      { header: 'Rodada', key: 'rodadaNome' },
      { header: 'Valor', key: 'valor' },
      { header: 'Status', key: 'statusPagamento' },
      { header: 'Origem', key: 'origem' },
      { header: 'Pontos', key: 'pontos' },
      { header: 'Data', key: 'criadoEm' }
    ], bilhetes.map(b => ({
      codigo: b.codigo || '',
      nome: b.nome || '',
      telefone: b.telefone || '',
      rodadaNome: b.rodadaNome || '',
      valor: Number(b.valor || 0),
      statusPagamento: b.pago ? 'PAGO' : 'PENDENTE',
      origem: b.manual ? 'MANUAL' : 'SITE',
      pontos: Number(b.pontos || 0),
      criadoEm: dataBR(b.criadoEm)
    })));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/export/ranking/excel', autenticarAdmin, async (req, res) => {
  try {
    const filtro = {};
    if (req.query.rodadaId) filtro.rodadaId = req.query.rodadaId;

    const ranking = await Ranking.find(filtro).sort({ pontos: -1, acertos: -1, atualizadoEm: 1 }).lean();

    await enviarExcel(res, `ranking-${dataArquivo()}.xlsx`, 'Ranking', [
      { header: 'Posição', key: 'posicao' },
      { header: 'Código', key: 'codigo' },
      { header: 'Cliente', key: 'nome' },
      { header: 'Telefone', key: 'telefone' },
      { header: 'Rodada', key: 'rodadaNome' },
      { header: 'Pontos', key: 'pontos' },
      { header: 'Acertos', key: 'acertos' },
      { header: 'Erros', key: 'erros' },
      { header: 'Pendentes', key: 'pendentes' },
      { header: 'Status pagamento', key: 'statusPagamento' },
      { header: 'Atualizado em', key: 'atualizadoEm' }
    ], ranking.map((r, i) => ({
      posicao: i + 1,
      codigo: r.codigo || '',
      nome: r.nome || '',
      telefone: r.telefone || '',
      rodadaNome: r.rodadaNome || '',
      pontos: Number(r.pontos || 0),
      acertos: Number(r.acertos || 0),
      erros: Number(r.erros || 0),
      pendentes: Number(r.pendentes || 0),
      statusPagamento: r.pago ? 'PAGO' : 'PENDENTE',
      atualizadoEm: dataBR(r.atualizadoEm)
    })));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/export/bilhetes/pdf', autenticarAdmin, async (req, res) => {
  try {
    const filtro = {};
    if (req.query.rodadaId) filtro.rodadaId = req.query.rodadaId;

    const bilhetes = await Bilhete.find(filtro).sort({ criadoEm: -1 }).lean();

    const doc = iniciarPDF(res, `bilhetes-${dataArquivo()}.pdf`, 'Relatório de Bilhetes', `Gerado em ${dataBR(new Date())}`);

    doc.fontSize(9).font('Helvetica-Bold').text(
      `Total: ${bilhetes.length} | Pagos: ${bilhetes.filter(b => b.pago).length} | Pendentes: ${bilhetes.filter(b => !b.pago).length}`
    );

    doc.moveDown();
    doc.font('Helvetica-Bold');

    linhaPDF(doc, [
      ['Código', 35, 70],
      ['Cliente', 105, 120],
      ['Telefone', 225, 90],
      ['Rodada', 315, 100],
      ['Valor', 415, 60],
      ['Status', 475, 70]
    ]);

    doc.font('Helvetica');

    bilhetes.forEach(b => linhaPDF(doc, [
      [b.codigo || '-', 35, 70],
      [b.nome || '-', 105, 120],
      [b.telefone || '-', 225, 90],
      [b.rodadaNome || '-', 315, 100],
      [dinheiroBR(b.valor), 415, 60],
      [b.pago ? 'PAGO' : 'PENDENTE', 475, 70]
    ]));

    doc.end();
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/export/ranking/pdf', autenticarAdmin, async (req, res) => {
  try {
    const filtro = {};
    if (req.query.rodadaId) filtro.rodadaId = req.query.rodadaId;

    const ranking = await Ranking.find(filtro).sort({ pontos: -1, acertos: -1, atualizadoEm: 1 }).lean();

    const doc = iniciarPDF(res, `ranking-${dataArquivo()}.pdf`, 'Relatório de Ranking', `Gerado em ${dataBR(new Date())}`);

    doc.fontSize(9).font('Helvetica-Bold').text(`Total no ranking: ${ranking.length}`);
    doc.moveDown();
    doc.font('Helvetica-Bold');

    linhaPDF(doc, [
      ['Pos.', 35, 40],
      ['Código', 75, 70],
      ['Cliente', 145, 135],
      ['Pontos', 280, 50],
      ['Acertos', 330, 50],
      ['Erros', 380, 50],
      ['Pend.', 430, 50],
      ['Status', 480, 65]
    ]);

    doc.font('Helvetica');

    ranking.forEach((r, i) => linhaPDF(doc, [
      [i + 1, 35, 40],
      [r.codigo || '-', 75, 70],
      [r.nome || '-', 145, 135],
      [r.pontos || 0, 280, 50],
      [r.acertos || 0, 330, 50],
      [r.erros || 0, 380, 50],
      [r.pendentes || 0, 430, 50],
      [r.pago ? 'PAGO' : 'PENDENTE', 480, 65]
    ]));

    doc.end();
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/backup/completo', autenticarAdmin, async (req, res) => {
  try {
    const backup = {
      sistema: 'Galera do Palpite',
      geradoEm: new Date().toISOString(),
      versaoBackup: '1.0',
      rodadas: await Rodada.find().lean(),
      jogos: await Jogo.find().lean(),
      bilhetes: await Bilhete.find().lean(),
      rankings: await Ranking.find().lean(),
      admins: await Admin.find().select('usuario criadoEm').lean()
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="backup-galera-${dataArquivo()}.json"`);

    res.json(backup);
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// FINANCEIRO
app.get('/api/financeiro/resumo', async (req, res) => {
  const filtro = {};

  if (req.query.rodadaId) filtro.rodadaId = req.query.rodadaId;

  const bilhetes = await Bilhete.find(filtro);
  const pagos = bilhetes.filter(b => b.pago);
  const pendentes = bilhetes.filter(b => !b.pago);

  const recebido = pagos.reduce((s, b) => s + (Number(b.valor) || 0), 0);
  const aConfirmar = pendentes.reduce((s, b) => s + (Number(b.valor) || 0), 0);

  res.json({
    totalBilhetes: bilhetes.length,
    pagos: pagos.length,
    pendentes: pendentes.length,
    recebido,
    aConfirmar,
    saldo: recebido
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
