import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { custosApi, getConfig } from '../../api/resources.js';
import PeriodFilter from '../../components/PeriodFilter.jsx';
import { brl, pct, brlCompact } from '../../utils/format.js';
import { exportarRelatorioCustos } from '../../utils/exportPdf.js';
import {
  groupSum, keyToLabel, monthsBetween, previousWindow, filterByPeriod, rowMonthKey, toNum,
} from '../../utils/agg.js';

// Paleta de gráficos derivada do brand Kampeki.
const COLORS = ['#ff8b7c', '#4f868f', '#bfcb7f', '#d7c4b6', '#e6e6e6', '#9c6b6b', '#7fb8a4'];

export default function DashCustos() {
  const [custos, setCustos] = useState([]);
  const [period, setPeriod] = useState({ de: '', ate: '' });
  const [topN, setTopN] = useState(10);
  const [threshold, setThreshold] = useState(20);
  const [loading, setLoading] = useState(true);

  // Drill-down por clique nos gráficos (compõe com o filtro de período).
  const [selCategoria, setSelCategoria] = useState('');
  const [selSubcategoria, setSelSubcategoria] = useState('');
  // Mês selecionado no "Comparativo mês a mês" (dropdown / clique na barra).
  const [selMes, setSelMes] = useState('');
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, cfg] = await Promise.all([custosApi.listar(), getConfig().catch(() => ({}))]);
        setCustos(c);
        if (cfg.growthAlertThreshold) setThreshold(cfg.growthAlertThreshold);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const val = (r) => toNum(r.VALOR_TOTAL);

  function toggleCategoria(cat) {
    if (!cat) return;
    setSelCategoria((prev) => (prev === cat ? '' : cat));
    setSelSubcategoria(''); // troca de categoria zera a subcategoria
  }
  function toggleSubcategoria(sub) {
    if (!sub) return;
    setSelSubcategoria((prev) => (prev === sub ? '' : sub));
  }
  function toggleMes(key) {
    if (!key) return;
    setSelMes((prev) => (prev === key ? '' : key));
  }
  function limparDrill() {
    setSelCategoria('');
    setSelSubcategoria('');
    setSelMes('');
  }

  // Limites efetivos do período (default = todo o histórico).
  const todasChaves = useMemo(
    () => [...new Set(custos.map(rowMonthKey).filter(Boolean))].sort(),
    [custos],
  );
  const deKey = period.de || todasChaves[0] || '';
  const ateKey = period.ate || todasChaves[todasChaves.length - 1] || '';

  const noPeriodo = useMemo(() => filterByPeriod(custos, deKey, ateKey), [custos, deKey, ateKey]);

  // Se o mês selecionado sair do período (ao mudar o filtro de período), limpa.
  useEffect(() => {
    if (selMes && deKey && ateKey && (selMes < deKey || selMes > ateKey)) setSelMes('');
  }, [selMes, deKey, ateKey]);

  // Comparativo mês a mês: respeita categoria/subcategoria, mas NÃO o mês
  // selecionado — mostra todos os meses para permitir trocar de mês.
  const baseDrill = useMemo(() => {
    let r = noPeriodo;
    if (selCategoria) r = r.filter((x) => x.CATEGORIA === selCategoria);
    if (selSubcategoria) r = r.filter((x) => x.SUB_CATEGORIA === selSubcategoria);
    return r;
  }, [noPeriodo, selCategoria, selSubcategoria]);

  const porMes = useMemo(() => {
    const sums = groupSum(baseDrill, rowMonthKey, val);
    const map = Object.fromEntries(sums.map((s) => [s.key, s.total]));
    return monthsBetween(deKey, ateKey).map((k) => ({ key: k, mes: keyToLabel(k), total: map[k] || 0 }));
  }, [baseDrill, deKey, ateKey]);

  // Filtro global de mês: ao escolher um mês no comparativo, TODO o restante do
  // dashboard (pizza, subcategorias, total, top itens) passa a refletir só ele.
  const noMes = useMemo(
    () => (selMes ? noPeriodo.filter((r) => rowMonthKey(r) === selMes) : noPeriodo),
    [noPeriodo, selMes],
  );

  // Pizza por categoria: sobre o recorte de mês (ou período), permitindo trocar
  // de categoria a qualquer momento.
  const porCategoria = useMemo(() => groupSum(noMes, (r) => r.CATEGORIA, val), [noMes]);
  // Base após drill-down de categoria (alimenta subcategorias) e base final após
  // subcategoria (alimenta total e itens).
  const baseCat = useMemo(
    () => (selCategoria ? noMes.filter((r) => r.CATEGORIA === selCategoria) : noMes),
    [noMes, selCategoria],
  );
  const porSubcategoria = useMemo(() => groupSum(baseCat, (r) => r.SUB_CATEGORIA, val), [baseCat]);
  const filtrado = useMemo(
    () => (selSubcategoria ? baseCat.filter((r) => r.SUB_CATEGORIA === selSubcategoria) : baseCat),
    [baseCat, selSubcategoria],
  );

  const totalGeral = filtrado.reduce((s, r) => s + val(r), 0);
  // Base da categoria (antes do filtro de subcategoria) — referência do % das subs.
  const totalBaseCat = baseCat.reduce((s, r) => s + val(r), 0);

  // Janela efetiva da variação "vs anterior": com mês selecionado, compara com o
  // mês anterior; senão, com o período anterior de mesmo tamanho.
  const effDe = selMes || deKey;
  const effAte = selMes || ateKey;

  // Item a item com % do total e variação vs janela anterior (respeita o mesmo
  // drill-down de categoria/subcategoria).
  const tabelaItens = useMemo(() => {
    const drill = (r) => (!selCategoria || r.CATEGORIA === selCategoria)
      && (!selSubcategoria || r.SUB_CATEGORIA === selSubcategoria);
    const atual = groupSum(filtrado, (r) => r.ITEM, val);
    const prev = previousWindow(effDe, effAte);
    const anterior = groupSum(filterByPeriod(custos, prev.de, prev.ate).filter(drill), (r) => r.ITEM, val);
    const prevMap = Object.fromEntries(anterior.map((a) => [a.key, a.total]));
    return atual.map((a) => {
      const ant = prevMap[a.key] || 0;
      const variacao = ant > 0 ? ((a.total - ant) / ant) * 100 : (a.total > 0 ? null : 0);
      return {
        item: a.key,
        total: a.total,
        share: totalGeral > 0 ? (a.total / totalGeral) * 100 : 0,
        anterior: ant,
        variacao,
      };
    });
  }, [filtrado, custos, effDe, effAte, totalGeral, selCategoria, selSubcategoria]);

  const topItens = tabelaItens.slice(0, Number(topN) || 10);

  function exportarPdf() {
    setExportando(true);
    try {
      const periodoLabel = selMes
        ? keyToLabel(selMes)
        : (deKey ? `${keyToLabel(deKey)} – ${keyToLabel(ateKey)}` : 'Todo o período');
      const drillParts = [];
      if (selMes) drillParts.push(`Mês: ${keyToLabel(selMes)}`);
      if (selCategoria) drillParts.push(`Categoria: ${selCategoria}`);
      if (selSubcategoria) drillParts.push(`Subcategoria: ${selSubcategoria}`);
      exportarRelatorioCustos({
        periodoLabel,
        drillLabel: drillParts.join(' · ') || null,
        subLabel: selCategoria || null,
        totalGeral,
        nLanc: filtrado.length,
        porMes,
        porCategoria,
        porSubcategoria,
        topItens,
        topN: Number(topN) || 10,
      });
    } finally {
      setExportando(false);
    }
  }

  if (loading) return <div><h1 className="page-title">Dash Custos</h1><div className="empty">Carregando...</div></div>;

  return (
    <div>
      <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dash Custos</h1>
        <button className="btn btn-ghost" onClick={exportarPdf} disabled={exportando}>
          {exportando ? 'Gerando PDF...' : '⬇ Exportar PDF'}
        </button>
      </div>

      <PeriodFilter de={period.de} ate={period.ate} onChange={setPeriod}>
        <div className="field" style={{ maxWidth: 120 }}>
          <label>Top N itens</label>
          <input type="number" min="1" value={topN} onChange={(e) => setTopN(e.target.value)} />
        </div>
        <div className="field" style={{ maxWidth: 150 }}>
          <label>Alerta crescimento (%)</label>
          <input type="number" min="0" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        </div>
      </PeriodFilter>

      {(selCategoria || selSubcategoria || selMes) && (
        <div className="row-actions" style={{ marginBottom: 14, gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted">Drill-down ativo:</span>
          {selMes && (
            <button className="btn btn-sm btn-ghost" onClick={() => setSelMes('')}>
              Mês: {keyToLabel(selMes)} ✕
            </button>
          )}
          {selCategoria && (
            <button className="btn btn-sm btn-ghost" onClick={() => toggleCategoria(selCategoria)}>
              Categoria: {selCategoria} ✕
            </button>
          )}
          {selSubcategoria && (
            <button className="btn btn-sm btn-ghost" onClick={() => toggleSubcategoria(selSubcategoria)}>
              Subcategoria: {selSubcategoria} ✕
            </button>
          )}
          <button className="btn btn-sm" onClick={limparDrill}>Limpar drill-down</button>
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="kpi-label">{selMes ? 'Total no mês' : 'Total no período'}</div>
          <div className="kpi-value">{brl(totalGeral)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Lançamentos</div>
          <div className="kpi-value">{filtrado.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{selMes ? 'Mês' : 'Período'}</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>
            {selMes
              ? keyToLabel(selMes)
              : (deKey ? `${keyToLabel(deKey)} – ${keyToLabel(ateKey)}` : '—')}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            Comparativo mês a mês
            <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (clique numa barra para filtrar todo o dashboard)</span>
          </h3>
          <div className="field" style={{ maxWidth: 200, margin: 0 }}>
            <select value={selMes} onChange={(e) => setSelMes(e.target.value)}>
              <option value="">Filtrar por mês...</option>
              {porMes.map((m) => <option key={m.key} value={m.key}>{m.mes}</option>)}
            </select>
          </div>
        </div>
        <div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={porMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2c4a43" />
            <XAxis dataKey="mes" stroke="#93a39b" fontSize={12} />
            <YAxis stroke="#93a39b" fontSize={12} tickFormatter={brlCompact} />
            <Tooltip
              formatter={(v) => brl(v)}
              contentStyle={{ background: '#16302b', border: '1px solid #2c4a43', borderRadius: 6 }}
              itemStyle={{ color: '#f1f3f5' }}
              labelStyle={{ color: '#f1f3f5' }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar
              dataKey="total"
              radius={[4, 4, 0, 0]}
              onClick={(d) => toggleMes(d?.key ?? d?.payload?.key)}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {porMes.map((m) => (
                <Cell
                  key={m.key}
                  fill="#ff8b7c"
                  fillOpacity={!selMes || selMes === m.key ? 1 : 0.3}
                  stroke={selMes === m.key ? '#fff' : undefined}
                  strokeWidth={selMes === m.key ? 2 : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Total por categoria <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(clique para filtrar)</span></h3>
          <div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={porCategoria}
                dataKey="total"
                nameKey="key"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={false}
                onClick={(d) => toggleCategoria(d?.key ?? d?.payload?.key)}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {porCategoria.map((entry, i) => (
                  <Cell
                    key={entry.key}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={!selCategoria || selCategoria === entry.key ? 1 : 0.28}
                    stroke={selCategoria === entry.key ? '#fff' : undefined}
                    strokeWidth={selCategoria === entry.key ? 2 : undefined}
                  />
                ))}
              </Pie>
              <Legend
                onClick={(e) => toggleCategoria(e?.value)}
                wrapperStyle={{ cursor: 'pointer' }}
              />
              <Tooltip
                formatter={(v) => brl(v)}
                contentStyle={{ background: '#16302b', border: '1px solid #2c4a43', borderRadius: 6 }}
                itemStyle={{ color: '#f1f3f5' }}
                labelStyle={{ color: '#f1f3f5' }}
              />
            </PieChart>
          </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">
            Total por subcategoria
            {selCategoria && <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> — {selCategoria}</span>}
            <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (clique para filtrar)</span>
          </h3>
          <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Subcategoria</th><th className="num">Total</th><th className="num">%</th></tr></thead>
              <tbody>
                {porSubcategoria.map((s) => (
                  <tr
                    key={s.key}
                    className={selSubcategoria === s.key ? 'selected-row' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleSubcategoria(s.key)}
                  >
                    <td>{s.key}</td>
                    <td className="num">{brl(s.total)}</td>
                    <td className="num">{pct(totalBaseCat > 0 ? (s.total / totalBaseCat) * 100 : 0)}</td>
                  </tr>
                ))}
                {porSubcategoria.length === 0 && <tr><td colSpan={3} className="empty">Sem dados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Top {topN} itens por valor — variação vs. período anterior</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Valor</th>
                <th className="num">% do total</th>
                <th className="num">Período anterior</th>
                <th className="num">Variação</th>
              </tr>
            </thead>
            <tbody>
              {topItens.map((r) => {
                const alerta = r.variacao !== null && r.variacao >= Number(threshold);
                return (
                  <tr key={r.item} className={alerta ? 'alert-row' : ''}>
                    <td>{r.item}{alerta && <span title="Crescimento acima do limite"> ⚠️</span>}</td>
                    <td className="num">{brl(r.total)}</td>
                    <td className="num">{pct(r.share)}</td>
                    <td className="num">{brl(r.anterior)}</td>
                    <td className="num">
                      {r.variacao === null
                        ? <span className="up">novo</span>
                        : <span className={r.variacao >= 0 ? 'up' : 'down'}>{r.variacao >= 0 ? '+' : ''}{pct(r.variacao)}</span>}
                    </td>
                  </tr>
                );
              })}
              {topItens.length === 0 && <tr><td colSpan={5} className="empty">Sem dados no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
