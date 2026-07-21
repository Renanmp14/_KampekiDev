// Helpers das visões de "notas de um item" (Dash Custos e Análise por Período).
import { toNum } from './format.js';
import { SEM_SUB } from './drillPeriodo.js';

// "DD/MM/YYYY" -> "YYYY-MM-DD" (string ordenável).
export function dataOrdenavel(d) {
  const m = String(d).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

// Normaliza linhas do Sheets para o formato das dialogs, ordenadas por data desc.
export function normalizarLinhas(rows) {
  return rows
    .map((r) => ({
      uuid: r.UUID,
      item: r.ITEM || '—',
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

/**
 * Linhas de um item dentro de uma base JÁ FILTRADA (período, mês e drill vêm
 * resolvidos pelo dashboard), normalizadas e ordenadas por data desc.
 *
 * Só entram as linhas do próprio item: os itens vizinhos da mesma nota ficam de
 * fora (decisão de 16/07 — a visão é sobre o item, não sobre a nota). Por isso o
 * total daqui é o total DO ITEM no recorte, e não o total das notas.
 */
export function linhasDoItem(rows, item) {
  return normalizarLinhas(rows.filter((r) => r.ITEM === item));
}

export const somaLinhas = (linhas) => linhas.reduce((s, l) => s + l.valorTotal, 0);

export const qtdFmt = (v) => toNum(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/**
 * Identidade da NOTA (não da linha): a chave NF-e quando existe; senão
 * fornecedor + nº + data, que é o mesmo critério de identidade já usado desde a
 * 1.5.1. Duas linhas da mesma nota (o mesmo item lançado 2x, ou itens vizinhos
 * no modo multi-item) colapsam numa nota só.
 */
export const chaveNota = (l) => (l.chave || `${l.fornecedor}|${l.numNota}|${l.data}`);

/**
 * Resumo de um conjunto de linhas — alimenta a faixa de KPIs das dialogs.
 *
 * `precoMedio` é PONDERADO (Σ V.Total ÷ Σ QTD), não a média simples dos V.Unit:
 * é o único que fecha com o total. Fica `null` quando não há quantidade (sem
 * QTD não existe preço unitário representável).
 *
 * Atenção no modo multi-item: `qtd` soma unidades diferentes (kg + un + cx), e
 * por consequência `precoMedio` também. Leia como "por unidade pedida" — a tela
 * exibe esse aviso (mesmo caveat da página Visões avançadas).
 */
export function resumoNotas(linhas) {
  const qtd = linhas.reduce((s, l) => s + l.qtd, 0);
  const total = somaLinhas(linhas);
  // O "—" das linhas é placeholder de exibição, não uma subcategoria: contá-lo
  // inflaria o número (base real tem itens "a classificar"). Vira o rótulo
  // "(sem subcategoria)", a mesma convenção do drill da Análise por Período.
  const subcategorias = [...new Set(linhas.map((l) => (
    !l.subcategoria || l.subcategoria === '—' ? SEM_SUB : l.subcategoria
  )))].sort();
  return {
    nLancamentos: linhas.length,
    nNotas: new Set(linhas.map(chaveNota)).size,
    subcategorias,
    qtd,
    total,
    precoMedio: qtd > 0 ? total / qtd : null,
  };
}

/** Agrupa por item (maior total primeiro) — tabela do modo multi-item. */
export function agruparPorItem(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    if (!mapa.has(l.item)) mapa.set(l.item, []);
    mapa.get(l.item).push(l);
  }
  return [...mapa.entries()]
    .map(([item, ls]) => ({ item, linhas: ls, resumo: resumoNotas(ls) }))
    .sort((a, b) => b.resumo.total - a.resumo.total);
}
