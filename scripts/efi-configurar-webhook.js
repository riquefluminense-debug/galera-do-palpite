// Registra na Efí a URL de webhook da chave Pix (confirmação automática).
// Uso: npm run efi:webhook          -> registra/atualiza
//      npm run efi:webhook -- ver   -> só mostra o que está registrado
try { require('dotenv').config(); } catch (e) {}
const efiPix = require('../efi-pix');

(async () => {
  const efi = efiPix.criarClienteEfi(efiPix.lerConfig());
  if (!efi.configurado) {
    console.error('Faltam variáveis no .env:', efi.faltando.join(', '));
    process.exit(1);
  }
  try {
    if (process.argv.includes('ver')) {
      console.log(await efi.consultarWebhook());
      return;
    }
    if (!efi.config.webhookUrl) throw new Error('Configure EFI_WEBHOOK_URL no .env (precisa ser HTTPS público).');
    if (!efi.config.webhookSecret) console.warn('⚠️ EFI_WEBHOOK_SECRET vazio: recomendo definir um segredo.');
    const url = efiPix.montarUrlWebhook(efi.config.webhookUrl, efi.config.webhookSecret);
    await efi.configurarWebhook(url);
    console.log('✅ Webhook registrado para a chave', efi.config.chave);
    console.log('   URL:', url.replace(/hmac=[^&]+/, 'hmac=***'));
  } catch (e) {
    console.error('❌', e.message);
    if (e.detalhes) console.error(JSON.stringify(e.detalhes, null, 2));
    process.exit(1);
  }
})();
