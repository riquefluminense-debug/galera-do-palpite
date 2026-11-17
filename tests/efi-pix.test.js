const {test}=require('node:test'),a=require('node:assert/strict');
const efiPix=require('../efi-pix');

function clienteFalso(rotas){
  const chamadas=[];
  const cfg=efiPix.lerConfig({EFI_CLIENT_ID:'id',EFI_CLIENT_SECRET:'segredo',EFI_PIX_KEY:'chave@teste.com',EFI_CERT_BASE64:'eA==',EFI_PIX_EXPIRACAO:'1800'});
  const efi=efiPix.criarClienteEfi(cfg,{requisitar:async req=>{chamadas.push(req);const r=rotas(req);return r;}});
  return {efi,chamadas};
}

test('txid segue o padrão Bacen (26 a 35 alfanuméricos) e é único',()=>{
  const t1=efiPix.gerarTxid('GDP-0001'),t2=efiPix.gerarTxid('GDP-0001');
  a.ok(efiPix.txidValido(t1));a.notEqual(t1,t2);a.ok(t1.startsWith('GDPGDP0001'));
  a.equal(efiPix.txidValido('123'),false);a.equal(efiPix.txidValido('GDP-0001-xxxxxxxxxxxxxxxxxxxxxx'),false);
});

test('valor vai com 2 casas e rejeita zero/negativo',()=>{
  a.equal(efiPix.formatarValor(10),'10.00');a.equal(efiPix.formatarValor('2.5'),'2.50');a.equal(efiPix.formatarValor(0.1+0.2),'0.30');
  a.throws(()=>efiPix.formatarValor(0));a.throws(()=>efiPix.formatarValor('abc'));
});

test('status da Efí vira status do site',()=>{
  a.equal(efiPix.statusParaSite('CONCLUIDA'),'approved');a.equal(efiPix.statusParaSite('ATIVA'),'pending');
  a.equal(efiPix.statusParaSite('REMOVIDA_PELO_PSP'),'cancelled');a.equal(efiPix.cobrancaPaga({status:'CONCLUIDA'}),true);a.equal(efiPix.cobrancaPaga({status:'ATIVA'}),false);
});

test('URL do webhook absorve o /pix e o hmac é conferido',()=>{
  a.equal(efiPix.montarUrlWebhook('https://x.com/api/pix/webhook','abc'),'https://x.com/api/pix/webhook?hmac=abc&ignorar=');
  a.equal(efiPix.segredoWebhookValido('abc','abc'),true);a.equal(efiPix.segredoWebhookValido('abd','abc'),false);a.equal(efiPix.segredoWebhookValido(undefined,'abc'),false);
});

test('aponta o que falta configurar',()=>{
  const e=efiPix.criarClienteEfi(efiPix.lerConfig({}));
  a.equal(e.configurado,false);a.deepEqual(e.faltando,['EFI_CLIENT_ID','EFI_CLIENT_SECRET','EFI_PIX_KEY','EFI_CERT_PATH ou EFI_CERT_BASE64']);
  a.equal(efiPix.lerConfig({}).baseUrl,'https://pix-h.api.efipay.com.br');a.equal(efiPix.lerConfig({EFI_SANDBOX:'false'}).baseUrl,'https://pix.api.efipay.com.br');
});

test('criarPix: autentica, cria cob com txid próprio e devolve QR + copia e cola',async()=>{
  const {efi,chamadas}=clienteFalso(req=>{
    if(req.caminho==='/oauth/token') return {status:200,corpo:{access_token:'tok',expires_in:3600}};
    if(req.metodo==='PUT'&&req.caminho.startsWith('/v2/cob/')) return {status:201,corpo:{txid:req.caminho.split('/').pop(),status:'ATIVA',loc:{id:7},valor:{original:req.corpo.valor.original},calendario:{expiracao:req.corpo.calendario.expiracao},pixCopiaECola:'000201COPIA'}};
    if(req.caminho==='/v2/loc/7/qrcode') return {status:200,corpo:{qrcode:'000201COPIA',imagemQrcode:'data:image/png;base64,AAA'}};
    return {status:404,corpo:{}};
  });
  const pix=await efi.criarPix({codigo:'GDP-0009',valor:12});
  a.ok(efiPix.txidValido(pix.txid));a.equal(pix.status,'pending');a.equal(pix.valor,'12.00');a.equal(pix.pix_copia_cola,'000201COPIA');a.equal(pix.qr_base64,'data:image/png;base64,AAA');
  const cob=chamadas.find(c=>c.metodo==='PUT');
  a.equal(cob.corpo.chave,'chave@teste.com');a.equal(cob.corpo.calendario.expiracao,1800);a.equal(cob.corpo.infoAdicionais[0].valor,'GDP-0009');a.equal(cob.cabecalhos.Authorization,'Bearer tok');
  a.equal(chamadas[0].cabecalhos.Authorization,'Basic '+Buffer.from('id:segredo').toString('base64'));
  await efi.consultarCobranca(pix.txid).catch(()=>{});
  a.equal(chamadas.filter(c=>c.caminho==='/oauth/token').length,1,'token reaproveitado');
});

test('token expirado (401) é renovado uma vez',async()=>{
  let tokens=0,tentativas=0;
  const {efi}=clienteFalso(req=>{
    if(req.caminho==='/oauth/token'){tokens++;return {status:200,corpo:{access_token:'t'+tokens,expires_in:3600}};}
    tentativas++;return req.cabecalhos.Authorization==='Bearer t1'?{status:401,corpo:{}}:{status:200,corpo:{txid:'x',status:'CONCLUIDA'}};
  });
  const cob=await efi.consultarCobranca('GDPGDP0001aaaaaaaaaaaaaaaaaaaa');
  a.equal(cob.status,'CONCLUIDA');a.equal(tokens,2);a.equal(tentativas,2);
});

test('erro da Efí chega com mensagem legível',async()=>{
  const {efi}=clienteFalso(req=>req.caminho==='/oauth/token'?{status:401,corpo:{error:'invalid_client',error_description:'Credenciais inválidas'}}:{status:200,corpo:{}});
  await a.rejects(()=>efi.obterToken(),/401: Credenciais inválidas/);
});

test('webhook manda x-skip-mtls-checking e a URL com hmac',async()=>{
  const {efi,chamadas}=clienteFalso(req=>req.caminho==='/oauth/token'?{status:200,corpo:{access_token:'tok'}}:{status:200,corpo:{webhookUrl:req.corpo?.webhookUrl}});
  await efi.configurarWebhook('https://x.com/api/pix/webhook?hmac=abc&ignorar=');
  const w=chamadas.find(c=>c.caminho.startsWith('/v2/webhook/'));
  a.equal(w.metodo,'PUT');a.equal(w.caminho,'/v2/webhook/chave%40teste.com');a.equal(w.cabecalhos['x-skip-mtls-checking'],'true');a.equal(w.corpo.webhookUrl,'https://x.com/api/pix/webhook?hmac=abc&ignorar=');
});
