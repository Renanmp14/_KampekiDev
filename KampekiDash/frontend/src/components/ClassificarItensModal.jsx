import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { custosApi, itensApi } from '../api/resources.js';

/**
 * Modal de classificação dos itens "incorretos" (sem categoria/subcategoria),
 * tipicamente criados pela importação de NF-e. Para cada item, escolhe-se uma
 * subcategoria (a categoria é derivada) e ao salvar o backend faz o back-fill
 * nos custos daquele item. Também permite criar uma subcategoria nova.
 *
 * Props: onClose, onChanged(restantes) — chamado a cada classificação com a
 * quantidade de pendentes restante.
 */
export default function ClassificarItensModal({ onClose, onChanged }) {
  const [itens, setItens] = useState([]);
  const [subcats, setSubcats] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [sel, setSel] = useState({}); // ITEM_UUID -> SUB_CATEGORIA
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [loading, setLoading] = useState(true);

  // Form de "nova subcategoria".
  const [novaOpen, setNovaOpen] = useState(false);
  const [novaSub, setNovaSub] = useState('');
  const [novaCat, setNovaCat] = useState('');
  const [novaErr, setNovaErr] = useState('');
  const [novaSaving, setNovaSaving] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [pend, subs, cats] = await Promise.all([
        custosApi.itensAClassificar(), itensApi.subcategorias(), itensApi.categorias(),
      ]);
      setItens(pend);
      setSubcats(subs);
      setCategorias(cats);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const subByName = useMemo(
    () => new Map(subcats.map((s) => [s.SUB_CATEGORIA, s.CATEGORIA])),
    [subcats],
  );

  async function classificar(item) {
    const sub = sel[item.UUID];
    if (!sub) { setError(`Selecione a subcategoria de "${item.DESCRICAO_ITEM}"`); return; }
    setError('');
    setSavingId(item.UUID);
    try {
      await custosApi.classificar({ ITEM_UUID: item.UUID, SUB_CATEGORIA: sub });
      const restantes = itens.filter((i) => i.UUID !== item.UUID);
      setItens(restantes);
      if (onChanged) onChanged(restantes.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId('');
    }
  }

  async function criarSubcategoria() {
    if (!novaSub.trim() || !novaCat) { setNovaErr('Informe nome e categoria'); return; }
    setNovaErr('');
    setNovaSaving(true);
    try {
      const criada = await itensApi.criarSubcategoria({ SUB_CATEGORIA: novaSub, CATEGORIA: novaCat });
      const subs = await itensApi.subcategorias();
      setSubcats(subs); // a recém-criada já aparece nos selects de cada item
      setNovaSub(''); setNovaCat(''); setNovaOpen(false);
      setError(`Subcategoria "${criada.SUB_CATEGORIA}" criada.`);
    } catch (e) {
      setNovaErr(e.message);
    } finally {
      setNovaSaving(false);
    }
  }

  return (
    <Modal
      title={`Classificar itens (${itens.length})`}
      onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Itens importados sem categoria/subcategoria. Escolha a subcategoria de cada
        um (a categoria é derivada). Ao classificar, todos os custos desse item são
        corrigidos automaticamente.
      </p>

      <div style={{ marginBottom: 12 }}>
        {!novaOpen ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNovaOpen(true); setNovaErr(''); }}>
            ➕ Nova subcategoria
          </button>
        ) : (
          <div className="card" style={{ padding: 12 }}>
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
            {novaErr && <div className="error-msg">{novaErr}</div>}
            <div className="row-actions" style={{ marginTop: 8, gap: 8 }}>
              <button className="btn btn-sm" onClick={criarSubcategoria} disabled={novaSaving}>
                {novaSaving ? 'Criando...' : 'Criar'}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setNovaOpen(false)} disabled={novaSaving}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {loading && <p className="muted">Carregando...</p>}
      {!loading && itens.length === 0 && <p className="muted">Nenhum item pendente. 🎉</p>}

      {!loading && itens.length > 0 && (
        <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>Item</th><th>Subcategoria</th><th>Categoria</th><th /></tr>
            </thead>
            <tbody>
              {itens.map((item) => {
                const sub = sel[item.UUID] || '';
                return (
                  <tr key={item.UUID}>
                    <td>{item.DESCRICAO_ITEM}</td>
                    <td>
                      <select
                        value={sub}
                        onChange={(e) => setSel((s) => ({ ...s, [item.UUID]: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {subcats.map((s) => (
                          <option key={s.SUB_CATEGORIA} value={s.SUB_CATEGORIA}>{s.SUB_CATEGORIA}</option>
                        ))}
                      </select>
                    </td>
                    <td className="muted">{sub ? (subByName.get(sub) || '') : '—'}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => classificar(item)}
                        disabled={!sub || savingId === item.UUID}
                      >
                        {savingId === item.UUID ? '...' : 'Classificar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && <div className="error-msg" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
