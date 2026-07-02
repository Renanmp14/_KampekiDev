import React, { useEffect, useState } from 'react';
import { getCellUsage } from '../api/resources.js';

// Traffic-light: verde até 60%, laranja de 60% a 90%, vermelho a partir de 90%.
function corFor(pct) {
  if (pct >= 90) return '#c0392b'; // vermelho
  if (pct >= 60) return '#e8912a'; // laranja
  return '#4caf7d'; // verde
}

const fmtInt = (n) => Number(n || 0).toLocaleString('pt-BR');

/**
 * Barra de progresso informativa do uso de células da planilha (Google Sheets),
 * contra o limite de 10 milhões. Não bloqueia nada — só informa. Usada no canto
 * superior esquerdo do lançamento de Custos.
 */
export default function CellUsageBar() {
  const [usage, setUsage] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    getCellUsage()
      .then((u) => { if (vivo) setUsage(u); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, []);

  if (erro) return null; // informativo: se falhar, apenas não aparece
  if (!usage) {
    return (
      <div className="cell-usage" style={{ maxWidth: 340 }}>
        <div className="cell-usage-head"><span className="muted">Uso da planilha…</span></div>
        <div className="cell-usage-track"><div className="cell-usage-fill" style={{ width: '0%' }} /></div>
      </div>
    );
  }

  const { used, limit } = usage;
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  const pctClamp = Math.min(100, pct);
  const cor = corFor(pct);

  return (
    <div
      className="cell-usage"
      style={{ maxWidth: 340 }}
      title={`${fmtInt(used)} de ${fmtInt(limit)} células usadas (${pct.toFixed(1)}%)`}
    >
      <div className="cell-usage-head">
        <span className="muted">Uso da planilha (células)</span>
        <strong style={{ color: cor }}>{pct.toFixed(1)}%</strong>
      </div>
      <div className="cell-usage-track">
        <div
          className="cell-usage-fill"
          style={{ width: `${pctClamp}%`, background: cor }}
        />
      </div>
      <div className="cell-usage-sub muted">
        {fmtInt(used)} / {fmtInt(limit)} · limite do Google Sheets
      </div>
    </div>
  );
}
