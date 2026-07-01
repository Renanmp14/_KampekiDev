// Subcategorias criadas em runtime (aba SUBCATEGORIA). Estendem o mapa fixo de
// switch-categoria.js. Mantêm o `dynamicMap` (em memória) sincronizado para que
// categoriaDe() continue síncrono em todo o fluxo de custos.
import { getObjects, appendRow, deleteRowByUuid } from './sheets.js';
import { newUuid } from '../utils/uuid.js';
import {
  categoriaMap, categoriasFixas, listarSubcategorias as listarCombinadas,
  setSubcategoriasDinamicas,
} from '../utils/switch-categoria.js';

const TAB = 'SUBCATEGORIA';

function norm(s) {
  return String(s || '').trim().toUpperCase();
}

// Carrega a aba SUBCATEGORIA e alimenta o mapa dinâmico em memória. Tolerante a
// falha (a aba pode não existir numa planilha antiga até o initSheets criá-la).
export async function carregar() {
  try {
    const objs = await getObjects(TAB);
    setSubcategoriasDinamicas(objs);
    return objs;
  } catch {
    setSubcategoriasDinamicas([]);
    return [];
  }
}

// Lista combinada (fixas + dinâmicas) para os selects do frontend.
export function listar() {
  return listarCombinadas();
}

// Categorias disponíveis para associar a uma subcategoria nova.
export function categorias() {
  return categoriasFixas;
}

/**
 * Lista para a tela de GESTÃO: cada subcategoria com a categoria, se é fixa (do
 * código) ou personalizada (aba SUBCATEGORIA) e quantos itens/custos a usam —
 * permitindo decidir o que pode ser excluído com segurança.
 */
export async function listarGestao() {
  const combinadas = listarCombinadas(); // [{ SUB_CATEGORIA, CATEGORIA }]
  const [itens, custos] = await Promise.all([
    getObjects('ITENS').catch(() => []),
    getObjects('CUSTOS').catch(() => []),
  ]);
  const usoItens = new Map();
  const usoCustos = new Map();
  for (const i of itens) {
    const k = norm(i.SUB_CATEGORIA);
    if (k) usoItens.set(k, (usoItens.get(k) || 0) + 1);
  }
  for (const c of custos) {
    const k = norm(c.SUB_CATEGORIA);
    if (k) usoCustos.set(k, (usoCustos.get(k) || 0) + 1);
  }
  return combinadas.map((s) => {
    const k = norm(s.SUB_CATEGORIA);
    return {
      SUB_CATEGORIA: s.SUB_CATEGORIA,
      CATEGORIA: s.CATEGORIA,
      fixa: Boolean(categoriaMap[k]),
      itens: usoItens.get(k) || 0,
      custos: usoCustos.get(k) || 0,
    };
  });
}

/**
 * Exclui uma subcategoria personalizada (dinâmica). Bloqueios:
 *  - Subcategoria fixa (do código) não pode ser excluída.
 *  - Subcategoria em uso por itens ou custos não pode ser excluída (reclassifique
 *    antes, para não deixar registros órfãos).
 * Recarrega o mapa dinâmico ao final.
 */
export async function remover({ SUB_CATEGORIA }) {
  const sub = norm(SUB_CATEGORIA);
  if (!sub) throw new Error('Subcategoria é obrigatória');
  if (categoriaMap[sub]) throw new Error('Subcategoria fixa não pode ser excluída');

  const existentes = await getObjects(TAB).catch(() => []);
  const alvo = existentes.find((o) => norm(o.SUB_CATEGORIA) === sub);
  if (!alvo) throw new Error('Subcategoria não encontrada');

  const [itens, custos] = await Promise.all([
    getObjects('ITENS').catch(() => []),
    getObjects('CUSTOS').catch(() => []),
  ]);
  const usoItens = itens.filter((i) => norm(i.SUB_CATEGORIA) === sub).length;
  const usoCustos = custos.filter((c) => norm(c.SUB_CATEGORIA) === sub).length;
  if (usoItens || usoCustos) {
    throw new Error(
      `Subcategoria em uso (${usoItens} item(ns), ${usoCustos} custo(s)). Reclassifique antes de excluir.`,
    );
  }

  await deleteRowByUuid(TAB, alvo.UUID);
  await carregar();
  return { ok: true, SUB_CATEGORIA: sub };
}

/**
 * Cria uma subcategoria nova apontando para uma das categorias fixas.
 * - SUB_CATEGORIA não pode repetir (nem do mapa fixo, nem das dinâmicas).
 * - CATEGORIA precisa ser uma das categorias fixas.
 * Recarrega o mapa dinâmico ao final.
 */
export async function criar({ SUB_CATEGORIA, CATEGORIA }) {
  const sub = norm(SUB_CATEGORIA);
  const cat = norm(CATEGORIA);
  if (!sub) throw new Error('Subcategoria é obrigatória');
  if (!cat) throw new Error('Categoria é obrigatória');
  if (!categoriasFixas.includes(cat)) throw new Error(`Categoria inválida: ${cat}`);
  if (categoriaMap[sub]) throw new Error('Subcategoria já existe (fixa)');

  const existentes = await getObjects(TAB).catch(() => []);
  if (existentes.some((o) => norm(o.SUB_CATEGORIA) === sub)) {
    throw new Error('Subcategoria já cadastrada');
  }

  await appendRow(TAB, [newUuid(), sub, cat]);
  await carregar();
  return { SUB_CATEGORIA: sub, CATEGORIA: cat };
}
