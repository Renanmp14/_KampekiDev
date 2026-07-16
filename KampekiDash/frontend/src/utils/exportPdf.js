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

// Nome de arquivo seguro a partir de um rótulo livre (item, categoria, ...).
const slug = (s) => String(s || 'export')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  .toLowerCase().slice(0, 40) || 'export';

const hoje = () => new Date().toISOString().slice(0, 10);

// Alinha à direita o CABEÇALHO + corpo + rodapé das colunas numéricas (col >= from).
// Necessário porque no autoTable o `halign` de columnStyles alinha só as células do
// corpo — o cabeçalho fica à esquerda por padrão, desalinhando título × valor.
const rightAlignNumCols = (from = 1) => (data) => {
  if (data.column.index >= from) data.cell.styles.halign = 'right';
};

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
    // Valor + % alinhados à direita numa coluna fixa (evita o texto "ragged").
    doc.text(`${brl(r.total)}  (${pct((r.total / total) * 100)})`, x + w, cy + 9, { align: 'right' });
    cy += rowH;
  });
  return cy;
}

// Barras horizontais da "Composição por grupo" (CMV/Despesas/Folha/Outros), com
// ordem e cores fixas por grupo (não ordena, para preservar o significado da cor).
function barrasGrupo(doc, x, y, w, grupos) {
  const rows = grupos.filter((g) => g.total > 0.005);
  if (!rows.length) return y;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const total = rows.reduce((s, r) => s + r.total, 0) || 1;
  const rowH = 18;
  const labelW = 110;
  const valW = 130;
  const barMaxW = Math.max(40, w - labelW - valW);
  let cy = y;
  rows.forEach((r) => {
    doc.setFontSize(9); doc.setTextColor(40);
    doc.text(trunc(r.key, 22), x, cy + 9);
    const bw = Math.max(1, (r.total / max) * barMaxW);
    doc.setFillColor(...r.color);
    doc.rect(x + labelW, cy + 1, bw, 11, 'F');
    doc.setFontSize(8); doc.setTextColor(60);
    doc.text(`${brl(r.total)}  (${pct((r.total / total) * 100)})`, x + w, cy + 9, { align: 'right' });
    cy += rowH;
  });
  // Linha de total.
  doc.setDrawColor(210); doc.setLineWidth(0.5);
  doc.line(x, cy + 2, x + w, cy + 2);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
  doc.text('Total', x, cy + 14);
  doc.text(brl(total), x + w, cy + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  return cy + 20;
}

// Tabela "Composição por grupo" quebrada por mês (mês nas linhas; CMV/Despesas/
// Folha/[Outros] nas colunas), com linha de Subtotal por grupo + Total geral.
function tabelaGrupoMes(doc, y, M, porGrupoMes) {
  const temOutros = porGrupoMes.some((m) => (m.Outros || 0) > 0.005);
  const cols = ['CMV', 'Despesas', 'Folha', ...(temOutros ? ['Outros'] : [])];
  const totCol = Object.fromEntries(cols.map((c) => [c, 0]));
  let grand = 0;
  const body = porGrupoMes.map((m) => {
    const linhaTotal = cols.reduce((s, c) => s + (m[c] || 0), 0);
    grand += linhaTotal;
    cols.forEach((c) => { totCol[c] += (m[c] || 0); });
    return [m.mes, ...cols.map((c) => brl(m[c] || 0)), brl(linhaTotal)];
  });
  autoTable(doc, {
    startY: y,
    head: [['Mês', ...cols, 'Total']],
    body,
    foot: [['Subtotal', ...cols.map((c) => brl(totCol[c])), brl(grand)]],
    headStyles: { fillColor: VERDE, textColor: 255 },
    footStyles: { fillColor: [230, 236, 233], textColor: 20, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(
      [...Array(cols.length + 1)].map((_, i) => [i + 1, { halign: 'right' }]),
    ),
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: M, right: M },
    didParseCell: rightAlignNumCols(1),
  });
  return doc.lastAutoTable.finalY;
}

// Tabela "Custos por categoria" quebrada por mês (mês nas linhas; categorias nas
// colunas), com Subtotal por categoria + Total geral.
function tabelaCategoriaMes(doc, y, M, porCategoriaMes) {
  const { categorias, rows } = porCategoriaMes;
  const totCol = Object.fromEntries(categorias.map((c) => [c, 0]));
  let grand = 0;
  const body = rows.map((r) => {
    grand += r.total;
    categorias.forEach((c) => { totCol[c] += (r.cats[c] || 0); });
    return [r.mes, ...categorias.map((c) => brl(r.cats[c] || 0)), brl(r.total)];
  });
  autoTable(doc, {
    startY: y,
    head: [['Mês', ...categorias, 'Total']],
    body,
    foot: [['Subtotal', ...categorias.map((c) => brl(totCol[c])), brl(grand)]],
    headStyles: { fillColor: VERDE, textColor: 255 },
    footStyles: { fillColor: [230, 236, 233], textColor: 20, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(
      [...Array(categorias.length + 1)].map((_, i) => [i + 1, { halign: 'right' }]),
    ),
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    margin: { left: M, right: M },
    didParseCell: rightAlignNumCols(1),
  });
  return doc.lastAutoTable.finalY;
}

/**
 * Gera e baixa um PDF do Relatório de Custos conforme os filtros ativos do Dash.
 * Desenha gráficos próprios (vetoriais, tema claro) — não captura a tela.
 */
export function exportarRelatorioCustos({
  periodoLabel, drillLabel, subLabel, totalGeral, nLanc,
  porMes = [], porGrupo = [], porGrupoMes = null, porCategoria = [], porCategoriaMes = null,
  porSubcategoria = [], topItens = [], topN = 10, periodoAnteriorLabel = null,
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

  // --- Composição por grupo (CMV / Despesas / Folha / Outros) ---
  // Com período multi-mês, sai quebrado por mês (tabela); senão, barras do total.
  const grupoPorMes = porGrupoMes && porGrupoMes.length > 1;
  if (grupoPorMes || porGrupo.some((g) => g.total > 0.005)) {
    y = ensureSpace(doc, y, 60, M);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`Composição por grupo${grupoPorMes ? ' (por mês)' : ''}`, M, y);
    y += 12;
    y = grupoPorMes
      ? tabelaGrupoMes(doc, y, M, porGrupoMes) + 18
      : barrasGrupo(doc, M, y, W, porGrupo) + 16;
  }

  // --- Custos por categoria ---
  // Com período multi-mês, sai quebrado por mês (tabela); senão, barras do total.
  const catPorMes = porCategoriaMes && porCategoriaMes.rows.length > 1;
  if (catPorMes || porCategoria.length) {
    y = ensureSpace(doc, y, 60, M);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`Custos por categoria${catPorMes ? ' (por mês)' : ''}`, M, y);
    y += catPorMes ? 12 : 10;
    y = catPorMes
      ? tabelaCategoriaMes(doc, y, M, porCategoriaMes) + 18
      : barrasCategoria(doc, M, y, W, porCategoria) + 16;
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
    didParseCell: rightAlignNumCols(1),
  });
  y = doc.lastAutoTable.finalY + 18;

  y = ensureSpace(doc, y, 70, M);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(`Top ${topN} itens por valor`, M, y);
  if (periodoAnteriorLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Coluna "Período anterior" refere-se a: ${periodoAnteriorLabel}`, M, y + 13);
    y += 13;
  }
  autoTable(doc, {
    startY: y + 6,
    head: [['Item', 'Valor', '% total', 'Período anterior', 'Variação']],
    body: topItens.map((r) => [
      r.item,
      brl(r.total),
      pct(r.share),
      brl(r.anterior ?? 0),
      r.variacao === null || r.variacao === undefined
        ? 'novo'
        : `${r.variacao >= 0 ? '+' : ''}${pct(r.variacao)}`,
    ]),
    headStyles: { fillColor: VERDE, textColor: 255 },
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
    },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: M, right: M },
    didParseCell: rightAlignNumCols(1),
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
      didParseCell: rightAlignNumCols(1),
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
      didParseCell: rightAlignNumCols(1),
    });
  }

  rodape(doc, M);
  doc.save(`relatorio-folha-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Gera e baixa um PDF do Cruzamento Tag × Categoria da Folha QUEBRADO por mês:
 * uma tabela por mês do período (respeitando os filtros ativos), cada uma com a
 * linha de Subtotal por categoria e o Total do mês.
 */
export function exportarCruzamentoMensalFolha({
  periodoLabel, filtrosLabel, tagsList = [], colsList = [], porMes = [],
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 40;
  let y = 46;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...VERDE);
  doc.text('KAMPEKI — Cruzamento Tag × Categoria (por mês)', M, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M, y); y += 13;
  if (periodoLabel) { doc.text(`Período: ${periodoLabel}`, M, y); y += 13; }
  if (filtrosLabel) { doc.text(`Filtros: ${filtrosLabel}`, M, y); y += 13; }
  y += 6;

  if (!porMes.length) {
    doc.setTextColor(120);
    doc.text('Sem dados no período.', M, y);
  }

  porMes.forEach((m) => {
    y = ensureSpace(doc, y, 60, M);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`${m.label} — Total ${brl(m.grand)}`, M, y);
    autoTable(doc, {
      startY: y + 6,
      head: [['Tag', ...colsList, 'Total']],
      body: tagsList.map((tg) => {
        const linhaTotal = colsList.reduce((s, cat) => s + (m.cell[`${tg}|||${cat}`] || 0), 0);
        return [tg, ...colsList.map((cat) => brl(m.cell[`${tg}|||${cat}`] || 0)), brl(linhaTotal)];
      }),
      foot: [['Subtotal', ...colsList.map((cat) => brl(m.colTotais[cat] || 0)), brl(m.grand)]],
      headStyles: { fillColor: VERDE, textColor: 255 },
      footStyles: { fillColor: [230, 236, 233], textColor: 20, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: M, right: M },
      didParseCell: rightAlignNumCols(1),
    });
    y = doc.lastAutoTable.finalY + 16;
  });

  rodape(doc, M);
  doc.save(`cruzamento-folha-mensal-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Gera e baixa um PDF da Análise por Período (Custos ou Folha), com um gráfico
 * de barras A × B e a tabela detalhada por seção.
 */
export function exportarRelatorioPeriodo({
  tipo = 'Custos', periodoALabel, periodoBLabel, filtrosLabel = null,
  totalA, totalB, nLancA = null, nLancB = null, precoQtd = null, secoes = [],
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
  if (filtrosLabel) { doc.text(`Filtros: ${filtrosLabel}`, M, y); y += 13; }

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
  y += 16;
  if (nLancA !== null || nLancB !== null) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Lançamentos — A: ${nLancA ?? 0} · B: ${nLancB ?? 0}`, M, y);
    y += 16;
  }

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
      didParseCell: rightAlignNumCols(1),
    });
    y = doc.lastAutoTable.finalY + 20;
  });

  // Preço médio × quantidade por subcategoria (A vs B) — com Δ de qtd e de preço.
  if (precoQtd && precoQtd.length) {
    y = ensureSpace(doc, y, 60, M);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Preço médio × quantidade (por subcategoria)', M, y);
    const q = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    const dPctTxt = (base, novo) => {
      if (base > 0) { const d = ((novo - base) / base) * 100; return `${d >= 0 ? '+' : ''}${pct(d)}`; }
      return novo > 0 ? 'novo' : '0,0%';
    };
    autoTable(doc, {
      startY: y + 6,
      head: [['Subcategoria', 'Qtd A', 'Qtd B', 'Δ Qtd', 'Preço méd. A', 'Preço méd. B', 'Δ Preço']],
      body: precoQtd.map((r) => [
        r.key,
        q(r.qtdA),
        q(r.qtdB),
        dPctTxt(r.qtdA, r.qtdB),
        brl(r.precoA),
        brl(r.precoB),
        dPctTxt(r.precoA, r.precoB),
      ]),
      headStyles: { fillColor: VERDE, textColor: 255 },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: M, right: M },
      didParseCell: rightAlignNumCols(1),
    });
    y = doc.lastAutoTable.finalY + 18;
  }

  rodape(doc, M);
  doc.save(`analise-periodo-${tipo.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// --- Dialogs de detalhe (Dash Custos e Análise por Período) -----------------
// Exportam exatamente o que está na tela da dialog: a base já vem recortada pelo
// período/mês/drill (Custos) ou pelos períodos A e B (Análise).

const qtdPdf = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

// Cabeçalho comum: título da marca + data de geração + linhas de contexto.
function cabecalhoDialog(doc, M, titulo, linhas = []) {
  let y = 46;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...VERDE);
  doc.text(`KAMPEKI — ${trunc(titulo, 60)}`, M, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M, y);
  y += 13;
  for (const l of linhas.filter(Boolean)) {
    doc.text(trunc(l, 110), M, y);
    y += 13;
  }
  return y + 6;
}

function tituloSecao(doc, y, M, texto) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(texto, M, y);
  return y + 12;
}

function semDados(doc, y, M) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Sem dados.', M, y);
  return y + 16;
}

// Tabela de lançamentos de um item (Data · Nº · Fornecedor · ... ) + TOTAL.
function tabelaNotas(doc, y, M, linhas, total) {
  autoTable(doc, {
    startY: y,
    head: [['Data', 'Nº Nota', 'Fornecedor', 'Subcategoria', 'Qtd', 'V. Unit', 'V. Total']],
    body: linhas.map((l) => [
      l.data, trunc(l.numNota, 14), trunc(l.fornecedor, 30), trunc(l.subcategoria, 22),
      qtdPdf(l.qtd), brl(l.valorUnit), brl(l.valorTotal),
    ]),
    foot: [['TOTAL', '', '', '', '', '', brl(total)]],
    headStyles: { fillColor: VERDE, textColor: 255 },
    footStyles: { fillColor: [232, 232, 232], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: M, right: M },
    didParseCell: rightAlignNumCols(4),
  });
  return doc.lastAutoTable.finalY + 18;
}

/**
 * PDF da dialog "Notas do item" do Dash Custos (um período só).
 * `linhas` vem de utils/notas.js → linhasDoItem(base já filtrada, item).
 */
export function exportarNotasItem({
  item, periodoLabel, filtrosLabel = null, linhas = [], total = 0,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 40;
  let y = cabecalhoDialog(doc, M, `Notas do item — ${item}`, [
    `Período: ${periodoLabel || 'Todo o período'}`,
    filtrosLabel ? `Filtros: ${filtrosLabel}` : null,
    `${linhas.length} lançamento(s) · Total ${brl(total)}`,
  ]);
  if (!linhas.length) semDados(doc, y, M);
  else tabelaNotas(doc, y, M, linhas, total);
  rodape(doc, M);
  doc.save(`notas-item-${slug(item)}-${hoje()}.pdf`);
}

/**
 * PDF da dialog de drill da Análise por Período. Dois modos:
 *  - detalhamento (rows de `comparar`): gráfico A×B + tabela com Δ;
 *  - notas (notasA/notasB): uma tabela de lançamentos por período.
 */
export function exportarDrillPeriodo({
  titulo, caminho = null, periodoALabel, periodoBLabel, filtrosLabel = null,
  totalA = 0, totalB = 0, labelCol = 'Chave', rows = null, notasA = null, notasB = null,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 40;
  const W = doc.internal.pageSize.getWidth() - 2 * M;
  let y = cabecalhoDialog(doc, M, titulo, [
    caminho ? `Caminho: ${caminho}` : null,
    `Período A: ${periodoALabel || 'Todo o histórico'}`,
    `Período B: ${periodoBLabel || 'Todo o histórico'}`,
    filtrosLabel ? `Filtros: ${filtrosLabel}` : null,
  ]);

  // KPIs A / B / variação (mesmo formato do relatório de período).
  const delta = totalB - totalA;
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

  if (notasA || notasB) {
    const secoes = [
      { label: `Período A — ${periodoALabel || 'Todo o histórico'}`, linhas: notasA || [] },
      { label: `Período B — ${periodoBLabel || 'Todo o histórico'}`, linhas: notasB || [] },
    ];
    for (const s of secoes) {
      const totalSecao = s.linhas.reduce((acc, l) => acc + l.valorTotal, 0);
      y = ensureSpace(doc, y, 70, M);
      y = tituloSecao(doc, y, M, `${s.label} · ${s.linhas.length} lançamento(s)`);
      y = s.linhas.length ? tabelaNotas(doc, y + 4, M, s.linhas, totalSecao) : semDados(doc, y + 4, M) + 6;
    }
  } else {
    const lista = rows || [];
    if (!lista.length) {
      semDados(doc, y, M);
    } else {
      const topN = 8;
      y = ensureSpace(doc, y, Math.min(lista.length, topN) * 30 + 24, M);
      y = barrasAB(doc, M, y, W, lista, topN) + 12;
      autoTable(doc, {
        startY: y,
        head: [[labelCol, 'Período A', 'Período B', 'Δ Absoluto', 'Δ %']],
        body: lista.map((r) => [
          r.key,
          brl(r.va),
          brl(r.vb),
          `${r.deltaAbs >= 0 ? '+' : ''}${brl(r.deltaAbs)}`,
          r.deltaPct === null || r.deltaPct === undefined
            ? 'novo'
            : `${r.deltaPct >= 0 ? '+' : ''}${pct(r.deltaPct)}`,
        ]),
        foot: [['TOTAL', brl(totalA), brl(totalB), `${delta >= 0 ? '+' : ''}${brl(delta)}`, deltaPct === null ? '—' : `${delta >= 0 ? '+' : ''}${pct(deltaPct)}`]],
        headStyles: { fillColor: VERDE, textColor: 255 },
        footStyles: { fillColor: [232, 232, 232], textColor: 20, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        margin: { left: M, right: M },
        didParseCell: rightAlignNumCols(1),
      });
    }
  }

  rodape(doc, M);
  doc.save(`detalhe-periodo-${slug(titulo)}-${hoje()}.pdf`);
}
