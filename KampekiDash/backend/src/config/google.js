import { google } from 'googleapis';

let sheetsClient = null;
let spreadsheetId = null;

// Lê e valida o JSON da Service Account vindo do .env.
function loadCredentials() {
  const raw = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!raw) {
    throw new Error('GOOGLE_CREDENTIALS_JSON não definido no .env');
  }
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    throw new Error('GOOGLE_CREDENTIALS_JSON não é um JSON válido');
  }
  // Quando a chave privada é colada com \n literais, normaliza para quebras reais.
  if (creds.private_key && creds.private_key.includes('\\n')) {
    creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  }
  return creds;
}

// Inicializa (uma única vez) o cliente autenticado do Google Sheets.
export async function getSheets() {
  if (sheetsClient) return sheetsClient;

  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return sheetsClient;
}

export function getSpreadsheetId() {
  if (!spreadsheetId) {
    spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('GOOGLE_SHEET_ID não definido no .env');
  }
  return spreadsheetId;
}
