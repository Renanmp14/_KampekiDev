import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { folhaApi, tagApi } from '../../api/resources.js';
import PeriodFilter from '../../components/PeriodFilter.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import CruzamentoMesModal from '../../components/CruzamentoMesModal.jsx';
import { exportarRelatorioFolha } from '../../utils/exportPdf.js';
import { brl, pct, brlCompact } from '../../utils/format.js';
import {
  groupSum, keyToLabel, monthsBetween, filterByPeriod, rowMonthKey, toNum,
} from '../../utils/agg.js';

// Paleta de gráficos derivada do brand Kampeki (teal à frente p/ a Folha).
const COLORS = ['#4f868f', '#ff8b7c', '#bfcb7f', '#d7c4b6', '#e6e6e6', '#9c6b6b', '#7fb8a4'];

export default function DashFolha() {
  const [folha, setFolha] = useState([]);
  const [tags, setTags] = useState([]);
  const [period, setPeriod] = useState({ de: '', ate: '' });
  // Filtro de tag MULTI-seleção: filtra TODO o dashboard (pizza, subtotais,
  // cruzamento, KPIs e PDF). Clicar na pizza/tabela adiciona/remove tags aqui.
  const [fTags, setFTags] = useState([]);
  const [selMes, setSelMes] = useState(''); // mês selecionado na evolução (filtro global)
  const [showCruzMes, setShowCruzMes] = useState(false); // modal do cruzamento por mês
  // Flag global: quando ligada, descarta a folha SEM tag de TODAS as visões.
  const [ocultarSemTag, setOcultarSemTag] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  function toggleMes(key) {
    if (!key) return;
    setSelMes((prev) => (prev === key ? '' : key));
  }
  function addTagFiltro(t) {
    if (t) setFTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }
  function toggleTagFiltro(t) {
    if (!t) return;
    setFTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }
  function removeTagFiltro(t) {
    setFTags((prev) => prev.filter((x) => x !== t));
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

  const tagNomes = useMemo(
    () => [...new Set(tags.map((t) => t.TAG).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [tags],
  );

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

  // base: período + filtro de tags (multi). Filtra o dashboard inteiro — quando há
  // tags escolhidas, TODAS as visões (inclusive "por Tag") mostram só elas.
  const base = useMemo(() => {
    let r = filterByPeriod(folha, deKey, ateKey);
    if (fTags.length) r = r.filter((x) => fTags.includes(x.TAG));
    if (ocultarSemTag) r = r.filter((x) => String(x.TAG || '').trim() !== '');
    return r;
  }, [folha, deKey, ateKey, fTags, ocultarSemTag]);

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

  // Cruzamento Tag (linha) × Categoria (coluna) — respeita o filtro de tags/mês.
  const cruzamento = useMemo(() => {
    const catOf = (r) => String(r.CATEGORIA || '').trim() || '(sem categoria)';
    // Lançamentos de folha sem tag entram como linha "(sem tag)" para o subtotal
    // continuar honesto (a folha sem tag ainda soma na categoria).
    const tagOf = (r) => String(r.TAG || '').trim() || '(sem tag)';
    // Lista as tags cadastradas (mais as presentes nos dados). Quando há filtro de
    // tags, restringe às escolhidas.
    let tagsList = [...new Set([...tags.map((t) => t.TAG), ...baseMes.map(tagOf)])]
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));
    if (fTags.length) tagsList = tagsList.filter((t) => fTags.includes(t));
    const colsList = [...new Set(baseMes.map(catOf))].sort();
    const cell = {};
    for (const r of baseMes) {
      const k = `${tagOf(r)}|||${catOf(r)}`;
      cell[k] = (cell[k] || 0) + val(r);
    }
    const colTotais = {};
    let grand = 0;
    for (const cat of colsList) {
      let s = 0;
      for (const tg of tagsList) s += cell[`${tg}|||${cat}`] || 0;
      colTotais[cat] = s;
      grand += s;
    }
    return {
      tagsList, colsList, cell, colTotais, grand,
    };
  }, [baseMes, tags, fTags]);

  // Rótulos reusados no PDF e no modal.
  const periodoLabel = selMes
    ? keyToLabel(selMes)
    : (deKey ? `${keyToLabel(deKey)} – ${keyToLabel(ateKey)}` : 'Todo o período');
  const filtrosLabel = useMemo(() => {
    const parts = [];
    if (fTags.length) parts.push(`Tags: ${fTags.join(', ')}`);
    if (selMes) parts.push(`Mês: ${keyToLabel(selMes)}`);
    return parts.join(' · ') || null;
  }, [fTags, selMes]);

  function exportarPdf() {
    setExportando(true);
    try {
      exportarRelatorioFolha({
        periodoLabel,
        filtrosLabel,
        total,
        nLanc: baseMes.length,
        porMes,
        porTag,
        porItem,
        cruzamento,
      });
    } finally {
      setExportando(false);
    }
  }

  if (loading) return <div><h1 className="page-title">Dash Folha</h1><div className="empty">Carregando...</div></div>;

  return (
    <div>
      <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dash Folha</h1>
        <div className="row-actions" style={{ gap: 14, alignItems: 'center', margin: 0, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ocultarSemTag}
              onChange={(e) => setOcultarSemTag(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <span className="muted" style={{ fontSize: 13 }}>Ocultar folha sem tag</span>
          </label>
          <button className="btn btn-ghost" onClick={exportarPdf} disabled={exportando}>
            {exportando ? 'Gerando PDF...' : '⬇ Exportar PDF'}
          </button>
        </div>
      </div>

      <PeriodFilter de={period.de} ate={period.ate} onChange={setPeriod}>
        <div className="field" style={{ minWidth: 200, maxWidth: 240 }}>
          <label>Tags (uma ou mais)</label>
          <SearchableSelect value="" onPick={addTagFiltro} options={tagNomes} placeholder="Adicionar tag..." />
        </div>
      </PeriodFilter>

      {(selMes || fTags.length > 0) && (
        <div className="row-actions" style={{ marginBottom: 14, gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted">Filtros ativos:</span>
          {fTags.map((t) => (
            <button key={t} className="btn btn-sm btn-ghost" onClick={() => removeTagFiltro(t)}>
              Tag: {t} ✕
            </button>
          ))}
          {selMes && (
            <button className="btn btn-sm btn-ghost" onClick={() => setSelMes('')}>
              Mês: {keyToLabel(selMes)} ✕
            </button>
          )}
          {fTags.length > 0 && (
            <button className="btn btn-sm" onClick={() => setFTags([])}>Limpar tags</button>
          )}
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
            <YAxis stroke="#93a39b" fontSize={12} tickFormatter={brlCompact} />
            <Tooltip
              formatter={(v) => brl(v)}
              contentStyle={{ background: '#16302b', border: '1px solid #2c4a43', borderRadius: 6 }}
              itemStyle={{ color: '#f1f3f5' }}
              labelStyle={{ color: '#f1f3f5' }}
              cursor={{ fill: 'rgba(255,255,255,0.08)' }}
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
          <h3 className="card-title" style={{ margin: '0 0 10px' }}>
            Participação por Tag
            <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (clique numa fatia para filtrar)</span>
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={porTag}
                dataKey="total"
                nameKey="key"
                cx="50%"
                cy="50%"
                outerRadius={90}
                onClick={(d) => toggleTagFiltro(d?.key ?? d?.payload?.key)}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {porTag.map((entry, i) => (
                  <Cell
                    key={entry.key}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={!fTags.length || fTags.includes(entry.key) ? 1 : 0.28}
                    stroke={fTags.includes(entry.key) ? '#fff' : undefined}
                    strokeWidth={fTags.includes(entry.key) ? 2 : undefined}
                  />
                ))}
              </Pie>
              <Legend onClick={(e) => toggleTagFiltro(e?.value)} wrapperStyle={{ cursor: 'pointer' }} />
              <Tooltip
                formatter={(v) => brl(v)}
                contentStyle={{ background: '#16302b', border: '1px solid #2c4a43', borderRadius: 6 }}
                itemStyle={{ color: '#f1f3f5' }}
                labelStyle={{ color: '#f1f3f5' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title">
            Subtotal por Tag
            <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (clique para filtrar)</span>
          </h3>
          <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Tag</th><th className="num">Total</th><th className="num">%</th></tr></thead>
              <tbody>
                {porTag.map((s) => (
                  <tr
                    key={s.key}
                    className={fTags.includes(s.key) ? 'selected-row' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleTagFiltro(s.key)}
                  >
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
        <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 className="card-title" style={{ margin: 0 }}>Cruzamento Tag × Categoria</h3>
          <button
            className="btn btn-sm btn-ghost"
            title="Ver quebrado por mês do período"
            onClick={() => setShowCruzMes(true)}
          >
            👁 Ver por mês
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tag \ Categoria</th>
                {cruzamento.colsList.map((cat) => <th key={cat} className="num">{cat}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {cruzamento.tagsList.map((tg) => {
                const linhaTotal = cruzamento.colsList.reduce(
                  (s, cat) => s + (cruzamento.cell[`${tg}|||${cat}`] || 0), 0,
                );
                return (
                  <tr key={tg}>
                    <td>{tg}</td>
                    {cruzamento.colsList.map((cat) => {
                      const v = cruzamento.cell[`${tg}|||${cat}`] || 0;
                      return <td key={cat} className="num">{brl(v)}</td>;
                    })}
                    <td className="num"><strong>{brl(linhaTotal)}</strong></td>
                  </tr>
                );
              })}
              {cruzamento.tagsList.length === 0 && (
                <tr><td className="empty">Sem dados.</td></tr>
              )}
            </tbody>
            {cruzamento.tagsList.length > 0 && (
              <tfoot>
                <tr>
                  <td><strong>Subtotal</strong></td>
                  {cruzamento.colsList.map((cat) => (
                    <td key={cat} className="num"><strong>{brl(cruzamento.colTotais[cat] || 0)}</strong></td>
                  ))}
                  <td className="num"><strong>{brl(cruzamento.grand)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {showCruzMes && (
        <CruzamentoMesModal
          base={base}
          tags={fTags.length ? tags.filter((t) => fTags.includes(t.TAG)) : tags}
          deKey={deKey}
          ateKey={ateKey}
          selMes={selMes}
          periodoLabel={periodoLabel}
          filtrosLabel={filtrosLabel}
          onClose={() => setShowCruzMes(false)}
        />
      )}
    </div>
  );
}
