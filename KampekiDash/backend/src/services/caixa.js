// Caixa (dinheiro físico) — módulo desacoplado dos demais (CUSTOS, ITENS,
// FOLHA). Cada registro é uma entrada ou saída de dinheiro em espécie.
//
// MES_ANO e ANO NÃO são gravados na planilha: são derivados de DATA aqui na
// leitura (economiza colunas e evita dado redundante que pode divergir).

import {
  getObjects, appendRow, updateRowByUuid, deleteRowByUuid,
} from './sheets.js';
import { getCache, setCache, invalidate } from './cache.js';
import { newUuid } from '../utils/uuid.js';

const TAB = 'CAIXA';
const CACHE_KEY = 'caixa';

export const TIPOS = ['entrada', 'saida'];

// --- Validação / normalização -------------------------------------------

// Valida DD/MM/YYYY exigindo uma data que EXISTE no calendário (31/02 é
// recusado). Devolve as partes e a string normalizada.
function validarData(str) {
  const m = String(str || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error('DATA é obrigatória no formato DD/MM/YYYY');
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  const ano = parseInt(m[3], 10);
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) {
    throw new Error('DATA inválida (dia inexistente no mês)');
  }
  return { dia, mes, ano, DATA: `${m[1]}/${m[2]}/${m[3]}` };
}

// "entrada"/"saida" em minúsculas e sem acento — aceita o que o usuário mandar
// ("Entrada", "SAÍDA") e normaliza para o valor canônico gravado.
function validarTipo(str) {
  const t = String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
  if (!TIPOS.includes(t)) throw new Error('TIPO deve ser "entrada" ou "saida"');
  return t;
}

// Aceita número nativo ou string pt-BR/en ("1.234,56", "R$ 10", "10.5").
function paraNumero(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/r\$/i, '').replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return parseFloat(s);
}

const round2 = (n) => Math.round(n * 100) / 100;

// Valida o payload inteiro e devolve a linha pronta para a planilha (na ordem
// de TABS.CAIXA). Usado por criar() e atualizar().
function montarLinha(uuid, payload) {
  const { DATA } = validarData(payload?.DATA);
  const TIPO = validarTipo(payload?.TIPO);

  const DESCRICAO = String(payload?.DESCRICAO || '').trim();
  if (!DESCRICAO) throw new Error('DESCRICAO é obrigatória');

  const valor = paraNumero(payload?.VALOR);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('VALOR é obrigatório e deve ser maior que zero');
  }
  const VALOR = round2(valor);

  // PESSOA é opcional (origem na entrada, destino na saída). A grafia é
  // preservada como digitada; o agrupamento no frontend ignora caixa/acento.
  const PESSOA = String(payload?.PESSOA || '').trim();

  return {
    registro: {
      UUID: uuid, DATA, TIPO, DESCRICAO, VALOR, PESSOA,
    },
    linha: [uuid, DATA, TIPO, DESCRICAO, VALOR, PESSOA],
  };
}

// --- Leitura --------------------------------------------------------------

// Chave ordenável a partir de DD/MM/YYYY -> "YYYYMMDD".
function chaveData(data) {
  const m = String(data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}${m[2]}${m[1]}` : '';
}

/**
 * Lista todos os registros, do mais recente para o mais antigo.
 * Desempate dentro do mesmo dia: ordem de gravação na planilha (_row) — o UUID
 * é aleatório (v4) e não ordena nada, e é a ordem da linha que torna o saldo
 * acumulado reproduzível.
 */
export async function listar() {
  const cached = getCache(CACHE_KEY);
  if (cached) return cached;

  const objs = await getObjects(TAB);
  const list = objs
    .filter((o) => o.UUID)
    .map((o) => {
      const m = String(o.DATA || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return {
        UUID: o.UUID,
        DATA: o.DATA,
        TIPO: validarTipoSuave(o.TIPO),
        DESCRICAO: o.DESCRICAO,
        VALOR: Number.isFinite(paraNumero(o.VALOR)) ? paraNumero(o.VALOR) : 0,
        PESSOA: o.PESSOA || '',
        // Derivados (não gravados) — usados nos filtros do frontend.
        MES_ANO: m ? `${m[2]}/${m[3]}` : '',
        ANO: m ? parseInt(m[3], 10) : null,
        _row: o._row,
      };
    })
    .sort((a, b) => {
      const ka = chaveData(a.DATA);
      const kb = chaveData(b.DATA);
      if (ka !== kb) return kb.localeCompare(ka); // data desc
      return b._row - a._row; // mesmo dia: gravação mais recente primeiro
    });

  setCache(CACHE_KEY, list);
  return list;
}

// Na LEITURA um TIPO fora do padrão não pode derrubar a listagem (dado legado
// ou editado à mão na planilha): normaliza o que dá e devolve o resto como veio.
function validarTipoSuave(t) {
  try {
    return validarTipo(t);
  } catch {
    return String(t || '').trim().toLowerCase();
  }
}

// --- Escrita --------------------------------------------------------------

export async function criar(payload) {
  const uuid = newUuid();
  const { registro, linha } = montarLinha(uuid, payload);
  await appendRow(TAB, linha);
  invalidate(CACHE_KEY);
  return registro;
}

export async function atualizar(uuid, payload) {
  if (!uuid) throw new Error('UUID é obrigatório');
  const { registro, linha } = montarLinha(uuid, payload);
  await updateRowByUuid(TAB, uuid, linha); // lança se o UUID não existir
  invalidate(CACHE_KEY);
  return registro;
}

export async function remover(uuid) {
  if (!uuid) throw new Error('UUID é obrigatório');
  await deleteRowByUuid(TAB, uuid);
  invalidate(CACHE_KEY);
  return { ok: true };
}
