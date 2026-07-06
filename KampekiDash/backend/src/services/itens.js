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
