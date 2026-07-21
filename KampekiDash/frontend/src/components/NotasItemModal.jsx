import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { brl } from '../utils/format.js';
import { linhasDoItem, somaLinhas, qtdFmt, resumoNotas } from '../utils/notas.js';
import { exportarNotasItem } from '../utils/exportPdf.js';
import ResumoNotas from './ResumoNotas.jsx';

/**
 * Notas em que um item aparece. A base (`custos`) chega JÁ FILTRADA pelo
 * dashboard — período, mês e drill-down —, então a dialog reflete exatamente o
 * recorte da tela que a abriu.
 *
 * Lista só as linhas do próprio item (os outros itens da mesma nota não entram),
 * por isso o total é o do ITEM no recorte, não o total das notas.
 */
export default function NotasItemModal({
  item, custos, periodoLabel = null, filtrosLabel = null, onClose,
}) {
  const linhas = useMemo(() => linhasDoItem(custos, item), [custos, item]);
  const total = useMemo(() => somaLinhas(linhas), [linhas]);
  const resumo = useMemo(() => resumoNotas(linhas), [linhas]);
  const [exportando, setExportando] = useState(false);

  function exportarPdf() {
    setExportando(true);
    try {
      exportarNotasItem({
        item, periodoLabel, filtrosLabel, linhas, total, resumo,
      });
    } finally {
      setExportando(false);
    }
  }

  return (
    <Modal
      title={`Notas do item — ${item}`}
      onClose={onClose}
      className="modal-lg"
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <div
        className="row-actions"
        style={{
          justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12,
        }}
      >
        <div className="muted" style={{ fontSize: 11 }}>
          Período: {periodoLabel || 'Todo o período'}
          {filtrosLabel && <> · {filtrosLabel}</>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportarPdf} disabled={exportando || !linhas.length}>
          {exportando ? 'Gerando PDF...' : '⬇ Exportar PDF'}
        </button>
      </div>

      <ResumoNotas resumo={resumo} />

      <div className="table-wrap" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Nº Nota</th>
              <th>Fornecedor</th>
              <th>Subcategoria</th>
              <th className="num">Qtd</th>
              <th className="num">V. Unit</th>
              <th className="num">V. Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l.uuid || i}>
                <td>{l.data}</td>
                {/* A chave NF-e (44+ díg.) estouraria a coluna: fica no tooltip. */}
                <td title={l.chave ? `Chave NF-e: ${l.chave}` : undefined}>
                  {l.numNota}{l.chave && <span className="muted"> 🔑</span>}
                </td>
                <td>{l.fornecedor}</td>
                <td>{l.subcategoria}</td>
                <td className="num">{qtdFmt(l.qtd)}</td>
                <td className="num">{brl(l.valorUnit)}</td>
                <td className="num">{brl(l.valorTotal)}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr><td colSpan={7} className="empty">Nenhum lançamento deste item no recorte atual.</td></tr>
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={6}><strong>TOTAL</strong></td>
                <td className="num"><strong>{brl(total)}</strong></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Modal>
  );
}
