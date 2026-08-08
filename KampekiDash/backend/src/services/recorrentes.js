import {
  getObjects, appendRow, appendRows, updateRowByUuid, deleteRowByUuid, updateCellsByUuid,
} from './sheets.js';
import { invalidate } from './cache.js';
import { newUuid } from '../utils/uuid.js';
import { derivarCamposData } from '../utils/date.js';
import { exigeTag } from '../utils/switch-categoria.js';
import {
  FREQUENCIAS, frequenciaValida, usaDiaBase, calcularOcorrencias, aplicarExcecoes,
  dataCorteInicial, hojeStr, normalizarData, compararDatas, somarDias,
} from '../utils/recorrencia.js';

const TAB = 'CUSTOS_RECORRENTES';
const TAB_EXC = 'CUSTOS_RECORRENTES_EXCECOES';
const TAB_CUSTOS = 'CUSTOS';

// Sem cache, deliberadamente. É a regra que saiu da 1.7.1: cache em memória é
// incompatível com deploy multiprocesso (a VM da web mais um backend embutido em
// cada instalação desktop) sem canal de invalidação entre os processos. Cada
// leitura vai à planilha, como custos.js e folha.js sempre fizeram.

function norm(s) {
  return String(s ?? '').trim().toUpperCase();
}

function num(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/r\$/i, '').replace(/\s/g, '');
  if (!s) return NaN;
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : NaN;
}

function ativoSim(t) {
  const v = norm(t?.ATIVO);
  return v === '' || v === 'SIM'; // vazio = ativo, para linha criada à mão na planilha
}

// --------------------------------------------------------------------------
// Leitura
// --------------------------------------------------------------------------

export async function listar() {
  const rows = await getObjects(TAB);
  return rows.map((t) => ({
    ...t,
    QTD: num(t.QTD) || 0,
    VALOR_UNIT: num(t.VALOR_UNIT) || 0,
    DIA_BASE: parseInt(t.DIA_BASE, 10) || '',
    DATA_INICIO: normalizarData(t.DATA_INICIO),
    DATA_FIM: normalizarData(t.DATA_FIM),
    DATA_CORTE: normalizarData(t.DATA_CORTE),
    ULTIMO_LANCAMENTO: normalizarData(t.ULTIMO_LANCAMENTO),
    ATIVO: ativoSim(t) ? 'sim' : 'nao',
  }));
}

export async function listarExcecoes(uuidTemplate) {
  const rows = await getObjects(TAB_EXC);
  const alvo = String(uuidTemplate || '').trim();
  return rows
    .filter((e) => !alvo || e.UUID_TEMPLATE === alvo)
    .map((e) => ({ ...e, DATA_EXCECAO: normalizarData(e.DATA_EXCECAO), ACAO: norm(e.ACAO) === 'PULAR' ? 'pular' : 'alterar' }));
}

// --------------------------------------------------------------------------
// Validação e escrita dos templates
// --------------------------------------------------------------------------

/**
 * Valida o payload e devolve os campos já normalizados. `ITEM` é EXIGIDO — a
 * spec o marcava como opcional, mas `CUSTOS.ITEM` é obrigatório (`custos.js:59`)
 * e é dele que saem subcategoria, categoria e tag do lançamento; um template sem
 * item geraria custo sem classificação e sem como classificar.
 */
function validarTemplate(payload, itens) {
  const DESCRICAO = String(payload?.DESCRICAO || '').trim();
  const ITEM = String(payload?.ITEM || '').trim();
  const FREQUENCIA = String(payload?.FREQUENCIA || '').trim();
  const DATA_INICIO = normalizarData(payload?.DATA_INICIO);
  const DATA_FIM = normalizarData(payload?.DATA_FIM);
  const qtd = num(payload?.QTD ?? 1);
  const valorUnit = num(payload?.VALOR_UNIT);

  if (!DESCRICAO) throw new Error('DESCRICAO é obrigatória');
  if (!ITEM) throw new Error('ITEM é obrigatório');
  if (!frequenciaValida(FREQUENCIA)) throw new Error('FREQUENCIA inválida');
  if (!DATA_INICIO) throw new Error('DATA_INICIO deve estar no formato DD/MM/YYYY');
  if (payload?.DATA_FIM && !DATA_FIM) throw new Error('DATA_FIM deve estar no formato DD/MM/YYYY');
  if (DATA_FIM && compararDatas(DATA_FIM, DATA_INICIO) < 0) {
    throw new Error('DATA_FIM não pode ser anterior à DATA_INICIO');
  }
  if (!Number.isFinite(qtd) || qtd <= 0) throw new Error('QTD inválida');
  if (!Number.isFinite(valorUnit) || valorUnit <= 0) throw new Error('VALOR_UNIT inválido');

  const item = (itens || []).find((i) => i.UUID === ITEM);
  if (!item) throw new Error('Item não encontrado');

  let DIA_BASE = '';
  if (usaDiaBase(FREQUENCIA)) {
    const n = parseInt(payload?.DIA_BASE, 10);
    if (!Number.isFinite(n) || n < 1 || n > 31) throw new Error('DIA_BASE deve ser um dia de 1 a 31');
    DIA_BASE = n;
  }

  return {
    DESCRICAO,
    FORNECEDOR: String(payload?.FORNECEDOR || '').trim(),
    ITEM,
    item,
    NUM_NOTA: String(payload?.NUM_NOTA ?? '').trim(),
    QTD: qtd,
    VALOR_UNIT: +valorUnit.toFixed(2),
    FREQUENCIA,
    DIA_BASE,
    DATA_INICIO,
    DATA_FIM,
  };
}

// Ordem das colunas de CUSTOS_RECORRENTES (ver TABS em sheets.js).
function linhaTemplate(uuid, v, { DATA_CORTE, ULTIMO_LANCAMENTO, ATIVO }) {
  return [
    uuid,
    v.DESCRICAO,
    v.FORNECEDOR,
    v.ITEM,
    v.item.SUB_CATEGORIA || '',
    v.item.CATEGORIA || '',
    exigeTag(v.item.CATEGORIA) ? String(v.item.TAG || '').trim() : '',
    v.QTD,
    v.VALOR_UNIT,
    v.NUM_NOTA,
    v.FREQUENCIA,
    v.DIA_BASE,
    v.DATA_INICIO,
    v.DATA_FIM,
    DATA_CORTE,
    ULTIMO_LANCAMENTO,
    ATIVO,
  ];
}

export async function criar(payload, { hoje = hojeStr() } = {}) {
  const itens = await getObjects('ITENS');
  const v = validarTemplate(payload, itens);
  const uuid = newUuid();
  // DATA_CORTE: piso imutável. Nada anterior a hoje é lançado — a DATA_INICIO no
  // passado serve só para ancorar o ciclo (decisão 3 do alinhamento).
  const DATA_CORTE = dataCorteInicial(v, hoje);
  await appendRow(TAB, linhaTemplate(uuid, v, { DATA_CORTE, ULTIMO_LANCAMENTO: '', ATIVO: 'sim' }));
  return { UUID: uuid, DATA_CORTE };
}

/**
 * Edição "esta e todas as seguintes": atualiza o template.
 * DATA_CORTE e ULTIMO_LANCAMENTO são PRESERVADOS — mover o piso na edição
 * ressuscitaria ocorrências antigas ou engoliria pendências. O que já está em
 * CUSTOS nunca é tocado: toda edição é prospectiva.
 */
export async function atualizar(uuid, payload) {
  const [itens, templates] = await Promise.all([getObjects('ITENS'), getObjects(TAB)]);
  const atual = templates.find((t) => t.UUID === uuid);
  if (!atual) throw new Error('Recorrência não encontrada');
  const v = validarTemplate(payload, itens);
  const ATIVO = payload?.ATIVO !== undefined
    ? (norm(payload.ATIVO) === 'NAO' ? 'nao' : 'sim')
    : (ativoSim(atual) ? 'sim' : 'nao');
  await updateRowByUuid(TAB, uuid, linhaTemplate(uuid, v, {
    DATA_CORTE: normalizarData(atual.DATA_CORTE),
    ULTIMO_LANCAMENTO: normalizarData(atual.ULTIMO_LANCAMENTO),
    ATIVO,
  }));
  return { UUID: uuid };
}

/**
 * Cancelamento "a partir de" uma data (default: hoje).
 *  - `DATA_FIM` = véspera da data escolhida (a partir dela não lança mais);
 *  - `ATIVO = 'nao'` SÓ quando essa data já passou. Marcar inativo com data
 *    futura pararia o processamento na hora e comeria as ocorrências entre hoje
 *    e a data escolhida — o oposto de "cancelar a partir de 20/09" (correção 5
 *    do alinhamento). O template sai de circulação sozinho quando DATA_FIM < hoje.
 *  - Exceções posteriores à data escolhida são removidas (não têm mais efeito).
 *
 * Nenhum lançamento já feito em CUSTOS é apagado.
 */
export async function cancelar(uuid, { aPartirDe, hoje = hojeStr() } = {}) {
  const templates = await getObjects(TAB);
  const t = templates.find((x) => x.UUID === uuid);
  if (!t) throw new Error('Recorrência não encontrada');

  const inicio = normalizarData(aPartirDe) || normalizarData(hoje);
  if (!inicio) throw new Error('Data de cancelamento inválida');
  const dataFim = somarDias(inicio, -1);
  const inativo = compararDatas(dataFim, normalizarData(hoje)) < 0;

  await updateCellsByUuid(TAB, [
    { uuid, field: 'DATA_FIM', value: dataFim },
    { uuid, field: 'ATIVO', value: inativo ? 'nao' : 'sim' },
  ]);

  // Exceções que caem depois do cancelamento perdem o sentido.
  const excecoes = await getObjects(TAB_EXC);
  const orfas = excecoes.filter(
    (e) => e.UUID_TEMPLATE === uuid && compararDatas(normalizarData(e.DATA_EXCECAO), dataFim) > 0,
  );
  for (const e of orfas) {
    // eslint-disable-next-line no-await-in-loop
    await deleteRowByUuid(TAB_EXC, e.UUID);
  }

  return { UUID: uuid, DATA_FIM: dataFim, ATIVO: inativo ? 'nao' : 'sim', excecoesRemovidas: orfas.length };
}

// Remoção definitiva do template (a linha some da aba). Os custos já lançados
// permanecem — inclusive com o UUID_RECORRENTE apontando para um template que não
// existe mais, que é só um rastro histórico.
export async function remover(uuid) {
  await deleteRowByUuid(TAB, uuid);
  const excecoes = await getObjects(TAB_EXC);
  const doTemplate = excecoes.filter((e) => e.UUID_TEMPLATE === uuid);
  for (const e of doTemplate) {
    // eslint-disable-next-line no-await-in-loop
    await deleteRowByUuid(TAB_EXC, e.UUID);
  }
  return { ok: true, excecoesRemovidas: doTemplate.length };
}

// --------------------------------------------------------------------------
// Exceções ("só esta data")
// --------------------------------------------------------------------------

function linhaExcecao(uuid, e) {
  return [
    uuid, e.UUID_TEMPLATE, e.DATA_EXCECAO, e.ACAO, e.DESCRICAO, e.FORNECEDOR, e.ITEM,
    '', '', '', e.QTD, e.VALOR_UNIT, e.NUM_NOTA,
  ];
}

function validarExcecao(payload, templates, itens) {
  const UUID_TEMPLATE = String(payload?.UUID_TEMPLATE || '').trim();
  const DATA_EXCECAO = normalizarData(payload?.DATA_EXCECAO);
  const ACAO = norm(payload?.ACAO) === 'PULAR' ? 'pular' : 'alterar';
  if (!templates.some((t) => t.UUID === UUID_TEMPLATE)) throw new Error('Recorrência não encontrada');
  if (!DATA_EXCECAO) throw new Error('DATA_EXCECAO deve estar no formato DD/MM/YYYY');

  const e = {
    UUID_TEMPLATE, DATA_EXCECAO, ACAO, DESCRICAO: '', FORNECEDOR: '', ITEM: '', QTD: '', VALOR_UNIT: '', NUM_NOTA: '',
  };
  if (ACAO === 'pular') return e; // 'pular' ignora os campos: a ocorrência não acontece

  e.DESCRICAO = String(payload?.DESCRICAO || '').trim();
  e.FORNECEDOR = String(payload?.FORNECEDOR || '').trim();
  e.NUM_NOTA = String(payload?.NUM_NOTA ?? '').trim();
  const item = String(payload?.ITEM || '').trim();
  if (item) {
    if (!itens.some((i) => i.UUID === item)) throw new Error('Item não encontrado');
    e.ITEM = item;
  }
  if (payload?.QTD !== undefined && payload?.QTD !== '') {
    const q = num(payload.QTD);
    if (!Number.isFinite(q) || q <= 0) throw new Error('QTD inválida');
    e.QTD = q;
  }
  if (payload?.VALOR_UNIT !== undefined && payload?.VALOR_UNIT !== '') {
    const v = num(payload.VALOR_UNIT);
    if (!Number.isFinite(v) || v <= 0) throw new Error('VALOR_UNIT inválido');
    e.VALOR_UNIT = +v.toFixed(2);
  }
  return e;
}

/**
 * Cria ou substitui a exceção daquele template naquela data (upsert). É upsert
 * de propósito: duas linhas para a mesma data tornariam o resultado dependente da
 * ordem de leitura da planilha.
 */
export async function salvarExcecao(payload) {
  const [templates, itens, excecoes] = await Promise.all([
    getObjects(TAB), getObjects('ITENS'), getObjects(TAB_EXC),
  ]);
  const e = validarExcecao(payload, templates, itens);
  const existente = excecoes.find(
    (x) => x.UUID_TEMPLATE === e.UUID_TEMPLATE && normalizarData(x.DATA_EXCECAO) === e.DATA_EXCECAO,
  );
  if (existente) {
    await updateRowByUuid(TAB_EXC, existente.UUID, linhaExcecao(existente.UUID, e));
    return { UUID: existente.UUID, substituida: true };
  }
  const uuid = newUuid();
  await appendRow(TAB_EXC, linhaExcecao(uuid, e));
  return { UUID: uuid, substituida: false };
}

export async function atualizarExcecao(uuid, payload) {
  const [templates, itens, excecoes] = await Promise.all([
    getObjects(TAB), getObjects('ITENS'), getObjects(TAB_EXC),
  ]);
  if (!excecoes.some((x) => x.UUID === uuid)) throw new Error('Exceção não encontrada');
  const e = validarExcecao(payload, templates, itens);
  await updateRowByUuid(TAB_EXC, uuid, linhaExcecao(uuid, e));
  return { UUID: uuid };
}

export async function removerExcecao(uuid) {
  await deleteRowByUuid(TAB_EXC, uuid);
  return { ok: true };
}

// --------------------------------------------------------------------------
// Prévia e processamento ("colocar em dia")
// --------------------------------------------------------------------------

async function carregarBase() {
  const [templates, excecoes, custos, itens, fornecedores] = await Promise.all([
    getObjects(TAB), getObjects(TAB_EXC), getObjects(TAB_CUSTOS),
    getObjects('ITENS'), getObjects('FORNECEDOR'),
  ]);
  return { templates, excecoes, custos, itens, fornecedores };
}

// Valor do campo na ocorrência: a exceção 'alterar' sobrepõe o template, mas só
// nos campos que ela realmente preencheu (célula vazia não sobrepõe nada).
function campo(template, excecao, nome) {
  if (excecao && String(excecao[nome] ?? '').trim() !== '') return excecao[nome];
  return template[nome];
}

/**
 * Monta a linha de CUSTOS de uma ocorrência. Lança Error com mensagem legível
 * quando a ocorrência não tem como virar custo (item apagado, valor zerado...).
 *
 * NÃO reaproveita `custos.montarLinha`: aquela função rejeita NUM_NOTA vazio e
 * devolve 15 colunas (a aba tem 17). É justamente por escrever só até a coluna O
 * que a edição de um custo pela tela preserva CHAVE_NFE — e agora também o
 * UUID_RECORRENTE. Aqui a linha é montada inteira, como em `importarLoteXml`.
 */
function montarCusto(template, data, excecao, itemByUuid) {
  const itemUuid = String(campo(template, excecao, 'ITEM') || '').trim();
  const item = itemByUuid.get(itemUuid);
  if (!item) throw new Error('item do cadastro não encontrado (foi excluído?)');

  const qtd = num(campo(template, excecao, 'QTD'));
  const valorUnit = num(campo(template, excecao, 'VALOR_UNIT'));
  if (!Number.isFinite(qtd) || qtd <= 0) throw new Error('QTD inválida no template');
  if (!Number.isFinite(valorUnit) || valorUnit <= 0) throw new Error('VALOR_UNIT inválido no template');

  const { MES_ANO, MES_NUM, ANO, DIA_MES_ANO } = derivarCamposData(data);
  const valorTotal = +(qtd * valorUnit).toFixed(2);
  // NUM_NOTA vazio vira "Sem Nota" — mesma convenção da importação em lote.
  const numNota = String(campo(template, excecao, 'NUM_NOTA') ?? '').trim() || 'Sem Nota';
  const fornecedor = String(campo(template, excecao, 'FORNECEDOR') || '').trim() || 'Sem Fornecedor';
  // Classificação e tag vêm do ITEM no momento do lançamento, não do template:
  // o item é a fonte da verdade desde a 1.4.1, e reclassificá-lo faz back-fill em
  // todos os custos dele. Congelar no template reintroduziria a classe antiga.
  const tag = exigeTag(item.CATEGORIA) ? String(item.TAG || '').trim() : '';

  const linha = [
    newUuid(), data, numNota, MES_ANO, MES_NUM, ANO, DIA_MES_ANO, fornecedor,
    item.DESCRICAO_ITEM, item.SUB_CATEGORIA || '', item.CATEGORIA || '',
    qtd, valorUnit, valorTotal, tag,
    '', // CHAVE_NFE — não é NF-e
    `${template.UUID}|${data}`, // UUID_RECORRENTE: a trava de idempotência
  ];

  return {
    linha,
    resumo: {
      UUID_TEMPLATE: template.UUID,
      DESCRICAO: campo(template, excecao, 'DESCRICAO') || template.DESCRICAO,
      DATA: data,
      FORNECEDOR: fornecedor,
      ITEM: item.DESCRICAO_ITEM,
      SUB_CATEGORIA: item.SUB_CATEGORIA || '',
      CATEGORIA: item.CATEGORIA || '',
      TAG: tag,
      QTD: qtd,
      VALOR_UNIT: valorUnit,
      VALOR_TOTAL: valorTotal,
      NUM_NOTA: numNota,
      EXCECAO: excecao ? 'alterada' : '',
    },
  };
}

/**
 * Calcula tudo o que está vencido e ainda não foi lançado, sem gravar nada.
 * A janela de cada template começa no dia seguinte à DATA_CORTE (ou na
 * DATA_INICIO, quando não há corte) e termina em `hoje`.
 */
function montarPendentes({ templates, excecoes, custos, itens }, hoje) {
  const itemByUuid = new Map(itens.map((i) => [i.UUID, i]));
  // A trava real: a ocorrência já existe em CUSTOS? Excluir o custo na tela
  // devolve a data à prévia — que é o ponto da coluna UUID_RECORRENTE.
  const jaLancadas = new Set(
    custos.map((c) => String(c.UUID_RECORRENTE || '').trim()).filter(Boolean),
  );

  const lancamentos = [];
  const erros = [];

  for (const t of templates) {
    if (!ativoSim(t)) continue;
    const corte = normalizarData(t.DATA_CORTE);
    const inicioJanela = corte ? somarDias(corte, 1) : normalizarData(t.DATA_INICIO);
    if (!inicioJanela) {
      erros.push({ UUID_TEMPLATE: t.UUID, DESCRICAO: t.DESCRICAO, motivo: 'DATA_INICIO inválida' });
      continue;
    }
    const datas = calcularOcorrencias(t, inicioJanela, hoje);
    const doTemplate = excecoes.filter((e) => e.UUID_TEMPLATE === t.UUID);
    for (const { DATA, excecao } of aplicarExcecoes(datas, doTemplate)) {
      if (jaLancadas.has(`${t.UUID}|${DATA}`)) continue;
      try {
        const { linha, resumo } = montarCusto(t, DATA, excecao, itemByUuid);
        lancamentos.push({ UUID_TEMPLATE: t.UUID, DATA, linha, resumo });
      } catch (e) {
        erros.push({
          UUID_TEMPLATE: t.UUID, DESCRICAO: t.DESCRICAO, DATA, motivo: e.message,
        });
      }
    }
  }

  lancamentos.sort((a, b) => compararDatas(a.DATA, b.DATA));
  const templatesAfetados = new Set(lancamentos.map((l) => l.UUID_TEMPLATE));
  return {
    hoje,
    total: lancamentos.length,
    templates: templatesAfetados.size,
    valorTotal: +lancamentos.reduce((s, l) => s + l.resumo.VALOR_TOTAL, 0).toFixed(2),
    lancamentos,
    erros,
  };
}

// Prévia: o que o botão "colocar em dia" lançaria agora. Leitura pura.
export async function pendentes({ hoje = hojeStr() } = {}) {
  const base = await carregarBase();
  const r = montarPendentes(base, hoje);
  // A linha crua de planilha não interessa a quem só vai exibir a prévia.
  return { ...r, lancamentos: r.lancamentos.map((l) => l.resumo) };
}

/**
 * Efetiva os lançamentos vencidos. Recalcula a prévia na hora (a planilha pode
 * ter mudado entre a tela e o clique) e grava numa passada: um appendRows em
 * CUSTOS e um batchUpdate para os ULTIMO_LANCAMENTO.
 *
 * Idempotente: rodar duas vezes seguidas não duplica, porque a segunda rodada
 * encontra o UUID_RECORRENTE de cada ocorrência já em CUSTOS.
 *
 * `uuids` (opcional) restringe a um ou mais templates.
 */
export async function processar({ hoje = hojeStr(), uuids = null } = {}) {
  const base = await carregarBase();
  const previa = montarPendentes(base, hoje);

  const filtro = Array.isArray(uuids) && uuids.length ? new Set(uuids) : null;
  const alvo = filtro
    ? previa.lancamentos.filter((l) => filtro.has(l.UUID_TEMPLATE))
    : previa.lancamentos;

  if (!alvo.length) {
    return {
      lancados: 0, templates: 0, valorTotal: 0, erros: previa.erros, porTemplate: [],
    };
  }

  // "Sem Fornecedor" precisa existir no cadastro, como na importação — senão o
  // filtro de fornecedor da tela de Custos mostraria um nome que não existe.
  const nomes = new Set(base.fornecedores.map((f) => norm(f.NOME_FORNECEDOR)));
  const faltantes = [...new Set(
    alvo.map((l) => l.resumo.FORNECEDOR).filter((f) => !nomes.has(norm(f))),
  )];
  if (faltantes.length) {
    await appendRows('FORNECEDOR', faltantes.map((f) => [newUuid(), f]));
    invalidate('fornecedores');
  }

  await appendRows(TAB_CUSTOS, alvo.map((l) => l.linha));

  // ULTIMO_LANCAMENTO é atalho de leitura (pinta o ✓ no calendário sem varrer
  // CUSTOS). Guarda a data mais recente efetivamente lançada de cada template.
  const ultimaPorTemplate = new Map();
  for (const l of alvo) {
    const atual = ultimaPorTemplate.get(l.UUID_TEMPLATE);
    if (!atual || compararDatas(l.DATA, atual) > 0) ultimaPorTemplate.set(l.UUID_TEMPLATE, l.DATA);
  }
  await updateCellsByUuid(TAB, [...ultimaPorTemplate].map(([uuid, value]) => ({
    uuid, field: 'ULTIMO_LANCAMENTO', value,
  })));

  const porTemplate = [...ultimaPorTemplate].map(([uuid, ultima]) => {
    const doTemplate = alvo.filter((l) => l.UUID_TEMPLATE === uuid);
    return {
      UUID_TEMPLATE: uuid,
      DESCRICAO: doTemplate[0]?.resumo.DESCRICAO || '',
      lancados: doTemplate.length,
      ultimaData: ultima,
      valorTotal: +doTemplate.reduce((s, l) => s + l.resumo.VALOR_TOTAL, 0).toFixed(2),
    };
  });

  return {
    lancados: alvo.length,
    templates: porTemplate.length,
    valorTotal: +alvo.reduce((s, l) => s + l.resumo.VALOR_TOTAL, 0).toFixed(2),
    fornecedoresCriados: faltantes.length,
    lancamentos: alvo.map((l) => l.resumo),
    porTemplate,
    erros: previa.erros,
  };
}

// Metadados das frequências para a tela montar o select sem duplicar a tabela.
export function frequencias() {
  return Object.entries(FREQUENCIAS).map(([valor, { label, unidade }]) => ({
    valor, label, usaDiaBase: unidade === 'meses',
  }));
}
