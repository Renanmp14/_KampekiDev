import { api, setToken } from './client.js';

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  setToken(data.token);
  return data;
}

export const getConfig = () => api.get('/config');

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
  categorias: () => api.get('/itens/categorias'),
  criarSubcategoria: (body) => api.post('/itens/subcategorias', body),
  importar: (rows) => api.post('/itens/import', { rows }),
};
export const custosApi = {
  ...crud('/custos'),
  // extra pode conter { fallbackMesAno } para datar linhas sem data.
  importar: (rows, extra = {}) => api.post('/custos/import', { rows, ...extra }),
  // notas: [{ CHAVE_NFE, NUM_NOTA, DATA_NOTA, FORNECEDOR, itens: [...] }]
  importarXml: (notas) => api.post('/custos/import-xml', { notas }),
  atualizarEmMassa: (body) => api.post('/custos/bulk', body),
  itensAClassificar: () => api.get('/custos/itens-a-classificar'),
  classificar: (body) => api.post('/custos/classificar', body),
};
export const folhaApi = crud('/folha');
