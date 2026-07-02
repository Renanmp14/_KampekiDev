import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { brl, pct, brlCompact } from './format.js';

const VERDE = [24, 50, 46]; // #18322e (verde institucional Kampeki)
const CORAL = [255, 139, 124];
const TEAL = [79, 134, 143]; // #4f868f (acento 2 — Folha / Período A)
// Paleta da marca para as barras por categoria.
const PALETA = [
  [255, 139, 124], [79, 134, 143], [191, 203, 127], [215, 196, 182],
  [98, 50, 50], [124, 155, 160], [140, 120, 160],
];

const trunc = (s, n) => { const t = String(s || ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

// Rodapé com paginação em todas as páginas (chamar ao final, já com tudo pronto).
function rodape(doc, M) {
  const pages = doc.internal.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Kampeki Finance · página ${i}/${pages}`, pw - M, ph - 20, { align: 'right' });
  }
}

// Garante espaço vertical `need`; se não couber, cria nova página e volta ao topo.
function ensureSpace(doc, y, need, M) {
  const ph = doc.internal.pageSize.getHeight();
  if (y + need > ph - M) {
    doc.addPage();
    return M + 6;
  }
  return y;
}

// Gráfico de barras verticais (total por mês) desenhado em vetor no PDF.
function barrasMes(doc, x, y, w, h, data, color = CORAL) {
  const n = data.length;
  if (!n) return h;
  const max = Math.max(1, ...data.map((d) => d.total));
  const padT = 12;
  const padB = 16;
  const plotH = h - padT - padB;
  const gap = Math.min(10, Math.max(3, (w / n) * 0.25));
  const bw = Math.max(2, (w - gap * n) / n);
  const baseY = y + padT + plotH;
  const step = n > 16 ? 2 : 1;

  // Eixo base.
  doc.setDrawColor(210);
  doc.setLineWidth(0.5);
  doc.line(x, baseY, x + w, baseY);

  data.forEach((d, i) => {
    const bh = (d.total / max) * plotH;
    const bx = x + i * (bw + gap) + gap / 2;
    const by = baseY - bh;
    doc.setFillColor(...color);
    doc.rect(bx, by, bw, Math.max(0.5, bh), 'F');
    // Rótulo do mês.
    if (i % step === 0) {
      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text(String(d.mes), bx + bw / 2, baseY + 10, { align: 'center' });
    }
    // Valor no topo (só quando cabe).
    if (bw >= 20 && n <= 14 && bh > 6) {
      doc.setFontSize(6);
      doc.setTextColor(90);
      doc.text(brlCompact(d.total), bx + bw / 2, by - 3, { align: 'center' });
    }
  });
  return h;
}

// Gráfico de barras horizontais (custos por categoria) desenhado em vetor.
function barrasCategoria(doc, x, y, w, data) {
  const rows = [...data].sort((a, b) => b.total - a.total);
  if (!rows.length) return y;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const total = rows.reduce((s, r) => s + r.total, 0) || 1;
  const rowH = 17;
  const labelW = 132;
  const valW = 118; // coluna fixa de valor + %
  const barMaxW = Math.max(40, w - labelW - valW);
  const valX = x + labelW + barMaxW + 8;
  let cy = y;

  rows.forEach((r, i) => {
    doc.setFontSize(8);
    doc.setTextColor(40);
    doc.text(trunc(r.key, 26), x, cy + 9);
    const bw = Math.max(1, (r.total / max) * barMaxW);
    doc.setFillColor(...PALETA[i % PALETA.length]);
    doc.rect(x + labelW, cy + 1, bw, 11, 'F');
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text(`${brl(r.total)}  (${pct((r.total / total) * 100)})`, valX, cy + 9);
    cy += rowH;
  });
  return cy;
}

/**
 * Gera e baixa um PDF do Relatório de Custos conforme os filtros ativos do Dash.
 * Desenha gráficos próprios (vetoriais, tema claro) — não captura a tela.
 */
export function exportarRelatorioCustos({
  periodoLabel, drillLabel, subLabel, totalGeral, nLanc,
  porMes = [], porCategoria = [], porSubcategoria = [], topItens = [], topN = 10,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 40;
  const W = doc.internal.pageSize.getWidth() - 2 * M;
  let y = 46;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...VERDE);
  doc.text('KAMPEKI — Relatório de Custos', M, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M, y); y += 13;
  if (periodoLabel) { doc.text(`Período: ${periodoLabel}`, M, y); y += 13; }
  if (drillLabel) { doc.text(`Filtros: ${drillLabel}`, M, y); y += 13; }

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(`Total: ${brl(totalGeral)}`, M, y);
  doc.text(`Lançamentos: ${nLanc}`, M + 240, y);
  y += 18;

  // --- Gráfico: custos por mês ---
  if (porMes.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Custos por mês', M, y);
    y += 6;
    y += barrasMes(doc, M, y, W, 120, porMes) + 12;
  }

  // --- Gráfico: custos por categoria (barras horizontais) ---
  if (porCategoria.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Custos por categoria', M, y);
    y += 10;
    y = barrasCategoria(doc, M, y, W, porCategoria) + 16;
  }

  // --- Tabelas ---
  const somaSub = porSubcategoria.reduce((s, c) => s + c.total, 0) || 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(`Total por subcategoria${subLabel ? ` — ${subLabel}` : ''}`, M, y);
  autoTable(doc, {
    startY: y + 6,
    head: [['Subcategoria', 'Valor', '%']],
    body: porSubcategoria.map((c) => [c.key, brl(c.total), pct((c.total / somaSub) * 100)]),
    headStyles: { fillColor: VERDE, textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 18;

  doc.setFontSize(11);
  doc.text(`Top ${topN} itens por valor`, M, y);
  autoTable(doc, {
    startY: y + 6,
    head: [['Item', 'Valor', '% total', 'Variação']],
    body: topItens.map((r) => [
      r.item,
      brl(r.total),
      pct(r.share),
      r.variacao === null || r.variacao === undefined
        ? 'novo'
        : `${r.variacao >= 0 ? '+' : ''}${pct(r.variacao)}`,
    ]),
    headStyles: { fillColor: VERDE, textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: M, right: M },
  });

  rodape(doc, M);
  doc.save(`relatorio-custos-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Barras horizontais agrupadas Período A × B (top N por Período B), em vetor.
function barrasAB(doc, x, y, w, rows, topN = 8) {
  const data = rows.slice(0, topN);
  if (!data.length) return y;
  const max = Math.max(1, ...data.flatMap((r) => [r.va, r.vb]));
  const labelW = 120;
  const valW = 58;
  const barMaxW = Math.max(50, w - labelW - valW);
  const valX = x + labelW + barMaxW + 4;
  const barH = 9;
  const groupH = barH * 2 + 12;

  // Legenda.
  doc.setFontSize(7);
  doc.setFillColor(...TEAL); doc.rect(x, y, 8, 6, 'F');
  doc.setTextColor(80); doc.text('Período A', x + 11, y + 5);
  doc.setFillColor(...CORAL); doc.rect(x + 62, y, 8, 6, 'F');
  doc.setTextColor(80); doc.text('Período B', x + 73, y + 5);
  let cy = y + 12;

  data.forEach((r) => {
    doc.setFontSize(8); doc.setTextColor(40);
    doc.text(trunc(r.key, 24), x, cy + barH);
    const aw = Math.max(1, (r.va / max) * barMaxW);
    doc.setFillColor(...TEAL); doc.rect(x + labelW, cy, aw, barH, 'F');
    const bw = Math.max(1, (r.vb / max) * barMaxW);
    doc.setFillColor(...CORAL); doc.rect(x + labelW, cy + barH + 2, bw, barH, 'F');
    doc.setFontSize(6.5); doc.setTextColor(90);
    doc.text(brlCompact(r.va), valX, cy + barH - 1);
    doc.text(brlCompact(r.vb), valX, cy + barH * 2 + 1);
    cy += groupH;
  });
  return cy;
}

/**
 * Gera e baixa um PDF do Relatório de Folha conforme os filtros ativos do Dash.
 * Desenha gráficos próprios (vetoriais, tema claro) — não captura a tela.
 */
export function exportarRelatorioFolha({
  periodoLabel, filtrosLabel, total, nLanc,
  porMes = [], porTag = [], porItem = [], cruzamento = null, topItens = 20,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 40;
  const W = doc.internal.pageSize.getWidth() - 2 * M;
  let y = 46;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...VERDE);
  doc.text('KAMPEKI — Relatório de Folha', M, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M, y); y += 13;
  if (periodoLabel) { doc.text(`Período: ${periodoLabel}`, M, y); y += 13; }
  if (filtrosLabel) { doc.text(`Filtros: ${filtrosLabel}`, M, y); y += 13; }

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(`Total: ${brl(total)}`, M, y);
  doc.text(`Lançamentos: ${nLanc}`, M + 240, y);
  y += 18;

  // --- Gráfico: folha por mês (teal) ---
  if (porMes.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Folha por mês', M, y);
    y += 6;
    y += barrasMes(doc, M, y, W, 120, porMes, TEAL) + 12;
  }

  // --- Gráfico: participação por Tag (barras horizontais) ---
  if (porTag.length) {
    y = ensureSpace(doc, y, 40 + porTag.length * 17, M);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Participação por Tag', M, y);
    y += 10;
    y = barrasCategoria(doc, M, y, W, porTag) + 16;
  }

  // --- Tabela: subtotal por Item ---
  if (porItem.length) {
    const somaItem = porItem.reduce((s, c) => s + c.total, 0) || 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    y = ensureSpace(doc, y, 40, M);
    doc.text(`Subtotal por Item${porItem.length > topItens ? ` (top ${topItens})` : ''}`, M, y);
    autoTable(doc, {
      startY: y + 6,
      head: [['Item Folha', 'Valor', '%']],
      body: porItem.slice(0, topItens).map((c) => [c.key, brl(c.total), pct((c.total / somaItem) * 100)]),
      headStyles: { fillColor: VERDE, textColor: 255 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 18;
  }

  // --- Tabela: cruzamento Tag × Categoria ---
  if (cruzamento && cruzamento.tagsList.length) {
    const { tagsList, colsList, cell, colTotais, grand } = cruzamento;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    y = ensureSpace(doc, y, 40, M);
    doc.text('Cruzamento Tag × Categoria', M, y);
    autoTable(doc, {
      startY: y + 6,
      head: [['Tag', ...colsList, 'Total']],
      body: tagsList.map((tg) => {
        const linhaTotal = colsList.reduce((s, cat) => s + (cell[`${tg}|||${cat}`] || 0), 0);
        return [tg, ...colsList.map((cat) => brl(cell[`${tg}|||${cat}`] || 0)), brl(linhaTotal)];
      }),
      foot: [['Subtotal', ...colsList.map((cat) => brl(colTotais[cat] || 0)), brl(grand)]],
      headStyles: { fillColor: VERDE, textColor: 255 },
      footStyles: { fillColor: [230, 236, 233], textColor: 20, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(
        [...Array(colsList.length + 1)].map((_, i) => [i + 1, { halign: 'right' }]),
      ),
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: M, right: M },
    });
  }

  rodape(doc, M);
  doc.save(`relatorio-folha-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Gera e baixa um PDF da Análise por Período (Custos ou Folha), com um gráfico
 * de barras A × B e a tabela detalhada por seção.
 */
export function exportarRelatorioPeriodo({
  tipo = 'Custos', periodoALabel, periodoBLabel, totalA, totalB, secoes = [],
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 40;
  const W = doc.internal.pageSize.getWidth() - 2 * M;
  let y = 46;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...VERDE);
  doc.text(`KAMPEKI — Análise por Período (${tipo})`, M, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M, y); y += 13;
  doc.text(`Período A: ${periodoALabel || 'Todo o histórico'}`, M, y); y += 13;
  doc.text(`Período B: ${periodoBLabel || 'Todo o histórico'}`, M, y); y += 13;

  y += 8;
  const delta = (totalB || 0) - (totalA || 0);
  const deltaPct = totalA > 0 ? (delta / totalA) * 100 : null;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(`Total A: ${brl(totalA)}`, M, y);
  doc.text(`Total B: ${brl(totalB)}`, M + 170, y);
  doc.text(
    `Variação: ${delta >= 0 ? '+' : ''}${brl(delta)}${deltaPct === null ? '' : ` (${delta >= 0 ? '+' : ''}${pct(deltaPct)})`}`,
    M + 340, y,
  );
  y += 20;

  secoes.forEach(({ titulo, labelCol, rows }) => {
    y = ensureSpace(doc, y, 60, M);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(titulo, M, y);
    y += 12;

    if (!rows.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('Sem dados.', M, y);
      y += 16;
      return;
    }

    const topN = 8;
    y = ensureSpace(doc, y, Math.min(rows.length, topN) * 30 + 24, M);
    y = barrasAB(doc, M, y, W, rows, topN) + 12;

    autoTable(doc, {
      startY: y,
      head: [[labelCol, 'Período A', 'Período B', 'Δ Absoluto', 'Δ %']],
      body: rows.map((r) => [
        r.key,
        brl(r.va),
        brl(r.vb),
        `${r.deltaAbs >= 0 ? '+' : ''}${brl(r.deltaAbs)}`,
        r.deltaPct === null || r.deltaPct === undefined
          ? 'novo'
          : `${r.deltaPct >= 0 ? '+' : ''}${pct(r.deltaPct)}`,
      ]),
      headStyles: { fillColor: VERDE, textColor: 255 },
      columnStyles: {
        1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
      },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 20;
  });

  rodape(doc, M);
  doc.save(`analise-periodo-${tipo.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
