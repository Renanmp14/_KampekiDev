import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { brl, pct } from '../utils/format.js';
import { comparar } from '../utils/agg.js';
import { linhasDoItem, somaLinhas, qtdFmt } from '../utils/notas.js';
import {
  NIVEIS, KEY_FN, LABEL_COL, valCusto as val, aplicarCaminho,
} from '../utils/drillPeriodo.js';
import { exportarDrillPeriodo } from '../utils/exportPdf.js';

function TabelaNotas({ linhas }) {
  const total = somaLinhas(linhas);
  if (!linhas.length) return <div className="empty">Sem lançamentos neste período.</div>;
  return (
    <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
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
        <tfoot>
          <tr>
            <td colSpan={6}><strong>TOTAL</strong></td>
            <td className="num"><strong>{brl(total)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Dialog de detalhe da Análise por Período (aba Custos).
 *
 * Desce de nível a cada clique — Grupo/Categoria → Subcategoria → Item → Notas —
 * mantendo um breadcrumb para voltar. As bases `rowsA`/`rowsB` chegam prontas do
 * dashboard (períodos A e B + filtros da tela), então todo nível respeita o que
 * foi definido nos Períodos A e B.
 */
export default function DrillPeriodoModal({
  inicial, rowsA, rowsB, periodoALabel, periodoBLabel, filtrosLabel = null, onClose,
}) {
  const [stack, setStack] = useState([inicial]);
  const [exportando, setExportando] = useState(false);
  const atual = stack[stack.length - 1];
  const proximo = NIVEIS[atual.tipo].proximo;

  // Aplica o caminho inteiro (todos os níveis) às duas bases.
  const [a, b] = useMemo(
    () => [aplicarCaminho(rowsA, stack), aplicarCaminho(rowsB, stack)],
    [stack, rowsA, rowsB],
  );

  const totalA = useMemo(() => a.reduce((s, r) => s + val(r), 0), [a]);
  const totalB = useMemo(() => b.reduce((s, r) => s + val(r), 0), [b]);
  const delta = totalB - totalA;
  const deltaPct = totalA > 0 ? (delta / totalA) * 100 : null;

  const rows = useMemo(
    () => (proximo ? comparar(a, b, KEY_FN[proximo], val) : []),
    [a, b, proximo],
  );
  const notasA = useMemo(() => (proximo ? [] : linhasDoItem(a, atual.valor)), [a, proximo, atual]);
  const notasB = useMemo(() => (proximo ? [] : linhasDoItem(b, atual.valor)), [b, proximo, atual]);

  const titulo = NIVEIS[atual.tipo].titulo(atual.valor);
  const caminho = stack.map((s) => s.valor).join(' › ');

  function exportarPdf() {
    setExportando(true);
    try {
      exportarDrillPeriodo({
        titulo,
        caminho,
        periodoALabel,
        periodoBLabel,
        filtrosLabel,
        totalA,
        totalB,
        labelCol: proximo ? LABEL_COL[proximo] : 'Item',
        rows: proximo ? rows : null,
        notasA: proximo ? null : notasA,
        notasB: proximo ? null : notasB,
      });
    } finally {
      setExportando(false);
    }
  }

  return (
    <Modal
      title={titulo}
      onClose={onClose}
      className="modal-lg"
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      {/* Voltar um nível (explícito) + breadcrumb para pular direto a qualquer
          nível do caminho. No primeiro nível não há para onde voltar: só fechar. */}
      <div className="drill-crumbs">
        {stack.length > 1 && (
          <button className="btn btn-sm btn-ghost drill-voltar" onClick={() => setStack(stack.slice(0, -1))}>
            ← Voltar
          </button>
        )}
        {stack.map((s, i) => (
          <React.Fragment key={`${s.tipo}:${s.valor}`}>
            {i > 0 && <span className="sep">›</span>}
            <button
              className="crumb"
              onClick={() => setStack(stack.slice(0, i + 1))}
              disabled={i === stack.length - 1}
              title={i === stack.length - 1 ? undefined : `Voltar para ${s.valor}`}
            >
              {s.valor}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div
        className="row-actions"
        style={{
          justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12,
        }}
      >
        <div className="muted" style={{ fontSize: 12 }}>
          <div>
            <strong>A:</strong> {brl(totalA)} · <strong>B:</strong> {brl(totalB)} ·{' '}
            <span className={delta >= 0 ? 'up' : 'down'}>
              {delta >= 0 ? '+' : ''}{brl(delta)}
              {deltaPct !== null && <> ({delta >= 0 ? '+' : ''}{pct(deltaPct)})</>}
            </span>
          </div>
          <div style={{ fontSize: 11, marginTop: 2 }}>
            A: {periodoALabel || 'Todo o histórico'} · B: {periodoBLabel || 'Todo o histórico'}
            {filtrosLabel && <> · {filtrosLabel}</>}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportarPdf} disabled={exportando}>
          {exportando ? 'Gerando PDF...' : '⬇ Exportar PDF'}
        </button>
      </div>

      {proximo ? (
        <>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {rows.length} {LABEL_COL[proximo].toLowerCase()}(s) · clique numa linha para detalhar
          </div>
          <div className="table-wrap" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{LABEL_COL[proximo]}</th>
                  <th className="num">Período A</th>
                  <th className="num">Período B</th>
                  <th className="num">Δ Absoluto</th>
                  <th className="num">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setStack([...stack, { tipo: proximo, valor: r.key }])}
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
                {rows.length === 0 && <tr><td colSpan={5} className="empty">Sem dados nos períodos.</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>TOTAL</strong></td>
                  <td className="num"><strong>{brl(totalA)}</strong></td>
                  <td className="num"><strong>{brl(totalB)}</strong></td>
                  <td className={`num ${delta >= 0 ? 'up' : 'down'}`}>
                    <strong>{delta >= 0 ? '+' : ''}{brl(delta)}</strong>
                  </td>
                  <td className="num">
                    {deltaPct === null ? '—' : (
                      <strong className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '+' : ''}{pct(deltaPct)}</strong>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <>
          <h4 className="card-title" style={{ fontSize: 13 }}>
            Período A <span className="muted" style={{ fontWeight: 400 }}>— {periodoALabel || 'Todo o histórico'} · {notasA.length} lançamento(s)</span>
          </h4>
          <TabelaNotas linhas={notasA} />
          <h4 className="card-title" style={{ fontSize: 13, marginTop: 16 }}>
            Período B <span className="muted" style={{ fontWeight: 400 }}>— {periodoBLabel || 'Todo o histórico'} · {notasB.length} lançamento(s)</span>
          </h4>
          <TabelaNotas linhas={notasB} />
        </>
      )}
    </Modal>
  );
}
