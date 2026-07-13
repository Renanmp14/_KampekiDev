// Mapeamento SUB_CATEGORIA → CATEGORIA.
// CATEGORIA é sempre derivada pela aplicação, nunca enviada pelo frontend.

export const categoriaMap = {
  // CMV
  'ALIMENTOS EM GERAL': 'CMV',
  'HORTIFRUTI': 'CMV',
  'BEBIDAS': 'CMV',
  'DESTILADOS': 'CMV',
  'CERVEJA': 'CMV',
  'DOCES': 'CMV',
  'PRODUTO ORIENTAL': 'CMV',
  'VINHOS E ESPUMANTES': 'CMV',
  'CAMARÃO': 'CMV',
  'PEIXES': 'CMV',
  'POLVO': 'CMV',
  'OSTRA': 'CMV',
  'SALMÃO': 'CMV',
  'ATUM': 'CMV',
  'BLUEFIN': 'CMV',
  'WAGYU': 'CMV',
  'GELO': 'CMV',
  'EMBALAGENS': 'CMV',
  'CARNE VERMELHA': 'CMV',
  'MOTOBOY CASA': 'CMV',
  'MOTOBOY OCTO': 'CMV',
  // FOLHA CANOAS
  'INSUMOS FUNCIONÁRIOS': 'FOLHA CANOAS',
  'CARNE FUNCIONÁRIO': 'FOLHA CANOAS',
  'UNIFORME': 'FOLHA CANOAS',
  'FGTS': 'FOLHA CANOAS',
  'FOLHA CANOAS': 'FOLHA CANOAS',
  // FOLHA POA
  'FOLHA POA': 'FOLHA POA',
  // FOLHA TELE
  'FOLHA TELE': 'FOLHA TELE',
  // DESPESA ADMINISTRATIVA
  'MATERIAL DE OPERAÇÃO': 'DESPESA ADMINISTRATIVA',
  'MATERIAL LIMPEZA': 'DESPESA ADMINISTRATIVA',
  'PRODUTO DE LIMPEZA': 'DESPESA ADMINISTRATIVA',
  'MATERIAL DE MANUTENÇÃO': 'DESPESA ADMINISTRATIVA',
  'MANUTENÇÃO': 'DESPESA ADMINISTRATIVA',
  'MATERIAL ESCRITÓRIO': 'DESPESA ADMINISTRATIVA',
  'UTENSILIOS': 'DESPESA ADMINISTRATIVA',
  'MARKETING': 'DESPESA ADMINISTRATIVA',
  'MATERIAL DE MARKETING': 'DESPESA ADMINISTRATIVA',
  'SISTEMA': 'DESPESA ADMINISTRATIVA',
  'INTERNET': 'DESPESA ADMINISTRATIVA',
  'ALUGUEL CANOAS': 'DESPESA ADMINISTRATIVA',
  'ALUGUEL POA': 'DESPESA ADMINISTRATIVA',
  'GAS': 'DESPESA ADMINISTRATIVA',
  'GAS NATURAL': 'DESPESA ADMINISTRATIVA',
  'LUZ POA': 'DESPESA ADMINISTRATIVA',
  'TAXAS': 'DESPESA ADMINISTRATIVA',
  'TAXAS POA': 'DESPESA ADMINISTRATIVA',
  'ADVOGADO': 'DESPESA ADMINISTRATIVA',
  'SEGURANÇA': 'DESPESA ADMINISTRATIVA',
  'FRETE': 'DESPESA ADMINISTRATIVA',
  'ATIVO IMOBILIZADO': 'DESPESA ADMINISTRATIVA',
  'LOUÇAS': 'DESPESA ADMINISTRATIVA',
  // DESPESA ADMINISTRATIVA (complementos vindos da planilha de importação)
  'AGUA CANOAS': 'DESPESA ADMINISTRATIVA',
  'AGUA POA': 'DESPESA ADMINISTRATIVA',
  'LUZ CANOAS': 'DESPESA ADMINISTRATIVA',
  'SEGURANÇA DO TRABALHO': 'DESPESA ADMINISTRATIVA',
  'PLANO CELULAR': 'DESPESA ADMINISTRATIVA',
  'CONTABILIDADE': 'DESPESA ADMINISTRATIVA',
  'COLETA LIXO': 'DESPESA ADMINISTRATIVA',
  'ICMS CANOAS': 'DESPESA ADMINISTRATIVA',
  'ICMS POA': 'DESPESA ADMINISTRATIVA',
  // FOLHA CANOAS (complementos)
  'UTENSILIOS FUNCIONÁRIOS': 'FOLHA CANOAS',
  'FARMACIA': 'FOLHA CANOAS',
  // FOLHA TELE (complementos)
  'TELE ENTREGA': 'FOLHA TELE',
  // OUTROS
  'DISTRIBUIÇÃO DE LUCRO': 'DISTRIBUIÇÃO DE LUCRO',
};

// Lista ordenada de subcategorias FIXAS (definidas em código) para popular
// selects. As subcategorias criadas em runtime ficam em `dynamicMap` (abaixo).
export const subCategorias = Object.keys(categoriaMap);

// Categorias consideradas "folha" — exigem TAG no lançamento de custo.
export const CATEGORIAS_FOLHA = ['FOLHA CANOAS', 'FOLHA POA', 'FOLHA TELE'];

// Conjunto fixo de categorias possíveis (valores distintos do mapa), usado para
// validar/oferecer categorias ao criar uma subcategoria nova.
export const categoriasFixas = [...new Set(Object.values(categoriaMap))];

// --- Subcategorias dinâmicas (aba SUBCATEGORIA) ----------------------------
// Estendem o mapa fixo do código. Carregadas uma vez no boot e recarregadas ao
// criar uma subcategoria nova; ficam em memória para que `categoriaDe` continue
// síncrono (usado em vários pontos do lançamento de custo).
let dynamicMap = {}; // SUB (UPPER) -> CATEGORIA

export function setSubcategoriasDinamicas(pares) {
  const m = {};
  for (const { SUB_CATEGORIA, CATEGORIA } of pares || []) {
    const sub = String(SUB_CATEGORIA || '').trim().toUpperCase();
    const cat = String(CATEGORIA || '').trim().toUpperCase();
    if (sub && cat) m[sub] = cat;
  }
  dynamicMap = m;
  return dynamicMap;
}

// A partir da v1.4.1 a aba SUBCATEGORIA é a fonte da verdade das subcategorias
// (semeada com o mapa fixo no boot — ver services/subcategoria.js), o que permite
// editar/mover/excluir inclusive as "fixas". O `categoriaMap` do código passa a
// ser apenas a SEMENTE inicial + um fallback de resolução.

// Lista as subcategorias (da aba, quando carregada), ordenada, para os selects.
export function listarSubcategorias() {
  const dyn = Object.entries(dynamicMap);
  if (dyn.length) {
    return dyn
      .map(([sub, cat]) => ({ SUB_CATEGORIA: sub, CATEGORIA: cat }))
      .sort((a, b) => a.SUB_CATEGORIA.localeCompare(b.SUB_CATEGORIA));
  }
  // Fallback: aba ainda não semeada/carregada — usa o mapa fixo do código.
  return subCategorias
    .map((sub) => ({ SUB_CATEGORIA: sub, CATEGORIA: categoriaMap[sub] }))
    .sort((a, b) => a.SUB_CATEGORIA.localeCompare(b.SUB_CATEGORIA));
}

export function categoriaDe(subCategoria) {
  if (!subCategoria) return null;
  const key = String(subCategoria).trim().toUpperCase();
  // Dinâmico (aba) primeiro — edições/movimentações prevalecem; código é fallback.
  return dynamicMap[key] || categoriaMap[key] || null;
}

export function exigeTag(categoria) {
  return CATEGORIAS_FOLHA.includes(categoria);
}
