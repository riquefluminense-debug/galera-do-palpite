import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const NOTIFICATION_URL = process.env.MP_NOTIFICATION_URL || '';
const dataDir = path.join(__dirname, 'server-data');
const dataFile = path.join(dataDir, 'payments.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ payments: {} }, null, 2));

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

function readDb(){
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
  catch { return { payments: {} }; }
}
function writeDb(db){ fs.writeFileSync(dataFile, JSON.stringify(db, null, 2)); }
function savePayment(codigo, data){
  const db = readDb();
  db.payments[codigo] = { ...(db.payments[codigo] || {}), ...data, updated_at: new Date().toISOString() };
  writeDb(db);
  return db.payments[codigo];
}

app.post('/api/pix/criar', async (req, res) => {
  try {
    if (!ACCESS_TOKEN) return res.status(500).json({ ok:false, error:'Configure MERCADO_PAGO_ACCESS_TOKEN no arquivo .env' });
    const { codigo, nome, telefone, valor, rodadaId, rodadaNome } = req.body || {};
    if (!codigo || !nome || !valor) return res.status(400).json({ ok:false, error:'Dados obrigatórios ausentes.' });

    const external_reference = String(codigo);
    const body = {
      transaction_amount: Number(valor),
      description: `Bilhete ${codigo} - Galera do Palpite`,
      payment_method_id: 'pix',
      external_reference,
      payer: {
        email: `cliente-${String(codigo).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@galeradopalpite.local`,
        first_name: String(nome).split(' ')[0] || 'Cliente'
      },
      metadata: { codigo, nome, telefone, rodadaId, rodadaNome }
    };
    if (NOTIFICATION_URL) body.notification_url = NOTIFICATION_URL;

    const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${codigo}-${Date.now()}`
      },
      body: JSON.stringify(body)
    });
    const mp = await mpResp.json();
    if (!mpResp.ok) return res.status(400).json({ ok:false, error: mp.message || 'Mercado Pago recusou a criação do Pix.', details: mp });

    savePayment(codigo, {
      codigo, nome, telefone, valor:Number(valor), rodadaId, rodadaNome,
      payment_id: String(mp.id), external_reference, status: mp.status || 'pending', raw_status: mp.status_detail || '',
      created_at: new Date().toISOString()
    });

    return res.json({
      ok:true,
      payment_id: String(mp.id),
      external_reference,
      status: mp.status,
      pix_copia_cola: mp.point_of_interaction?.transaction_data?.qr_code || '',
      qr_base64: mp.point_of_interaction?.transaction_data?.qr_code_base64 || ''
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error:'Erro interno ao gerar Pix.' });
  }
});

async function atualizarPagamentoPorId(paymentId){
  if (!ACCESS_TOKEN || !paymentId) return null;
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });
  const mp = await resp.json();
  if (!resp.ok) throw new Error(mp.message || 'Erro ao consultar pagamento.');
  const codigo = mp.external_reference || mp.metadata?.codigo;
  if (codigo) {
    savePayment(codigo, {
      codigo,
      payment_id: String(mp.id),
      status: mp.status,
      raw_status: mp.status_detail || '',
      approved_at: mp.status === 'approved' ? (mp.date_approved || new Date().toISOString()) : undefined
    });
  }
  return mp;
}

app.get('/api/pix/status/:codigo', async (req, res) => {
  try {
    const codigo = req.params.codigo;
    const db = readDb();
    const item = db.payments[codigo];
    if (!item) return res.json({ ok:true, status:'not_found' });
    if (item.payment_id) {
      try { await atualizarPagamentoPorId(item.payment_id); } catch(e) { console.warn(e.message); }
    }
    const fresh = readDb().payments[codigo] || item;
    return res.json({ ok:true, status:fresh.status, payment_id:fresh.payment_id, codigo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error:'Erro ao consultar pagamento.' });
  }
});

app.post('/api/mercadopago/webhook', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query?.id || req.query?.['data.id'];
    if (paymentId) await atualizarPagamentoPorId(paymentId);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(200);
  }
});

app.listen(PORT, () => console.log(`Galera do Palpite rodando em http://localhost:${PORT}`));


let rankingFake = [];

app.get("/api/ranking", (req, res) => {
  res.json(rankingFake);
});

app.post("/api/ranking/recalcular", (req, res) => {
  rankingFake = [
    {
      codigo: "GDP-0001",
      nome: "Cliente Teste",
      telefone: "21999999999",
      pontos: 10,
      acertos: 5,
      erros: 0,
      pendentes: 0,
      pago: true,
      detalhes: [
        { jogo: 1, escolha: "CASA", resultado: "CASA", status: "ACERTO" }
      ]
    }
  ];

  res.json({
    sucesso: true,
    ranking: rankingFake
  });
});
