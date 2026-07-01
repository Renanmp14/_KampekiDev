// Extração de campos de uma NFS-e de serviço (DANFSe v1.0) a partir do PDF.
// O layout é padronizado nacionalmente (validado com Porto Alegre e Canoas): o
// texto sai em pares rótulo → valor. Extraímos o texto no navegador com
// pdfjs-dist (sem OCR — o PDF tem texto selecionável) e localizamos cada campo
// por âncora de rótulo. A inteligência de negócio fica no backend.
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Normaliza para comparar rótulos (sem acento, minúsculo, espaços colapsados).
function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ')
    .trim();
}

// Converte "R$ 3.480,00" / "1.939,50" → número.
function toNum(s) {
  let t = String(s || '').replace(/r\$/i, '').replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

// Índice da 1ª linha cujo texto normalizado é exatamente `label` (a partir de `from`).
function idxOf(L, label, from = 0) {
  const t = norm(label);
  for (let i = from; i < L.length; i += 1) if (norm(L[i]) === t) return i;
  return -1;
}

// Valor logo após o rótulo (próxima linha não vazia já garantida pelo filtro).
function after(L, label, from = 0) {
  const i = idxOf(L, label, from);
  return i >= 0 && i + 1 < L.length ? L[i + 1] : null;
}

// Extrai todas as linhas de texto (não vazias) do PDF, na ordem do documento.
async function lerLinhas(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const linhas = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await doc.getPage(p);
    // eslint-disable-next-line no-await-in-loop
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      const s = (it.str || '').trim();
      if (s) linhas.push(s);
    }
  }
  return linhas;
}

/**
 * Lê o PDF e devolve o objeto normalizado da NFS-e:
 *   { chaveNfse, numNota, dataNota, fornecedor, item, valor, avisos: [] }
 * `avisos` traz mensagens de campos que não puderam ser localizados — a tela de
 * conferência mostra os campos editáveis para o usuário completar antes de salvar.
 */
export async function parseNfsePdf(file) {
  const L = await lerLinhas(file);
  const avisos = [];

  // Chave de acesso (dígitos longos).
  let chaveNfse = (after(L, 'Chave de Acesso da NFS-e') || '').replace(/\s/g, '');
  if (!/^\d{20,}$/.test(chaveNfse)) { chaveNfse = chaveNfse || ''; avisos.push('Não foi possível localizar a "Chave de Acesso da NFS-e".'); }

  // Número da NFS-e.
  const numNota = (after(L, 'Número da NFS-e') || '').trim();
  if (!numNota) avisos.push('Não foi possível localizar o "Número da NFS-e".');

  // Competência → data (DD/MM/YYYY).
  const dataNota = (after(L, 'Competência da NFS-e') || '').trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataNota)) avisos.push('Não foi possível localizar a "Competência da NFS-e" (data).');

  // Fornecedor: "Nome / Nome Empresarial" do bloco EMITENTE (1ª ocorrência após
  // "EMITENTE DA NFS-e" — a 2ª é o TOMADOR, que é a própria Kampeki).
  const emIdx = idxOf(L, 'EMITENTE DA NFS-e');
  const nomeIdx = idxOf(L, 'Nome / Nome Empresarial', emIdx >= 0 ? emIdx : 0);
  let fornecedor = nomeIdx >= 0 && nomeIdx + 1 < L.length ? L[nomeIdx + 1] : '';
  // Remove CPF/CNPJ colado no fim do nome (9+ dígitos).
  fornecedor = fornecedor.replace(/\s*\d{9,}\s*$/, '').trim();
  if (!fornecedor) avisos.push('Não foi possível localizar o "Nome / Nome Empresarial" do emitente.');

  // Item: "Código de Tributação Nacional" até "Código de Tributação Municipal"
  // (o valor pode quebrar em várias linhas). Depois remove o código "NN.NN.NN - ".
  let item = '';
  const cnIdx = idxOf(L, 'Código de Tributação Nacional');
  if (cnIdx >= 0) {
    const cmIdx = idxOf(L, 'Código de Tributação Municipal', cnIdx + 1);
    const fim = cmIdx >= 0 ? cmIdx : cnIdx + 3;
    item = L.slice(cnIdx + 1, fim).join(' ').replace(/\s+/g, ' ').trim();
    item = item.replace(/^\d{2}\.\d{2}\.\d{2}\s*-\s*/, '').trim();
  }
  if (!item) avisos.push('Não foi possível localizar o "Código de Tributação Nacional" (item).');

  // Valor Líquido da NFS-e.
  const valorRaw = after(L, 'Valor Líquido da NFS-e');
  const valor = toNum(valorRaw);
  if (!Number.isFinite(valor)) avisos.push('Não foi possível localizar o "Valor Líquido da NFS-e".');

  return {
    chaveNfse,
    numNota,
    dataNota,
    fornecedor,
    item,
    valor: Number.isFinite(valor) ? +valor.toFixed(2) : null,
    avisos,
  };
}
