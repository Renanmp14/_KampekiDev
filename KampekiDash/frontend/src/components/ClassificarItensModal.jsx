import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { custosApi, itensApi } from '../api/resources.js';

/**
 * Modal de classificação dos itens "incorretos" (sem categoria/subcategoria),
 * tipicamente criados pela importação de NF-e. Para cada item escolhe-se uma
 * subcategoria (a categoria é derivada) e ao salvar o backend faz o back-fill
 * nos custos daquele item. Também permite criar uma subcategoria nova.
 *
 * Recursos:
 *  - Busca por descrição do item.
 *  - Contador de custos pendentes por item (ajuda a priorizar).
 *  - Seleção em massa: marca vários itens e aplica a MESMA subcategoria a todos
 *    de uma vez (caso comum: vários itens da mesma subcategoria).
 *  - Classificação individual (select + botão por linha) continua disponível.
 *
 * Props: onClose, onChanged(restantes) — chamado a cada classificação com a
 * quantidade de pendentes restante.
 */
export default function ClassificarItensModal({ onClose, onChanged }) {
  const [itens, setItens] = useState([]);
  const [subcats, setSubcats] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [sel, setSel] = useState({}); // ITEM_UUID -> SUB_CATEGORIA (classificação individual)
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [loading, setLoading] = useState(true);

  // Busca e seleção em massa.
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState(() => new Set()); // ITEM_UUIDs marcados
  const [subMassa, setSubMassa] = useState('');
  const [massaSaving, setMassaSaving] = useState(false);

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

  // Mapa case-insensitive (chave em maiúsculas) e resolução do valor canônico —
  // o campo aceita digitação livre, então normalizamos para casar com a lista.
  const subByName = useMemo(
    () => new Map(subcats.map((s) => [s.SUB_CATEGORIA.toUpperCase(), s.CATEGORIA])),
    [subcats],
  );
  const resolveSub = (v) => {
    const k = String(v || '').trim().toUpperCase();
    if (!k) return null;
    return subcats.find((s) => s.SUB_CATEGORIA.toUpperCase() === k) || null;
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((i) => String(i.DESCRICAO_ITEM || '').toLowerCase().includes(q));
  }, [itens, busca]);

  // Mantém a seleção em massa coerente com o que está visível/pendente.
  const uuidsFiltrados = filtrados.map((i) => i.UUID);
  const marcadosVisiveis = uuidsFiltrados.filter((u) => marcados.has(u));
  const todosVisiveisMarcados = uuidsFiltrados.length > 0
    && marcadosVisiveis.length === uuidsFiltrados.length;

  function removerDaLista(uuids) {
    const rem = new Set(uuids);
    const restantes = itens.filter((i) => !rem.has(i.UUID));
    setItens(restantes);
    setMarcados((prev) => {
      const next = new Set(prev);
      uuids.forEach((u) => next.delete(u));
      return next;
    });
    if (onChanged) onChanged(restantes.length);
    return restantes;
  }

  function toggleMarcar(uuid) {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid); else next.add(uuid);
      return next;
    });
  }

  function toggleTodosVisiveis() {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (todosVisiveisMarcados) uuidsFiltrados.forEach((u) => next.delete(u));
      else uuidsFiltrados.forEach((u) => next.add(u));
      return next;
    });
  }

  async function classificar(item) {
    const canon = resolveSub(sel[item.UUID]);
    if (!canon) { setError(`Selecione uma subcategoria válida para "${item.DESCRICAO_ITEM}"`); return; }
    setError('');
    setSavingId(item.UUID);
    try {
      await custosApi.classificar({ ITEM_UUID: item.UUID, SUB_CATEGORIA: canon.SUB_CATEGORIA });
      removerDaLista([item.UUID]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId('');
    }
  }

  async function classificarMassa() {
    const canon = resolveSub(subMassa);
    if (!canon) { setError('Selecione uma subcategoria válida para aplicar aos itens marcados'); return; }
    const uuids = [...marcados];
    if (!uuids.length) { setError('Marque ao menos um item'); return; }
    setError('');
    setMassaSaving(true);
    try {
      const r = await custosApi.classificarLote({ ITEM_UUIDS: uuids, SUB_CATEGORIA: canon.SUB_CATEGORIA });
      removerDaLista(uuids);
      setSubMassa('');
      setError(`${r.itensClassificados} item(ns) classificados como "${r.SUB_CATEGORIA}" (${r.custosAtualizados} custo(s) atualizados).`);
    } catch (e) {
      setError(e.message);
    } finally {
      setMassaSaving(false);
    }
  }

  async function criarSubcategoria() {
    if (!novaSub.trim() || !novaCat) { setNovaErr('Informe nome e categoria'); return; }
    setNovaErr('');
    setNovaSaving(true);
    try {
      const criada = await itensApi.criarSubcategoria({ SUB_CATEGORIA: novaSub, CATEGORIA: novaCat });
      const subs = await itensApi.subcategorias();
      setSubcats(subs); // a recém-criada já aparece nos selects
      setNovaSub(''); setNovaCat(''); setNovaOpen(false);
      setError(`Subcategoria "${criada.SUB_CATEGORIA}" criada.`);
    } catch (e) {
      setNovaErr(e.message);
    } finally {
      setNovaSaving(false);
    }
  }

  // Opções compartilhadas pelo combo (input + datalist): escolher na lista ou
  // digitar para filtrar rápido.
  const subDatalist = (
    <datalist id="subcats-classif-dl">
      {subcats.map((s) => <option key={s.SUB_CATEGORIA} value={s.SUB_CATEGORIA} />)}
    </datalist>
  );

  return (
    <Modal
      className="modal-lg"
      title={`Classificar itens (${itens.length})`}
      onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Itens importados sem categoria/subcategoria. Escolha a subcategoria (a
        categoria é derivada) — individualmente ou marcando vários e aplicando de
        uma vez. Ao classificar, todos os custos do item são corrigidos.
      </p>

      {subDatalist}

      <div className="row-actions" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="field" style={{ flex: '1 1 220px', margin: 0 }}>
          <label>Buscar item</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por descrição..." />
        </div>
        {!novaOpen && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNovaOpen(true); setNovaErr(''); }}>
            ➕ Nova subcategoria
          </button>
        )}
      </div>

      {novaOpen && (
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
          {novaErr && <div className="error-msg">{novaErr}</div>}
          <div className="row-actions" style={{ marginTop: 8, gap: 8 }}>
            <button className="btn btn-sm" onClick={criarSubcategoria} disabled={novaSaving}>
              {novaSaving ? 'Criando...' : 'Criar'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setNovaOpen(false)} disabled={novaSaving}>Cancelar</button>
          </div>
        </div>
      )}

      {marcados.size > 0 && (
        <div
          className="card"
          style={{
            padding: 12, marginBottom: 12, display: 'flex', gap: 8,
            alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg-2, #1b1f29)',
          }}
        >
          <div className="field" style={{ flex: '1 1 220px', margin: 0 }}>
            <label>{marcados.size} item(ns) marcado(s) → aplicar subcategoria</label>
            <input
              list="subcats-classif-dl"
              value={subMassa}
              onChange={(e) => setSubMassa(e.target.value)}
              placeholder="Selecionar ou digitar..."
            />
          </div>
          <span className="muted" style={{ paddingBottom: 8 }}>
            {resolveSub(subMassa) ? `Categoria: ${resolveSub(subMassa).CATEGORIA}` : ''}
          </span>
          <button className="btn btn-sm" onClick={classificarMassa} disabled={!resolveSub(subMassa) || massaSaving}>
            {massaSaving ? 'Aplicando...' : `Classificar ${marcados.size} selecionado(s)`}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setMarcados(new Set())} disabled={massaSaving}>
            Limpar seleção
          </button>
        </div>
      )}

      {loading && <p className="muted">Carregando...</p>}
      {!loading && itens.length === 0 && <p className="muted">Nenhum item pendente. 🎉</p>}
      {!loading && itens.length > 0 && filtrados.length === 0 && (
        <p className="muted">Nenhum item corresponde à busca.</p>
      )}

      {!loading && filtrados.length > 0 && (
        <>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {filtrados.length} de {itens.length} item(ns)
          </div>
          <div className="table-wrap" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={todosVisiveisMarcados}
                      onChange={toggleTodosVisiveis}
                      title="Marcar todos os visíveis"
                    />
                  </th>
                  <th>Item</th>
                  <th className="num">Custos</th>
                  <th>Subcategoria</th>
                  <th>Categoria</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => {
                  const sub = sel[item.UUID] || '';
                  return (
                    <tr key={item.UUID} className={marcados.has(item.UUID) ? 'selected-row' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={marcados.has(item.UUID)}
                          onChange={() => toggleMarcar(item.UUID)}
                        />
                      </td>
                      <td>{item.DESCRICAO_ITEM}</td>
                      <td className="num">{item.custos ?? 0}</td>
                      <td>
                        <input
                          list="subcats-classif-dl"
                          value={sub}
                          onChange={(e) => setSel((s) => ({ ...s, [item.UUID]: e.target.value }))}
                          placeholder="Selecionar ou digitar..."
                          style={{ minWidth: 180 }}
                        />
                      </td>
                      <td className="muted">{resolveSub(sub)?.CATEGORIA || '—'}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={() => classificar(item)}
                          disabled={!resolveSub(sub) || savingId === item.UUID}
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
        </>
      )}

      {error && <div className="error-msg" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
