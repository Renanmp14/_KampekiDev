// Núcleo de cálculo do Caixa — funções puras, isoladas da tela para poderem ser
// testadas sem renderizar o React (é a parte que mexe com dinheiro).
//
// Regra que atravessa as três: o saldo é do CAIXA, não do filtro. Os filtros
// escolhem o que aparece na tela; o saldo sempre reflete o dinheiro que existe
// de fato, considerando todo o histórico.

import { toNum } from './format.js';

// "DD/MM/YYYY" -> "YYYYMMDD" (ordenável e comparável)
export function chaveDia(data) {
  const m = String(data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}${m[2]}${m[1]}` : '';
}

// "08/2026" -> "202608" (ordenável, atravessa anos)
export function chaveMes(mesAno) {
  const m = String(mesAno || '').match(/^(\d{2})\/(\d{4})$/);
  return m ? `${m[2]}${m[1]}` : '';
}

// Entrada soma, saída subtrai.
export function valorCom(r) {
  return r.TIPO === 'entrada' ? toNum(r.VALOR) : -toNum(r.VALOR);
}

/**
 * Saldo corrido sobre TODO o histórico (lista em ordem cronológica), a partir
 * de zero. Devolve Map<UUID, saldo naquele instante>.
 *
 * É calculado sobre o histórico inteiro de propósito: com meses não contíguos
 * selecionados (ex.: Janeiro + Março), o saldo de uma linha de Março precisa
 * embutir o que passou em Fevereiro — senão o número deixaria de ser o dinheiro
 * que está na caixa.
 */
export function saldoCorrido(cronologico) {
  const mapa = new Map();
  let acc = 0;
  cronologico.forEach((r) => {
    acc += valorCom(r);
    mapa.set(r.UUID, acc);
  });
  return mapa;
}

/**
 * Começo do recorte como chave "YYYYMMDD": o ponto mais antigo selecionado.
 * Tudo anterior a ele forma o saldo inicial. Sem filtro de tempo devolve ''
 * (não existe "antes" — o saldo inicial é zero).
 *
 * fDias só é considerado quando há exatamente UM mês selecionado (o mesmo DD em
 * meses diferentes seria ambíguo).
 */
export function inicioKeyDe(fAnos = [], fMeses = [], fDias = []) {
  if (fMeses.length) {
    const menorMes = [...fMeses].sort((a, b) => chaveMes(a).localeCompare(chaveMes(b)))[0];
    const base = chaveMes(menorMes);
    if (!base) return '';
    if (fMeses.length === 1 && fDias.length) return `${base}${[...fDias].sort()[0]}`;
    return `${base}01`;
  }
  if (fAnos.length) return `${[...fAnos].sort()[0]}0101`;
  return '';
}

/** Saldo acumulado antes do começo do recorte (o "saldo inicial" do período). */
export function saldoAntesDe(cronologico, inicioKey) {
  if (!inicioKey) return 0;
  return cronologico
    .filter((r) => chaveDia(r.DATA) < inicioKey)
    .reduce((s, r) => s + valorCom(r), 0);
}
