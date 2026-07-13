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

  // Edição inline (nome + categoria).
  const [editando, setEditando] = useState(null); // { SUB_CATEGORIA, nome, cat }
  const [editSaving, setEditSaving] = useState(false);

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

  function abrirEdicao(s) {
    setError(''); setInfo('');
    setEditando({ SUB_CATEGORIA: s.SUB_CATEGORIA, nome: s.SUB_CATEGORIA, cat: s.CATEGORIA });
  }

  async function salvarEdicao() {
    if (!editando) return;
    if (!editando.nome.trim() || !editando.cat) { setError('Informe nome e categoria'); return; }
    setError(''); setInfo('');
    setEditSaving(true);
    try {
      const r = await itensApi.editarSubcategoria({
        SUB_CATEGORIA: editando.SUB_CATEGORIA,
        NOVO_NOME: editando.nome,
        NOVA_CATEGORIA: editando.cat,
      });
      setEditando(null);
      setInfo(
        `Subcategoria salva como "${r.SUB_CATEGORIA}" (${r.CATEGORIA}); `
        + `${r.itensAtualizados} item(ns) e ${r.custosAtualizados} custo(s) reprocessados.`,
      );
      await carregar();
      if (onChanged) onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function excluir(sub) {
    setError(''); setInfo('');
    setDelSaving(true);
    try {
      const r = await itensApi.removerSubcategoria(sub.SUB_CATEGORIA);
      setConfirmDel(null);
      setInfo(
        `Subcategoria "${sub.SUB_CATEGORIA}" excluída. `
        + `${r.itensDesclassificados} item(ns) e ${r.custosDesclassificados} custo(s) voltaram para "a classificar".`,
      );
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
        Toda subcategoria aponta para uma categoria fixa. Você pode <strong>criar</strong>,
        <strong> editar</strong> (nome/categoria) e <strong>excluir</strong> qualquer uma
        ({personalizadas} personalizada(s), as demais são do sistema). Ao <strong>editar</strong>,
        os itens e custos daquela subcategoria são reprocessados para o novo nome/categoria.
        Ao <strong>excluir</strong>, eles voltam para “a classificar”.
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
                {filtrada.map((s) => {
                  const emEdicao = editando && editando.SUB_CATEGORIA === s.SUB_CATEGORIA;
                  if (emEdicao) {
                    return (
                      <tr key={s.SUB_CATEGORIA} className="selected-row">
                        <td>
                          <input
                            value={editando.nome}
                            onChange={(e) => setEditando((ed) => ({ ...ed, nome: e.target.value }))}
                            style={{ minWidth: 160 }}
                            autoFocus
                          />
                        </td>
                        <td>
                          <select
                            value={editando.cat}
                            onChange={(e) => setEditando((ed) => ({ ...ed, cat: e.target.value }))}
                          >
                            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td><span className="muted">{s.fixa ? 'Sistema' : 'Personalizada'}</span></td>
                        <td className="num">{s.itens}</td>
                        <td className="num">{s.custos}</td>
                        <td>
                          <div className="row-actions">
                            <button className="btn btn-sm" onClick={salvarEdicao} disabled={editSaving}>
                              {editSaving ? '...' : 'Salvar'}
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setEditando(null)} disabled={editSaving}>
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={s.SUB_CATEGORIA}>
                      <td>{s.SUB_CATEGORIA}</td>
                      <td><span className={categoriaBadgeClass(s.CATEGORIA)}>{s.CATEGORIA}</span></td>
                      <td><span className="muted">{s.fixa ? 'Sistema' : 'Personalizada'}</span></td>
                      <td className="num">{s.itens}</td>
                      <td className="num">{s.custos}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => abrirEdicao(s)}
                            disabled={Boolean(editando)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setConfirmDel(s)}
                            disabled={Boolean(editando)}
                            title="Excluir — os itens/custos voltam para “a classificar”"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
          message={
            `Excluir a subcategoria "${confirmDel.SUB_CATEGORIA}"? `
            + `${confirmDel.itens} item(ns) e ${confirmDel.custos} custo(s) que a usam `
            + 'voltarão para "a classificar" (sem subcategoria/categoria).'
          }
          confirmLabel={delSaving ? 'Excluindo...' : 'Excluir e desclassificar'}
          onConfirm={() => excluir(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </Modal>
  );
}
