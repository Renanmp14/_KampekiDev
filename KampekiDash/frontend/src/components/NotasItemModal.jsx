import React, { useMemo } from 'react';
import Modal from './Modal.jsx';
import { brl, toNum } from '../utils/format.js';

// Identidade de uma nota: chave NF-e quando existe; senão fornecedor + nº + data.
function noteKey(r) {
  const chave = String(r.CHAVE_NFE || '').trim();
  if (chave) return `chave:${chave}`;
  return `${String(r.FORNECEDOR || '').trim()}|${String(r.NUM_NOTA || '').trim()}|${String(r.DATA_NOTA || '').trim()}`;
}

// Ordena por DATA_NOTA (DD/MM/YYYY) desc.
function dataOrdenavel(d) {
  const m = String(d).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

const qtdFmt = (v) => toNum(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/**
 * Modal que lista todas as notas (custos) em que um item aparece, com os dados de
 * cada nota (data, nº, fornecedor, total) e todos os itens daquela nota.
 */
export default function NotasItemModal({ item, custos, onClose }) {
  const notas = useMemo(() => {
    // Agrupa TODOS os custos por nota (uma passada), depois pega só as notas que
    // contêm o item selecionado.
    const byKey = new Map();
    const keysComItem = new Set();
    for (const r of custos) {
      const k = noteKey(r);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(r);
      if (r.ITEM === item) keysComItem.add(k);
    }
    return [...keysComItem].map((k) => {
      const linhas = byKey.get(k) || [];
      const ref = linhas[0] || {};
      const total = linhas.reduce((s, r) => s + toNum(r.VALOR_TOTAL), 0);
      return {
        key: k,
        data: ref.DATA_NOTA || '—',
        numNota: ref.NUM_NOTA || '—',
        fornecedor: ref.FORNECEDOR || '—',
        chave: String(ref.CHAVE_NFE || '').trim(),
        linhas,
        total,
      };
    }).sort((a, b) => dataOrdenavel(b.data).localeCompare(dataOrdenavel(a.data)));
  }, [item, custos]);

  return (
    <Modal
      title={`Notas do item — ${item}`}
      onClose={onClose}
      className="modal-lg"
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <div className="muted" style={{ marginBottom: 12 }}>
        {notas.length} nota(s) contêm este item.
      </div>

      {notas.map((n) => (
        <div key={n.key} className="card" style={{ marginBottom: 12 }}>
          <div
            className="row-actions"
            style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}
          >
            <div>
              <strong>{n.data}</strong> · Nº {n.numNota} · {n.fornecedor}
              {n.chave && (
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Chave NF-e: {n.chave}</div>
              )}
            </div>
            <div style={{ whiteSpace: 'nowrap' }}>
              <span className="muted">Total da nota: </span>
              <strong>{brl(n.total)}</strong>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Subcategoria</th>
                  <th className="num">Qtd</th>
                  <th className="num">V. Unit</th>
                  <th className="num">V. Total</th>
                </tr>
              </thead>
              <tbody>
                {n.linhas.map((r, i) => (
                  <tr key={r.UUID || i} className={r.ITEM === item ? 'selected-row' : ''}>
                    <td>{r.ITEM}</td>
                    <td>{r.SUB_CATEGORIA || '—'}</td>
                    <td className="num">{qtdFmt(r.QTD)}</td>
                    <td className="num">{brl(r.VALOR_UNIT)}</td>
                    <td className="num">{brl(r.VALOR_TOTAL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {notas.length === 0 && <div className="empty">Nenhuma nota encontrada para este item.</div>}
    </Modal>
  );
}
