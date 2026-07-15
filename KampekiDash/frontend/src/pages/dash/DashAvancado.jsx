import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { custosApi } from '../../api/resources.js';
import PeriodFilter from '../../components/PeriodFilter.jsx';
import { brl, brlCompact, toNum } from '../../utils/format.js';
import {
  keyToLabel, monthsBetween, rowMonthKey, filterByPeriod,
} from '../../utils/agg.js';

// Hub de análises avançadas (deep-dives que não pertencem ao dashboard operacional
// do dia a dia). Primeira visão: evolução de preço médio × quantidade.
export default function DashAvancado() {
  const [custos, setCustos] = useState([]);
  const [period, setPeriod] = useState({ de: '', ate: '' });
  const [loading, setLoading] = useState(true);

  // Evolução de preço médio × quantidade: categoria + subcategoria selecionadas.
  const [precoCat, setPrecoCat] = useState('');
  const [precoSub, setPrecoSub] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCustos(await custosApi.listar());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Limites efetivos do período (default = todo o histórico).
  const todasChaves = useMemo(
    () => [...new Set(custos.map(rowMonthKey).filter(Boolean))].sort(),
    [custos],
  );
  const deKey = period.de || todasChaves[0] || '';
  const ateKey = period.ate || todasChaves[todasChaves.length - 1] || '';
  const noPeriodo = useMemo(() => filterByPeriod(custos, deKey, ateKey), [custos, deKey, ateKey]);

  const precoCategorias = useMemo(
    () => [...new Set(custos.map((r) => r.CATEGORIA).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [custos],
  );
  // Subcategorias restritas à categoria escolhida.
  const precoSubcategorias = useMemo(() => {
    if (!precoCat) return [];
    const set = new Set();
    for (const r of custos) {
      if (r.CATEGORIA === precoCat && r.SUB_CATEGORIA) set.add(r.SUB_CATEGORIA);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [custos, precoCat]);

  // Série mensal: preço médio ponderado (Σ valor ÷ Σ quantidade) + quantidade, sobre
  // o período, para a categoria (e subcategoria, se escolhida) selecionada.
  const precoSerie = useMemo(() => {
    if (!precoCat) return [];
    const linhas = monthsBetween(deKey, ateKey).map((k) => ({ key: k, mes: keyToLabel(k), valorTotal: 0, qtd: 0 }));
    const idx = Object.fromEntries(linhas.map((l, i) => [l.key, i]));
    for (const r of noPeriodo) {
      if (r.CATEGORIA !== precoCat) continue;
      if (precoSub && r.SUB_CATEGORIA !== precoSub) continue;
      const k = rowMonthKey(r);
      if (!(k in idx)) continue;
      linhas[idx[k]].valorTotal += toNum(r.VALOR_TOTAL);
      linhas[idx[k]].qtd += toNum(r.QTD);
    }
    return linhas.map((l) => ({ ...l, preco: l.qtd > 0 ? l.valorTotal / l.qtd : 0 }));
  }, [precoCat, precoSub, noPeriodo, deKey, ateKey]);

  if (loading) return <div><h1 className="page-title">Visões avançadas</h1><div className="empty">Carregando...</div></div>;

  return (
    <div>
      <h1 className="page-title">Visões avançadas</h1>

      <PeriodFilter de={period.de} ate={period.ate} onChange={setPeriod} />

      <div className="card">
        <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            Evolução de preço médio × quantidade
            <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> — escolha categoria e (opcional) subcategoria</span>
          </h3>
          <div className="row-actions" style={{ gap: 8, flexWrap: 'wrap', margin: 0 }}>
            <div className="field" style={{ minWidth: 180, maxWidth: 240, margin: 0 }}>
              <label>Categoria</label>
              <select value={precoCat} onChange={(e) => { setPrecoCat(e.target.value); setPrecoSub(''); }}>
                <option value="">Escolha...</option>
                {precoCategorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field" style={{ minWidth: 180, maxWidth: 240, margin: 0 }}>
              <label>Subcategoria</label>
              <select value={precoSub} onChange={(e) => setPrecoSub(e.target.value)} disabled={!precoCat}>
                <option value="">— todas —</option>
                {precoSubcategorias.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {precoCat ? (
          <div style={{ marginTop: 12 }}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={precoSerie}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2c4a43" />
                <XAxis dataKey="mes" stroke="#93a39b" fontSize={12} />
                <YAxis yAxisId="preco" stroke="#ff8b7c" fontSize={12} tickFormatter={brlCompact} />
                <YAxis yAxisId="qtd" orientation="right" stroke="#4f868f" fontSize={12} />
                <Tooltip
                  formatter={(v, name) => (name === 'Preço médio'
                    ? [brl(v), name]
                    : [toNum(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }), name])}
                  contentStyle={{ background: '#16302b', border: '1px solid #2c4a43', borderRadius: 6 }}
                  itemStyle={{ color: '#f1f3f5' }}
                  labelStyle={{ color: '#f1f3f5' }}
                />
                <Legend />
                <Line yAxisId="preco" type="monotone" dataKey="preco" name="Preço médio" stroke="#ff8b7c" strokeWidth={2} />
                <Line yAxisId="qtd" type="monotone" dataKey="qtd" name="Quantidade" stroke="#4f868f" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Preço médio = Σ valor total ÷ Σ quantidade no mês, para {precoSub || precoCat}. Itens de unidades diferentes dentro do recorte são somados — leia como preço médio por unidade pedida.
            </div>
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 12 }}>Escolha uma categoria para ver a evolução do preço médio e da quantidade pedida mês a mês.</div>
        )}
      </div>
    </div>
  );
}
