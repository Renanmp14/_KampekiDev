// Helpers de formatação (pt-BR).

export function brl(value) {
  const n = toNum(value);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function pct(value) {
  const n = toNum(value);
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Valor monetário compacto para eixos de gráfico e rótulos: milhar (k), milhão
// (mi) e bilhão (bi). Antes só ia até "k", o que estourava com valores em milhão
// (ex.: 1.500.000 virava "1.500k"); agora vira "R$ 1,5mi".
export function brlCompact(value) {
  const n = toNum(value);
  const abs = Math.abs(n);
  const f = (x, d) => x.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
  if (abs >= 1e9) return `R$ ${f(n / 1e9, 1)}bi`;
  if (abs >= 1e6) return `R$ ${f(n / 1e6, 1)}mi`;
  if (abs >= 1e3) return `R$ ${f(n / 1e3, 0)}k`;
  return `R$ ${f(n, 0)}`;
}

// Converte valor vindo do Sheets em número. Aceita number nativo (com a leitura
// UNFORMATTED_VALUE os números chegam assim) e strings em pt-BR ("R$ 1.234,56")
// ou en ("1234.56") como fallback de robustez.
export function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).trim().replace(/r\$/i, '').replace(/\s/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    // "1.234,56" -> ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // "1234,56" -> vírgula = decimal
    s = s.replace(',', '.');
  }
  // só ponto (ou nenhum separador): "1234.56" / "1.5" / "5" — já é parseável
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// "06/2026" -> chave ordenável "2026-06"
export function mesAnoKey(mesAno) {
  const m = String(mesAno || '').match(/^(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[2]}-${m[1]}`;
}

export function categoriaBadgeClass(categoria) {
  const c = String(categoria || '').toUpperCase();
  if (c === 'CMV') return 'badge badge-cmv';
  if (c.startsWith('FOLHA')) return 'badge badge-folha';
  if (c === 'DESPESA ADMINISTRATIVA') return 'badge badge-desp';
  return 'badge badge-default';
}

export const MESES = [
  { num: 1, nome: 'Janeiro' }, { num: 2, nome: 'Fevereiro' }, { num: 3, nome: 'Março' },
  { num: 4, nome: 'Abril' }, { num: 5, nome: 'Maio' }, { num: 6, nome: 'Junho' },
  { num: 7, nome: 'Julho' }, { num: 8, nome: 'Agosto' }, { num: 9, nome: 'Setembro' },
  { num: 10, nome: 'Outubro' }, { num: 11, nome: 'Novembro' }, { num: 12, nome: 'Dezembro' },
];
