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

// Aplica a TAG aos custos de UM item (os que estiverem com tag diferente/vazia).
// Barato: uma leitura de CUSTOS + uma escrita. Usado ao salvar o item — o custo
// sempre respeita a tag do item. Não faz nada se a tag estiver vazia (não limpa
// custos ao remover a tag do item, para não deixar folha sem tag).
async function aplicarTagAosCustosDoItem(descricao, tag) {
  if (!tag) return 0;
  const custos = await getObjects('CUSTOS');
  const alvo = custos
    .filter((c) => normalizar(c.ITEM) === normalizar(descricao) && String(c.TAG || '').trim() !== tag)
    .map((c) => c.UUID);
  if (!alvo.length) return 0;
  await updateColumnForUuids('CUSTOS', 'TAG', alvo, tag);
  return alvo.length;
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
  // Item novo pode já casar com custos existentes (mesma descrição) — aplica a tag.
  const custosAtualizados = await aplicarTagAosCustosDoItem(descricao, tag);
  return {
    UUID: uuid, DESCRICAO_ITEM: descricao, SUB_CATEGORIA: sub, CATEGORIA: categoria, TAG: tag, custosAtualizados,
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
  // O custo sempre respeita o item: ao salvar a tag, aplica aos custos deste item.
  const custosAtualizados = await aplicarTagAosCustosDoItem(descricao, tag);
  return {
    UUID: uuid, DESCRICAO_ITEM: descricao, SUB_CATEGORIA: sub, CATEGORIA: categoria, TAG: tag, custosAtualizados,
  };
}

/**
 * Reprocessa as TAGs nos custos a partir da TAG cadastrada em cada item.
 * Para cada item que tem TAG, aplica essa tag a todos os custos daquele item
 * cuja TAG esteja diferente (ou vazia) — corrige custos lançados antes de o item
 * ganhar tag. Itens sem tag não afetam nada.
 */
export async function reprocessarTagsNosCustos() {
  const [itensList, custos] = await Promise.all([getObjects(TAB), getObjects('CUSTOS')]);

  const tagPorItem = new Map();
  for (const it of itensList) {
    const tag = String(it.TAG || '').trim();
    if (tag) tagPorItem.set(normalizar(it.DESCRICAO_ITEM), tag);
  }

  // Agrupa por tag alvo os UUIDs de custos que precisam mudar.
  const porTag = new Map();
  for (const c of custos) {
    const alvo = tagPorItem.get(normalizar(c.ITEM));
    if (alvo && String(c.TAG || '').trim() !== alvo) {
      if (!porTag.has(alvo)) porTag.set(alvo, []);
      porTag.get(alvo).push(c.UUID);
    }
  }

  let custosAtualizados = 0;
  for (const [tag, uuids] of porTag) {
    // eslint-disable-next-line no-await-in-loop
    await updateColumnForUuids('CUSTOS', 'TAG', uuids, tag);
    custosAtualizados += uuids.length;
  }

  return { itensComTag: tagPorItem.size, custosAtualizados };
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
