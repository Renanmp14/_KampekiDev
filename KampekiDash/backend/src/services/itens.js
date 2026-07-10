import {
  getObjects, appendRow, appendRows, updateRowByUuid, deleteRowByUuid,
  updateColumnForUuids,
} from './sheets.js';
import { getCache, setCache, invalidate } from './cache.js';
import { newUuid } from '../utils/uuid.js';
import { categoriaDe, exigeTag } from '../utils/switch-categoria.js';
import { tagExiste } from './tag.js';

const TAB = 'ITENS';
const CACHE_KEY = 'itens';

export async function listar() {
  const cached = getCache(CACHE_KEY);
  if (cached) return cached;
  const objs = await getObjects(TAB);
  const list = objs.map((o) => ({
    UUID: o.UUID,
    DESCRICAO_ITEM: o.DESCRICAO_ITEM,
    SUB_CATEGORIA: o.SUB_CATEGORIA,
    CATEGORIA: o.CATEGORIA,
    TAG: o.TAG || '',
  }));
  setCache(CACHE_KEY, list);
  return list;
}

// Resolve a TAG de um item: só faz sentido para categorias de folha; é opcional
// (pode ficar vazia) e, quando informada, precisa existir na aba TAG. Itens
// não-folha nunca têm tag.
async function resolverTagItem(categoria, TAG) {
  if (!exigeTag(categoria)) return '';
  const tag = String(TAG || '').trim();
  if (!tag) return '';
  if (!(await tagExiste(tag))) throw new Error('TAG não cadastrada');
  return tag;
}

// Sincroniza a TAG dos custos de UM item para o valor `tag` do item — o custo
// SEMPRE segue a tag do item. Barato: uma leitura de CUSTOS + uma escrita.
// Aplica tanto a definição quanto a REMOÇÃO: se `tag` vier vazia, os custos
// daquele item que tinham tag são limpos (o item é a fonte da verdade).
// Retorna { atualizados, limpou } para a UI diferenciar aplicar vs. remover.
async function aplicarTagAosCustosDoItem(descricao, tag) {
  const alvoTag = String(tag || '').trim();
  const custos = await getObjects('CUSTOS');
  const alvo = custos
    .filter((c) => normalizar(c.ITEM) === normalizar(descricao) && String(c.TAG || '').trim() !== alvoTag)
    .map((c) => c.UUID);
  if (!alvo.length) return { atualizados: 0, limpou: false };
  await updateColumnForUuids('CUSTOS', 'TAG', alvo, alvoTag);
  return { atualizados: alvo.length, limpou: alvoTag === '' };
}

function normalizar(t) {
  return String(t || '').trim().toUpperCase();
}

function montar({ DESCRICAO_ITEM, SUB_CATEGORIA }) {
  const descricao = String(DESCRICAO_ITEM || '').trim();
  const sub = String(SUB_CATEGORIA || '').trim().toUpperCase();
  if (!descricao) throw new Error('Descrição do item é obrigatória');
  if (!sub) throw new Error('Subcategoria é obrigatória');
  // CATEGORIA derivada pela aplicação — nunca recebida do frontend.
  const categoria = categoriaDe(sub);
  if (!categoria) throw new Error(`Subcategoria desconhecida: ${sub}`);
  return { descricao, sub, categoria };
}

export async function criar(payload) {
  const { descricao, sub, categoria } = montar(payload);

  const existentes = await listar();
  if (existentes.some((i) => normalizar(i.DESCRICAO_ITEM) === normalizar(descricao))) {
    throw new Error('Item já cadastrado');
  }

  const tag = await resolverTagItem(categoria, payload.TAG);
  const uuid = newUuid();
  await appendRow(TAB, [uuid, descricao, sub, categoria, tag]);
  invalidate(CACHE_KEY);
  // Item novo pode já casar com custos existentes (mesma descrição) — sincroniza a tag.
  const { atualizados: custosAtualizados, limpou } = await aplicarTagAosCustosDoItem(descricao, tag);
  return {
    UUID: uuid, DESCRICAO_ITEM: descricao, SUB_CATEGORIA: sub, CATEGORIA: categoria, TAG: tag, custosAtualizados, tagRemovida: limpou,
  };
}

export async function atualizar(uuid, payload) {
  const { descricao, sub, categoria } = montar(payload);

  const existentes = await listar();
  if (existentes.some((i) => i.UUID !== uuid && normalizar(i.DESCRICAO_ITEM) === normalizar(descricao))) {
    throw new Error('Item já cadastrado');
  }

  const tag = await resolverTagItem(categoria, payload.TAG);
  await updateRowByUuid(TAB, uuid, [uuid, descricao, sub, categoria, tag]);
  invalidate(CACHE_KEY);
  // O custo sempre segue o item: ao salvar, sincroniza a tag nos custos deste
  // item — aplica quando há tag, e LIMPA quando a tag foi removida.
  const { atualizados: custosAtualizados, limpou } = await aplicarTagAosCustosDoItem(descricao, tag);
  return {
    UUID: uuid, DESCRICAO_ITEM: descricao, SUB_CATEGORIA: sub, CATEGORIA: categoria, TAG: tag, custosAtualizados, tagRemovida: limpou,
  };
}

// Campos permitidos na edição em massa de itens (lista branca).
const CAMPOS_MASSA = new Set(['SUB_CATEGORIA', 'TAG']);

/**
 * Edição em massa de itens — espelha a de Custos, mas no cadastro de Itens.
 * `{ ITEM_UUIDS, campo, valor }` com campo ∈ { SUB_CATEGORIA, TAG }.
 *
 * Como o item é a fonte da verdade, a mudança RE-SINCRONIZA os custos dos itens
 * afetados (não só os "a classificar"):
 *  - SUB_CATEGORIA: valida a subcategoria (deriva a categoria), grava sub/cat nos
 *    itens e em TODOS os custos desses itens. Se a nova categoria não for de folha,
 *    limpa a TAG (itens não-folha nunca têm tag) — nos itens e nos custos.
 *  - TAG: só vale para itens de folha (os não-folha são ignorados). Grava a tag
 *    (ou vazio p/ limpar) nos itens de folha selecionados e sincroniza os custos.
 *
 * Lê ITENS/CUSTOS uma vez e usa updateColumnForUuids (1 chamada por coluna).
 */
export async function atualizarEmMassa({ ITEM_UUIDS, campo, valor }) {
  if (!Array.isArray(ITEM_UUIDS) || ITEM_UUIDS.length === 0) throw new Error('Nenhum item selecionado');
  if (!CAMPOS_MASSA.has(campo)) throw new Error(`Campo não permitido: ${campo}`);

  const [itens, custos] = await Promise.all([getObjects(TAB), getObjects('CUSTOS')]);
  const alvo = new Set(ITEM_UUIDS);
  const selecionados = itens.filter((i) => alvo.has(i.UUID));
  if (!selecionados.length) throw new Error('Itens não encontrados');

  if (campo === 'SUB_CATEGORIA') {
    const sub = String(valor || '').trim().toUpperCase();
    if (!sub) throw new Error('Subcategoria é obrigatória');
    const categoria = categoriaDe(sub);
    if (!categoria) throw new Error(`Subcategoria desconhecida: ${sub}`);
    const folha = exigeTag(categoria);

    const itemUuids = selecionados.map((i) => i.UUID);
    const descricoes = new Set(selecionados.map((i) => normalizar(i.DESCRICAO_ITEM)));

    await updateColumnForUuids(TAB, 'SUB_CATEGORIA', itemUuids, sub);
    await updateColumnForUuids(TAB, 'CATEGORIA', itemUuids, categoria);
    // Categoria não-folha → item não pode ter tag: limpa nos itens que tinham.
    if (!folha) {
      const itensComTag = selecionados.filter((i) => String(i.TAG || '').trim()).map((i) => i.UUID);
      if (itensComTag.length) await updateColumnForUuids(TAB, 'TAG', itensComTag, '');
    }
    invalidate(CACHE_KEY);

    // Re-sincroniza TODOS os custos desses itens (sub/cat, e tag se virou não-folha).
    const custosDoItem = custos.filter((c) => descricoes.has(normalizar(c.ITEM)));
    let custosAtualizados = 0;
    if (custosDoItem.length) {
      const custoUuids = custosDoItem.map((c) => c.UUID);
      await updateColumnForUuids('CUSTOS', 'SUB_CATEGORIA', custoUuids, sub);
      await updateColumnForUuids('CUSTOS', 'CATEGORIA', custoUuids, categoria);
      custosAtualizados = custoUuids.length;
      if (!folha) {
        const custosComTag = custosDoItem.filter((c) => String(c.TAG || '').trim()).map((c) => c.UUID);
        if (custosComTag.length) await updateColumnForUuids('CUSTOS', 'TAG', custosComTag, '');
      }
    }
    return {
      itensAtualizados: itemUuids.length, campo, SUB_CATEGORIA: sub, CATEGORIA: categoria, custosAtualizados,
    };
  }

  // campo === 'TAG' — só para itens de folha; vazio = limpar.
  const tag = String(valor || '').trim();
  if (tag && !(await tagExiste(tag))) throw new Error('TAG não cadastrada');
  const folhaSel = selecionados.filter((i) => exigeTag(i.CATEGORIA));
  if (!folhaSel.length) throw new Error('Nenhum item de folha selecionado (a tag só se aplica a itens de folha)');

  const itemUuids = folhaSel.map((i) => i.UUID);
  await updateColumnForUuids(TAB, 'TAG', itemUuids, tag);
  invalidate(CACHE_KEY);

  // Sincroniza os custos desses itens que estão com tag diferente do alvo.
  const descricoes = new Set(folhaSel.map((i) => normalizar(i.DESCRICAO_ITEM)));
  const alvoCustos = custos
    .filter((c) => descricoes.has(normalizar(c.ITEM)) && String(c.TAG || '').trim() !== tag)
    .map((c) => c.UUID);
  let custosAtualizados = 0;
  if (alvoCustos.length) {
    await updateColumnForUuids('CUSTOS', 'TAG', alvoCustos, tag);
    custosAtualizados = alvoCustos.length;
  }
  return {
    itensAtualizados: itemUuids.length, campo, TAG: tag, custosAtualizados, itensIgnorados: selecionados.length - folhaSel.length,
  };
}

/**
 * Reprocessa as TAGs nos custos a partir da TAG cadastrada em cada item — o custo
 * SEMPRE segue a tag do item (o item é a fonte da verdade).
 *
 * Para cada custo cujo ITEM existe no cadastro, a tag alvo é:
 *  - a TAG do item, quando o item é de folha e tem tag;
 *  - vazia (LIMPA), quando o item é de folha sem tag ou é item não-folha.
 * Custos cuja tag difere do alvo são atualizados (aplicando ou limpando).
 * Custos de itens desconhecidos (sem correspondência em ITENS) não são tocados.
 *
 * Observação: como o item manda, tags aplicadas direto no custo (edição em massa)
 * de itens que não têm tag própria são limpas aqui — comportamento desejado.
 */
export async function reprocessarTagsNosCustos() {
  const [itensList, custos] = await Promise.all([getObjects(TAB), getObjects('CUSTOS')]);

  // Alvo de tag por item (descrição normalizada). '' = deve ficar sem tag.
  const alvoPorItem = new Map();
  let itensComTag = 0;
  for (const it of itensList) {
    const tag = exigeTag(it.CATEGORIA) ? String(it.TAG || '').trim() : '';
    if (tag) itensComTag += 1;
    alvoPorItem.set(normalizar(it.DESCRICAO_ITEM), tag);
  }

  // Agrupa por tag alvo (inclusive '' para limpar) os UUIDs que precisam mudar.
  const porTag = new Map();
  for (const c of custos) {
    const chave = normalizar(c.ITEM);
    if (!alvoPorItem.has(chave)) continue; // item desconhecido: não mexe
    const alvo = alvoPorItem.get(chave);
    if (String(c.TAG || '').trim() !== alvo) {
      if (!porTag.has(alvo)) porTag.set(alvo, []);
      porTag.get(alvo).push(c.UUID);
    }
  }

  let custosAplicados = 0;
  let custosLimpos = 0;
  for (const [tag, uuids] of porTag) {
    // eslint-disable-next-line no-await-in-loop
    await updateColumnForUuids('CUSTOS', 'TAG', uuids, tag);
    if (tag === '') custosLimpos += uuids.length;
    else custosAplicados += uuids.length;
  }

  return {
    itensComTag,
    custosAtualizados: custosAplicados + custosLimpos,
    custosAplicados,
    custosLimpos,
  };
}

export async function remover(uuid) {
  await deleteRowByUuid(TAB, uuid);
  invalidate(CACHE_KEY);
  return { ok: true };
}

// Helper: retorna o item pelo UUID (usado no lançamento de custos).
export async function buscarPorUuid(uuid) {
  const existentes = await listar();
  return existentes.find((i) => i.UUID === uuid) || null;
}

// Importação em lote. Cada row: { DESCRICAO_ITEM, SUB_CATEGORIA, CATEGORIA? }.
// CATEGORIA é derivada do mapa interno; se a subcategoria não existir no mapa,
// usa a CATEGORIA informada no arquivo como fallback. Linhas sem categoria
// possível são reportadas como erro (não entram), nunca derrubam a importação.
export async function importarLote(rows) {
  const existentes = await listar();
  const vistos = new Set(existentes.map((i) => normalizar(i.DESCRICAO_ITEM)));

  const novas = [];
  let vazios = 0;
  let duplicados = 0;
  const duplicadosLista = [];
  const erros = [];

  rows.forEach((r, idx) => {
    const descricao = String(r?.DESCRICAO_ITEM || '').trim();
    const sub = String(r?.SUB_CATEGORIA || '').trim().toUpperCase();
    const catArquivo = String(r?.CATEGORIA || '').trim().toUpperCase();

    if (!descricao) { vazios += 1; return; }

    const chave = normalizar(descricao);
    if (vistos.has(chave)) {
      duplicados += 1;
      if (duplicadosLista.length < 50) duplicadosLista.push(descricao);
      return;
    }

    if (!sub) {
      erros.push({ linha: idx + 2, item: descricao, motivo: 'Subcategoria vazia' });
      return;
    }

    // Categoria: mapa interno primeiro, depois fallback para a do arquivo.
    const categoria = categoriaDe(sub) || (catArquivo || null);
    if (!categoria) {
      erros.push({ linha: idx + 2, item: descricao, motivo: `Subcategoria sem categoria: ${sub}` });
      return;
    }

    vistos.add(chave);
    novas.push([newUuid(), descricao, sub, categoria]);
  });

  if (novas.length) {
    await appendRows(TAB, novas);
    invalidate(CACHE_KEY);
  }

  return {
    recebidos: rows.length,
    importados: novas.length,
    duplicados,
    vazios,
    erros: erros.length,
    duplicadosLista,
    errosLista: erros.slice(0, 50),
  };
}
