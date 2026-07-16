// Helpers das visões de "notas de um item" (Dash Custos e Análise por Período).
import { toNum } from './format.js';

// "DD/MM/YYYY" -> "YYYY-MM-DD" (string ordenável).
export function dataOrdenavel(d) {
  const m = String(d).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/**
 * Linhas de um item dentro de uma base JÁ FILTRADA (período, mês e drill vêm
 * resolvidos pelo dashboard), normalizadas e ordenadas por data desc.
 *
 * Só entram as linhas do próprio item: os itens vizinhos da mesma nota ficam de
 * fora (decisão de 16/07 — a visão é sobre o item, não sobre a nota). Por isso o
 * total daqui é o total DO ITEM no recorte, e não o total das notas.
 */
export function linhasDoItem(rows, item) {
  return rows
    .filter((r) => r.ITEM === item)
    .map((r) => ({
      uuid: r.UUID,
      data: r.DATA_NOTA || '—',
      numNota: r.NUM_NOTA || '—',
      fornecedor: r.FORNECEDOR || '—',
      subcategoria: r.SUB_CATEGORIA || '—',
      chave: String(r.CHAVE_NFE || '').trim(),
      qtd: toNum(r.QTD),
      valorUnit: toNum(r.VALOR_UNIT),
      valorTotal: toNum(r.VALOR_TOTAL),
    }))
    .sort((a, b) => dataOrdenavel(b.data).localeCompare(dataOrdenavel(a.data)));
}

export const somaLinhas = (linhas) => linhas.reduce((s, l) => s + l.valorTotal, 0);

export const qtdFmt = (v) => toNum(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
