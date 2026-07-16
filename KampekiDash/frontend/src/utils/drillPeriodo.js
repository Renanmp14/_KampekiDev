// Lógica pura do drill da Análise por Período (usada pelo DrillPeriodoModal).
// Fica fora do componente para poder ser exercitada isoladamente.
import { grupoDe, toNum } from './agg.js';

// Custos sem subcategoria (itens "a classificar") precisam de um rótulo próprio:
// o groupSum descarta chave vazia, e sem isso o detalhamento do grupo "Outros"
// não fecharia com o valor da linha clicada.
export const SEM_SUB = '(sem subcategoria)';

export const valCusto = (r) => toNum(r.VALOR_TOTAL);

// Cada nível sabe filtrar a base, qual é o próximo nível e como se chamar.
export const NIVEIS = {
  grupo: {
    pred: (v) => (r) => grupoDe(r.CATEGORIA) === v,
    proximo: 'subcategoria',
    titulo: (v) => `Subcategorias de ${v}`,
  },
  categoria: {
    pred: (v) => (r) => r.CATEGORIA === v,
    proximo: 'subcategoria',
    titulo: (v) => `Subcategorias de ${v}`,
  },
  subcategoria: {
    pred: (v) => (r) => (r.SUB_CATEGORIA || SEM_SUB) === v,
    proximo: 'item',
    titulo: (v) => `Itens de ${v}`,
  },
  item: {
    pred: (v) => (r) => r.ITEM === v,
    proximo: null,
    titulo: (v) => `Notas — ${v}`,
  },
};

export const KEY_FN = {
  subcategoria: (r) => r.SUB_CATEGORIA || SEM_SUB,
  item: (r) => r.ITEM,
};

export const LABEL_COL = { subcategoria: 'Subcategoria', item: 'Item' };

// Aplica o caminho inteiro (todos os níveis do breadcrumb) a uma base.
export function aplicarCaminho(rows, stack) {
  return stack.reduce((acc, s) => acc.filter(NIVEIS[s.tipo].pred(s.valor)), rows);
}
