import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import ResumoNotas from './ResumoNotas.jsx';
import { brl, pct } from '../utils/format.js';
import { normalizarLinhas, resumoNotas, agruparPorItem, qtdFmt } from '../utils/notas.js';
import { exportarNotasFiltro } from '../utils/exportPdf.js';

/**
 * Notas de TODOS os itens do recorte ativo (irmã da NotasItemModal, que cobre um
 * item só). A base (`custos`) chega JÁ FILTRADA pelo dashboard — período, mês e
 * drill —, então a dialog reflete exatamente o recorte da tela.
 *
 * A tabela é agrupada por item (maior total primeiro) e cada grupo expande para
 * os seus lançamentos: um recorte amplo pode ter milhares de linhas, e a lista
 * plana seria ilegível.
 */
export default function NotasFiltroModal({
  custos, periodoLabel = null, filtrosLabel = null, onClose,
}) {
  const linhas = useMemo(() => normalizarLinhas(custos), [custos]);
  const resumo = useMemo(() => resumoNotas(linhas), [linhas]);
  const grupos = useMemo(() => agruparPorItem(linhas), [linhas]);
  const [abertos, setAbertos] = useState(() => new Set());
  const [exportando, setExportando] = useState(false);

  function alternar(item) {
    setAbertos((prev) => {
      const s = new Set(prev);
      if (s.has(item)) s.delete(item); else s.add(item);
      return s;
    });
  }

  const todosAbertos = grupos.length > 0 && abertos.size === grupos.length;
  const alternarTodos = () => setAbertos(todosAbertos ? new Set() : new Set(grupos.map((g) => g.item)));

  function exportarPdf() {
    setExportando(true);
    try {
      // O PDF sai fiel à tela: detalha só os itens expandidos (regra das demais
      // dialogs — exportar exatamente o que está em vista).
      exportarNotasFiltro({
        periodoLabel, filtrosLabel, resumo, grupos, expandidos: [...abertos],
      });
    } finally {
      setExportando(false);
    }
  }

  return (
    <Modal
      title="Notas do recorte — todos os itens"
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
          {' · '}{grupos.length} item(ns)
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportarPdf} disabled={exportando || !linhas.length}>
          {exportando ? 'Gerando PDF...' : '⬇ Exportar PDF'}
        </button>
      </div>

      <ResumoNotas resumo={resumo} avisoUnidades={grupos.length > 1} />

      {grupos.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={alternarTodos}>
            {todosAbertos ? '▶ Recolher todos' : '▼ Expandir todos'}
          </button>
        </div>
      )}

      <div className="table-wrap" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Notas</th>
              <th className="num">Qtd</th>
              <th className="num">V. Unit médio</th>
              <th className="num">V. Total</th>
              <th className="num">% do total</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const aberto = abertos.has(g.item);
              const share = resumo.total > 0 ? (g.resumo.total / resumo.total) * 100 : 0;
              return (
                <React.Fragment key={g.item}>
                  <tr
                    className={`grp-row${aberto ? ' grp-row-open' : ''}`}
                    onClick={() => alternar(g.item)}
                    title={aberto ? 'Recolher lançamentos' : 'Ver lançamentos'}
                  >
                    <td><span className="grp-caret">{aberto ? '▼' : '▶'}</span> {g.item}</td>
                    <td className="num">{g.resumo.nNotas}</td>
                    <td className="num">{qtdFmt(g.resumo.qtd)}</td>
                    <td className="num">{g.resumo.precoMedio === null ? '—' : brl(g.resumo.precoMedio)}</td>
                    <td className="num">{brl(g.resumo.total)}</td>
                    <td className="num">{pct(share)}</td>
                  </tr>
                  {aberto && (
                    <tr className="grp-detalhe">
                      <td colSpan={6}>
                        <table className="grp-inner">
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
                            {g.linhas.map((l, i) => (
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
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {grupos.length === 0 && (
              <tr><td colSpan={6} className="empty">Nenhum lançamento no recorte atual.</td></tr>
            )}
          </tbody>
          {/* "Notas" do TOTAL é a contagem DISTINTA do recorte, não a soma da
              coluna: uma nota que traz 3 itens conta 1 aqui e 1 em cada item. */}
          {grupos.length > 0 && (
            <tfoot>
              <tr>
                <td><strong>TOTAL</strong></td>
                <td className="num"><strong>{resumo.nNotas}</strong></td>
                <td className="num"><strong>{qtdFmt(resumo.qtd)}</strong></td>
                <td className="num"><strong>{resumo.precoMedio === null ? '—' : brl(resumo.precoMedio)}</strong></td>
                <td className="num"><strong>{brl(resumo.total)}</strong></td>
                <td className="num"><strong>{pct(resumo.total > 0 ? 100 : 0)}</strong></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Modal>
  );
}
