// Pré-build: barra o empacotamento se o desktop/build/.env estiver faltando ou
// ainda com valores de exemplo (placeholders). Evita gerar um instalador com
// credenciais fake (login não entra, Sheets não conecta).
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, 'build', '.env');

if (!fs.existsSync(envPath)) {
  console.error(`\n[check-env] Arquivo não encontrado: ${envPath}`);
  console.error('Crie-o a partir de build/.env.example e preencha as credenciais reais.\n');
  process.exit(1);
}

require('dotenv').config({ path: envPath });

const val = (k) => String(process.env[k] || '').trim();
const errs = [];

if (!val('ADMIN_EMAIL') || val('ADMIN_EMAIL') === 'admin@kampeki.local') {
  errs.push('ADMIN_EMAIL vazio ou ainda no valor de exemplo (admin@kampeki.local).');
}
if (!val('ADMIN_PASSWORD') || val('ADMIN_PASSWORD') === 'defina_uma_senha') {
  errs.push('ADMIN_PASSWORD vazio ou ainda no valor de exemplo (defina_uma_senha).');
}
if (!val('JWT_SECRET') || /troque_por/i.test(val('JWT_SECRET'))) {
  errs.push('JWT_SECRET vazio ou ainda placeholder.');
}
if (!val('GOOGLE_SHEET_ID') || val('GOOGLE_SHEET_ID') === 'coloque_o_id_da_planilha') {
  errs.push('GOOGLE_SHEET_ID vazio ou placeholder.');
}
try {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '');
  if (!creds.private_key || !creds.client_email) {
    errs.push('GOOGLE_CREDENTIALS_JSON sem private_key/client_email.');
  }
} catch {
  errs.push('GOOGLE_CREDENTIALS_JSON ausente ou não é JSON válido (precisa estar em UMA linha).');
}

if (errs.length) {
  console.error('\n[check-env] desktop/build/.env NÃO está pronto para o build:');
  errs.forEach((e) => console.error(`  ✗ ${e}`));
  console.error('\nCorrija desktop/build/.env e rode de novo.\n');
  process.exit(1);
}

console.log(`[check-env] OK — credenciais reais presentes (login: ${val('ADMIN_EMAIL')}).`);
