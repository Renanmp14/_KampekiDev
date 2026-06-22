// Utilitários de agregação e manipulação de períodos para os dashboards.
import { toNum, mesAnoKey } from './format.js';

// Soma valores agrupando por chave. Retorna array [{ key, total }] desc.
export function groupSum(rows, keyFn, valFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k === undefined || k === null || k === '') continue;
    map.set(k, (map.get(k) || 0) + valFn(r));
  }
  return [...map.entries()]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total);
}

// "YYYY-MM" -> rótulo "MM/YYYY"
export function keyToLabel(key) {
  const [y, m] = key.split('-');
  return `${m}/${y}`;
}

// Lista ordenada de meses (YYYY-MM) entre dois limites inclusivos.
export function monthsBetween(deKey, ateKey) {
  if (!deKey || !ateKey || deKey > ateKey) return [];
  const out = [];
  let [y, m] = deKey.split('-').map(Number);
  const [ey, em] = ateKey.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

// Janela anterior de mesmo tamanho a [deKey, ateKey].
export function previousWindow(deKey, ateKey) {
  const n = monthsBetween(deKey, ateKey).length;
  if (!n) return { de: '', ate: '' };
  const before = (key, count) => {
    let [y, m] = key.split('-').map(Number);
    for (let i = 0; i < count; i += 1) {
      m -= 1;
      if (m < 1) { m = 12; y -= 1; }
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  };
  return { de: before(deKey, n), ate: before(deKey, 1) };
}

// Chave de mês (YYYY-MM) a partir de um registro com campo MES_ANO.
export function rowMonthKey(row) {
  return mesAnoKey(row.MES_ANO);
}

// Filtra registros cujo MES_ANO cai em [deKey, ateKey].
export function filterByPeriod(rows, deKey, ateKey) {
  return rows.filter((r) => {
    const k = rowMonthKey(r);
    return k && (!deKey || k >= deKey) && (!ateKey || k <= ateKey);
  });
}

export { toNum };
