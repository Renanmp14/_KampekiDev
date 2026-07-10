import { api, setToken } from './client.js';

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  setToken(data.token);
  return data;
}

export const getConfig = () => api.get('/config');

// Uso de células da planilha (informativo, contra o limite de 10M do Sheets).
export const getCellUsage = () => api.get('/meta/cell-usage');

// Fábrica de CRUD simples para os recursos de cadastro.
function crud(base) {
  return {
    listar: () => api.get(base),
    criar: (body) => api.post(base, body),
    atualizar: (uuid, body) => api.put(`${base}/${uuid}`, body),
    remover: (uuid) => api.del(`${base}/${uuid}`),
  };
}

export const fornecedorApi = {
  ...crud('/fornecedor'),
  importar: (rows) => api.post('/fornecedor/import', { rows }),
};
export const tagApi = crud('/tag');
export const itensApi = {
  ...crud('/itens'),
  subcategorias: () => api.get('/itens/subcategorias'),
  subcategoriasGestao: () => api.get('/itens/subcategorias-gestao'),
  categorias: () => api.get('/itens/categorias'),
  criarSubcategoria: (body) => api.post('/itens/subcategorias', body),
  removerSubcategoria: (SUB_CATEGORIA) => api.post('/itens/subcategorias/remover', { SUB_CATEGORIA }),
  reprocessarTags: () => api.post('/itens/reprocessar-tags'),
  importar: (rows) => api.post('/itens/import', { rows }),
};
export const custosApi = {
  ...crud('/custos'),
  // extra pode conter { fallbackMesAno } para datar linhas sem data.
  importar: (rows, extra = {}) => api.post('/custos/import', { rows, ...extra }),
  // notas: [{ CHAVE_NFE, NUM_NOTA, DATA_NOTA, FORNECEDOR, itens: [...] }]
  importarXml: (notas) => api.post('/custos/import-xml', { notas }),
  // NFS-e (PDF): { chaveNfse, numNota, dataNota, fornecedor, item, valor }
  importarNfse: (payload) => api.post('/custos/import-nfse', payload),
  // Lote de NFS-e (vários PDFs): { notas: [ { chaveNfse, ... } ] }
  importarNfseLote: (notas) => api.post('/custos/import-nfse-lote', { notas }),
  atualizarEmMassa: (body) => api.post('/custos/bulk', body),
  removerEmMassa: (uuids) => api.post('/custos/bulk-delete', { uuids }),
  itensAClassificar: () => api.get('/custos/itens-a-classificar'),
  classificar: (body) => api.post('/custos/classificar', body),
  classificarLote: (body) => api.post('/custos/classificar-lote', body),
};
export const folhaApi = crud('/folha');
