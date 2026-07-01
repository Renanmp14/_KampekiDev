import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { custosApi } from '../api/resources.js';
import { brl, toNum } from '../utils/format.js';

// Colunas exportadas no backup (fiéis à aba CUSTOS, em ordem legível).
const COLS = [
  ['DATA_NOTA', 'DATA'],
  ['NUM_NOTA', 'Nº NOTA'],
  ['MES_ANO', 'MÊS/ANO'],
  ['FORNECEDOR', 'FORNECEDOR'],
  ['ITEM', 'ITEM'],
  ['SUB_CATEGORIA', 'SUBCATEGORIA'],
  ['CATEGORIA', 'CATEGORIA'],
  ['TAG', 'TAG'],
  ['QTD', 'QTD'],
  ['VALOR_UNIT', 'VALOR UNIT'],
  ['VALOR_TOTAL', 'VALOR TOTAL'],
  ['CHAVE_NFE', 'CHAVE NFE'],
  ['UUID', 'UUID'],
];
const NUMERICOS = new Set(['QTD', 'VALOR_UNIT', 'VALOR_TOTAL']);

export default function Saida() {
  const [custos, setCustos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setCustos(await custosApi.listar()); } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, []);

  // Meses disponíveis (MM/YYYY), do mais recente para o mais antigo.
  const meses = useMemo(
    () => [...new Set(custos.map((c) => c.MES_ANO).filter(Boolean))]
      .sort((a, b) => {
        const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/');
        return `${yb}${mb}`.localeCompare(`${ya}${ma}`);
      }),
    [custos],
  );

  const doMes = useMemo(() => (mes ? custos.filter((c) => c.MES_ANO === mes) : []), [custos, mes]);
  const total = doMes.reduce((s, c) => s + toNum(c.VALOR_TOTAL), 0);

  function baixar() {
    if (!mes || !doMes.length) return;
    const header = COLS.map(([, label]) => label);
    const linhas = doMes.map((c) => COLS.map(([campo]) => (NUMERICOS.has(campo) ? toNum(c[campo]) : (c[campo] ?? ''))));
    // Linha de total ao final.
    const totalRow = COLS.map(([campo]) => {
      if (campo === 'VALOR_TOTAL') return +total.toFixed(2);
      if (campo === 'ITEM') return `TOTAL (${doMes.length} lançamentos)`;
      return '';
    });
    const aoa = [header, ...linhas, [], totalRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Custos ${mes.replace('/', '-')}`);
    XLSX.writeFile(wb, `backup-custos-${mes.replace('/', '-')}.xlsx`);
  }

  return (
    <div>
      <h1 className="page-title">Saída — Backup mensal</h1>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Escolha o mês e baixe uma planilha (.xlsx) com <b>todos os custos</b> daquele mês — backup completo da aba CUSTOS.
        </p>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Mês/Ano</label>
            <select value={mes} onChange={(e) => setMes(e.target.value)} disabled={loading}>
              <option value="">{loading ? 'Carregando...' : 'Selecione...'}</option>
              {meses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button className="btn" onClick={baixar} disabled={!mes || !doMes.length}>
            ⬇ Baixar planilha
          </button>
        </div>
        {error && <div className="error-msg">{error}</div>}
      </div>

      {mes && (
        <div className="card">
          <h3 className="card-title" style={{ marginTop: 0 }}>
            {doMes.length} lançamentos · Total {brl(total)}
          </h3>
          {doMes.length === 0
            ? <div className="empty">Nenhum custo neste mês.</div>
            : (
              <div className="table-wrap" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th><th>Nº Nota</th><th>Fornecedor</th><th>Item</th>
                      <th>Categoria</th><th>Tag</th><th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doMes.map((c) => (
                      <tr key={c.UUID}>
                        <td>{c.DATA_NOTA}</td>
                        <td>{c.NUM_NOTA}</td>
                        <td>{c.FORNECEDOR}</td>
                        <td>{c.ITEM}</td>
                        <td>{c.CATEGORIA}</td>
                        <td>{c.TAG || '—'}</td>
                        <td className="num">{brl(c.VALOR_TOTAL)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
