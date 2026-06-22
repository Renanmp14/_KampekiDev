import {
  getObjects, appendRow, appendRows, updateRowByUuid, deleteRowByUuid,
} from './sheets.js';
import { getCache, setCache, invalidate } from './cache.js';
import { newUuid } from '../utils/uuid.js';
import { categoriaDe } from '../utils/switch-categoria.js';

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
  }));
  setCache(CACHE_KEY, list);
  return list;
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

  const uuid = newUuid();
  await appendRow(TAB, [uuid, descricao, sub, categoria]);
  invalidate(CACHE_KEY);
  return { UUID: uuid, DESCRICAO_ITEM: descricao, SUB_CATEGORIA: sub, CATEGORIA: categoria };
}

export async function atualizar(uuid, payload) {
  const { descricao, sub, categoria } = montar(payload);

  const existentes = await listar();
  if (existentes.some((i) => i.UUID !== uuid && normalizar(i.DESCRICAO_ITEM) === normalizar(descricao))) {
    throw new Error('Item já cadastrado');
  }

  await updateRowByUuid(TAB, uuid, [uuid, descricao, sub, categoria]);
  invalidate(CACHE_KEY);
  return { UUID: uuid, DESCRICAO_ITEM: descricao, SUB_CATEGORIA: sub, CATEGORIA: categoria };
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
