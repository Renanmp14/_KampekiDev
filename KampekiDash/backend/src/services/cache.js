// Cache leve em memória para listas de Fornecedor, Tag e Itens.
// Invalidado manualmente em cada inserção/edição/exclusão.

const store = new Map();

export function getCache(key) {
  return store.get(key);
}

export function setCache(key, value) {
  store.set(key, value);
}

export function invalidate(key) {
  store.delete(key);
}
