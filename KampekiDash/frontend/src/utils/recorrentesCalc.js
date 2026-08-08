// Núcleo de cálculo das recorrências (custos fixos) — versão do frontend.
//
// ⚠ ESPELHO de `backend/src/utils/recorrencia.js`, que é o arquivo CANÔNICO. A
// duplicação é deliberada: o calendário projeta as ocorrências futuras a cada
// troca de mês e não pode depender de uma ida ao servidor, e o backend não pode
// importar daqui (esta pasta não é empacotada junto do backend no Electron).
// Mudou lá, muda aqui — existe um teste de paridade que roda a mesma bateria nos
// dois módulos e exige resultado idêntico.
//
// Funções PURAS: nada de rede, planilha ou React, e o relógio só é lido em
// `hojeStr()`. Datas em `DD/MM/YYYY` e toda comparação POR VALOR (via UTC), nunca
// lexicográfica — "02/01/2026" é menor que "10/12/2025" como texto.

// Passo de cada frequência. `unidade: 'meses'` é o que decide se o DIA_BASE vale
// (frequências mensais ou maiores) ou se o ciclo simplesmente conta dias.
export const FREQUENCIAS = {
  diario: { label: 'Todo dia', unidade: 'dias', passo: 1 },
  '3dias': { label: 'A cada 3 dias', unidade: 'dias', passo: 3 },
  '5dias': { label: 'A cada 5 dias', unidade: 'dias', passo: 5 },
  semanal: { label: 'Toda semana', unidade: 'dias', passo: 7 },
  quinzenal: { label: 'A cada 2 semanas', unidade: 'dias', passo: 14 },
  mensal: { label: 'Todo mês', unidade: 'meses', passo: 1 },
  trimestral: { label: 'A cada 3 meses', unidade: 'meses', passo: 3 },
  semestral: { label: 'A cada 6 meses', unidade: 'meses', passo: 6 },
  anual: { label: 'Todo ano', unidade: 'meses', passo: 12 },
};

// Trava de segurança: impede que um dado torto na planilha (frequência diária com
// DATA_INICIO em 1900, por exemplo) transforme a geração num laço interminável.
const MAX_OCORRENCIAS = 5000;

export function frequenciaValida(freq) {
  return Object.prototype.hasOwnProperty.call(FREQUENCIAS, String(freq || ''));
}

export function usaDiaBase(freq) {
  return FREQUENCIAS[String(freq || '')]?.unidade === 'meses';
}

export function labelFrequencia(freq) {
  return FREQUENCIAS[String(freq || '')]?.label || '';
}

// Último dia do mês (1-12). Dia 0 do mês seguinte = último do mês atual; trata
// ano bissexto sem tabela própria.
export function ultimoDiaMes(mes, ano) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

// Quebra `DD/MM/YYYY` em partes numéricas, validando que a data EXISTE (31/02
// não passa). Aceita dia/mês com um dígito só, porque a planilha é editável à mão.
// Devolve `null` no lugar de lançar: as funções de cálculo precisam ser tolerantes
// a lixo, e quem valida entrada de usuário é o serviço.
export function parseData(str) {
  const m = String(str ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  const ano = parseInt(m[3], 10);
  if (mes < 1 || mes > 12) return null;
  if (dia < 1 || dia > ultimoDiaMes(mes, ano)) return null;
  return { dia, mes, ano };
}

export function formatarData({ dia, mes, ano }) {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

// Reescreve a data na grafia canônica (`5/8/2026` -> `05/08/2026`). Devolve '' se
// não for data válida. Usado antes de comparar strings vindas da planilha.
export function normalizarData(str) {
  const d = parseData(str);
  return d ? formatarData(d) : '';
}

// Data em milissegundos UTC — a régua de todas as comparações. NaN se inválida.
export function ms(str) {
  const d = parseData(str);
  return d ? Date.UTC(d.ano, d.mes - 1, d.dia) : NaN;
}

export function compararDatas(a, b) {
  const x = ms(a);
  const y = ms(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return 0;
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

const DIA_MS = 86400000;

export function somarDias(str, n) {
  const t = ms(str);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + n * DIA_MS);
  return formatarData({ dia: d.getUTCDate(), mes: d.getUTCMonth() + 1, ano: d.getUTCFullYear() });
}

function diasEntre(de, ate) {
  return Math.round((ms(ate) - ms(de)) / DIA_MS);
}

// Índice absoluto de mês (ano*12 + mês-1). Toda a aritmética mensal roda sobre
// ele: somar meses no índice e só então resolver o dia evita a DERIVA que
// apareceria ao somar em cima da data já encurtada — um template do dia 31
// passaria a cair no dia 28 para sempre depois de um fevereiro.
function indiceMes(ano, mes) {
  return ano * 12 + (mes - 1);
}

function dataDoIndice(idx, diaBase) {
  const ano = Math.floor(idx / 12);
  const mes = (idx % 12) + 1;
  return formatarData({ dia: Math.min(diaBase, ultimoDiaMes(mes, ano)), mes, ano });
}

function diaBaseDe(template, inicio) {
  const n = parseInt(template?.DIA_BASE, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 31) return n;
  return inicio.dia; // sem DIA_BASE, o dia da própria DATA_INICIO ancora o ciclo
}

/**
 * Todas as datas de ocorrência do template dentro de [de, ate], já respeitando
 * DATA_INICIO, DATA_FIM e o DIA_BASE. Não sabe nada sobre o que já foi lançado —
 * isso é papel do serviço, que cruza com CUSTOS e com a DATA_CORTE.
 *
 * `template`: { FREQUENCIA, DIA_BASE, DATA_INICIO, DATA_FIM }
 * Retorna array de strings `DD/MM/YYYY` em ordem cronológica.
 */
export function calcularOcorrencias(template, de, ate) {
  const freq = FREQUENCIAS[String(template?.FREQUENCIA || '')];
  const inicio = parseData(template?.DATA_INICIO);
  const inicioJanela = parseData(de);
  const fimJanela = parseData(ate);
  if (!freq || !inicio || !inicioJanela || !fimJanela) return [];

  // O fim efetivo é o menor entre o fim da janela pedida e a DATA_FIM do template.
  const fimTemplate = parseData(template?.DATA_FIM);
  let limite = formatarData(fimJanela);
  if (fimTemplate && compararDatas(formatarData(fimTemplate), limite) < 0) {
    limite = formatarData(fimTemplate);
  }
  const inicioStr = formatarData(inicio);
  const deStr = formatarData(inicioJanela);
  if (compararDatas(inicioStr, limite) > 0) return [];

  const out = [];
  let atual;

  if (freq.unidade === 'dias') {
    atual = inicioStr;
    // Salto direto até a vizinhança do início da janela: um template diário com
    // DATA_INICIO anos atrás não pode custar milhares de iterações só para chegar
    // ao mês que está na tela.
    const diff = diasEntre(inicioStr, deStr);
    if (diff > 0) atual = somarDias(inicioStr, Math.floor(diff / freq.passo) * freq.passo);
    while (compararDatas(atual, deStr) < 0) atual = somarDias(atual, freq.passo);
  } else {
    const diaBase = diaBaseDe(template, inicio);
    let idx = indiceMes(inicio.ano, inicio.mes);
    // A primeira ocorrência é a primeira data >= DATA_INICIO cujo dia bate com o
    // DIA_BASE — se o dia já passou no mês de início, cai no ciclo seguinte.
    if (compararDatas(dataDoIndice(idx, diaBase), inicioStr) < 0) idx += freq.passo;
    const idxDe = indiceMes(inicioJanela.ano, inicioJanela.mes);
    if (idxDe > idx) idx += Math.floor((idxDe - idx) / freq.passo) * freq.passo;
    while (compararDatas(dataDoIndice(idx, diaBase), deStr) < 0) idx += freq.passo;
    atual = dataDoIndice(idx, diaBase);

    while (compararDatas(atual, limite) <= 0 && out.length < MAX_OCORRENCIAS) {
      out.push(atual);
      idx += freq.passo;
      atual = dataDoIndice(idx, diaBase);
    }
    return out;
  }

  while (compararDatas(atual, limite) <= 0 && out.length < MAX_OCORRENCIAS) {
    out.push(atual);
    atual = somarDias(atual, freq.passo);
  }
  return out;
}

/**
 * Cruza as datas calculadas com as exceções daquele template.
 *  - `ACAO = 'pular'`   → a ocorrência some (o caso "este mês não lança");
 *  - `ACAO = 'alterar'` → a ocorrência fica, carregando a linha de exceção para
 *    quem for montar o custo sobrepor os campos do template.
 *
 * O caller já deve ter filtrado as exceções pelo UUID do template.
 * Retorna [{ DATA, excecao }] — `excecao` é `null` quando não há.
 */
export function aplicarExcecoes(ocorrencias, excecoes) {
  const porData = new Map();
  for (const e of excecoes || []) {
    const d = normalizarData(e?.DATA_EXCECAO);
    if (d) porData.set(d, e);
  }
  const out = [];
  for (const oc of ocorrencias || []) {
    const data = normalizarData(oc);
    if (!data) continue;
    const exc = porData.get(data);
    if (exc && String(exc.ACAO || 'alterar').trim().toLowerCase() === 'pular') continue;
    out.push({ DATA: data, excecao: exc || null });
  }
  return out;
}

/**
 * DATA_CORTE do template no momento da criação: a última ocorrência ESTRITAMENTE
 * anterior a `hoje` (vazia quando o template começa hoje ou no futuro).
 *
 * É o piso imutável que segura o retroativo. A trava de duplicidade é outra — o
 * UUID_RECORRENTE gravado em CUSTOS —, e é essa separação que faz um custo gerado
 * e depois excluído na tela voltar à prévia, em vez de sumir para sempre.
 */
export function dataCorteInicial(template, hoje) {
  const inicio = parseData(template?.DATA_INICIO);
  const ref = parseData(hoje);
  if (!inicio || !ref) return '';
  const ontem = somarDias(formatarData(ref), -1);
  if (compararDatas(formatarData(inicio), ontem) > 0) return '';
  const ocorrencias = calcularOcorrencias(template, template.DATA_INICIO, ontem);
  return ocorrencias.length ? ocorrencias[ocorrencias.length - 1] : '';
}

// Próxima data após `dataAnterior`, seguindo a frequência. Usada para descrever o
// próximo vencimento na tela sem recalcular a série inteira.
export function proximaData(frequencia, dataAnterior, diaBase) {
  const freq = FREQUENCIAS[String(frequencia || '')];
  const d = parseData(dataAnterior);
  if (!freq || !d) return '';
  if (freq.unidade === 'dias') return somarDias(formatarData(d), freq.passo);
  const n = parseInt(diaBase, 10);
  const base = Number.isFinite(n) && n >= 1 && n <= 31 ? n : d.dia;
  return dataDoIndice(indiceMes(d.ano, d.mes) + freq.passo, base);
}

// Data de hoje em DD/MM/YYYY, no fuso local — o único ponto que lê o relógio.
// Fica isolado de propósito: tudo o mais recebe "hoje" por parâmetro e por isso é
// testável sem congelar o tempo.
export function hojeStr() {
  const d = new Date();
  return formatarData({ dia: d.getDate(), mes: d.getMonth() + 1, ano: d.getFullYear() });
}
