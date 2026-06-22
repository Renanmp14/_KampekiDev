import React from 'react';

// Renderiza o resumo retornado por uma importação em lote.
export default function ImportResult({ result }) {
  const {
    recebidos = 0, importados = 0, duplicados = 0, vazios = 0, erros = 0,
    datasAtribuidas = 0, dataFallback = null,
    duplicadosLista = [], errosLista = [],
    novosFornecedores, novosItens,
    // Específicos da importação de NF-e (.zip):
    notasProcessadas, notasPuladas, aClassificar,
  } = result;

  const isXml = notasPuladas != null || aClassificar != null;

  return (
    <div>
      <div className="grid grid-2" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="kpi-label">Importados</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>{importados}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{isXml ? 'Notas já importadas (puladas)' : 'Duplicados (ignorados)'}</div>
          <div className="kpi-value">{isXml ? (notasPuladas || 0) : duplicados}</div>
        </div>
      </div>

      <div className="modal-summary">
        <div><span className="muted">{isXml ? 'Notas recebidas' : 'Linhas recebidas'}</span><span>{recebidos}</span></div>
        {isXml && notasProcessadas != null && <div><span className="muted">Notas processadas</span><span>{notasProcessadas}</span></div>}
        <div><span className="muted">{isXml ? 'Itens importados' : 'Importados'}</span><span>{importados}</span></div>
        {isXml
          ? (notasPuladas > 0 && <div><span className="muted">Notas puladas (já importadas)</span><span>{notasPuladas}</span></div>)
          : <div><span className="muted">Duplicados ignorados</span><span>{duplicados}</span></div>}
        {vazios > 0 && <div><span className="muted">Linhas vazias</span><span>{vazios}</span></div>}
        {datasAtribuidas > 0 && (
          <div>
            <span className="muted">Datas atribuídas (sem data)</span>
            <span>{datasAtribuidas}{dataFallback ? ` → ${dataFallback}` : ''}</span>
          </div>
        )}
        {novosFornecedores != null && <div><span className="muted">Fornecedores criados</span><span>{novosFornecedores}</span></div>}
        {novosItens != null && <div><span className="muted">Itens criados</span><span>{novosItens}</span></div>}
        {aClassificar > 0 && <div><span className="down">Itens a classificar</span><span className="down">{aClassificar}</span></div>}
        {erros > 0 && <div><span className="up">Com erro (não importados)</span><span className="up">{erros}</span></div>}
      </div>

      {aClassificar > 0 && (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          ⚠ {aClassificar} item(ns) entraram sem categoria/subcategoria. Use o aviso na tela de Custos para classificá-los.
        </p>
      )}

      {duplicadosLista.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="muted">Ver duplicados ({duplicadosLista.length}{duplicados > duplicadosLista.length ? '+' : ''})</summary>
          <ul style={{ maxHeight: 140, overflowY: 'auto', fontSize: 13 }}>
            {duplicadosLista.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </details>
      )}

      {errosLista.length > 0 && (
        <details style={{ marginTop: 10 }} open>
          <summary className="up">Ver não importados ({errosLista.length}{erros > errosLista.length ? '+' : ''})</summary>
          <ul style={{ maxHeight: 260, overflowY: 'auto', fontSize: 13 }}>
            {errosLista.map((e, i) => (
              <li key={i}>
                {e.linha != null ? `Linha ${e.linha}` : e.nota}
                {e.item ? `: ${e.item}` : ''} — {e.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
