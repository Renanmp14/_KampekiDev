import React from 'react';

// "YYYY-MM" (month input) <-> chave interna (também YYYY-MM)
export default function PeriodFilter({ de, ate, onChange, children }) {
  return (
    <div className="toolbar">
      <div className="field" style={{ maxWidth: 170 }}>
        <label>De (mês/ano)</label>
        <input type="month" value={de} onChange={(e) => onChange({ de: e.target.value, ate })} />
      </div>
      <div className="field" style={{ maxWidth: 170 }}>
        <label>Até (mês/ano)</label>
        <input type="month" value={ate} onChange={(e) => onChange({ de, ate: e.target.value })} />
      </div>
      {(de || ate) && (
        <button className="btn btn-ghost" onClick={() => onChange({ de: '', ate: '' })}>Limpar</button>
      )}
      {children}
    </div>
  );
}
