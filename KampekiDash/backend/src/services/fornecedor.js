import {
  getObjects, appendRow, appendRows, updateRowByUuid, deleteRowByUuid,
} from './sheets.js';
import { getCache, setCache, invalidate } from './cache.js';
import { newUuid } from '../utils/uuid.js';

const TAB = 'FORNECEDOR';
const CACHE_KEY = 'fornecedores';

export async function listar() {
  const cached = getCache(CACHE_KEY);
  if (cached) return cached;
  const objs = await getObjects(TAB);
  const list = objs.map((o) => ({ UUID: o.UUID, NOME_FORNECEDOR: o.NOME_FORNECEDOR }));
  setCache(CACHE_KEY, list);
  return list;
}

function normalizar(nome) {
  return String(nome || '').trim().toUpperCase();
}

export async function criar({ NOME_FORNECEDOR }) {
  const nome = String(NOME_FORNECEDOR || '').trim();
  if (!nome) throw new Error('Nome do fornecedor é obrigatório');

  const existentes = await listar();
  if (existentes.some((f) => normalizar(f.NOME_FORNECEDOR) === normalizar(nome))) {
    throw new Error('Fornecedor já cadastrado');
  }

  const uuid = newUuid();
  await appendRow(TAB, [uuid, nome]);
  invalidate(CACHE_KEY);
  return { UUID: uuid, NOME_FORNECEDOR: nome };
}

export async function atualizar(uuid, { NOME_FORNECEDOR }) {
  const nome = String(NOME_FORNECEDOR || '').trim();
  if (!nome) throw new Error('Nome do fornecedor é obrigatório');

  const existentes = await listar();
  if (existentes.some((f) => f.UUID !== uuid && normalizar(f.NOME_FORNECEDOR) === normalizar(nome))) {
    throw new Error('Fornecedor já cadastrado');
  }

  await updateRowByUuid(TAB, uuid, [uuid, nome]);
  invalidate(CACHE_KEY);
  return { UUID: uuid, NOME_FORNECEDOR: nome };
}

export async function remover(uuid) {
  await deleteRowByUuid(TAB, uuid);
  invalidate(CACHE_KEY);
  return { ok: true };
}

// Importação em lote. Recebe array de nomes (strings ou objetos { NOME_FORNECEDOR }).
// Ignora vazios e duplicados (contra o que já existe e dentro do próprio arquivo).
export async function importarLote(rows) {
  const existentes = await listar();
  const vistos = new Set(existentes.map((f) => normalizar(f.NOME_FORNECEDOR)));

  const novas = [];
  let vazios = 0;
  let duplicados = 0;
  const duplicadosLista = [];

  for (const r of rows) {
    const nome = String((typeof r === 'string' ? r : r?.NOME_FORNECEDOR) || '').trim();
    if (!nome) { vazios += 1; continue; }
    const chave = normalizar(nome);
    if (vistos.has(chave)) {
      duplicados += 1;
      if (duplicadosLista.length < 50) duplicadosLista.push(nome);
      continue;
    }
    vistos.add(chave);
    novas.push([newUuid(), nome]);
  }

  if (novas.length) {
    await appendRows(TAB, novas);
    invalidate(CACHE_KEY);
  }

  return {
    recebidos: rows.length,
    importados: novas.length,
    duplicados,
    vazios,
    duplicadosLista,
  };
}
