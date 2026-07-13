import React, { useEffect, useMemo, useState } from 'react';
import { itensApi, custosApi, tagApi } from '../api/resources.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import ImportModal from '../components/ImportModal.jsx';
import ImportResult from '../components/ImportResult.jsx';
import ClassificarItensModal from '../components/ClassificarItensModal.jsx';
import SubcategoriasModal from '../components/SubcategoriasModal.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { parseItens } from '../utils/importParse.js';
import { categoriaBadgeClass } from '../utils/format.js';

const CATEGORIAS_FOLHA = ['FOLHA CANOAS', 'FOLHA POA', 'FOLHA TELE'];
const isFolha = (cat) => CATEGORIAS_FOLHA.includes(String(cat || '').toUpperCase());

// Opção especial do filtro de Tag: filtra os itens SEM nenhuma tag.
const SEM_TAG = '(sem tag)';
const norm = (s) => String(s || '').trim().toUpperCase();

const emptyForm = { DESCRICAO_ITEM: '', SUB_CATEGORIA: '', TAG: '' };

export default function Itens() {
  const [items, setItems] = useState([]);
  const [subcats, setSubcats] = useState([]);
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showClassificar, setShowClassificar] = useState(false);
  const [qtdAClassificar, setQtdAClassificar] = useState(0);
  const [showSubcats, setShowSubcats] = useState(false);
  const [reprocessando, setReprocessando] = useState(false);
  const [reprocMsg, setReprocMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Seleção / edição em massa.
  const [selected, setSelected] = useState(() => new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [bulkCampo, setBulkCampo] = useState('SUB_CATEGORIA');
  const [bulkValor, setBulkValor] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Filtros combináveis: nome (texto), subcategorias (multi), categoria e tag.
  const [fNome, setFNome] = useState('');
  const [fSubs, setFSubs] = useState([]); // multi-seleção de subcategorias
  const [fCat, setFCat] = useState('');
  const [fTag, setFTag] = useState('');

  // Mapa subcategoria -> categoria para exibição automática.
  const catMap = useMemo(() => {
    const m = {};
    subcats.forEach((s) => { m[s.SUB_CATEGORIA] = s.CATEGORIA; });
    return m;
  }, [subcats]);

  // Lista de categorias únicas (para o filtro).
  const categorias = useMemo(
    () => [...new Set(subcats.map((s) => s.CATEGORIA).filter(Boolean))].sort(),
    [subcats],
  );

  // Conjunto (normalizado) das subcategorias já escolhidas (viram chips).
  const fSubsSet = useMemo(() => new Set(fSubs.map((s) => norm(s))), [fSubs]);
  // Opções de subcategoria: limitadas à categoria escolhida (se houver) e sem as
  // já selecionadas.
  const subcatOptions = useMemo(
    () => (fCat ? subcats.filter((s) => s.CATEGORIA === fCat) : subcats)
      .map((s) => s.SUB_CATEGORIA)
      .filter((s) => !fSubsSet.has(norm(s))),
    [subcats, fCat, fSubsSet],
  );

  const filtrados = useMemo(() => {
    const q = fNome.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !String(it.DESCRICAO_ITEM || '').toLowerCase().includes(q)) return false;
      if (fSubsSet.size && !fSubsSet.has(norm(it.SUB_CATEGORIA))) return false;
      if (fCat && it.CATEGORIA !== fCat) return false;
      if (fTag) {
        if (fTag === SEM_TAG) { if (String(it.TAG || '').trim()) return false; }
        else if (String(it.TAG || '') !== fTag) return false;
      }
      return true;
    });
  }, [items, fNome, fSubsSet, fCat, fTag]);

  const filtroAtivo = fNome.trim() || fSubs.length || fCat || fTag;

  // Adiciona/remove subcategoria do filtro multi.
  function addSubFiltro(v) {
    const s = String(v || '').trim();
    if (s && !fSubsSet.has(norm(s))) setFSubs((prev) => [...prev, s]);
  }
  function removeSubFiltro(v) {
    setFSubs((prev) => prev.filter((s) => norm(s) !== norm(v)));
  }

  async function carregar() {
    setLoading(true);
    try {
      const [lista, subs, tgs, pend] = await Promise.all([
        itensApi.listar(), itensApi.subcategorias(), tagApi.listar(),
        custosApi.itensAClassificar().catch(() => []),
      ]);
      setItems(lista);
      setSubcats(subs);
      setTags(tgs);
      setQtdAClassificar(pend.length);
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
  }

  function abrirEdicao(it) {
    setForm({ DESCRICAO_ITEM: it.DESCRICAO_ITEM, SUB_CATEGORIA: it.SUB_CATEGORIA, TAG: it.TAG || '' });
    setEditing(it);
    setError('');
  }

  async function reprocessarTags() {
    setReprocessando(true);
    setReprocMsg('');
    setError('');
    try {
      const r = await itensApi.reprocessarTags();
      const partes = [];
      if (r.custosAplicados) partes.push(`${r.custosAplicados} com tag aplicada`);
      if (r.custosLimpos) partes.push(`${r.custosLimpos} com tag removida`);
      setReprocMsg(
        `Reprocessado: ${r.custosAtualizados} custo(s) sincronizados`
        + `${partes.length ? ` (${partes.join(', ')})` : ''}`
        + ` a partir de ${r.itensComTag} item(ns) com tag.`,
      );
      await carregar();
    } catch (err) {
      setError(err.message);
    } finally {
      setReprocessando(false);
    }
  }

  async function salvar() {
    setError('');
    try {
      const res = editing === 'novo'
        ? await itensApi.criar(form)
        : await itensApi.atualizar(editing.UUID, form);
      setEditing(null);
      setReprocMsg(
        res && res.custosAtualizados > 0
          ? (res.tagRemovida
            ? `Tag removida de ${res.custosAtualizados} custo(s) deste item.`
            : `Tag "${res.TAG}" aplicada a ${res.custosAtualizados} custo(s) deste item.`)
          : '',
      );
      await carregar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function excluir(uuid) {
    try {
      await itensApi.remover(uuid);
      setConfirm(null);
      await carregar();
    } catch (err) {
      setError(err.message);
      setConfirm(null);
    }
  }

  const categoriaAtual = catMap[form.SUB_CATEGORIA] || '';

  // --- Seleção em massa (persiste por UUID, respeita os filtros ativos) ------
  const uuidsFiltrados = filtrados.map((i) => i.UUID);
  const selecionadosVisiveis = uuidsFiltrados.filter((u) => selected.has(u));
  const todosVisiveisSelecionados = uuidsFiltrados.length > 0
    && selecionadosVisiveis.length === uuidsFiltrados.length;

  function toggleUm(uuid) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid); else next.add(uuid);
      return next;
    });
  }
  function toggleTodosVisiveis() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (todosVisiveisSelecionados) uuidsFiltrados.forEach((u) => next.delete(u));
      else uuidsFiltrados.forEach((u) => next.add(u));
      return next;
    });
  }
  function limparSelecao() { setSelected(new Set()); }

  function abrirBulk() {
    setBulkCampo('SUB_CATEGORIA');
    setBulkValor('');
    setBulkError('');
    setShowBulk(true);
  }

  async function aplicarBulk() {
    setBulkError('');
    if (bulkCampo === 'SUB_CATEGORIA' && !bulkValor) { setBulkError('Selecione a subcategoria'); return; }
    setBulkSaving(true);
    try {
      const ITEM_UUIDS = [...selected];
      const r = await itensApi.atualizarEmMassa({ ITEM_UUIDS, campo: bulkCampo, valor: bulkValor });
      setShowBulk(false);
      limparSelecao();
      if (bulkCampo === 'SUB_CATEGORIA') {
        setReprocMsg(
          `${r.itensAtualizados} item(ns) → ${r.SUB_CATEGORIA} (${r.CATEGORIA}); `
          + `${r.custosAtualizados} custo(s) sincronizado(s).`,
        );
      } else {
        const alvo = r.TAG ? `tag "${r.TAG}"` : 'tag removida';
        setReprocMsg(
          `${r.itensAtualizados} item(ns) de folha → ${alvo}; ${r.custosAtualizados} custo(s) sincronizado(s)`
          + `${r.itensIgnorados ? `; ${r.itensIgnorados} não-folha ignorado(s)` : ''}.`,
        );
      }
      await carregar();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Itens</h1>

      <div className="toolbar">
        <button className="btn" onClick={abrirNovo}>+ Novo item</button>
        <button className="btn btn-ghost" onClick={() => setShowImport(true)}>Importar planilha</button>
        <button className="btn btn-ghost" onClick={() => setShowSubcats(true)}>Subcategorias</button>
        <button
          className="btn btn-ghost"
          onClick={reprocessarTags}
          disabled={reprocessando}
          title="Sincroniza TODOS os itens com tag de uma vez (mais pesado). No dia a dia não é necessário — salvar o item já aplica a tag aos custos dele."
        >
          {reprocessando ? 'Reprocessando...' : '↻ Reprocessar tags (geral)'}
        </button>
        {qtdAClassificar > 0 && (
          <button
            className="btn btn-sm"
            style={{ background: 'var(--down, #e0a800)', color: '#1b1f29' }}
            title="Itens sem categoria/subcategoria"
            onClick={() => setShowClassificar(true)}
          >
            ⚠ {qtdAClassificar} item(ns) a classificar
          </button>
        )}
        <div className="spacer" />
        <span className="muted">
          {filtroAtivo ? `${filtrados.length} de ${items.length}` : `${items.length}`} itens
        </span>
      </div>

      {reprocMsg && <div className="muted" style={{ marginBottom: 12 }}>{reprocMsg}</div>}

      <div className="card">
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="field">
            <label>Pesquisar item</label>
            <input
              value={fNome}
              onChange={(e) => setFNome(e.target.value)}
              placeholder="Nome do item..."
            />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select
              value={fCat}
              onChange={(e) => { setFCat(e.target.value); setFSubs([]); }}
            >
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Subcategoria {fSubs.length > 0 ? `(${fSubs.length})` : ''}</label>
            <SearchableSelect
              value=""
              onPick={addSubFiltro}
              onChange={() => {}}
              options={subcatOptions}
              placeholder={fSubs.length ? 'Adicionar outra...' : 'Todas...'}
            />
            {fSubs.length > 0 && (
              <div className="filtro-chips">
                {fSubs.map((s) => (
                  <span key={s} className="filtro-chip">
                    {s}
                    <button type="button" onClick={() => removeSubFiltro(s)} title="Remover">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label>Tag</label>
            <select value={fTag} onChange={(e) => setFTag(e.target.value)}>
              <option value="">Todas</option>
              <option value={SEM_TAG}>(sem tag)</option>
              {tags.map((t) => <option key={t.UUID} value={t.TAG}>{t.TAG}</option>)}
            </select>
          </div>
          {filtroAtivo && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setFNome(''); setFSubs([]); setFCat(''); setFTag(''); }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {selected.size > 0 && (
          <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="muted">{selected.size} selecionado(s)</span>
            <div className="row-actions" style={{ alignItems: 'center', gap: 8 }}>
              <button className="btn btn-sm" onClick={abrirBulk}>Editar em massa</button>
              <button className="btn btn-sm btn-ghost" onClick={limparSelecao}>Limpar seleção</button>
            </div>
          </div>
        )}
        {loading ? <div className="empty">Carregando...</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={todosVisiveisSelecionados}
                      onChange={toggleTodosVisiveis}
                      title="Selecionar todos os filtrados"
                    />
                  </th>
                  <th>Descrição</th>
                  <th>Subcategoria</th>
                  <th>Categoria</th>
                  <th>Tag</th>
                  <th style={{ width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((it) => (
                  <tr key={it.UUID} className={selected.has(it.UUID) ? 'selected-row' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(it.UUID)}
                        onChange={() => toggleUm(it.UUID)}
                      />
                    </td>
                    <td>{it.DESCRICAO_ITEM}</td>
                    <td>{it.SUB_CATEGORIA}</td>
                    <td><span className={categoriaBadgeClass(it.CATEGORIA)}>{it.CATEGORIA}</span></td>
                    <td>{isFolha(it.CATEGORIA) ? (it.TAG || '—') : ''}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => abrirEdicao(it)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => setConfirm(it)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={6} className="empty">
                    {items.length === 0 ? 'Nenhum item.' : 'Nenhum item para os filtros.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={editing === 'novo' ? 'Novo item' : 'Editar item'}
          onClose={() => setEditing(null)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn" onClick={salvar}>Salvar</button>
            </>
          )}
        >
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Descrição do item</label>
            <input
              value={form.DESCRICAO_ITEM}
              onChange={(e) => setForm({ ...form, DESCRICAO_ITEM: e.target.value })}
              autoFocus
            />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Subcategoria</label>
            <select
              value={form.SUB_CATEGORIA}
              onChange={(e) => {
                const sub = e.target.value;
                const cat = catMap[sub] || '';
                setForm((f) => ({ ...f, SUB_CATEGORIA: sub, TAG: isFolha(cat) ? f.TAG : '' }));
              }}
            >
              <option value="">Selecione...</option>
              {subcats.map((s) => (
                <option key={s.SUB_CATEGORIA} value={s.SUB_CATEGORIA}>{s.SUB_CATEGORIA}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Categoria (automática)</label>
            <input className="readonly" value={categoriaAtual} readOnly placeholder="—" />
          </div>

          {isFolha(categoriaAtual) && (
            <div className="field" style={{ marginTop: 14 }}>
              <label>Tag (opcional — categoria de folha)</label>
              <select value={form.TAG} onChange={(e) => setForm({ ...form, TAG: e.target.value })}>
                <option value="">(sem tag)</option>
                {tags.map((t) => <option key={t.UUID} value={t.TAG}>{t.TAG}</option>)}
              </select>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Ao salvar, esta tag é aplicada automaticamente a todos os custos
                deste item (os já lançados e os futuros).
              </p>
            </div>
          )}
          {error && <div className="error-msg">{error}</div>}
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          message={`Excluir o item "${confirm.DESCRICAO_ITEM}"?`}
          onConfirm={() => excluir(confirm.UUID)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {showBulk && (
        <Modal
          title={`Editar em massa (${selected.size} itens)`}
          onClose={() => setShowBulk(false)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setShowBulk(false)} disabled={bulkSaving}>Cancelar</button>
              <button className="btn" onClick={aplicarBulk} disabled={bulkSaving}>
                {bulkSaving ? 'Aplicando...' : 'Aplicar a todos'}
              </button>
            </>
          )}
        >
          <p className="muted" style={{ marginTop: 0 }}>
            O valor escolhido é aplicado aos {selected.size} itens selecionados — e os
            custos desses itens são sincronizados (o item é a fonte da verdade).
          </p>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Campo</label>
            <select
              value={bulkCampo}
              onChange={(e) => { setBulkCampo(e.target.value); setBulkValor(''); setBulkError(''); }}
            >
              <option value="SUB_CATEGORIA">Subcategoria</option>
              <option value="TAG">Tag (folha)</option>
            </select>
          </div>
          <div className="field">
            <label>{bulkCampo === 'SUB_CATEGORIA' ? 'Nova subcategoria' : 'Nova tag'}</label>
            {bulkCampo === 'SUB_CATEGORIA' ? (
              <select value={bulkValor} onChange={(e) => setBulkValor(e.target.value)}>
                <option value="">Selecione...</option>
                {subcats.map((s) => (
                  <option key={s.SUB_CATEGORIA} value={s.SUB_CATEGORIA}>{s.SUB_CATEGORIA} — {s.CATEGORIA}</option>
                ))}
              </select>
            ) : (
              <select value={bulkValor} onChange={(e) => setBulkValor(e.target.value)}>
                <option value="">(limpar tag)</option>
                {tags.map((t) => <option key={t.UUID} value={t.TAG}>{t.TAG}</option>)}
              </select>
            )}
          </div>
          {bulkCampo === 'TAG' ? (
            <p className="muted" style={{ fontSize: 12 }}>
              A tag só se aplica a itens de <b>folha</b>; itens de outras categorias na seleção são ignorados.
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>
              A categoria é derivada da subcategoria. Se a nova categoria não for de folha, a tag dos itens/custos afetados é limpa.
            </p>
          )}
          {bulkError && <div className="error-msg">{bulkError}</div>}
        </Modal>
      )}

      {showImport && (
        <ImportModal
          title="Importar Itens"
          hint='A planilha deve ter as colunas "ITENS", "SUB CATEGORIA" e "CATEGORIA". A categoria é derivada da subcategoria pelo mapa interno (com fallback para a categoria do arquivo). Itens repetidos são ignorados.'
          parse={parseItens}
          onImport={(rows) => itensApi.importar(rows)}
          chunkSize={5000}
          templateColumns={['ITENS', 'SUB CATEGORIA', 'CATEGORIA']}
          templateName="modelo-itens.xlsx"
          renderResult={(r) => <ImportResult result={r} />}
          onClose={() => setShowImport(false)}
          onDone={carregar}
        />
      )}

      {showClassificar && (
        <ClassificarItensModal
          onClose={() => { setShowClassificar(false); carregar(); }}
          onChanged={(restantes) => {
            setQtdAClassificar(restantes);
            if (restantes === 0) setShowClassificar(false);
          }}
          onSubcategoriasChanged={carregar}
        />
      )}

      {showSubcats && (
        <SubcategoriasModal
          onClose={() => setShowSubcats(false)}
          onChanged={carregar}
        />
      )}
    </div>
  );
}
