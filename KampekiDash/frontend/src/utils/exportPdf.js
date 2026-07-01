import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { brl, pct, brlCompact } from './format.js';

const VERDE = [24, 50, 46]; // #18322e (verde institucional Kampeki)
const CORAL = [255, 139, 124];
// Paleta da marca para as barras por categoria.
const PALETA = [
  [255, 139, 124], [79, 134, 143], [191, 203, 127], [215, 196, 182],
  [98, 50, 50], [124, 155, 160], [140, 120, 160],
];

const trunc = (s, n) => { const t = String(s || ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

// Gráfico de barras verticais (custos por mês) desenhado em vetor no PDF.
function barrasMes(doc, x, y, w, h, data) {
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
    doc.setFillColor(...CORAL);
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

  const pages = doc.internal.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Kampeki Finance · página ${i}/${pages}`, pw - M, ph - 20, { align: 'right' });
  }

  doc.save(`relatorio-custos-${new Date().toISOString().slice(0, 10)}.pdf`);
}
