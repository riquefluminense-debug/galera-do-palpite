const crypto = require('node:crypto');
function createClient(env = process.env, request = fetch) {
  const environment = env.PAGBANK_ENV || 'sandbox';
  if (!['sandbox', 'production'].includes(environment)) throw new Error('PAGBANK_ENV inválido');
  const base = environment === 'production' ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';
  return { environment, async call(method, route, body, key) {
    if (!env.PAGBANK_TOKEN) throw new Error('Configure PAGBANK_TOKEN no servidor');
    const response = await request(base + route, {
      method, signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${env.PAGBANK_TOKEN}`, 'Content-Type': 'application/json', ...(key ? {'x-idempotency-key': key} : {}) },
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`PagBank HTTP ${response.status}: ${data.error_messages?.map(x => x.description || x.code).join('; ') || 'requisição recusada'}`);
    return data;
  }};
}
function payload(ticket, customer, webhook) {
  const amount = Math.round(Number(ticket.valor) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Valor do bilhete inválido');
  const cpf = String(customer.cpf || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email || '')) throw new Error('Informe CPF e e-mail do pagador');
  if (!webhook || !webhook.startsWith('https://')) throw new Error('Configure PAGBANK_WEBHOOK_URL com HTTPS');
  return { reference_id: ticket.codigo, customer: {name: ticket.nome, email: customer.email, tax_id: cpf},
    items: [{reference_id: ticket.codigo, name: `Bilhete Galera do Palpite ${ticket.codigo}`, quantity: 1, unit_amount: amount}],
    charges: [{reference_id: ticket.codigo, description: `Bilhete Galera do Palpite ${ticket.codigo}`, amount: {value: amount, currency: 'BRL'}, payment_method: {type: 'PIX', pix: {expiration_date: new Date(Date.now()+30*60000).toISOString()}}}],
    notification_urls: [webhook] };
}
function paymentResult(order, saved) {
  if (order.id !== saved.orderId || order.reference_id !== saved.codigo) throw new Error('Pedido não corresponde ao bilhete');
  const charge = order.charges?.find(c => c.reference_id === saved.codigo && c.payment_method?.type === 'PIX');
  if (!charge || charge.amount?.currency !== 'BRL' || charge.amount.value !== saved.amount) throw new Error('Valor ou cobrança divergente');
  return { paid: charge.status === 'PAID' && Number(charge.amount.summary?.refunded || 0) === 0, status: charge.status, charge };
}
function install(app, {mongoose, readTicket, markPaid, env = process.env}) {
  const client = createClient(env);
  const Payment = mongoose.model('PagBankPayment', new mongoose.Schema({
    codigo: String, environment: String, orderId: String, amount: Number, paid: {type:Boolean,default:false}
  }));
  Payment.schema.index({codigo:1,environment:1},{unique:true});
  const locks = new Set();
  async function sync(saved) {
    const order = await client.call('GET', `/orders/${encodeURIComponent(saved.orderId)}`);
    const result = paymentResult(order, saved);
    if (result.paid) {
      // Sandbox nunca altera bilhetes reais no Supabase ou Mongo.
      if (client.environment === 'production') await markPaid(saved.codigo);
      await Payment.updateOne({_id:saved._id}, {$set:{paid:true}});
    }
    return {ok:true, codigo:saved.codigo, pago:result.paid, status:result.paid?'approved':'pending', provider_status:result.status, ambiente:client.environment};
  }
  app.post('/api/pix/criar', async (req,res) => {
    const codigo = String(req.body.codigo || '');
    if (!/^GDP-\d+$/.test(codigo)) return res.status(400).json({erro:'Código inválido'});
    if (locks.has(codigo)) return res.status(409).json({erro:'Cobrança em processamento. Tente novamente.'});
    locks.add(codigo);
    try {
      let saved = await Payment.findOne({codigo,environment:client.environment});
      let order;
      if (saved) order = await client.call('GET', `/orders/${encodeURIComponent(saved.orderId)}`);
      else {
        const ticket = await readTicket(codigo);
        if (!ticket || ticket.status === 'Pago') throw new Error('Bilhete não encontrado ou já pago');
        const body = payload(ticket, req.body, env.PAGBANK_WEBHOOK_URL);
        order = await client.call('POST','/orders',body,crypto.createHash('sha256').update(`${client.environment}:${codigo}`).digest('hex'));
        saved = await Payment.create({codigo,environment:client.environment,orderId:order.id,amount:body.charges[0].amount.value});
      }
      const result = paymentResult(order,saved);
      const qr = result.charge.qr_code;
      if (!qr?.text && !result.paid) throw new Error('PagBank não disponibilizou QR Code: '+result.status);
      res.json({ok:true,codigo,payment_id:order.id,external_reference:codigo,pix_copia_cola:qr?.text || '',ambiente:client.environment,status:result.status});
    } catch(e) {res.status(400).json({erro:e.message});} finally {locks.delete(codigo);}
  });
  app.get('/api/pix/status/:codigo',async(req,res)=>{
    try {
      const saved=await Payment.findOne({codigo:req.params.codigo,environment:client.environment});
      if(!saved) return res.json({status:'pending',pago:false,ambiente:client.environment});
      res.json(await sync(saved));
    }catch(e){res.status(502).json({erro:e.message});}
  });
  app.post('/api/pix/webhook',async(req,res)=>{
    // Notificação é somente um gatilho: nunca confiamos no status/valor recebido.
    // A API autenticada é consultada antes de alterar qualquer bilhete.
    try {
      const saved=await Payment.findOne({orderId:String(req.body.id || ''),environment:client.environment});
      if(saved) await sync(saved);
      res.sendStatus(200);
    }catch(e){res.sendStatus(503);}
  });
}
module.exports={createClient,payload,paymentResult,install};
