import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from 'recharts';
import { custosApi, folhaApi } from '../../api/resources.js';
import PeriodFilter from '../../components/PeriodFilter.jsx';
import DrillPeriodoModal from '../../components/DrillPeriodoModal.jsx';
import { exportarRelatorioPeriodo } from '../../utils/exportPdf.js';
import { brl, pct, brlCompact } from '../../utils/format.js';
import {
  filterByPeriod, toNum, keyToLabel, comparar, grupoDe,
} from '../../utils/agg.js';

// Rótulo de período a partir de { de, ate } (chaves 'YYYY-MM' do month input).
function periodLabel(p) {
  if (!p.de && !p.ate) return '';
  const l = (k) => (k ? keyToLabel(k) : '…');
  return `${l(p.de)} – ${l(p.ate)}`;
}

const A_COLOR = '#4f868f'; // Período A (teal)
const B_COLOR = '#ff8b7c'; // Período B (coral)
const UP_COLOR = '#bfcb7f'; // contribuição positiva (oliva)
const DOWN_COLOR = '#9c6b6b'; // contribuição negativa (vinho)
const TOTAL_COLOR = '#93a39b'; // barras de total no bridge

const fmtQtd = (n) => toNum(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// Preço médio ponderado (Σ valor ÷ Σ qtd) e quantidade por subcategoria, A vs B.
function precoQtdPorSub(rowsA, rowsB, valFn) {
  const agg = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const k = r.SUB_CATEGORIA || '(sem subcategoria)';
      const cur = m.get(k) || { val: 0, qtd: 0 };
      cur.val += valFn(r);
      cur.qtd += toNum(r.QTD);
      m.set(k, cur);
    }
    return m;
  };
  const A = agg(rowsA);
  const B = agg(rowsB);
  const keys = [...new Set([...A.keys(), ...B.keys()])];
  return keys.map((k) => {
    const va = A.get(k) || { val: 0, qtd: 0 };
    const vb = B.get(k) || { val: 0, qtd: 0 };
    return {
      key: k,
      qtdA: va.qtd,
      qtdB: vb.qtd,
      precoA: va.qtd > 0 ? va.val / va.qtd : 0,
      precoB: vb.qtd > 0 ? vb.val / vb.qtd : 0,
      valB: vb.val,
    };
  }).sort((x, y) => y.valB - x.valB);
}

function BridgeTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#16302b', border: '1px solid #2c4a43', borderRadius: 6, padding: '6px 10px', color: '#f1f3f5', fontSize: 12,
    }}
    >
      <div style={{ marginBottom: 2 }}>{d.name}</div>
      <div>{d.tipo === 'total' ? brl(d.val) : `${d.delta >= 0 ? '+' : ''}${brl(d.delta)}`}</div>
    </div>
  );
}

// Gráfico "cascata" (bridge): parte do Total A, soma as contribuições (↑/↓) e
// chega ao Total B. Contribuições pequenas viram "Outros".
function BridgeChart({
  totalA, totalB, contribs, labelA = 'Total A', labelB = 'Total B', topN = 8,
}) {
  const data = useMemo(() => {
    const sorted = [...contribs].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    let main = sorted;
    if (sorted.length > topN) {
      const rest = sorted.slice(topN).reduce((s, c) => s + c.delta, 0);
      main = [...sorted.slice(0, topN), { key: 'Outros', delta: rest }];
    }
    const pos = main.filter((c) => c.delta >= 0).sort((a, b) => b.delta - a.delta);
    const neg = main.filter((c) => c.delta < 0).sort((a, b) => a.delta - b.delta);
    const out = [{ name: labelA, base: 0, val: totalA, tipo: 'total' }];
    let cum = totalA;
    for (const c of [...pos, ...neg]) {
      let base; let val;
      if (c.delta >= 0) { base = cum; val = c.delta; cum += c.delta; } else { cum += c.delta; base = cum; val = -c.delta; }
      out.push({ name: c.key, base, val, delta: c.delta, tipo: 'delta' });
    }
    out.push({ name: labelB, base: 0, val: totalB, tipo: 'total' });
    return out;
  }, [contribs, totalA, totalB, labelA, labelB, topN]);

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2c4a43" />
        <XAxis type="number" stroke="#93a39b" fontSize={11} tickFormatter={brlCompact} />
        <YAxis type="category" dataKey="name" stroke="#93a39b" fontSize={11} width={140} />
        <Tooltip content={<BridgeTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="val" stackId="w" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.tipo === 'total' ? TOTAL_COLOR : (d.delta >= 0 ? UP_COLOR : DOWN_COLOR)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Seção comparativa: gráfico de barras horizontais (A vs B, top N) + tabela
// detalhada com todas as chaves e a variação. Com `onRowClick`, cada linha da
// tabela abre a dialog de detalhe daquela chave.
function ComparativoSecao({
  titulo, labelCol, rows, topN = 8, maxRows = null, onRowClick = null,
}) {
  const chartData = rows.slice(0, topN).map((r) => ({
    nome: r.key, 'Período A': r.va, 'Período B': r.vb,
  }));
  const tableRows = maxRows ? rows.slice(0, maxRows) : rows;
  return (
    <div className="card">
      <h3 className="card-title">
        {titulo}
        {onRowClick && (
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (clique numa linha para detalhar)</span>
        )}
      </h3>
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
          {maxRows && rows.length > maxRows ? (
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
              Mostrando os {maxRows} maiores (por Período B) de {rows.length}.
            </p>
          ) : rows.length > topN && (
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
                {tableRows.map((r) => (
                  <tr
                    key={r.key}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                  >
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

// KPIs de totais A vs B (com nº de lançamentos — a "quantidade de itens").
function TotaisAB({ totalA, totalB, nLancA, nLancB }) {
  const delta = totalB - totalA;
  return (
    <div className="grid grid-3" style={{ marginBottom: 18 }}>
      <div className="kpi">
        <div className="kpi-label">Total A</div>
        <div className="kpi-value">{brl(totalA)}</div>
        <div className="muted" style={{ fontSize: 11 }}>{nLancA} lançamento(s)</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Total B</div>
        <div className="kpi-value">{brl(totalB)}</div>
        <div className="muted" style={{ fontSize: 11 }}>{nLancB} lançamento(s)</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Variação</div>
        <div className={`kpi-value ${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? '+' : ''}{brl(delta)} {totalA > 0 && <span style={{ fontSize: 14 }}>({delta >= 0 ? '+' : ''}{pct((delta / totalA) * 100)})</span>}
        </div>
        <div className="muted" style={{ fontSize: 11 }}>lançamentos: {nLancA} → {nLancB}</div>
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
  const [fCat, setFCat] = useState('');
  const [fSubs, setFSubs] = useState([]);
  const [topItens, setTopItens] = useState(15);
  const [exportando, setExportando] = useState(false);
  // Nível inicial da dialog de detalhe: { tipo: 'grupo'|'categoria'|'subcategoria'|'item', valor }
  const [drill, setDrill] = useState(null);
  const val = (r) => toNum(r.VALOR_TOTAL);

  const categorias = useMemo(
    () => [...new Set(custos.map((r) => r.CATEGORIA).filter(Boolean))].sort((x, y) => x.localeCompare(y)),
    [custos],
  );
  const subcategorias = useMemo(() => {
    if (!fCat) return [];
    const set = new Set();
    for (const r of custos) if (r.CATEGORIA === fCat && r.SUB_CATEGORIA) set.add(r.SUB_CATEGORIA);
    return [...set].sort((x, y) => x.localeCompare(y));
  }, [custos, fCat]);

  // Filtro de categoria/subcategoria aplicado aos DOIS períodos antes de comparar.
  const filtrar = useMemo(
    () => (r) => (!fCat || r.CATEGORIA === fCat) && (!fSubs.length || fSubs.includes(r.SUB_CATEGORIA)),
    [fCat, fSubs],
  );
  const a = useMemo(() => filterByPeriod(custos, periodoA.de, periodoA.ate).filter(filtrar), [custos, periodoA, filtrar]);
  const b = useMemo(() => filterByPeriod(custos, periodoB.de, periodoB.ate).filter(filtrar), [custos, periodoB, filtrar]);

  const totalA = a.reduce((s, r) => s + val(r), 0);
  const totalB = b.reduce((s, r) => s + val(r), 0);

  const porCategoria = useMemo(() => comparar(a, b, (r) => r.CATEGORIA, val), [a, b]);
  const porSubcategoria = useMemo(() => comparar(a, b, (r) => r.SUB_CATEGORIA, val), [a, b]);
  const porItem = useMemo(() => comparar(a, b, (r) => r.ITEM, val), [a, b]);
  const porGrupo = useMemo(() => comparar(a, b, (r) => grupoDe(r.CATEGORIA), val), [a, b]);
  const precoQtd = useMemo(() => precoQtdPorSub(a, b, val), [a, b]);

  const filtrosLabel = [fCat && `Categoria: ${fCat}`, fSubs.length && `Subcategorias: ${fSubs.join(', ')}`]
    .filter(Boolean).join(' · ') || null;
  const nItens = Number(topItens) || 15;

  function exportarPdf() {
    setExportando(true);
    try {
      exportarRelatorioPeriodo({
        tipo: 'Custos',
        periodoALabel: periodLabel(periodoA),
        periodoBLabel: periodLabel(periodoB),
        filtrosLabel,
        totalA,
        totalB,
        nLancA: a.length,
        nLancB: b.length,
        precoQtd,
        secoes: [
          { titulo: 'Composição por grupo', labelCol: 'Grupo', rows: porGrupo },
          { titulo: 'Comparativo por Categoria', labelCol: 'Categoria', rows: porCategoria },
          { titulo: 'Comparativo por Subcategoria', labelCol: 'Subcategoria', rows: porSubcategoria },
          { titulo: `Comparativo por Item (top ${nItens})`, labelCol: 'Item', rows: porItem.slice(0, nItens) },
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
      <div className="row-actions" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 180, maxWidth: 220, margin: 0 }}>
          <label>Categoria</label>
          <select value={fCat} onChange={(e) => { setFCat(e.target.value); setFSubs([]); }}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 200, maxWidth: 260, margin: 0 }}>
          <label>Subcategoria (uma ou mais)</label>
          <select
            value=""
            disabled={!fCat}
            onChange={(e) => { if (e.target.value) setFSubs((p) => (p.includes(e.target.value) ? p : [...p, e.target.value])); }}
          >
            <option value="">{fCat ? 'Adicionar...' : 'Escolha a categoria'}</option>
            {subcategorias.filter((s) => !fSubs.includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {fSubs.length > 0 && (
            <div className="filtro-chips">
              {fSubs.map((s) => (
                <span key={s} className="filtro-chip">{s}<button onClick={() => setFSubs((p) => p.filter((x) => x !== s))}>×</button></span>
              ))}
            </div>
          )}
        </div>
        <div className="field" style={{ maxWidth: 120, margin: 0 }}>
          <label>Top N itens</label>
          <input type="number" min="1" value={topItens} onChange={(e) => setTopItens(e.target.value)} />
        </div>
        {(fCat || fSubs.length > 0) && (
          <button className="btn btn-sm" onClick={() => { setFCat(''); setFSubs([]); }}>Limpar filtros</button>
        )}
      </div>
      <TotaisAB totalA={totalA} totalB={totalB} nLancA={a.length} nLancB={b.length} />

      <div className="card">
        <h3 className="card-title">
          Contribuição para a variação
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (do Total A ao Total B, por categoria)</span>
        </h3>
        {porCategoria.length === 0 ? <div className="empty">Sem dados.</div> : (
          <BridgeChart totalA={totalA} totalB={totalB} contribs={porCategoria.map((r) => ({ key: r.key, delta: r.deltaAbs }))} />
        )}
      </div>

      {/* Clicar numa linha abre a dialog de detalhe, que desce de nível a partir
          dali (grupo/categoria → subcategoria → item → notas), sempre sobre as
          mesmas bases `a`/`b` (Períodos A e B + filtros da tela). */}
      <ComparativoSecao
        titulo="Composição por grupo"
        labelCol="Grupo"
        rows={porGrupo}
        onRowClick={(r) => setDrill({ tipo: 'grupo', valor: r.key })}
      />
      <ComparativoSecao
        titulo="Comparativo por Categoria"
        labelCol="Categoria"
        rows={porCategoria}
        onRowClick={(r) => setDrill({ tipo: 'categoria', valor: r.key })}
      />
      <ComparativoSecao
        titulo="Comparativo por Subcategoria"
        labelCol="Subcategoria"
        rows={porSubcategoria}
        onRowClick={(r) => setDrill({ tipo: 'subcategoria', valor: r.key })}
      />
      <ComparativoSecao
        titulo="Comparativo por Item"
        labelCol="Item"
        rows={porItem}
        maxRows={nItens}
        onRowClick={(r) => setDrill({ tipo: 'item', valor: r.key })}
      />

      <div className="card">
        <h3 className="card-title">
          Preço médio × quantidade
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (por subcategoria — separa preço de volume)</span>
        </h3>
        {precoQtd.length === 0 ? <div className="empty">Sem dados.</div> : (
          <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Subcategoria</th>
                  <th className="num">Qtd A</th>
                  <th className="num">Qtd B</th>
                  <th className="num">Δ Qtd</th>
                  <th className="num">Preço méd. A</th>
                  <th className="num">Preço méd. B</th>
                  <th className="num">Δ Preço</th>
                </tr>
              </thead>
              <tbody>
                {precoQtd.map((r) => {
                  const dQtd = r.qtdA > 0 ? ((r.qtdB - r.qtdA) / r.qtdA) * 100 : (r.qtdB > 0 ? null : 0);
                  const dPreco = r.precoA > 0 ? ((r.precoB - r.precoA) / r.precoA) * 100 : (r.precoB > 0 ? null : 0);
                  return (
                    <tr key={r.key}>
                      <td>{r.key}</td>
                      <td className="num">{fmtQtd(r.qtdA)}</td>
                      <td className="num">{fmtQtd(r.qtdB)}</td>
                      <td className="num">
                        {dQtd === null ? <span className="up">novo</span>
                          : <span className={dQtd >= 0 ? 'up' : 'down'}>{dQtd >= 0 ? '+' : ''}{pct(dQtd)}</span>}
                      </td>
                      <td className="num">{brl(r.precoA)}</td>
                      <td className="num">{brl(r.precoB)}</td>
                      <td className="num">
                        {dPreco === null ? <span className="up">novo</span>
                          : <span className={dPreco >= 0 ? 'up' : 'down'}>{dPreco >= 0 ? '+' : ''}{pct(dPreco)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drill && (
        <DrillPeriodoModal
          inicial={drill}
          rowsA={a}
          rowsB={b}
          periodoALabel={periodLabel(periodoA)}
          periodoBLabel={periodLabel(periodoB)}
          filtrosLabel={filtrosLabel}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}

function AnaliseFolha({ folha }) {
  const [periodoA, setPeriodoA] = useState({ de: '', ate: '' });
  const [periodoB, setPeriodoB] = useState({ de: '', ate: '' });
  const [fCat, setFCat] = useState(''); // unidade FOLHA CANOAS/POA/TELE
  const [fTags, setFTags] = useState([]); // folha não tem subcategoria → filtro por Tag (multi)
  const [topItens, setTopItens] = useState(15);
  const [exportando, setExportando] = useState(false);
  const val = (r) => toNum(r.VALOR);

  const categorias = useMemo(
    () => [...new Set(folha.map((r) => r.CATEGORIA).filter(Boolean))].sort((x, y) => x.localeCompare(y)),
    [folha],
  );
  const tagsList = useMemo(
    () => [...new Set(folha.map((r) => r.TAG).filter(Boolean))].sort((x, y) => x.localeCompare(y)),
    [folha],
  );

  const filtrar = useMemo(
    () => (r) => (!fCat || r.CATEGORIA === fCat) && (!fTags.length || fTags.includes(r.TAG)),
    [fCat, fTags],
  );
  const a = useMemo(() => filterByPeriod(folha, periodoA.de, periodoA.ate).filter(filtrar), [folha, periodoA, filtrar]);
  const b = useMemo(() => filterByPeriod(folha, periodoB.de, periodoB.ate).filter(filtrar), [folha, periodoB, filtrar]);

  const totalA = a.reduce((s, r) => s + val(r), 0);
  const totalB = b.reduce((s, r) => s + val(r), 0);

  const porTag = useMemo(() => comparar(a, b, (r) => r.TAG, val), [a, b]);
  const porItem = useMemo(() => comparar(a, b, (r) => r.ITEM_FOLHA, val), [a, b]);
  const porUnidade = useMemo(
    () => comparar(a, b, (r) => String(r.CATEGORIA || '').trim() || '(sem unidade)', val),
    [a, b],
  );

  const filtrosLabel = [fCat && `Categoria: ${fCat}`, fTags.length && `Tags: ${fTags.join(', ')}`]
    .filter(Boolean).join(' · ') || null;
  const nItens = Number(topItens) || 15;

  function exportarPdf() {
    setExportando(true);
    try {
      exportarRelatorioPeriodo({
        tipo: 'Folha',
        periodoALabel: periodLabel(periodoA),
        periodoBLabel: periodLabel(periodoB),
        filtrosLabel,
        totalA,
        totalB,
        nLancA: a.length,
        nLancB: b.length,
        secoes: [
          { titulo: 'Composição por unidade', labelCol: 'Unidade', rows: porUnidade },
          { titulo: 'Comparativo por Tag', labelCol: 'Tag', rows: porTag },
          { titulo: `Comparativo por Item Folha (top ${nItens})`, labelCol: 'Item Folha', rows: porItem.slice(0, nItens) },
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
      <div className="row-actions" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 180, maxWidth: 220, margin: 0 }}>
          <label>Categoria (unidade)</label>
          <select value={fCat} onChange={(e) => setFCat(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 200, maxWidth: 260, margin: 0 }}>
          <label>Tag (uma ou mais)</label>
          <select
            value=""
            onChange={(e) => { if (e.target.value) setFTags((p) => (p.includes(e.target.value) ? p : [...p, e.target.value])); }}
          >
            <option value="">Adicionar tag...</option>
            {tagsList.filter((t) => !fTags.includes(t)).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {fTags.length > 0 && (
            <div className="filtro-chips">
              {fTags.map((t) => (
                <span key={t} className="filtro-chip">{t}<button onClick={() => setFTags((p) => p.filter((x) => x !== t))}>×</button></span>
              ))}
            </div>
          )}
        </div>
        <div className="field" style={{ maxWidth: 120, margin: 0 }}>
          <label>Top N itens</label>
          <input type="number" min="1" value={topItens} onChange={(e) => setTopItens(e.target.value)} />
        </div>
        {(fCat || fTags.length > 0) && (
          <button className="btn btn-sm" onClick={() => { setFCat(''); setFTags([]); }}>Limpar filtros</button>
        )}
      </div>
      <TotaisAB totalA={totalA} totalB={totalB} nLancA={a.length} nLancB={b.length} />

      <div className="card">
        <h3 className="card-title">
          Contribuição para a variação
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (do Total A ao Total B, por tag)</span>
        </h3>
        {porTag.length === 0 ? <div className="empty">Sem dados.</div> : (
          <BridgeChart totalA={totalA} totalB={totalB} contribs={porTag.map((r) => ({ key: r.key, delta: r.deltaAbs }))} />
        )}
      </div>

      <ComparativoSecao titulo="Composição por unidade" labelCol="Unidade" rows={porUnidade} />
      <ComparativoSecao titulo="Comparativo por Tag" labelCol="Tag" rows={porTag} />
      <ComparativoSecao titulo="Comparativo por Item Folha" labelCol="Item Folha" rows={porItem} maxRows={nItens} />
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
