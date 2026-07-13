// Subcategorias na aba SUBCATEGORIA. A partir da v1.4.1 esta aba é a FONTE DA
// VERDADE das subcategorias: no boot ela é semeada com o mapa fixo do código
// (migração aditiva, uma vez), passando a permitir editar/mover/excluir inclusive
// as subcategorias que antes eram fixas. Mantém o `dynamicMap` (em memória)
// sincronizado para que categoriaDe() continue síncrono em todo o fluxo de custos.
import {
  getObjects, appendRow, appendRows, updateRowByUuid, deleteRowByUuid,
  updateCellsByUuid, getCellValue, setCellValue,
} from './sheets.js';
import { invalidate } from './cache.js';
import { newUuid } from '../utils/uuid.js';
import {
  categoriaMap, categoriasFixas, listarSubcategorias as listarCombinadas,
  setSubcategoriasDinamicas, exigeTag,
} from '../utils/switch-categoria.js';

const TAB = 'SUBCATEGORIA';

// Marcador de MIGRAÇÃO única (linha 2 = notas, fora da área de dados). Garante que
// a semeadura das fixas rode UMA vez; depois disso a aba é soberana e exclusões/
// renomeações de subcategorias (inclusive as que vieram do código) persistem entre
// reinícios — sem o marcador, uma fixa excluída ressuscitaria no próximo boot,
// pois ainda existe no categoriaMap do código.
const MARCADOR_CELL = `${TAB}!A2`;
const MARCADOR_VALOR = 'MIGRADO_V141';

function norm(s) {
  return String(s || '').trim().toUpperCase();
}

// Carrega a aba SUBCATEGORIA e alimenta o mapa dinâmico em memória. Na PRIMEIRA
// carga (sem marcador) semeia as subcategorias fixas do código que ainda não
// existam na aba e grava o marcador — assim instalações antigas (que tinham as
// fixas só no código) convergem para o modelo em que a aba manda, sem re-semear
// depois. Tolerante a falha (a aba pode não existir até o initSheets criá-la).
export async function carregar() {
  try {
    let objs = await getObjects(TAB);
    let migrado = false;
    try { migrado = norm(await getCellValue(MARCADOR_CELL)) === MARCADOR_VALOR; } catch { migrado = false; }
    if (!migrado) {
      const existentes = new Set(objs.map((o) => norm(o.SUB_CATEGORIA)));
      const faltantes = Object.entries(categoriaMap)
        .filter(([sub]) => !existentes.has(norm(sub)))
        .map(([sub, cat]) => [newUuid(), norm(sub), norm(cat)]);
      if (faltantes.length) {
        await appendRows(TAB, faltantes);
        objs = await getObjects(TAB);
      }
      await setCellValue(MARCADOR_CELL, MARCADOR_VALOR);
    }
    setSubcategoriasDinamicas(objs);
    return objs;
  } catch {
    setSubcategoriasDinamicas([]);
    return [];
  }
}

// Lista combinada (da aba, ou fallback do código) para os selects do frontend.
export function listar() {
  return listarCombinadas();
}

// Categorias disponíveis para associar a uma subcategoria (não são criáveis).
export function categorias() {
  return categoriasFixas;
}

/**
 * Lista para a tela de GESTÃO: cada subcategoria com a categoria, se é do sistema
 * (veio do mapa fixo do código) ou personalizada, e quantos itens/custos a usam.
 * A partir da v1.4.1 todas podem ser editadas/excluídas; a flag `fixa` é apenas
 * informativa.
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
 * Aplica em ITENS e CUSTOS a mudança de uma subcategoria — renomear/mover
 * (alvoSub/alvoCat preenchidos) ou desclassificar (ambos ''). Lê ITENS/CUSTOS uma
 * vez e grava tudo com `updateCellsByUuid` (uma escrita por aba). Quando a
 * categoria alvo não é de folha (ou é desclassificação), limpa a TAG dos
 * registros afetados que a tinham. Retorna { itens, custos } (linhas afetadas).
 */
async function aplicarCascata(subAtual, alvoSub, alvoCat) {
  const subKey = norm(subAtual);
  const [itens, custos] = await Promise.all([
    getObjects('ITENS').catch(() => []),
    getObjects('CUSTOS').catch(() => []),
  ]);
  // Desclassificação (alvoSub vazio) ou categoria não-folha → tag deve ficar vazia.
  const limpaTag = !alvoSub || !exigeTag(alvoCat);

  function montarUpdates(objs) {
    const ups = [];
    let n = 0;
    for (const o of objs) {
      if (norm(o.SUB_CATEGORIA) !== subKey) continue;
      ups.push({ uuid: o.UUID, field: 'SUB_CATEGORIA', value: alvoSub });
      ups.push({ uuid: o.UUID, field: 'CATEGORIA', value: alvoCat });
      if (limpaTag && String(o.TAG || '').trim()) {
        ups.push({ uuid: o.UUID, field: 'TAG', value: '' });
      }
      n += 1;
    }
    return { ups, n };
  }

  const it = montarUpdates(itens);
  const cu = montarUpdates(custos);
  if (it.ups.length) await updateCellsByUuid('ITENS', it.ups);
  if (cu.ups.length) await updateCellsByUuid('CUSTOS', cu.ups);
  if (it.n) invalidate('itens');
  return { itens: it.n, custos: cu.n };
}

/**
 * Cria uma subcategoria nova apontando para uma das categorias fixas.
 * - SUB_CATEGORIA não pode repetir (a aba já contém as fixas semeadas).
 * - CATEGORIA precisa ser uma das categorias fixas.
 */
export async function criar({ SUB_CATEGORIA, CATEGORIA }) {
  const sub = norm(SUB_CATEGORIA);
  const cat = norm(CATEGORIA);
  if (!sub) throw new Error('Subcategoria é obrigatória');
  if (!cat) throw new Error('Categoria é obrigatória');
  if (!categoriasFixas.includes(cat)) throw new Error(`Categoria inválida: ${cat}`);

  const existentes = await getObjects(TAB).catch(() => []);
  if (existentes.some((o) => norm(o.SUB_CATEGORIA) === sub)) {
    throw new Error('Subcategoria já cadastrada');
  }

  await appendRow(TAB, [newUuid(), sub, cat]);
  await carregar();
  return { SUB_CATEGORIA: sub, CATEGORIA: cat };
}

/**
 * Edita uma subcategoria: novo nome e/ou nova categoria. Reprocessa em cascata os
 * ITENS e CUSTOS que estavam na subcategoria atual, corrigindo-os para o novo
 * nome/categoria. Se a nova categoria não for de folha, limpa a tag dos afetados.
 * `{ SUB_CATEGORIA (atual), NOVO_NOME, NOVA_CATEGORIA }`.
 */
export async function editar({ SUB_CATEGORIA, NOVO_NOME, NOVA_CATEGORIA }) {
  const atual = norm(SUB_CATEGORIA);
  const novo = norm(NOVO_NOME);
  const novaCat = norm(NOVA_CATEGORIA);
  if (!atual) throw new Error('Subcategoria atual é obrigatória');
  if (!novo) throw new Error('Novo nome é obrigatório');
  if (!novaCat) throw new Error('Categoria é obrigatória');
  if (!categoriasFixas.includes(novaCat)) throw new Error(`Categoria inválida: ${novaCat}`);

  const existentes = await getObjects(TAB).catch(() => []);
  const alvo = existentes.find((o) => norm(o.SUB_CATEGORIA) === atual);
  if (!alvo) throw new Error('Subcategoria não encontrada');
  // Renomeando: o novo nome não pode colidir com outra subcategoria.
  if (novo !== atual
      && existentes.some((o) => o.UUID !== alvo.UUID && norm(o.SUB_CATEGORIA) === novo)) {
    throw new Error('Já existe uma subcategoria com esse nome');
  }

  // Atualiza a linha na aba SUBCATEGORIA (UUID, SUB_CATEGORIA, CATEGORIA).
  await updateRowByUuid(TAB, alvo.UUID, [alvo.UUID, novo, novaCat]);
  await carregar();

  // Cascata: itens/custos que estavam na subcategoria atual passam ao novo alvo.
  const { itens, custos } = await aplicarCascata(atual, novo, novaCat);
  return {
    SUB_CATEGORIA: novo, CATEGORIA: novaCat, itensAtualizados: itens, custosAtualizados: custos,
  };
}

/**
 * Exclui uma subcategoria. Em vez de bloquear quando está em uso, DESCLASSIFICA:
 * os itens e custos daquela subcategoria voltam a ficar sem subcategoria/categoria
 * (e sem tag) — reaparecem em "a classificar". Depois remove a linha da aba.
 */
export async function remover({ SUB_CATEGORIA }) {
  const sub = norm(SUB_CATEGORIA);
  if (!sub) throw new Error('Subcategoria é obrigatória');

  const existentes = await getObjects(TAB).catch(() => []);
  const alvo = existentes.find((o) => norm(o.SUB_CATEGORIA) === sub);
  if (!alvo) throw new Error('Subcategoria não encontrada');

  // Desclassifica os itens/custos antes de remover a subcategoria (se a cascata
  // falhar, a subcategoria não é apagada — evita registros órfãos).
  const { itens, custos } = await aplicarCascata(sub, '', '');

  await deleteRowByUuid(TAB, alvo.UUID);
  await carregar();
  return {
    ok: true, SUB_CATEGORIA: sub, itensDesclassificados: itens, custosDesclassificados: custos,
  };
}
