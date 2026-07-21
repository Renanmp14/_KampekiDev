import React from 'react';
import { brl } from '../utils/format.js';
import { qtdFmt } from '../utils/notas.js';

/**
 * Faixa de KPIs das dialogs de notas (item único e filtro inteiro):
 * Notas · Subcategoria(s) · QTD · V. Unit médio · V. Total.
 *
 * `resumo` vem de utils/notas.js → resumoNotas(linhas).
 */
export default function ResumoNotas({ resumo, avisoUnidades = false }) {
  const { nNotas, nLancamentos, subcategorias, qtd, precoMedio, total } = resumo;

  // Uma subcategoria: mostra o nome. Várias: mostra quantas, com a lista no
  // tooltip (o "pode ser N aqui" do pedido — o nome de todas estouraria a faixa).
  const subLabel = subcategorias.length === 1 ? subcategorias[0] : String(subcategorias.length);
  const subSub = subcategorias.length === 1
    ? null
    : (subcategorias.length ? subcategorias.join(' · ') : 'nenhuma');

  return (
    <>
      <div className="resumo-notas">
        <div className="resumo-kpi">
          <div className="resumo-label">Notas</div>
          <div className="resumo-value">{nNotas}</div>
          <div className="resumo-sub">{nLancamentos} lançamento(s)</div>
        </div>
        <div className="resumo-kpi">
          <div className="resumo-label">Subcategoria{subcategorias.length === 1 ? '' : 's'}</div>
          <div className="resumo-value resumo-value-sm" title={subSub || undefined}>{subLabel}</div>
          {subSub && <div className="resumo-sub resumo-trunc" title={subSub}>{subSub}</div>}
        </div>
        <div className="resumo-kpi">
          <div className="resumo-label">Qtd</div>
          <div className="resumo-value">{qtdFmt(qtd)}</div>
        </div>
        <div className="resumo-kpi">
          <div className="resumo-label">V. Unit médio</div>
          <div className="resumo-value">{precoMedio === null ? '—' : brl(precoMedio)}</div>
          <div className="resumo-sub">ponderado</div>
        </div>
        <div className="resumo-kpi">
          <div className="resumo-label">V. Total</div>
          <div className="resumo-value">{brl(total)}</div>
        </div>
      </div>
      {avisoUnidades && (
        <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>
          ⚠️ Qtd e V. Unit médio somam itens de unidades diferentes (kg, un, cx) —
          leia como “por unidade pedida”.
        </div>
      )}
    </>
  );
}
