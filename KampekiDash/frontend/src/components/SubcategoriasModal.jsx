import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { itensApi } from '../api/resources.js';
import { categoriaBadgeClass } from '../utils/format.js';

/**
 * Gestão de subcategorias: lista todas (fixas do código + personalizadas da aba
 * SUBCATEGORIA), mostrando a categoria, o tipo e quanto cada uma é usada (itens
 * e custos). Permite criar uma subcategoria nova (apontando para uma categoria
 * fixa) e excluir as personalizadas que não estejam em uso.
 *
 * Props: onClose, onChanged — onChanged é chamado após criar/excluir para que a
 * página pai recarregue os selects de subcategoria.
 */
export default function SubcategoriasModal({ onClose, onChanged }) {
  const [lista, setLista] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busca, setBusca] = useState('');

  // Form de criação.
  const [novaSub, setNovaSub] = useState('');
  const [novaCat, setNovaCat] = useState('');
  const [saving, setSaving] = useState(false);

  // Exclusão.
  const [confirmDel, setConfirmDel] = useState(null);
  const [delSaving, setDelSaving] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [gestao, cats] = await Promise.all([
        itensApi.subcategoriasGestao(), itensApi.categorias(),
      ]);
      setLista(gestao);
      setCategorias(cats);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((s) => `${s.SUB_CATEGORIA} ${s.CATEGORIA}`.toLowerCase().includes(q));
  }, [lista, busca]);

  const personalizadas = lista.filter((s) => !s.fixa).length;

  async function criar() {
    if (!novaSub.trim() || !novaCat) { setError('Informe nome e categoria'); return; }
    setError(''); setInfo('');
    setSaving(true);
    try {
      const criada = await itensApi.criarSubcategoria({ SUB_CATEGORIA: novaSub, CATEGORIA: novaCat });
      setNovaSub(''); setNovaCat('');
      setInfo(`Subcategoria "${criada.SUB_CATEGORIA}" criada.`);
      await carregar();
      if (onChanged) onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function excluir(sub) {
    setError(''); setInfo('');
    setDelSaving(true);
    try {
      await itensApi.removerSubcategoria(sub.SUB_CATEGORIA);
      setConfirmDel(null);
      setInfo(`Subcategoria "${sub.SUB_CATEGORIA}" excluída.`);
      await carregar();
      if (onChanged) onChanged();
    } catch (e) {
      setError(e.message);
      setConfirmDel(null);
    } finally {
      setDelSaving(false);
    }
  }

  return (
    <Modal
      className="modal-lg"
      title="Gerenciar subcategorias"
      onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Subcategorias fixas vêm do sistema e não podem ser excluídas. As
        personalizadas ({personalizadas}) podem ser excluídas se não estiverem em uso.
        Toda subcategoria aponta para uma categoria fixa.
      </p>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <strong>Nova subcategoria</strong>
        <div className="grid grid-2" style={{ marginTop: 8 }}>
          <div className="field">
            <label>Nome</label>
            <input value={novaSub} onChange={(e) => setNovaSub(e.target.value)} placeholder="EX: TEMPEROS" />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select value={novaCat} onChange={(e) => setNovaCat(e.target.value)}>
              <option value="">Selecione...</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn btn-sm" onClick={criar} disabled={saving}>
            {saving ? 'Criando...' : '➕ Criar subcategoria'}
          </button>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Buscar</label>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por nome ou categoria..." />
      </div>

      {loading ? <p className="muted">Carregando...</p> : (
        <>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {filtrada.length} de {lista.length} subcategoria(s)
          </div>
          <div className="table-wrap" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Subcategoria</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th className="num">Itens</th>
                  <th className="num">Custos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrada.map((s) => (
                  <tr key={s.SUB_CATEGORIA}>
                    <td>{s.SUB_CATEGORIA}</td>
                    <td><span className={categoriaBadgeClass(s.CATEGORIA)}>{s.CATEGORIA}</span></td>
                    <td>
                      <span className="muted">{s.fixa ? 'Fixa' : 'Personalizada'}</span>
                    </td>
                    <td className="num">{s.itens}</td>
                    <td className="num">{s.custos}</td>
                    <td>
                      {!s.fixa && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => setConfirmDel(s)}
                          disabled={s.itens > 0 || s.custos > 0}
                          title={s.itens > 0 || s.custos > 0 ? 'Em uso — reclassifique antes de excluir' : 'Excluir subcategoria'}
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtrada.length === 0 && (
                  <tr><td colSpan={6} className="empty">Nenhuma subcategoria.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {info && <div className="muted" style={{ marginTop: 10 }}>{info}</div>}
      {error && <div className="error-msg" style={{ marginTop: 10 }}>{error}</div>}

      {confirmDel && (
        <ConfirmDialog
          message={`Excluir a subcategoria "${confirmDel.SUB_CATEGORIA}"?`}
          confirmLabel={delSaving ? 'Excluindo...' : 'Excluir'}
          onConfirm={() => excluir(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </Modal>
  );
}
