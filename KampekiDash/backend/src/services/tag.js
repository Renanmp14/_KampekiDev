import {
  getObjects, appendRow, updateRowByUuid, deleteRowByUuid,
} from './sheets.js';
import { getCache, setCache, invalidate } from './cache.js';
import { newUuid } from '../utils/uuid.js';

const TAB = 'TAG';
const CACHE_KEY = 'tags';

export async function listar() {
  const cached = getCache(CACHE_KEY);
  if (cached) return cached;
  const objs = await getObjects(TAB);
  const list = objs.map((o) => ({ UUID: o.UUID, TAG: o.TAG }));
  setCache(CACHE_KEY, list);
  return list;
}

function normalizar(t) {
  return String(t || '').trim().toUpperCase();
}

export async function criar({ TAG }) {
  const tag = String(TAG || '').trim();
  if (!tag) throw new Error('Tag é obrigatória');

  const existentes = await listar();
  if (existentes.some((x) => normalizar(x.TAG) === normalizar(tag))) {
    throw new Error('Tag já cadastrada');
  }

  const uuid = newUuid();
  await appendRow(TAB, [uuid, tag]);
  invalidate(CACHE_KEY);
  return { UUID: uuid, TAG: tag };
}

export async function atualizar(uuid, { TAG }) {
  const tag = String(TAG || '').trim();
  if (!tag) throw new Error('Tag é obrigatória');

  const existentes = await listar();
  if (existentes.some((x) => x.UUID !== uuid && normalizar(x.TAG) === normalizar(tag))) {
    throw new Error('Tag já cadastrada');
  }

  await updateRowByUuid(TAB, uuid, [uuid, tag]);
  invalidate(CACHE_KEY);
  return { UUID: uuid, TAG: tag };
}

export async function remover(uuid) {
  await deleteRowByUuid(TAB, uuid);
  invalidate(CACHE_KEY);
  return { ok: true };
}

// Helper usado por outros serviços para validar existência de uma tag.
export async function tagExiste(tag) {
  const existentes = await listar();
  return existentes.some((x) => normalizar(x.TAG) === normalizar(tag));
}
