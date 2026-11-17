// Teste rápido da Efí: autentica, cria uma cobrança de R$ 0,01 e consulta.
// Uso: npm run efi:testar
try { require('dotenv').config(); } catch (e) {}
const efiPix = require('../efi-pix');

(async () => {
  const efi = efiPix.criarClienteEfi(efiPix.lerConfig());
  console.log(`Ambiente: ${efi.config.sandbox ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'} (${efi.config.baseUrl})`);
  if (!efi.configurado) {
    console.error('Faltam variáveis no .env:', efi.faltando.join(', '));
    process.exit(1);
  }
  try {
    await efi.obterToken();
    console.log('✅ Autenticação OK (certificado + Client ID/Secret)');

    const pix = await efi.criarPix({ codigo: 'GDP-TESTE', valor: 0.01, descricao: 'Teste de integração Galera do Palpite' });
    console.log('✅ Cobrança criada. txid:', pix.txid, '| status:', pix.status_efi);
    console.log('   Pix Copia e Cola:', pix.pix_copia_cola);
    console.log('   QR Code em imagem:', pix.qr_base64 ? 'recebido' : 'não recebido');

    const cob = await efi.consultarCobranca(pix.txid);
    console.log('✅ Consulta OK. status:', cob.status);
  } catch (e) {
    console.error('❌', e.message);
    if (e.detalhes) console.error(JSON.stringify(e.detalhes, null, 2));
    process.exit(1);
  }
})();
