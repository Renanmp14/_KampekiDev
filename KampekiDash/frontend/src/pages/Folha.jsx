import React, { useEffect, useMemo, useState } from 'react';
import { folhaApi, tagApi } from '../api/resources.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { brl, toNum } from '../utils/format.js';

const emptyForm = { MES_ANO: '', TAG: '', ITEM_FOLHA: '', VALOR: '', OBSERVACAO: '' };

// "2026-06" (input month) <-> "06/2026"
function monthToBr(v) {
  if (!v) return '';
  const [y, m] = v.split('-');
  return `${m}/${y}`;
}
function brToMonth(v) {
  const m = String(v || '').match(/^(\d{2})\/(\d{4})$/);
  return m ? `${m[2]}-${m[1]}` : '';
}

export default function Folha() {
  const [folha, setFolha] = useState([]);
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [fMesAno, setFMesAno] = useState('');
  const [fTag, setFTag] = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const [f, t] = await Promise.all([folhaApi.listar(), tagApi.listar()]);
      setFolha(f);
      setTags(t);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function abrirNovo() {
    setForm(emptyForm);
    setEditing('novo');
    setError('');
    setShowForm(true);
  }

  function abrirEdicao(r) {
    setForm({
      MES_ANO: r.MES_ANO,
      TAG: r.TAG,
      ITEM_FOLHA: r.ITEM_FOLHA,
      VALOR: r.VALOR,
      OBSERVACAO: r.OBSERVACAO || '',
    });
    setEditing(r);
    setError('');
    setShowForm(true);
  }

  function validarLocal() {
    if (!form.MES_ANO) return 'Informe o mês/ano';
    if (!form.TAG) return 'Selecione a tag';
    if (!form.ITEM_FOLHA.trim()) return 'Informe o item da folha';
    if (toNum(form.VALOR) < 0) return 'Valor inválido';
    return '';
  }

  async function salvar() {
    const msg = validarLocal();
    if (msg) { setError(msg); return; }
    setError('');
    try {
      if (editing === 'novo') {
        await folhaApi.criar(form);
      } else {
        await folhaApi.atualizar(editing.UUID, form);
      }
      setShowForm(false);
      setEditing(null);
      await carregar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function excluir(uuid) {
    try {
      await folhaApi.remover(uuid);
      setConfirmDel(null);
      await carregar();
    } catch (err) {
      setError(err.message);
      setConfirmDel(null);
    }
  }

  const mesesAno = useMemo(
    () => [...new Set(folha.map((r) => r.MES_ANO).filter(Boolean))].sort(),
    [folha],
  );

  const filtrados = folha.filter((r) => (
    (!fMesAno || r.MES_ANO === fMesAno) && (!fTag || r.TAG === fTag)
  ));
  const total = filtrados.reduce((s, r) => s + toNum(r.VALOR), 0);

  return (
    <div>
      <h1 className="page-title">Folha</h1>

      <div className="toolbar">
        <button className="btn" onClick={abrirNovo}>+ Novo lançamento</button>
        <div className="spacer" />
        <div className="field" style={{ maxWidth: 150 }}>
          <label>Mês/Ano</label>
          <select value={fMesAno} onChange={(e) => setFMesAno(e.target.value)}>
            <option value="">Todos</option>
            {mesesAno.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 180 }}>
          <label>Tag</label>
          <select value={fTag} onChange={(e) => setFTag(e.target.value)}>
            <option value="">Todas</option>
            {tags.map((t) => <option key={t.UUID} value={t.TAG}>{t.TAG}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">{filtrados.length} lançamentos · Total {brl(total)}</h3>
        {loading ? <div className="empty">Carregando...</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mês/Ano</th>
                  <th>Tag</th>
                  <th>Item Folha</th>
                  <th className="num">Valor</th>
                  <th>Origem</th>
                  <th>Observação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.UUID}>
                    <td>{r.MES_ANO}</td>
                    <td>{r.TAG || '—'}</td>
                    <td>{r.ITEM_FOLHA}</td>
                    <td className="num">{brl(r.VALOR)}</td>
                    <td>
                      {r._origem === 'custo'
                        ? <span className="badge badge-folha" title={r.CATEGORIA}>Custo</span>
                        : <span className="badge badge-default">Manual</span>}
                    </td>
                    <td>{r.OBSERVACAO}</td>
                    <td>
                      {r._origem === 'custo' ? (
                        <span className="muted" style={{ fontSize: 12 }} title="Este lançamento vem de um custo de categoria folha. Edite-o na página Custos.">
                          editar em Custos
                        </span>
                      ) : (
                        <div className="row-actions">
                          <button className="btn btn-sm btn-ghost" onClick={() => abrirEdicao(r)}>Editar</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setConfirmDel(r)}>Excluir</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && <tr><td colSpan={7} className="empty">Nenhum lançamento.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal
          title={editing === 'novo' ? 'Novo lançamento de folha' : 'Editar folha'}
          onClose={() => setShowForm(false)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn" onClick={salvar}>Salvar</button>
            </>
          )}
        >
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Mês/Ano</label>
              <input
                type="month"
                value={brToMonth(form.MES_ANO)}
                onChange={(e) => setForm({ ...form, MES_ANO: monthToBr(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Tag</label>
              <select value={form.TAG} onChange={(e) => setForm({ ...form, TAG: e.target.value })}>
                <option value="">Selecione...</option>
                {tags.map((t) => <option key={t.UUID} value={t.TAG}>{t.TAG}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Item Folha</label>
            <input value={form.ITEM_FOLHA} onChange={(e) => setForm({ ...form, ITEM_FOLHA: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Valor</label>
            <input type="number" step="any" value={form.VALOR} onChange={(e) => setForm({ ...form, VALOR: e.target.value })} />
          </div>
          <div className="field">
            <label>Observação</label>
            <textarea rows={2} value={form.OBSERVACAO} onChange={(e) => setForm({ ...form, OBSERVACAO: e.target.value })} />
          </div>
          {error && <div className="error-msg">{error}</div>}
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog
          message={`Excluir o lançamento "${confirmDel.ITEM_FOLHA}" (${confirmDel.MES_ANO})?`}
          onConfirm={() => excluir(confirmDel.UUID)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
