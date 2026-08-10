import {
  getObjects, appendRow, updateRowByUuid, deleteRowByUuid,
} from './sheets.js';
import { newUuid } from '../utils/uuid.js';

const TAB = 'TAG';

// Sempre lê a planilha — sem cache em memória (ver a nota em fornecedor.js).
export async function listar() {
  const objs = await getObjects(TAB);
  return objs.map((o) => ({ UUID: o.UUID, TAG: o.TAG }));
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
  return { UUID: uuid, TAG: tag };
}

export async function remover(uuid) {
  await deleteRowByUuid(TAB, uuid);
  return { ok: true };
}

// Helper usado por outros serviços para validar existência de uma tag.
export async function tagExiste(tag) {
  const existentes = await listar();
  return existentes.some((x) => normalizar(x.TAG) === normalizar(tag));
}
