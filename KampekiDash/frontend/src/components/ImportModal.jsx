import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from './Modal.jsx';

// Lê a primeira aba do arquivo como matriz (array de arrays), incluindo cabeçalho.
async function lerArquivo(file) {
  const buf = await file.arrayBuffer();
  // cellDates: datas viram objetos Date (em vez de serial), simplificando o parse.
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

/**
 * ImportModal genérico.
 * Props:
 *  - title, hint
 *  - parse(aoa): { rows, previewCols, previewRows } — rows = payload a enviar
 *  - onImport(rows): Promise<resultado>
 *  - renderResult(resultado): JSX
 *  - onClose, onDone
 *  - chunkSize (opcional) — envia em lotes se o arquivo for muito grande
 *  - templateColumns (opcional) — cabeçalhos do modelo p/ download (.xlsx)
 *  - templateName (opcional) — nome do arquivo de modelo
 *  - renderExtra({ parsed, extra, setExtra, setExtraValid }) (opcional) — etapa
 *    extra entre a prévia e o botão de importar; o objeto `extra` é mesclado no
 *    corpo enviado via onImport(rows, extra). Bloqueia o botão se inválida.
 */
export default function ImportModal({
  title, hint, parse, onImport, renderResult, onClose, onDone, chunkSize = 0,
  templateColumns, templateName, renderExtra,
}) {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { rows, previewCols, previewRows }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [extra, setExtra] = useState({});      // payload adicional (ex.: fallbackMesAno)
  const [extraValid, setExtraValid] = useState(true);

  async function onFile(e) {
    setError('');
    setResult(null);
    setParsed(null);
    setExtra({});
    setExtraValid(true);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const aoa = await lerArquivo(file);
      const p = parse(aoa);
      if (!p.rows.length) {
        setError('Nenhuma linha de dados encontrada no arquivo.');
        return;
      }
      setParsed(p);
    } catch (err) {
      setError(`Falha ao ler o arquivo: ${err.message}`);
    }
  }

  // Mescla resultados de vários lotes em um só resumo.
  function mesclar(a, b) {
    const out = { ...a };
    for (const k of ['recebidos', 'importados', 'duplicados', 'vazios', 'erros', 'novosFornecedores', 'novosItens', 'datasAtribuidas']) {
      if (typeof b[k] === 'number') out[k] = (out[k] || 0) + b[k];
    }
    out.duplicadosLista = [...(a.duplicadosLista || []), ...(b.duplicadosLista || [])];
    out.errosLista = [...(a.errosLista || []), ...(b.errosLista || [])];
    out.dataFallback = b.dataFallback || a.dataFallback;
    return out;
  }

  function baixarModelo() {
    const cols = templateColumns || [];
    const ws = XLSX.utils.aoa_to_sheet([cols]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, templateName || 'modelo.xlsx');
  }

  async function importar() {
    setError('');
    setLoading(true);
    try {
      const { rows } = parsed;
      let res;
      if (chunkSize > 0 && rows.length > chunkSize) {
        res = null;
        for (let i = 0; i < rows.length; i += chunkSize) {
          // eslint-disable-next-line no-await-in-loop
          const parcial = await onImport(rows.slice(i, i + chunkSize), extra);
          res = res ? mesclar(res, parcial) : parcial;
        }
      } else {
        res = await onImport(rows, extra);
      }
      setResult(res);
      if (onDone) onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={result ? (
        <button className="btn" onClick={onClose}>Fechar</button>
      ) : (
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn" onClick={importar} disabled={!parsed || loading || !extraValid}>
            {loading ? 'Importando...' : `Importar ${parsed ? parsed.rows.length : ''} linhas`}
          </button>
        </>
      )}
    >
      {!result && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>{hint}</p>
          {templateColumns && templateColumns.length > 0 && (
            <p style={{ marginTop: 0, marginBottom: 14 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={baixarModelo}>
                ⬇ Baixar modelo
              </button>
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                Baixe o modelo, preencha os dados e importe o arquivo.
              </span>
            </p>
          )}
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Arquivo (.xlsx, .xls ou .csv)</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
          </div>

          {parsed && (
            <>
              <div className="kpi" style={{ marginBottom: 12 }}>
                <div className="kpi-label">Linhas detectadas em {fileName}</div>
                <div className="kpi-value">{parsed.rows.length}</div>
              </div>
              <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>Prévia (5 primeiras):</div>
              <div className="table-wrap" style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>{parsed.previewCols.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsed.previewRows.slice(0, 5).map((r, i) => (
                      <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ fontSize: 12 }}>
                Duplicados e linhas inválidas são tratados automaticamente no servidor.
              </p>
              {renderExtra && renderExtra({
                parsed, extra, setExtra, setExtraValid,
              })}
            </>
          )}
        </>
      )}

      {result && renderResult(result)}

      {error && <div className="error-msg">{error}</div>}
    </Modal>
  );
}
