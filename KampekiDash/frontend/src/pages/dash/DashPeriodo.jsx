import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { custosApi, folhaApi } from '../../api/resources.js';
import PeriodFilter from '../../components/PeriodFilter.jsx';
import { exportarRelatorioPeriodo } from '../../utils/exportPdf.js';
import { brl, pct, brlCompact } from '../../utils/format.js';
import {
  groupSum, filterByPeriod, toNum, keyToLabel,
} from '../../utils/agg.js';

// Rótulo de período a partir de { de, ate } (chaves 'YYYY-MM' do month input).
function periodLabel(p) {
  if (!p.de && !p.ate) return '';
  const l = (k) => (k ? keyToLabel(k) : '…');
  return `${l(p.de)} – ${l(p.ate)}`;
}

const A_COLOR = '#4f868f'; // Período A (teal)
const B_COLOR = '#ff8b7c'; // Período B (coral)

// Compara duas agregações por chave e calcula variação absoluta e percentual.
function comparar(rowsA, rowsB, keyFn, valFn) {
  const a = Object.fromEntries(groupSum(rowsA, keyFn, valFn).map((x) => [x.key, x.total]));
  const b = Object.fromEntries(groupSum(rowsB, keyFn, valFn).map((x) => [x.key, x.total]));
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return chaves
    .map((key) => {
      const va = a[key] || 0;
      const vb = b[key] || 0;
      const deltaAbs = vb - va;
      const deltaPct = va > 0 ? (deltaAbs / va) * 100 : (vb > 0 ? null : 0);
      return { key, va, vb, deltaAbs, deltaPct };
    })
    .sort((x, y) => y.vb - x.vb);
}

// Seção comparativa: gráfico de barras horizontais (A vs B, top N) + tabela
// detalhada com todas as chaves e a variação.
function ComparativoSecao({ titulo, labelCol, rows, topN = 8 }) {
  const chartData = rows.slice(0, topN).map((r) => ({
    nome: r.key, 'Período A': r.va, 'Período B': r.vb,
  }));
  return (
    <div className="card">
      <h3 className="card-title">{titulo}</h3>
      {rows.length === 0 ? <div className="empty">Sem dados.</div> : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 46)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2c4a43" />
              <XAxis type="number" stroke="#93a39b" fontSize={11} tickFormatter={brlCompact} />
              <YAxis type="category" dataKey="nome" stroke="#93a39b" fontSize={11} width={130} />
              <Tooltip
                formatter={(v) => brl(v)}
                contentStyle={{ background: '#16302b', border: '1px solid #2c4a43', borderRadius: 6 }}
                itemStyle={{ color: '#f1f3f5' }}
                labelStyle={{ color: '#f1f3f5' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Legend />
              <Bar dataKey="Período A" fill={A_COLOR} radius={[0, 3, 3, 0]} />
              <Bar dataKey="Período B" fill={B_COLOR} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {rows.length > topN && (
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
              Gráfico mostra os {topN} maiores (por Período B); a tabela abaixo traz todos.
            </p>
          )}
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto', marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>{labelCol}</th>
                  <th className="num">Período A</th>
                  <th className="num">Período B</th>
                  <th className="num">Δ Absoluto</th>
                  <th className="num">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.key}</td>
                    <td className="num">{brl(r.va)}</td>
                    <td className="num">{brl(r.vb)}</td>
                    <td className={`num ${r.deltaAbs >= 0 ? 'up' : 'down'}`}>
                      {r.deltaAbs >= 0 ? '+' : ''}{brl(r.deltaAbs)}
                    </td>
                    <td className="num">
                      {r.deltaPct === null
                        ? <span className="up">novo</span>
                        : <span className={r.deltaPct >= 0 ? 'up' : 'down'}>{r.deltaPct >= 0 ? '+' : ''}{pct(r.deltaPct)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function PeriodHeaders({ periodoA, setPeriodoA, periodoB, setPeriodoB }) {
  return (
    <div className="grid grid-2" style={{ marginBottom: 18 }}>
      <div className="card periodo-card">
        <h3 className="card-title">Período A</h3>
        <PeriodFilter de={periodoA.de} ate={periodoA.ate} onChange={setPeriodoA} />
      </div>
      <div className="card periodo-card">
        <h3 className="card-title">Período B</h3>
        <PeriodFilter de={periodoB.de} ate={periodoB.ate} onChange={setPeriodoB} />
      </div>
    </div>
  );
}

// KPIs de totais A vs B.
function TotaisAB({ totalA, totalB }) {
  const delta = totalB - totalA;
  return (
    <div className="grid grid-3" style={{ marginBottom: 18 }}>
      <div className="kpi"><div className="kpi-label">Total A</div><div className="kpi-value">{brl(totalA)}</div></div>
      <div className="kpi"><div className="kpi-label">Total B</div><div className="kpi-value">{brl(totalB)}</div></div>
      <div className="kpi">
        <div className="kpi-label">Variação</div>
        <div className={`kpi-value ${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? '+' : ''}{brl(delta)} {totalA > 0 && <span style={{ fontSize: 14 }}>({delta >= 0 ? '+' : ''}{pct((delta / totalA) * 100)})</span>}
        </div>
      </div>
    </div>
  );
}

// Cabeçalho da análise com o botão de exportar PDF.
function AnaliseHeader({ exportando, onExport }) {
  return (
    <div className="row-actions" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
      <button className="btn btn-ghost" onClick={onExport} disabled={exportando}>
        {exportando ? 'Gerando PDF...' : '⬇ Exportar PDF'}
      </button>
    </div>
  );
}

function AnaliseCustos({ custos }) {
  const [periodoA, setPeriodoA] = useState({ de: '', ate: '' });
  const [periodoB, setPeriodoB] = useState({ de: '', ate: '' });
  const [exportando, setExportando] = useState(false);
  const val = (r) => toNum(r.VALOR_TOTAL);

  const a = useMemo(() => filterByPeriod(custos, periodoA.de, periodoA.ate), [custos, periodoA]);
  const b = useMemo(() => filterByPeriod(custos, periodoB.de, periodoB.ate), [custos, periodoB]);

  const totalA = a.reduce((s, r) => s + val(r), 0);
  const totalB = b.reduce((s, r) => s + val(r), 0);

  const porCategoria = useMemo(() => comparar(a, b, (r) => r.CATEGORIA, val), [a, b]);
  const porSubcategoria = useMemo(() => comparar(a, b, (r) => r.SUB_CATEGORIA, val), [a, b]);
  const porItem = useMemo(() => comparar(a, b, (r) => r.ITEM, val), [a, b]);

  function exportarPdf() {
    setExportando(true);
    try {
      exportarRelatorioPeriodo({
        tipo: 'Custos',
        periodoALabel: periodLabel(periodoA),
        periodoBLabel: periodLabel(periodoB),
        totalA,
        totalB,
        secoes: [
          { titulo: 'Comparativo por Categoria', labelCol: 'Categoria', rows: porCategoria },
          { titulo: 'Comparativo por Subcategoria', labelCol: 'Subcategoria', rows: porSubcategoria },
          { titulo: 'Comparativo por Item', labelCol: 'Item', rows: porItem },
        ],
      });
    } finally {
      setExportando(false);
    }
  }

  return (
    <div>
      <AnaliseHeader exportando={exportando} onExport={exportarPdf} />
      <PeriodHeaders {...{ periodoA, setPeriodoA, periodoB, setPeriodoB }} />
      <TotaisAB totalA={totalA} totalB={totalB} />
      <ComparativoSecao titulo="Comparativo por Categoria" labelCol="Categoria" rows={porCategoria} />
      <ComparativoSecao titulo="Comparativo por Subcategoria" labelCol="Subcategoria" rows={porSubcategoria} />
      <ComparativoSecao titulo="Comparativo por Item" labelCol="Item" rows={porItem} />
    </div>
  );
}

function AnaliseFolha({ folha }) {
  const [periodoA, setPeriodoA] = useState({ de: '', ate: '' });
  const [periodoB, setPeriodoB] = useState({ de: '', ate: '' });
  const [exportando, setExportando] = useState(false);
  const val = (r) => toNum(r.VALOR);

  const a = useMemo(() => filterByPeriod(folha, periodoA.de, periodoA.ate), [folha, periodoA]);
  const b = useMemo(() => filterByPeriod(folha, periodoB.de, periodoB.ate), [folha, periodoB]);

  const totalA = a.reduce((s, r) => s + val(r), 0);
  const totalB = b.reduce((s, r) => s + val(r), 0);

  const porTag = useMemo(() => comparar(a, b, (r) => r.TAG, val), [a, b]);
  const porItem = useMemo(() => comparar(a, b, (r) => r.ITEM_FOLHA, val), [a, b]);

  function exportarPdf() {
    setExportando(true);
    try {
      exportarRelatorioPeriodo({
        tipo: 'Folha',
        periodoALabel: periodLabel(periodoA),
        periodoBLabel: periodLabel(periodoB),
        totalA,
        totalB,
        secoes: [
          { titulo: 'Comparativo por Tag', labelCol: 'Tag', rows: porTag },
          { titulo: 'Comparativo por Item Folha', labelCol: 'Item Folha', rows: porItem },
        ],
      });
    } finally {
      setExportando(false);
    }
  }

  return (
    <div>
      <AnaliseHeader exportando={exportando} onExport={exportarPdf} />
      <PeriodHeaders {...{ periodoA, setPeriodoA, periodoB, setPeriodoB }} />
      <TotaisAB totalA={totalA} totalB={totalB} />
      <ComparativoSecao titulo="Comparativo por Tag" labelCol="Tag" rows={porTag} />
      <ComparativoSecao titulo="Comparativo por Item Folha" labelCol="Item Folha" rows={porItem} />
    </div>
  );
}

export default function DashPeriodo() {
  const [tab, setTab] = useState('custos');
  const [custos, setCustos] = useState([]);
  const [folha, setFolha] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, f] = await Promise.all([custosApi.listar(), folhaApi.listar()]);
        setCustos(c);
        setFolha(f);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h1 className="page-title">Análise por Período</h1>

      <div className="tabs">
        <div className={`tab ${tab === 'custos' ? 'active' : ''}`} onClick={() => setTab('custos')}>Custos</div>
        <div className={`tab ${tab === 'folha' ? 'active' : ''}`} onClick={() => setTab('folha')}>Folha</div>
      </div>

      {loading ? <div className="empty">Carregando...</div>
        : tab === 'custos' ? <AnaliseCustos custos={custos} /> : <AnaliseFolha folha={folha} />}
    </div>
  );
}
