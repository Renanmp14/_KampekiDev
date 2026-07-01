import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { custosApi } from '../api/resources.js';
import { parseNfsePdf } from '../utils/parseNfsePdf.js';
import { brl, toNum } from '../utils/format.js';

const norm = (s) => String(s || '').trim().toUpperCase();
const isoToBr = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const brToIso = (br) => { const m = String(br || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

/**
 * Importa UM Custo a partir de uma NFS-e de serviço (PDF, DANFSe v1.0).
 * Extrai os campos no navegador (pdfjs-dist), mostra uma tela de conferência
 * editável e envia ao backend, que aplica dedup por chave, cria fornecedor/item
 * e grava o custo (QTD=1).
 *
 * Props: onClose, onDone (recarrega a página), fornecedores, itens, custos.
 */
export default function ImportNfsePdfModal({
  onClose, onDone, fornecedores = [], itens = [], custos = [],
}) {
  const [fase, setFase] = useState('upload'); // upload | conferencia | ok
  const [loading, setLoading] = useState(false);
  const [campos, setCampos] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState('');

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) { setError('Selecione um arquivo PDF.'); return; }
    setError('');
    setNomeArquivo(file.name);
    setLoading(true);
    try {
      const dados = await parseNfsePdf(file);
      setCampos({
        chaveNfse: dados.chaveNfse || '',
        numNota: dados.numNota || '',
        dataNota: dados.dataNota || '',
        fornecedor: dados.fornecedor || '',
        item: dados.item || '',
        valor: dados.valor != null ? String(dados.valor) : '',
      });
      setAvisos(dados.avisos || []);
      setFase('conferencia');
    } catch (err) {
      setError(`Falha ao ler o PDF: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const set = (campo, v) => setCampos((c) => ({ ...c, [campo]: v }));

  const jaImportada = useMemo(() => {
    const chave = String(campos?.chaveNfse || '').trim();
    if (!chave) return null;
    return custos.find((c) => String(c.CHAVE_NFE || '').trim() === chave) || null;
  }, [campos, custos]);

  const fornecedorNovo = useMemo(
    () => campos && !fornecedores.some((f) => norm(f.NOME_FORNECEDOR) === norm(campos.fornecedor)),
    [campos, fornecedores],
  );

  const itemInfo = useMemo(() => {
    if (!campos) return null;
    const it = itens.find((i) => norm(i.DESCRICAO_ITEM) === norm(campos.item));
    if (!it) return { status: 'novo', label: 'novo — será criado como "a classificar"' };
    if (!String(it.SUB_CATEGORIA || '').trim() || !String(it.CATEGORIA || '').trim()) {
      return { status: 'aClassificar', label: 'existente, a classificar', tag: it.TAG };
    }
    return { status: 'classificado', label: `existente (${it.CATEGORIA}${it.TAG ? ` · tag ${it.TAG}` : ''})`, tag: it.TAG };
  }, [campos, itens]);

  const valorNum = campos ? toNum(campos.valor) : 0;

  function validar() {
    if (!campos.dataNota || !brToIso(campos.dataNota)) return 'Informe a data (competência) no formato DD/MM/AAAA';
    if (!campos.numNota.trim()) return 'Informe o número da nota';
    if (!campos.fornecedor.trim()) return 'Informe o fornecedor';
    if (!campos.item.trim()) return 'Informe o item';
    if (!(valorNum > 0)) return 'Informe um valor válido';
    return '';
  }

  async function salvar() {
    if (jaImportada) return;
    const msg = validar();
    if (msg) { setError(msg); return; }
    setError('');
    setSaving(true);
    try {
      const r = await custosApi.importarNfse({
        chaveNfse: campos.chaveNfse.trim(),
        numNota: campos.numNota.trim(),
        dataNota: campos.dataNota.trim(),
        fornecedor: campos.fornecedor.trim(),
        item: campos.item.trim(),
        valor: valorNum,
      });
      setResultado(r);
      setFase('ok');
      if (onDone) onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Render por fase ---
  if (fase === 'ok') {
    return (
      <Modal title="NFS-e importada" onClose={onClose} footer={<button className="btn" onClick={onClose}>Fechar</button>}>
        <div className="modal-summary">
          <div><span className="muted">Item</span><span>{resultado.item}</span></div>
          <div><span className="muted">Fornecedor</span><span>{resultado.fornecedor}{resultado.fornecedorCriado ? ' (criado)' : ''}</span></div>
          <div className="total"><span>Valor</span><span>{brl(resultado.valor)}</span></div>
        </div>
        {resultado.aClassificar && (
          <p className="muted" style={{ marginTop: 10 }}>
            ⚠ O item entrou como <b>a classificar</b> — classifique-o na página Itens ou no botão "a classificar" dos Custos.
          </p>
        )}
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
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" onClick={salvar} disabled={saving || !!jaImportada}>
            {saving ? 'Salvando...' : 'Confirmar e salvar'}
          </button>
        </>
      ) : (
        <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
      )}
    >
      {fase === 'upload' && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Selecione um PDF da NFS-e de serviço (DANFSe v1.0, texto selecionável).
            Gera <b>um</b> lançamento de Custo (QTD = 1). Um PDF por vez.
          </p>
          <input type="file" accept="application/pdf,.pdf" onChange={onFile} disabled={loading} />
          {loading && <p className="muted" style={{ marginTop: 10 }}>Lendo PDF...</p>}
        </>
      )}

      {fase === 'conferencia' && campos && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Confira os dados extraídos de <b>{nomeArquivo}</b> antes de salvar (todos editáveis).
          </p>

          {jaImportada && (
            <div className="error-msg" style={{ marginBottom: 12 }}>
              Esta NFS-e já foi importada (nota {jaImportada.NUM_NOTA || '—'}, {jaImportada.DATA_NOTA || '—'}). Salvamento bloqueado.
            </div>
          )}
          {avisos.length > 0 && (
            <div className="card" style={{ padding: 10, marginBottom: 12, background: 'var(--bg-2, #1b1f29)' }}>
              {avisos.map((a) => <div key={a} className="muted" style={{ fontSize: 12 }}>⚠ {a}</div>)}
            </div>
          )}

          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Data (competência)</label>
              <input type="date" value={brToIso(campos.dataNota)} onChange={(e) => set('dataNota', isoToBr(e.target.value))} />
            </div>
            <div className="field">
              <label>Nº Nota</label>
              <input value={campos.numNota} onChange={(e) => set('numNota', e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 4 }}>
            <label>Fornecedor</label>
            <input value={campos.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 12 }}>
            {fornecedorNovo ? '➕ novo — será criado' : '✓ existente'}
          </p>

          <div className="field" style={{ marginBottom: 4 }}>
            <label>Item (serviço)</label>
            <input value={campos.item} onChange={(e) => set('item', e.target.value)} />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 12 }}>
            {itemInfo?.status === 'novo' ? '➕ ' : '✓ '}{itemInfo?.label}
          </p>

          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Valor (Qtd = 1)</label>
              <input type="number" step="any" value={campos.valor} onChange={(e) => set('valor', e.target.value)} />
            </div>
            <div className="field">
              <label>Total</label>
              <div className="kpi-value" style={{ marginTop: 4 }}>{brl(valorNum)}</div>
            </div>
          </div>

          {campos.chaveNfse && (
            <p className="muted" style={{ fontSize: 11, wordBreak: 'break-all' }}>Chave: {campos.chaveNfse}</p>
          )}
          {error && <div className="error-msg">{error}</div>}
        </>
      )}

      {fase === 'upload' && error && <div className="error-msg" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
