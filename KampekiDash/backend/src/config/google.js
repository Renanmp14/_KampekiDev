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

// --- Resiliência a falhas transitórias do Google ---------------------------
// A API do Sheets falha de vez em quando por motivos que não são erro nosso:
// cota estourada num pico (429 — o limite é por service account, e a VM mais
// cada desktop compartilham a MESMA), indisponibilidade momentânea (500/503) ou
// conexão cortada. Sem retentativa, isso vira erro na tela e uma tabela vazia —
// que o usuário lê, com razão, como "perdi meus dados".
const HTTP_TRANSITORIO = new Set([408, 429, 500, 502, 503, 504]);
const REDE_TRANSITORIA = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE', 'ERR_STREAM_PREMATURE_CLOSE',
]);

function ehTransitorio(err) {
  const status = typeof err?.code === 'number' ? err.code : err?.response?.status;
  if (typeof status === 'number' && HTTP_TRANSITORIO.has(status)) return true;
  return typeof err?.code === 'string' && REDE_TRANSITORIA.has(err.code);
}

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function comRetry(rotulo, fn, tentativas = 4) {
  let ultimo;
  for (let i = 0; i < tentativas; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (e) {
      ultimo = e;
      if (!ehTransitorio(e) || i === tentativas - 1) throw e;
      // Backoff exponencial com jitter (500ms, 1s, 2s ±20%) — é o que o próprio
      // Google recomenda para 429/5xx. Sem o jitter, dois clientes que estouraram
      // a cota juntos voltariam a bater juntos.
      const base = 500 * (2 ** i);
      const atraso = Math.round(base * (0.8 + Math.random() * 0.4));
      console.warn(`[sheets] ${rotulo} falhou (${e.code || e.message}) — tentativa ${i + 2}/${tentativas} em ${atraso}ms`);
      // eslint-disable-next-line no-await-in-loop
      await espera(atraso);
    }
  }
  throw ultimo;
}

/**
 * Envolve o cliente do googleapis mantendo EXATAMENTE a mesma forma
 * (`sheets.spreadsheets.values.get`, etc.), para que nenhum ponto de chamada
 * precise saber que existe retentativa.
 *
 * O que é repetido e o que NÃO é — a distinção importa:
 *  - leituras (`values.get`, `spreadsheets.get`): sempre seguras;
 *  - `values.update` / `values.batchUpdate`: gravam em FAIXAS FIXAS já
 *    calculadas (o projeto nunca usa `values.append`), então repetir reescreve
 *    as mesmas células — mesmo resultado;
 *  - `spreadsheets.batchUpdate`: **não é repetido**. É a chamada estrutural
 *    (`deleteDimension`, `insertDimension`, `addSheet`) e uma exclusão de linhas
 *    repetida depois de já ter funcionado apagaria OUTRAS linhas. Aqui é melhor
 *    devolver o erro e deixar a pessoa decidir do que arriscar apagar dado.
 */
function envolverComRetry(client) {
  const ss = client.spreadsheets;
  return {
    ...client,
    spreadsheets: {
      ...ss,
      get: (p) => comRetry('spreadsheets.get', () => ss.get(p)),
      batchUpdate: (p) => ss.batchUpdate(p), // sem retry — ver nota acima
      values: {
        ...ss.values,
        get: (p) => comRetry('values.get', () => ss.values.get(p)),
        update: (p) => comRetry('values.update', () => ss.values.update(p)),
        batchUpdate: (p) => comRetry('values.batchUpdate', () => ss.values.batchUpdate(p)),
      },
    },
  };
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
  sheetsClient = envolverComRetry(google.sheets({ version: 'v4', auth: authClient }));
  return sheetsClient;
}

export function getSpreadsheetId() {
  if (!spreadsheetId) {
    spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('GOOGLE_SHEET_ID não definido no .env');
  }
  return spreadsheetId;
}
