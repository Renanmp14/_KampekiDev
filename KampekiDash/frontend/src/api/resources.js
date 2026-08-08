import { api, setToken, setPerfil } from './client.js';

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  setToken(data.token);
  setPerfil(data.perfil); // 'admin' | 'leitura' — a interface esconde o que não pode
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
// Caixa (dinheiro físico) — CRUD simples; MES_ANO/ANO vêm derivados do backend.
export const caixaApi = crud('/caixa');
export const itensApi = {
  ...crud('/itens'),
  subcategorias: () => api.get('/itens/subcategorias'),
  subcategoriasGestao: () => api.get('/itens/subcategorias-gestao'),
  categorias: () => api.get('/itens/categorias'),
  criarSubcategoria: (body) => api.post('/itens/subcategorias', body),
  // { SUB_CATEGORIA (atual), NOVO_NOME, NOVA_CATEGORIA }
  editarSubcategoria: (body) => api.post('/itens/subcategorias/editar', body),
  removerSubcategoria: (SUB_CATEGORIA) => api.post('/itens/subcategorias/remover', { SUB_CATEGORIA }),
  reprocessarTags: () => api.post('/itens/reprocessar-tags'),
  // Edição em massa: { ITEM_UUIDS, campo: 'SUB_CATEGORIA'|'TAG', valor }
  atualizarEmMassa: (body) => api.post('/itens/bulk', body),
  importar: (rows) => api.post('/itens/import', { rows }),
};
export const custosApi = {
  ...crud('/custos'),
  // Recorte por DATA_NOTA (DD/MM/YYYY) — usado pelo calendário de Recorrentes
  // para carregar só o intervalo visível em vez da base inteira.
  listarPeriodo: (dataInicio, dataFim) => api.get(
    `/custos?dataInicio=${encodeURIComponent(dataInicio)}&dataFim=${encodeURIComponent(dataFim)}`,
  ),
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
  // Lote com subcategorias variadas: { classificacoes: [{ ITEM_UUID, SUB_CATEGORIA }] }
  classificarLoteVariado: (body) => api.post('/custos/classificar-lote-variado', body),
};
export const folhaApi = crud('/folha');

// Custos recorrentes: templates, exceções pontuais e o "colocar em dia".
// Não existe gatilho automático — nada é lançado sem alguém clicar em processar.
export const recorrentesApi = {
  ...crud('/recorrentes'),
  frequencias: () => api.get('/recorrentes/frequencias'),
  // Prévia (leitura pura): o que seria lançado agora + a contagem de vencidas.
  pendentes: () => api.get('/recorrentes/pendentes'),
  // uuids opcional restringe a um ou mais templates.
  processar: (uuids) => api.post('/recorrentes/processar', uuids ? { uuids } : {}),
  // Cancelamento a partir de uma data (default hoje): grava DATA_FIM na véspera.
  cancelar: (uuid, aPartirDe) => api.post(`/recorrentes/${uuid}/cancelar`, { aPartirDe }),
  excecoes: (template) => api.get(
    template ? `/recorrentes/excecoes?template=${encodeURIComponent(template)}` : '/recorrentes/excecoes',
  ),
  // Upsert por (template, data): salvar duas vezes na mesma data substitui.
  salvarExcecao: (body) => api.post('/recorrentes/excecoes', body),
  removerExcecao: (uuid) => api.del(`/recorrentes/excecoes/${uuid}`),
};
