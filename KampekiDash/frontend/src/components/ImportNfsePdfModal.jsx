import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import ImportResult from './ImportResult.jsx';
import { custosApi } from '../api/resources.js';
import { parseNfsePdf } from '../utils/parseNfsePdf.js';
import { brl, toNum } from '../utils/format.js';

const norm = (s) => String(s || '').trim().toUpperCase();
const isoToBr = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const brToIso = (br) => { const m = String(br || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

let seq = 0;
const nextId = () => { seq += 1; return `nfse_${seq}`; };

/**
 * Importa VÁRIOS Custos a partir de NFS-e de serviço (PDF, DANFSe v1.0).
 * A cliente escolhe um ou vários PDFs de uma vez; cada um é lido no navegador
 * (pdfjs-dist) e vira uma linha na tela de conferência. Ela pode importar todas
 * de uma vez (aceitar os prévios) ou expandir cada linha e ajustar item a item
 * antes de confirmar. O backend (importarNfseLote) aplica dedup por chave, cria
 * fornecedor/item e grava tudo numa passada (QTD = 1 por nota).
 *
 * Props: onClose, onDone (recarrega a página), fornecedores, itens, custos.
 */
export default function ImportNfsePdfModal({
  onClose, onDone, fornecedores = [], itens = [], custos = [],
}) {
  const [fase, setFase] = useState('upload'); // upload | conferencia | ok
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [notas, setNotas] = useState([]); // [{ id, arquivo, chaveNfse, numNota, dataNota, fornecedor, item, valor, avisos }]
  const [expandido, setExpandido] = useState(null); // id da linha aberta
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState(null);

  // URLs de blob dos PDFs (para "abrir em outra aba"); revogadas ao fechar o modal.
  const urlsRef = useRef([]);
  useEffect(() => () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  async function onFiles(e) {
    const arquivos = Array.from(e.target.files || []).filter((f) => /\.pdf$/i.test(f.name));
    if (!arquivos.length) { setError('Selecione um ou mais arquivos PDF.'); return; }
    setError('');
    setLoading(true);
    setProgresso({ atual: 0, total: arquivos.length });
    const lidas = [];
    const falhas = [];
    for (let i = 0; i < arquivos.length; i += 1) {
      const file = arquivos[i];
      setProgresso({ atual: i + 1, total: arquivos.length });
      try {
        // eslint-disable-next-line no-await-in-loop
        const d = await parseNfsePdf(file);
        const url = URL.createObjectURL(file);
        urlsRef.current.push(url);
        lidas.push({
          id: nextId(),
          arquivo: file.name,
          url,
          chaveNfse: d.chaveNfse || '',
          numNota: d.numNota || '',
          dataNota: d.dataNota || '',
          fornecedor: d.fornecedor || '',
          item: d.item || '',
          valor: d.valor != null ? String(d.valor) : '',
          avisos: d.avisos || [],
        });
      } catch (err) {
        falhas.push(`${file.name}: ${err.message}`);
      }
    }
    setLoading(false);
    if (!lidas.length) {
      setError(`Nenhum PDF pôde ser lido.${falhas.length ? ` (${falhas.join('; ')})` : ''}`);
      return;
    }
    if (falhas.length) setError(`${falhas.length} arquivo(s) não puderam ser lidos: ${falhas.join('; ')}`);
    setNotas(lidas);
    setFase('conferencia');
  }

  const set = (id, campo, v) => setNotas((ns) => ns.map((n) => (n.id === id ? { ...n, [campo]: v } : n)));
  const remover = (id) => setNotas((ns) => ns.filter((n) => n.id !== id));

  // Índices para casar fornecedor/item/chave existentes (uma vez).
  const fornSet = useMemo(() => new Set(fornecedores.map((f) => norm(f.NOME_FORNECEDOR))), [fornecedores]);
  const itemMap = useMemo(() => new Map(itens.map((i) => [norm(i.DESCRICAO_ITEM), i])), [itens]);
  const custoByChave = useMemo(() => {
    const m = new Map();
    custos.forEach((c) => { const k = String(c.CHAVE_NFE || '').trim(); if (k && !m.has(k)) m.set(k, c); });
    return m;
  }, [custos]);

  // Deriva status de cada linha (dup, fornecedor novo, item, validade).
  const linhas = useMemo(() => {
    const vistas = new Set(); // chaves já vistas dentro do próprio lote
    return notas.map((n) => {
      const chave = String(n.chaveNfse || '').trim();
      const jaImportada = chave ? custoByChave.get(chave) || null : null;
      const dupNoLote = chave && vistas.has(chave);
      if (chave) vistas.add(chave);

      const valorNum = toNum(n.valor);
      const it = itemMap.get(norm(n.item));
      let itemInfo;
      if (!n.item.trim()) itemInfo = { status: 'novo', label: '—' };
      else if (!it) itemInfo = { status: 'novo', label: 'novo — a classificar' };
      else if (!String(it.SUB_CATEGORIA || '').trim() || !String(it.CATEGORIA || '').trim()) {
        itemInfo = { status: 'aClassificar', label: 'a classificar' };
      } else itemInfo = { status: 'classificado', label: `${it.CATEGORIA}${it.TAG ? ` · ${it.TAG}` : ''}` };

      let erroMsg = '';
      if (!n.dataNota || !brToIso(n.dataNota)) erroMsg = 'Data inválida';
      else if (!n.item.trim()) erroMsg = 'Sem item';
      else if (!(valorNum > 0)) erroMsg = 'Valor inválido';

      const dup = !!jaImportada || dupNoLote;
      return {
        ...n, jaImportada, dupNoLote, dup, valorNum,
        fornecedorNovo: !!n.fornecedor.trim() && !fornSet.has(norm(n.fornecedor)),
        itemInfo, erroMsg,
        valida: !dup && !erroMsg,
      };
    });
  }, [notas, custoByChave, itemMap, fornSet]);

  const validas = linhas.filter((l) => l.valida).length;
  const duplicadas = linhas.filter((l) => l.dup).length;
  const comErro = linhas.filter((l) => !l.dup && l.erroMsg).length;

  async function importarTodas() {
    if (!validas) { setError('Nenhuma nota válida para importar.'); return; }
    setError('');
    setSaving(true);
    try {
      // Envia todas as linhas (o backend pula as duplicadas e reporta as com erro).
      const payload = notas.map((n) => ({
        chaveNfse: String(n.chaveNfse || '').trim(),
        numNota: String(n.numNota || '').trim(),
        dataNota: String(n.dataNota || '').trim(),
        fornecedor: String(n.fornecedor || '').trim(),
        item: String(n.item || '').trim(),
        valor: toNum(n.valor),
      }));
      const r = await custosApi.importarNfseLote(payload);
      setResultado(r);
      setFase('ok');
      if (onDone) onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Resultado ---
  if (fase === 'ok' && resultado) {
    return (
      <Modal className="modal-lg" title="NFS-e importadas" onClose={onClose} footer={<button className="btn" onClick={onClose}>Fechar</button>}>
        <ImportResult result={resultado} />
      </Modal>
    );
  }

  return (
    <Modal
      className="modal-lg"
      title="Importar NFS-e (PDF)"
      onClose={onClose}
      footer={fase === 'conferencia' ? (
        <>
          <span className="muted" style={{ marginRight: 'auto', fontSize: 13 }}>
            {validas} de {linhas.length} válida(s)
            {duplicadas > 0 ? ` · ${duplicadas} já importada(s)` : ''}
            {comErro > 0 ? ` · ${comErro} com erro` : ''}
          </span>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" onClick={importarTodas} disabled={saving || !validas}>
            {saving ? 'Importando...' : `Importar todas (${validas})`}
          </button>
        </>
      ) : (
        <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
      )}
    >
      {fase === 'upload' && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Selecione <b>um ou vários</b> PDFs de NFS-e de serviço (DANFSe v1.0, texto selecionável).
            Cada PDF vira <b>um</b> lançamento de Custo (QTD = 1). Você poderá conferir/ajustar antes de salvar.
          </p>
          <input type="file" accept="application/pdf,.pdf" multiple onChange={onFiles} disabled={loading} />
          {loading && (
            <p className="muted" style={{ marginTop: 10 }}>
              Lendo PDF {progresso.atual} de {progresso.total}...
            </p>
          )}
          {error && <div className="error-msg" style={{ marginTop: 10 }}>{error}</div>}
        </>
      )}

      {fase === 'conferencia' && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Confira as {linhas.length} nota(s). Clique numa linha para <b>expandir e ajustar</b>, ou use
            <b> Importar todas</b> para aceitar os prévios. Notas já importadas são puladas automaticamente.
          </p>
          {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="table-wrap nfse-conf">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 24 }} />
                  <th>Data</th>
                  <th>Nº</th>
                  <th>Fornecedor</th>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th>Situação</th>
                  <th>Arquivo</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const aberta = expandido === l.id;
                  const cor = l.dup ? 'var(--down, #c9a227)' : l.erroMsg ? 'var(--up, #e06666)' : 'var(--muted)';
                  const situacao = l.dup
                    ? (l.jaImportada ? '⛔ já importada' : '⛔ repetida no lote')
                    : l.erroMsg ? `⚠ ${l.erroMsg}` : '✓ pronta';
                  return (
                    <React.Fragment key={l.id}>
                      <tr
                        onClick={() => setExpandido(aberta ? null : l.id)}
                        style={{ cursor: 'pointer', opacity: l.dup ? 0.6 : 1 }}
                      >
                        <td>{aberta ? '▾' : '▸'}</td>
                        <td>{l.dataNota || '—'}</td>
                        <td>{l.numNota || '—'}</td>
                        <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.fornecedor || '—'}{l.fornecedorNovo ? ' ➕' : ''}
                        </td>
                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.item || '—'}
                          {l.itemInfo.status !== 'classificado' && l.item ? ` · ${l.itemInfo.label}` : ''}
                        </td>
                        <td style={{ textAlign: 'right' }}>{brl(l.valorNum)}</td>
                        <td style={{ color: cor, fontSize: 12, whiteSpace: 'nowrap' }}>{situacao}</td>
                        <td style={{ maxWidth: 110 }}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            title={`Abrir ${l.arquivo} em outra aba`}
                            onClick={(ev) => ev.stopPropagation()}
                            style={{ display: 'inline-block', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}
                          >
                            📄 {l.arquivo}
                          </a>
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '2px 8px' }}
                            title="Remover da lista"
                            onClick={(ev) => { ev.stopPropagation(); remover(l.id); if (aberta) setExpandido(null); }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                      {aberta && (
                        <tr>
                          <td colSpan={9} style={{ background: 'var(--bg-2, #1b1f29)' }}>
                            <div style={{ padding: '10px 6px' }}>
                              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
                                Arquivo: <a href={l.url} target="_blank" rel="noreferrer">📄 {l.arquivo} (abrir em outra aba)</a>
                              </p>
                              {l.jaImportada && (
                                <div className="error-msg" style={{ marginBottom: 10 }}>
                                  Já importada (nota {l.jaImportada.NUM_NOTA || '—'}, {l.jaImportada.DATA_NOTA || '—'}) — será pulada.
                                </div>
                              )}
                              {l.avisos.length > 0 && (
                                <div className="card" style={{ padding: 8, marginBottom: 10 }}>
                                  {l.avisos.map((a) => <div key={a} className="muted" style={{ fontSize: 12 }}>⚠ {a}</div>)}
                                </div>
                              )}
                              <div className="grid grid-2" style={{ marginBottom: 10 }}>
                                <div className="field">
                                  <label>Data (competência)</label>
                                  <input type="date" value={brToIso(l.dataNota)} onChange={(e) => set(l.id, 'dataNota', isoToBr(e.target.value))} />
                                </div>
                                <div className="field">
                                  <label>Nº Nota</label>
                                  <input value={l.numNota} onChange={(e) => set(l.id, 'numNota', e.target.value)} />
                                </div>
                              </div>
                              <div className="field" style={{ marginBottom: 4 }}>
                                <label>Fornecedor</label>
                                <input value={l.fornecedor} onChange={(e) => set(l.id, 'fornecedor', e.target.value)} />
                              </div>
                              <p className="muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 10 }}>
                                {l.fornecedorNovo ? '➕ novo — será criado' : '✓ existente'}
                              </p>
                              <div className="field" style={{ marginBottom: 4 }}>
                                <label>Item (serviço)</label>
                                <input value={l.item} onChange={(e) => set(l.id, 'item', e.target.value)} />
                              </div>
                              <p className="muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 10 }}>
                                {l.itemInfo.status === 'classificado' ? '✓ ' : '➕ '}{l.itemInfo.label}
                              </p>
                              <div className="grid grid-2">
                                <div className="field">
                                  <label>Valor (Qtd = 1)</label>
                                  <input type="number" step="any" value={l.valor} onChange={(e) => set(l.id, 'valor', e.target.value)} />
                                </div>
                                <div className="field">
                                  <label>Total</label>
                                  <div className="kpi-value" style={{ marginTop: 4 }}>{brl(l.valorNum)}</div>
                                </div>
                              </div>
                              {l.chaveNfse && (
                                <p className="muted" style={{ fontSize: 11, wordBreak: 'break-all', marginBottom: 0 }}>Chave: {l.chaveNfse}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
