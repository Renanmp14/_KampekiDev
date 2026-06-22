import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { folhaApi, tagApi } from '../../api/resources.js';
import PeriodFilter from '../../components/PeriodFilter.jsx';
import { brl, pct } from '../../utils/format.js';
import {
  groupSum, keyToLabel, monthsBetween, filterByPeriod, rowMonthKey, toNum,
} from '../../utils/agg.js';

// Paleta de gráficos derivada do brand Kampeki (teal à frente p/ a Folha).
const COLORS = ['#4f868f', '#ff8b7c', '#bfcb7f', '#d7c4b6', '#e6e6e6', '#9c6b6b', '#7fb8a4'];

export default function DashFolha() {
  const [folha, setFolha] = useState([]);
  const [tags, setTags] = useState([]);
  const [period, setPeriod] = useState({ de: '', ate: '' });
  const [fTag, setFTag] = useState('');
  const [selMes, setSelMes] = useState(''); // mês selecionado na evolução (filtro global)
  const [loading, setLoading] = useState(true);

  function toggleMes(key) {
    if (!key) return;
    setSelMes((prev) => (prev === key ? '' : key));
  }

  useEffect(() => {
    (async () => {
      try {
        const [f, t] = await Promise.all([folhaApi.listar(), tagApi.listar()]);
        setFolha(f);
        setTags(t);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const val = (r) => toNum(r.VALOR);

  const todasChaves = useMemo(
    () => [...new Set(folha.map(rowMonthKey).filter(Boolean))].sort(),
    [folha],
  );
  const deKey = period.de || todasChaves[0] || '';
  const ateKey = period.ate || todasChaves[todasChaves.length - 1] || '';

  // Se o mês selecionado sair do período (ao mudar o filtro), limpa.
  useEffect(() => {
    if (selMes && deKey && ateKey && (selMes < deKey || selMes > ateKey)) setSelMes('');
  }, [selMes, deKey, ateKey]);

  // base: período + filtro de tag (alimenta a evolução mensal — todos os meses,
  // para permitir trocar de mês).
  const base = useMemo(() => {
    const noPeriodo = filterByPeriod(folha, deKey, ateKey);
    return fTag ? noPeriodo.filter((r) => r.TAG === fTag) : noPeriodo;
  }, [folha, deKey, ateKey, fTag]);

  const porMes = useMemo(() => {
    const sums = groupSum(base, rowMonthKey, val);
    const map = Object.fromEntries(sums.map((s) => [s.key, s.total]));
    return monthsBetween(deKey, ateKey).map((k) => ({ key: k, mes: keyToLabel(k), total: map[k] || 0 }));
  }, [base, deKey, ateKey]);

  // Filtro global de mês: ao escolher um mês na evolução, TODO o restante do
  // dashboard (por Tag, por Item, cruzamento, totais) reflete só ele.
  const baseMes = useMemo(
    () => (selMes ? base.filter((r) => rowMonthKey(r) === selMes) : base),
    [base, selMes],
  );

  const total = baseMes.reduce((s, r) => s + val(r), 0);
  const porTag = useMemo(() => groupSum(baseMes, (r) => r.TAG, val), [baseMes]);
  const porItem = useMemo(() => groupSum(baseMes, (r) => r.ITEM_FOLHA, val), [baseMes]);

  // Cruzamento Tag × Item.
  const cruzamento = useMemo(() => {
    const tagsList = [...new Set(baseMes.map((r) => r.TAG))];
    const itensList = [...new Set(baseMes.map((r) => r.ITEM_FOLHA))];
    const cell = {};
    for (const r of baseMes) {
      const k = `${r.TAG}|||${r.ITEM_FOLHA}`;
      cell[k] = (cell[k] || 0) + val(r);
    }
    return { tagsList, itensList, cell };
  }, [baseMes]);

  if (loading) return <div><h1 className="page-title">Dash Folha</h1><div className="empty">Carregando...</div></div>;

  return (
    <div>
      <h1 className="page-title">Dash Folha</h1>

      <PeriodFilter de={period.de} ate={period.ate} onChange={setPeriod}>
        <div className="field" style={{ maxWidth: 180 }}>
          <label>Tag</label>
          <select value={fTag} onChange={(e) => setFTag(e.target.value)}>
            <option value="">Todas</option>
            {tags.map((t) => <option key={t.UUID} value={t.TAG}>{t.TAG}</option>)}
          </select>
        </div>
      </PeriodFilter>

      {selMes && (
        <div className="row-actions" style={{ marginBottom: 14, gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted">Filtro de mês ativo:</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setSelMes('')}>
            Mês: {keyToLabel(selMes)} ✕
          </button>
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="kpi-label">{selMes ? 'Total no mês' : 'Total no período'}</div>
          <div className="kpi-value">{brl(total)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Lançamentos</div>
          <div className="kpi-value">{baseMes.length}</div>
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
            Evolução mensal da folha
            <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (clique numa barra para filtrar todo o dashboard)</span>
          </h3>
          <div className="field" style={{ maxWidth: 200, margin: 0 }}>
            <select value={selMes} onChange={(e) => setSelMes(e.target.value)}>
              <option value="">Filtrar por mês...</option>
              {porMes.map((m) => <option key={m.key} value={m.key}>{m.mes}</option>)}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={porMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2c4a43" />
            <XAxis dataKey="mes" stroke="#93a39b" fontSize={12} />
            <YAxis stroke="#93a39b" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: '#16302b', border: '1px solid #2c4a43' }} />
            <Bar
              dataKey="total"
              radius={[4, 4, 0, 0]}
              onClick={(d) => toggleMes(d?.key ?? d?.payload?.key)}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {porMes.map((m) => (
                <Cell
                  key={m.key}
                  fill="#4f868f"
                  fillOpacity={!selMes || selMes === m.key ? 1 : 0.3}
                  stroke={selMes === m.key ? '#fff' : undefined}
                  strokeWidth={selMes === m.key ? 2 : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Participação por Tag</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porTag} dataKey="total" nameKey="key" cx="50%" cy="50%" outerRadius={90}>
                {porTag.map((entry, i) => <Cell key={entry.key} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: '#16302b', border: '1px solid #2c4a43' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title">Subtotal por Tag</h3>
          <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Tag</th><th className="num">Total</th><th className="num">%</th></tr></thead>
              <tbody>
                {porTag.map((s) => (
                  <tr key={s.key}>
                    <td>{s.key}</td>
                    <td className="num">{brl(s.total)}</td>
                    <td className="num">{pct(total > 0 ? (s.total / total) * 100 : 0)}</td>
                  </tr>
                ))}
                {porTag.length === 0 && <tr><td colSpan={3} className="empty">Sem dados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Subtotal por Item</h3>
        <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Item Folha</th><th className="num">Total</th><th className="num">%</th></tr></thead>
            <tbody>
              {porItem.map((s) => (
                <tr key={s.key}>
                  <td>{s.key}</td>
                  <td className="num">{brl(s.total)}</td>
                  <td className="num">{pct(total > 0 ? (s.total / total) * 100 : 0)}</td>
                </tr>
              ))}
              {porItem.length === 0 && <tr><td colSpan={3} className="empty">Sem dados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Cruzamento Tag × Item</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tag \ Item</th>
                {cruzamento.itensList.map((it) => <th key={it} className="num">{it}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {cruzamento.tagsList.map((tg) => {
                const linhaTotal = cruzamento.itensList.reduce(
                  (s, it) => s + (cruzamento.cell[`${tg}|||${it}`] || 0), 0,
                );
                return (
                  <tr key={tg}>
                    <td>{tg}</td>
                    {cruzamento.itensList.map((it) => {
                      const v = cruzamento.cell[`${tg}|||${it}`] || 0;
                      return <td key={it} className="num">{v ? brl(v) : '—'}</td>;
                    })}
                    <td className="num"><strong>{brl(linhaTotal)}</strong></td>
                  </tr>
                );
              })}
              {cruzamento.tagsList.length === 0 && (
                <tr><td className="empty">Sem dados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
