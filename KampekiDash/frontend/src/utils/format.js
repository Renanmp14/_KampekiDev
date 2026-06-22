// Helpers de formatação (pt-BR).

export function brl(value) {
  const n = toNum(value);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function pct(value) {
  const n = toNum(value);
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
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
