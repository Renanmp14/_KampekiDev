import React, { useMemo } from 'react';
import Modal from './Modal.jsx';
import { brl } from '../utils/format.js';
import {
  monthsBetween, keyToLabel, rowMonthKey, toNum,
} from '../utils/agg.js';
import { exportarCruzamentoMensalFolha } from '../utils/exportPdf.js';

const catOf = (r) => String(r.CATEGORIA || '').trim() || '(sem categoria)';
// Folha sem tag entra como "(sem tag)" (mantém o subtotal honesto).
const tagOf = (r) => String(r.TAG || '').trim() || '(sem tag)';

/**
 * Modal do Cruzamento Tag × Categoria QUEBRADO por mês do período. Reaproveita a
 * base já filtrada (período + tags) do Dash Folha, então os filtros aplicados
 * refletem aqui. Tem exportação própria em PDF (uma tabela por mês).
 */
export default function CruzamentoMesModal({
  base, tags, deKey, ateKey, selMes, periodoLabel, filtrosLabel, onClose,
}) {
  const dados = useMemo(() => {
    const meses = selMes ? [selMes] : monthsBetween(deKey, ateKey);
    const tagsList = [...new Set([...tags.map((t) => t.TAG), ...base.map(tagOf)])]
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));
    const colsSet = new Set();
    const cellByMes = {};
    for (const m of meses) cellByMes[m] = {};
    for (const r of base) {
      const m = rowMonthKey(r);
      if (!(m in cellByMes)) continue;
      const c = catOf(r);
      colsSet.add(c);
      const k = `${tagOf(r)}|||${c}`;
      cellByMes[m][k] = (cellByMes[m][k] || 0) + toNum(r.VALOR);
    }
    const colsList = [...colsSet].sort();
    const porMes = meses.map((m) => {
      const cell = cellByMes[m] || {};
      const colTotais = {};
      let grand = 0;
      for (const cat of colsList) {
        let s = 0;
        for (const tg of tagsList) s += cell[`${tg}|||${cat}`] || 0;
        colTotais[cat] = s;
        grand += s;
      }
      return {
        key: m, label: keyToLabel(m), cell, colTotais, grand,
      };
    });
    return { tagsList, colsList, porMes };
  }, [base, tags, deKey, ateKey, selMes]);

  function exportar() {
    exportarCruzamentoMensalFolha({
      periodoLabel,
      filtrosLabel,
      tagsList: dados.tagsList,
      colsList: dados.colsList,
      porMes: dados.porMes,
    });
  }

  return (
    <Modal
      title="Cruzamento Tag × Categoria — por mês"
      onClose={onClose}
      className="modal-lg"
      footer={(
        <>
          <button className="btn btn-ghost" onClick={exportar}>⬇ Exportar PDF</button>
          <button className="btn" onClick={onClose}>Fechar</button>
        </>
      )}
    >
      <div className="muted" style={{ marginBottom: 12 }}>
        {periodoLabel}{filtrosLabel ? ` · ${filtrosLabel}` : ''}
      </div>

      {dados.porMes.map((m) => (
        <div key={m.key} style={{ marginBottom: 18 }}>
          <h4 className="card-title" style={{ marginBottom: 6 }}>
            {m.label}
            <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> — Total {brl(m.grand)}</span>
          </h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tag \ Categoria</th>
                  {dados.colsList.map((cat) => <th key={cat} className="num">{cat}</th>)}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {dados.tagsList.map((tg) => {
                  const linhaTotal = dados.colsList.reduce((s, cat) => s + (m.cell[`${tg}|||${cat}`] || 0), 0);
                  return (
                    <tr key={tg}>
                      <td>{tg}</td>
                      {dados.colsList.map((cat) => (
                        <td key={cat} className="num">{brl(m.cell[`${tg}|||${cat}`] || 0)}</td>
                      ))}
                      <td className="num"><strong>{brl(linhaTotal)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Subtotal</strong></td>
                  {dados.colsList.map((cat) => (
                    <td key={cat} className="num"><strong>{brl(m.colTotais[cat] || 0)}</strong></td>
                  ))}
                  <td className="num"><strong>{brl(m.grand)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
      {dados.porMes.length === 0 && <div className="empty">Sem meses no período.</div>}
    </Modal>
  );
}
