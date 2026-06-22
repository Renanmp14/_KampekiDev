import {
  getObjects, appendRow, updateRowByUuid, deleteRowByUuid,
} from './sheets.js';
import { newUuid } from '../utils/uuid.js';
import { derivarCamposMesAno } from '../utils/date.js';
import { exigeTag } from '../utils/switch-categoria.js';
import { tagExiste } from './tag.js';

const TAB = 'FOLHA';

function num(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// A "folha" do negócio é, na prática, lançada como CUSTO (categoria FOLHA
// CANOAS/POA/TELE + TAG) — não há lançamento de folha separado. Por isso a
// listagem de folha unifica duas fontes:
//   1. aba FOLHA (lançamentos manuais avulsos, se houver) → _origem 'folha'
//   2. custos de categoria FOLHA, mapeados para o formato folha → _origem 'custo'
// Todos os consumidores (Dash Folha, Análise por Período–Folha, página Folha)
// recebem a visão unificada sem reimplementar a regra.
function custoParaFolha(c) {
  return {
    UUID: c.UUID,
    MES_ANO: c.MES_ANO,
    MES_NUM: c.MES_NUM,
    ANO: c.ANO,
    TAG: c.TAG || '',
    ITEM_FOLHA: c.ITEM,
    VALOR: c.VALOR_TOTAL,
    OBSERVACAO: '',
    CATEGORIA: c.CATEGORIA, // útil para quebra por unidade (Canoas/POA/Tele)
    _origem: 'custo',
  };
}

export async function listar() {
  const [folhaRows, custosRows] = await Promise.all([
    getObjects(TAB),
    getObjects('CUSTOS'),
  ]);
  const proprios = folhaRows.map((o) => ({ ...o, _origem: 'folha' }));
  const deCustos = custosRows
    .filter((c) => exigeTag(String(c.CATEGORIA || '').trim().toUpperCase()))
    .map(custoParaFolha);
  return [...proprios, ...deCustos];
}

async function montarLinha(uuid, payload) {
  const { MES_ANO, TAG, ITEM_FOLHA, VALOR, OBSERVACAO } = payload;

  if (!MES_ANO) throw new Error('MES_ANO é obrigatório');
  if (!TAG) throw new Error('TAG é obrigatória');
  if (!ITEM_FOLHA) throw new Error('ITEM_FOLHA é obrigatório');

  const valor = num(VALOR);
  if (!Number.isFinite(valor) || valor < 0) throw new Error('VALOR inválido');

  const tag = String(TAG).trim();
  if (!(await tagExiste(tag))) throw new Error('TAG não cadastrada');

  const { MES_NUM, ANO } = derivarCamposMesAno(MES_ANO);

  // Ordem: UUID, MES_ANO, MES_NUM, ANO, TAG, ITEM_FOLHA, VALOR, OBSERVACAO
  return [
    uuid,
    MES_ANO,
    MES_NUM,
    ANO,
    tag,
    String(ITEM_FOLHA).trim(),
    valor,
    String(OBSERVACAO || '').trim(),
  ];
}

export async function criar(payload) {
  const uuid = newUuid();
  const linha = await montarLinha(uuid, payload);
  await appendRow(TAB, linha);
  return { UUID: uuid };
}

export async function atualizar(uuid, payload) {
  const linha = await montarLinha(uuid, payload);
  await updateRowByUuid(TAB, uuid, linha);
  return { UUID: uuid };
}

export async function remover(uuid) {
  await deleteRowByUuid(TAB, uuid);
  return { ok: true };
}
