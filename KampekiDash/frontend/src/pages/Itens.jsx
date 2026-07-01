import React, { useEffect, useMemo, useState } from 'react';
import { itensApi, custosApi, tagApi } from '../api/resources.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import ImportModal from '../components/ImportModal.jsx';
import ImportResult from '../components/ImportResult.jsx';
import ClassificarItensModal from '../components/ClassificarItensModal.jsx';
import SubcategoriasModal from '../components/SubcategoriasModal.jsx';
import { parseItens } from '../utils/importParse.js';
import { categoriaBadgeClass } from '../utils/format.js';

const CATEGORIAS_FOLHA = ['FOLHA CANOAS', 'FOLHA POA', 'FOLHA TELE'];
const isFolha = (cat) => CATEGORIAS_FOLHA.includes(String(cat || '').toUpperCase());

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

  // Filtros combináveis: nome (texto), subcategoria e categoria.
  const [fNome, setFNome] = useState('');
  const [fSub, setFSub] = useState('');
  const [fCat, setFCat] = useState('');

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

  // Subcategorias visíveis no filtro: limitadas à categoria escolhida, se houver.
  const subcatsFiltro = useMemo(
    () => (fCat ? subcats.filter((s) => s.CATEGORIA === fCat) : subcats),
    [subcats, fCat],
  );

  const filtrados = useMemo(() => {
    const q = fNome.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !String(it.DESCRICAO_ITEM || '').toLowerCase().includes(q)) return false;
      if (fSub && it.SUB_CATEGORIA !== fSub) return false;
      if (fCat && it.CATEGORIA !== fCat) return false;
      return true;
    });
  }, [items, fNome, fSub, fCat]);

  const filtroAtivo = fNome.trim() || fSub || fCat;

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
      setReprocMsg(`Reprocessado: ${r.custosAtualizados} custo(s) atualizados a partir de ${r.itensComTag} item(ns) com tag.`);
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
          ? `Tag "${res.TAG}" aplicada a ${res.custosAtualizados} custo(s) deste item.`
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
              onChange={(e) => { setFCat(e.target.value); setFSub(''); }}
            >
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Subcategoria</label>
            <select value={fSub} onChange={(e) => setFSub(e.target.value)}>
              <option value="">Todas</option>
              {subcatsFiltro.map((s) => (
                <option key={s.SUB_CATEGORIA} value={s.SUB_CATEGORIA}>{s.SUB_CATEGORIA}</option>
              ))}
            </select>
          </div>
          {filtroAtivo && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setFNome(''); setFSub(''); setFCat(''); }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? <div className="empty">Carregando...</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Subcategoria</th>
                  <th>Categoria</th>
                  <th>Tag</th>
                  <th style={{ width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((it) => (
                  <tr key={it.UUID}>
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
                  <tr><td colSpan={5} className="empty">
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
