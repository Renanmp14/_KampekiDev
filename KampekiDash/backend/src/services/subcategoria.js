// Subcategorias criadas em runtime (aba SUBCATEGORIA). Estendem o mapa fixo de
// switch-categoria.js. Mantêm o `dynamicMap` (em memória) sincronizado para que
// categoriaDe() continue síncrono em todo o fluxo de custos.
import { getObjects, appendRow } from './sheets.js';
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
