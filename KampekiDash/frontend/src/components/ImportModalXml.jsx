import React, { useState } from 'react';
import JSZip from 'jszip';
import Modal from './Modal.jsx';
import { parseNfeXml } from '../utils/importParse.js';

/**
 * Importação de Custos a partir de um .zip de NF-e (modelo 55).
 * Descompacta no navegador (JSZip), lê cada XML (DOMParser nativo via
 * parseNfeXml) e envia as notas normalizadas ao backend, que aplica toda a
 * inteligência (dedup por chave, criar fornecedor/item, classificação).
 *
 * Props:
 *  - onImport(notas): Promise<resultado>
 *  - renderResult(resultado): JSX
 *  - onClose, onDone
 */
export default function ImportModalXml({ onImport, renderResult, onClose, onDone }) {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { notas, totalItens, ignorados }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onFile(e) {
    setError('');
    setResult(null);
    setParsed(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const xmls = Object.values(zip.files).filter(
        (f) => !f.dir && /\.xml$/i.test(f.name),
      );
      if (!xmls.length) {
        setError('Nenhum arquivo .xml encontrado no .zip.');
        return;
      }
      const notas = [];
      let ignorados = 0;
      let totalItens = 0;
      for (const f of xmls) {
        // eslint-disable-next-line no-await-in-loop
        const nota = parseNfeXml(await f.async('string'));
        if (!nota || !nota.itens.length) { ignorados += 1; continue; }
        totalItens += nota.itens.length;
        notas.push(nota);
      }
      if (!notas.length) {
        setError('Nenhuma NF-e válida encontrada no .zip.');
        return;
      }
      setParsed({ notas, totalItens, ignorados });
    } catch (err) {
      setError(`Falha ao ler o .zip: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Prévia: as 5 primeiras linhas (nota × item).
  const preview = [];
  if (parsed) {
    for (const n of parsed.notas) {
      for (const it of n.itens) {
        if (preview.length >= 5) break;
        preview.push([n.DATA_NOTA, n.NUM_NOTA, n.FORNECEDOR, it.ITEM, it.QTD, it.VALOR_UNIT]);
      }
      if (preview.length >= 5) break;
    }
  }

  async function importar() {
    setError('');
    setLoading(true);
    try {
      const res = await onImport(parsed.notas);
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
      title="Importar NF-e (.zip)"
      onClose={onClose}
      footer={result ? (
        <button className="btn" onClick={onClose}>Fechar</button>
      ) : (
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn" onClick={importar} disabled={!parsed || loading}>
            {loading ? 'Importando...' : `Importar ${parsed ? parsed.notas.length : ''} notas`}
          </button>
        </>
      )}
    >
      {!result && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Selecione o .zip de NF-e baixado do portal. Cada XML é interpretado e
            cada item da nota vira um lançamento de Custo. Notas já importadas (mesma
            chave de acesso) são ignoradas. Itens sem cadastro entram para classificar
            depois (ícone ⚠ na tela de Custos).
          </p>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Arquivo (.zip)</label>
            <input type="file" accept=".zip" onChange={onFile} />
          </div>

          {parsed && (
            <>
              <div className="kpi" style={{ marginBottom: 12 }}>
                <div className="kpi-label">Notas em {fileName}</div>
                <div className="kpi-value">{parsed.notas.length}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {parsed.totalItens} itens
                  {parsed.ignorados > 0 ? ` · ${parsed.ignorados} arquivo(s) ignorado(s)` : ''}
                </div>
              </div>
              <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>Prévia (5 primeiros itens):</div>
              <div className="table-wrap" style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      {['Data', 'Nº Nota', 'Fornecedor', 'Item', 'Qtd', 'V.Unit'].map((c) => <th key={c}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>{r.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {result && renderResult(result)}

      {error && <div className="error-msg">{error}</div>}
    </Modal>
  );
}
