// Parsing das planilhas de importação (Fornecedor, Itens e Custos).
// Mapeia colunas pelo nome do cabeçalho (tolerante a variações), com fallback
// por posição. Ignora linhas totalmente vazias.

function normHeader(s) {
  return String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

// --- Datas -----------------------------------------------------------------
// O ImportModal lê o arquivo com cellDates:true, então datas chegam como Date.
// Também tratamos serial do Excel e strings (DD/MM/YYYY, D/M/YY, ISO).

function excelSerialToDate(serial) {
  // Epoch do Excel: 1899-12-30. 25569 = dias até 1970-01-01.
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

function dateToBr(d) {
  // Arredonda para o dia mais próximo (mata o artefato de precisão do xlsx,
  // ex.: 03:00:28) e formata em UTC.
  const r = new Date(Math.round(d.getTime() / 86400000) * 86400000);
  const dd = String(r.getUTCDate()).padStart(2, '0');
  const mm = String(r.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${r.getUTCFullYear()}`;
}

// Converte um valor de célula de data em string DD/MM/YYYY.
export function toBrDate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return dateToBr(v);
  if (typeof v === 'number') return dateToBr(excelSerialToDate(v));
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${d.padStart(2, '0')}/${mo.padStart(2, '0')}/${y}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s; // não reconhecido — backend reporta como erro
}

// Índice da primeira coluna cujo cabeçalho casa com algum dos nomes aceitos.
function colIndex(headerRow, nomes) {
  const H = (headerRow || []).map(normHeader);
  for (const n of nomes) {
    const i = H.indexOf(normHeader(n));
    if (i >= 0) return i;
  }
  return -1;
}

// Template: coluna "LISTA FORNECEDOR".
export function parseFornecedor(aoa) {
  const header = aoa[0] || [];
  let idx = colIndex(header, ['LISTA FORNECEDOR', 'NOME_FORNECEDOR', 'FORNECEDOR', 'NOME']);
  if (idx < 0) idx = 0;

  const rows = [];
  for (const r of aoa.slice(1)) {
    const nome = String(r[idx] ?? '').trim();
    if (!nome) continue;
    rows.push({ NOME_FORNECEDOR: nome });
  }
  return {
    rows,
    previewCols: ['Fornecedor'],
    previewRows: rows.map((o) => [o.NOME_FORNECEDOR]),
  };
}

// Template: colunas "ITENS", "SUB CATEGORIA", "CATEGORIA".
export function parseItens(aoa) {
  const header = aoa[0] || [];
  let iItem = colIndex(header, ['ITENS', 'DESCRICAO_ITEM', 'ITEM', 'DESCRICAO', 'DESCRIÇÃO']);
  let iSub = colIndex(header, ['SUB CATEGORIA', 'SUB_CATEGORIA', 'SUBCATEGORIA', 'SUB-CATEGORIA']);
  const iCat = colIndex(header, ['CATEGORIA']);
  if (iItem < 0) iItem = 0;
  if (iSub < 0) iSub = 1;

  const rows = [];
  for (const r of aoa.slice(1)) {
    const desc = String(r[iItem] ?? '').trim();
    if (!desc) continue;
    rows.push({
      DESCRICAO_ITEM: desc,
      SUB_CATEGORIA: String(r[iSub] ?? '').trim(),
      CATEGORIA: iCat >= 0 ? String(r[iCat] ?? '').trim() : '',
    });
  }
  return {
    rows,
    previewCols: ['Item', 'Subcategoria', 'Categoria (arquivo)'],
    previewRows: rows.map((o) => [o.DESCRICAO_ITEM, o.SUB_CATEGORIA, o.CATEGORIA]),
  };
}

// --- NF-e (XML) ------------------------------------------------------------
// Extrai de um XML de NF-e (modelo 55) os campos que interessam ao Custo. Uma
// nota = N itens (<det>); cada item vira uma linha de custo no backend. A
// "inteligência" (dedup por chave, criar fornecedor/item, classificação) fica
// no backend; aqui só extraímos e normalizamos.

function txt(parent, tag) {
  if (!parent) return '';
  const el = parent.getElementsByTagName(tag)[0];
  return el ? el.textContent.trim() : '';
}

function numero(s) {
  const n = parseFloat(String(s || '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Converte um XML de NF-e (string) numa nota normalizada:
 *   { CHAVE_NFE, NUM_NOTA, DATA_NOTA: 'DD/MM/YYYY', FORNECEDOR,
 *     itens: [{ ITEM, QTD, VALOR_UNIT, VALOR_TOTAL }] }
 * Retorna null se não houver infNFe (arquivo que não é NF-e).
 */
export function parseNfeXml(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return null;
  const inf = doc.getElementsByTagName('infNFe')[0];
  if (!inf) return null;

  const ide = inf.getElementsByTagName('ide')[0];
  const emit = inf.getElementsByTagName('emit')[0];

  // Chave de acesso: atributo Id = "NFe" + 44 dígitos.
  const chave = String(inf.getAttribute('Id') || '').replace(/\D/g, '');
  const numNota = txt(ide, 'nNF');
  const dataNota = toBrDate(txt(ide, 'dhEmi') || txt(ide, 'dEmi'));
  const fornecedor = txt(emit, 'xNome');

  const itens = [];
  const dets = inf.getElementsByTagName('det');
  for (const det of dets) {
    const prod = det.getElementsByTagName('prod')[0];
    if (!prod) continue;
    itens.push({
      ITEM: txt(prod, 'xProd'),
      QTD: numero(txt(prod, 'qCom')),
      VALOR_UNIT: numero(txt(prod, 'vUnCom')),
      // vProd = total da linha; o backend respeita se > 0, senão recalcula.
      VALOR_TOTAL: numero(txt(prod, 'vProd')),
    });
  }

  return {
    CHAVE_NFE: chave, NUM_NOTA: numNota, DATA_NOTA: dataNota, FORNECEDOR: fornecedor, itens,
  };
}

// Template: DATA | N° NOTA | LISTA FORNECEDOR | ITENS | SUB CATEGORIA |
//           CATEGORIA | UN | VALOR | TOTAL. Toda a inteligência (criar
// fornecedor/item, derivar mês/ano, recalcular total) roda no backend; aqui só
// extraímos e normalizamos a data.
export function parseCustos(aoa) {
  const header = aoa[0] || [];
  const iData = colIndex(header, ['DATA', 'DATA NOTA', 'DATA_NOTA', 'DATA DA NOTA']);
  const iNota = colIndex(header, ['N° NOTA', 'Nº NOTA', 'N NOTA', 'NUM NOTA', 'NUMERO NOTA', 'NUM_NOTA', 'NOTA']);
  const iForn = colIndex(header, ['LISTA FORNECEDOR', 'FORNECEDOR', 'NOME_FORNECEDOR']);
  const iItem = colIndex(header, ['ITENS', 'ITEM', 'DESCRICAO_ITEM', 'DESCRICAO', 'DESCRIÇÃO']);
  const iSub = colIndex(header, ['SUB CATEGORIA', 'SUB_CATEGORIA', 'SUBCATEGORIA', 'SUB-CATEGORIA']);
  const iCat = colIndex(header, ['CATEGORIA']);
  const iUn = colIndex(header, ['UN', 'QTD', 'QUANTIDADE', 'UNID', 'UNIDADE', 'QTDE']);
  const iVal = colIndex(header, ['VALOR', 'VALOR UNIT', 'VALOR_UNIT', 'VALOR UNITARIO', 'V UNIT', 'VL UNIT']);
  const iTotal = colIndex(header, ['TOTAL', 'VALOR TOTAL', 'VALOR_TOTAL', 'VL TOTAL', 'V TOTAL']);

  const at = (r, i) => (i >= 0 ? r[i] : '');

  const rows = [];
  for (const r of aoa.slice(1)) {
    const fornecedor = String(at(r, iForn) ?? '').trim();
    const descricao = String(at(r, iItem) ?? '').trim();
    const data = toBrDate(at(r, iData));
    const un = at(r, iUn);
    const valor = at(r, iVal);
    const total = at(r, iTotal);
    // Pula linha completamente vazia.
    if (!fornecedor && !descricao && !data
        && (un === '' || un == null) && (valor === '' || valor == null)) continue;
    rows.push({
      DATA_NOTA: data,
      NUM_NOTA: String(at(r, iNota) ?? '').trim(),
      FORNECEDOR: fornecedor,
      ITEM: descricao,
      SUB_CATEGORIA: String(at(r, iSub) ?? '').trim(),
      CATEGORIA: String(at(r, iCat) ?? '').trim(),
      QTD: un,
      VALOR_UNIT: valor,
      // TOTAL do arquivo: se vier preenchido (>0), o backend o respeita; vazio
      // ou zero, recalcula UN × VALOR.
      VALOR_TOTAL: total,
    });
  }
  return {
    rows,
    previewCols: ['Data', 'Nº Nota', 'Fornecedor', 'Item', 'Subcat.', 'Categoria', 'Qtd', 'V.Unit', 'Total (arq.)'],
    previewRows: rows.map((o) => [
      o.DATA_NOTA, o.NUM_NOTA, o.FORNECEDOR, o.ITEM, o.SUB_CATEGORIA, o.CATEGORIA, o.QTD, o.VALOR_UNIT, o.VALOR_TOTAL,
    ]),
  };
}
