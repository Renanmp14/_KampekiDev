import { getSheets, getSpreadsheetId } from '../config/google.js';

// Linha 1 = cabeçalho, linha 2 = notas/instrução, dados a partir da linha 3.
export const HEADER_ROW = 1;
export const DATA_START_ROW = 3;

// Definição das abas e seus cabeçalhos (ordem das colunas importa).
export const TABS = {
  FORNECEDOR: ['UUID', 'NOME_FORNECEDOR'],
  TAG: ['UUID', 'TAG'],
  ITENS: ['UUID', 'DESCRICAO_ITEM', 'SUB_CATEGORIA', 'CATEGORIA', 'TAG'],
  SUBCATEGORIA: ['UUID', 'SUB_CATEGORIA', 'CATEGORIA'],
  CUSTOS: [
    'UUID', 'DATA_NOTA', 'NUM_NOTA', 'MES_ANO', 'MES_NUM', 'ANO',
    'DIA_MES_ANO', 'FORNECEDOR', 'ITEM', 'SUB_CATEGORIA', 'CATEGORIA',
    'QTD', 'VALOR_UNIT', 'VALOR_TOTAL', 'TAG', 'CHAVE_NFE',
  ],
  FOLHA: [
    'UUID', 'MES_ANO', 'MES_NUM', 'ANO', 'TAG', 'ITEM_FOLHA', 'VALOR', 'OBSERVACAO',
  ],
};

// Converte índice de coluna (0-based) em letra(s) A1 (0->A, 26->AA).
function colLetter(idx) {
  let s = '';
  let n = idx;
  do {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function lastColLetter(tab) {
  return colLetter(TABS[tab].length - 1);
}

// Cache de metadados (sheetId por título) — recarregado em initSheets.
let sheetIdByTitle = {};

async function loadMetadata() {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  sheetIdByTitle = {};
  for (const s of meta.data.sheets || []) {
    sheetIdByTitle[s.properties.title] = s.properties.sheetId;
  }
  return meta;
}

export function getSheetId(tab) {
  return sheetIdByTitle[tab];
}

// Uso de células da planilha inteira (todas as abas) contra o limite do Google
// Sheets (10 milhões de células por planilha). O Google conta a GRADE de cada
// aba (rowCount × columnCount), incluindo células vazias dentro da grade — é
// exatamente esse número que se aproxima do limite. Retorna também o detalhe por
// aba, para depuração. Uma única chamada de metadados (barata).
export async function getCellUsage() {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title,gridProperties(rowCount,columnCount)))',
  });
  const detalhe = (meta.data.sheets || []).map((s) => {
    const gp = s.properties.gridProperties || {};
    const rows = gp.rowCount || 0;
    const cols = gp.columnCount || 0;
    return { title: s.properties.title, rows, cols, cells: rows * cols };
  });
  const used = detalhe.reduce((sum, d) => sum + d.cells, 0);
  const limit = Number(process.env.SHEETS_CELL_LIMIT || 10_000_000);
  return { used, limit, sheets: detalhe };
}

// Cria as abas faltantes com seus cabeçalhos. Não modifica dados existentes.
export async function initSheets() {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const meta = await loadMetadata();
  const existentes = new Set((meta.data.sheets || []).map((s) => s.properties.title));

  const aCriar = Object.keys(TABS).filter((t) => !existentes.has(t));
  if (aCriar.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: aCriar.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
    await loadMetadata();
    console.log(`[initSheets] Abas criadas: ${aCriar.join(', ')}`);
  } else {
    console.log('[initSheets] Todas as abas já existem.');
  }

  // Sincroniza o cabeçalho (linha 1) de TODAS as abas com a definição canônica
  // em TABS. Garante que colunas adicionadas posteriormente (ex.: CHAVE_NFE em
  // CUSTOS) ganhem o rótulo correto numa aba que já existia, sem tocar nos dados
  // (linha 2 = notas; dados a partir da linha 3).
  for (const tab of Object.keys(TABS)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A${HEADER_ROW}`,
      valueInputOption: 'RAW',
      requestBody: { values: [TABS[tab]] },
    });
  }
}

// Lê as linhas de dados (a partir da linha 3) como matriz de valores.
//
// valueRenderOption=UNFORMATTED_VALUE: números (QTD, VALOR_UNIT, VALOR_TOTAL...)
// voltam como número real, não como o texto formatado da célula. Sem isso, o
// default FORMATTED_VALUE devolve "1.234,56" (locale pt-BR) e o front não
// consegue parsear → exibe zero, mesmo com o dado correto na planilha.
// dateTimeRenderOption=FORMATTED_STRING mantém colunas de data (DATA_NOTA,
// MES_ANO...) como string de exibição, preservando o formato DD/MM/YYYY.
export async function getRows(tab) {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const range = `${tab}!A${DATA_START_ROW}:${lastColLetter(tab)}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data.values || [];
}

// Lê as linhas como objetos { COLUNA: valor }, incluindo o número real da linha.
export async function getObjects(tab) {
  const rows = await getRows(tab);
  const headers = TABS[tab];
  return rows.map((row, i) => {
    const obj = { _row: DATA_START_ROW + i };
    headers.forEach((h, c) => {
      obj[h] = row[c] !== undefined ? row[c] : '';
    });
    return obj;
  });
}

// Acrescenta uma linha de dados na primeira linha livre (>= 3).
export async function appendRow(tab, rowArray) {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const existing = await getRows(tab);
  const targetRow = DATA_START_ROW + existing.length;
  await ensureRowCapacity(tab, targetRow);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${targetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowArray] },
  });
  return targetRow;
}

// Garante que a aba tenha pelo menos `lastRowNeeded` linhas na grade, expandindo
// se necessário (o values.update não cria linhas além da grade existente).
export async function ensureRowCapacity(tab, lastRowNeeded) {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title,gridProperties(rowCount)))',
  });
  const sh = (meta.data.sheets || []).find((s) => s.properties.title === tab);
  if (!sh) throw new Error(`Aba não encontrada: ${tab}`);
  const atual = sh.properties.gridProperties.rowCount || 0;
  if (atual >= lastRowNeeded) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: { sheetId: sh.properties.sheetId, gridProperties: { rowCount: lastRowNeeded + 200 } },
          fields: 'gridProperties.rowCount',
        },
      }],
    },
  });
}

// Acrescenta várias linhas de uma vez, em lotes, a partir da primeira linha
// livre (>= 3). Faz poucas chamadas à API (1 leitura + N/chunk escritas),
// suportando importações grandes sem estourar limites de requisição.
export async function appendRows(tab, rowsArray, chunkSize = 2000) {
  if (!rowsArray.length) return { inseridas: 0, startRow: null };
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const existing = await getRows(tab);
  const startRow = DATA_START_ROW + existing.length;
  // Expande a grade para caber todas as novas linhas antes de escrever.
  await ensureRowCapacity(tab, startRow + rowsArray.length - 1);

  let written = 0;
  for (let i = 0; i < rowsArray.length; i += chunkSize) {
    const chunk = rowsArray.slice(i, i + chunkSize);
    const at = startRow + i;
    // eslint-disable-next-line no-await-in-loop
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A${at}`,
      valueInputOption: 'RAW', // texto literal — evita interpretação de fórmulas
      requestBody: { values: chunk },
    });
    written += chunk.length;
  }
  return { inseridas: written, startRow };
}

// Atualiza UMA coluna (mesmo valor) em vários registros identificados por UUID,
// em uma única chamada à API (values.batchUpdate). Retorna quantos foram tocados.
export async function updateColumnForUuids(tab, field, uuids, value) {
  const colIdx = TABS[tab].indexOf(field);
  if (colIdx < 0) throw new Error(`Campo desconhecido em ${tab}: ${field}`);
  const letter = colLetter(colIdx);
  const alvo = new Set(uuids);
  const objs = await getObjects(tab);
  const data = objs
    .filter((o) => alvo.has(o.UUID))
    .map((o) => ({ range: `${tab}!${letter}${o._row}`, values: [[value]] }));
  if (!data.length) return 0;
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
  return data.length;
}

// Localiza o número da linha (real) de um registro pelo UUID, ou null.
export async function findRowByUuid(tab, uuid) {
  const objs = await getObjects(tab);
  const found = objs.find((o) => o.UUID === uuid);
  return found ? found._row : null;
}

// Atualiza a linha inteira de um registro identificado pelo UUID.
export async function updateRowByUuid(tab, uuid, rowArray) {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const row = await findRowByUuid(tab, uuid);
  if (!row) throw new Error('Registro não encontrado');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowArray] },
  });
  return row;
}

// Remove VÁRIAS linhas identificadas por UUID em uma única chamada à API.
// Lê os registros uma vez, agrupa as linhas em intervalos contíguos e aplica as
// exclusões de baixo para cima (índices maiores primeiro) — assim cada remoção
// não invalida os índices das próximas. Retorna quantas linhas foram removidas.
export async function deleteRowsByUuid(tab, uuids) {
  const alvo = new Set(uuids || []);
  if (!alvo.size) return 0;
  const objs = await getObjects(tab);
  const linhas = objs.filter((o) => alvo.has(o.UUID)).map((o) => o._row).sort((a, b) => a - b);
  if (!linhas.length) return 0;

  // Agrupa linhas consecutivas em intervalos [startIndex, endIndex) 0-based.
  const ranges = [];
  let inicio = linhas[0];
  let anterior = linhas[0];
  for (let k = 1; k < linhas.length; k += 1) {
    if (linhas[k] === anterior + 1) { anterior = linhas[k]; continue; }
    ranges.push([inicio - 1, anterior]); // start 0-based, end exclusivo
    inicio = linhas[k];
    anterior = linhas[k];
  }
  ranges.push([inicio - 1, anterior]);
  // De baixo para cima, para não deslocar os índices ainda não processados.
  ranges.sort((a, b) => b[0] - a[0]);

  const sheetId = getSheetId(tab);
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: ranges.map(([startIndex, endIndex]) => ({
        deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex, endIndex } },
      })),
    },
  });
  return linhas.length;
}

// Remove a linha de um registro identificado pelo UUID (shift para cima).
export async function deleteRowByUuid(tab, uuid) {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const row = await findRowByUuid(tab, uuid);
  if (!row) throw new Error('Registro não encontrado');
  const sheetId = getSheetId(tab);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: row - 1, // 0-based
              endIndex: row, // exclusivo
            },
          },
        },
      ],
    },
  });
  return row;
}
