// Helpers de data. Datas trafegam como string DD/MM/YYYY entre front e back.

const MESES_PT = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

// Valida e quebra uma string DD/MM/YYYY em partes numéricas.
export function parseDataNota(str) {
  if (typeof str !== 'string') throw new Error('DATA_NOTA inválida');
  const m = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error('DATA_NOTA deve estar no formato DD/MM/YYYY');
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  const ano = parseInt(m[3], 10);
  if (mes < 1 || mes > 12) throw new Error('Mês inválido em DATA_NOTA');
  if (dia < 1 || dia > 31) throw new Error('Dia inválido em DATA_NOTA');
  return { dia, mes, ano };
}

// A partir de DATA_NOTA (DD/MM/YYYY) deriva os campos auxiliares de custo.
export function derivarCamposData(dataNota) {
  const { dia, mes, ano } = parseDataNota(dataNota);
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return {
    MES_ANO: `${mm}/${ano}`,
    MES_NUM: mes,
    ANO: ano,
    DIA_MES_ANO: `${dd}/${mm}/${ano}`,
  };
}

// Valida e quebra uma string MES_ANO no formato MM/YYYY.
export function parseMesAno(str) {
  if (typeof str !== 'string') throw new Error('MES_ANO inválido');
  const m = str.trim().match(/^(\d{2})\/(\d{4})$/);
  if (!m) throw new Error('MES_ANO deve estar no formato MM/YYYY');
  const mes = parseInt(m[1], 10);
  const ano = parseInt(m[2], 10);
  if (mes < 1 || mes > 12) throw new Error('Mês inválido em MES_ANO');
  return { mes, ano };
}

// Deriva MES_NUM e ANO a partir de MES_ANO (MM/YYYY).
export function derivarCamposMesAno(mesAno) {
  const { mes, ano } = parseMesAno(mesAno);
  return { MES_NUM: mes, ANO: ano };
}

// Retorna a string DD/MM/YYYY do último dia do mês de um MES_ANO (MM/YYYY).
// Ex.: "02/2026" -> "28/02/2026". Usado na importação para linhas sem data.
export function ultimoDiaDoMes(mesAno) {
  const { mes, ano } = parseMesAno(mesAno);
  // Dia 0 do mês seguinte = último dia do mês atual (trata anos bissextos).
  const dia = new Date(ano, mes, 0).getDate();
  const dd = String(dia).padStart(2, '0');
  const mm = String(mes).padStart(2, '0');
  return `${dd}/${mm}/${ano}`;
}

export function nomeMes(mesNum) {
  return MESES_PT[mesNum - 1] || '';
}

// Converte DD/MM/YYYY em milissegundos UTC, para comparar datas POR VALOR.
// Comparar as strings direto ordena errado ("02/01/2026" < "10/12/2025" como
// texto). Aceita dia/mês com um dígito só — a planilha é editável à mão — e
// devolve NaN em vez de lançar, porque quem chama está filtrando, não validando.
export function dataParaMs(str) {
  const m = String(str ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return NaN;
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  const ano = parseInt(m[3], 10);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return NaN;
  return Date.UTC(ano, mes - 1, dia);
}
