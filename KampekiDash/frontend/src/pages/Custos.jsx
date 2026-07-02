import React, { useEffect, useMemo, useState } from 'react';
import {
  custosApi, fornecedorApi, itensApi, tagApi,
} from '../api/resources.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ImportModal from '../components/ImportModal.jsx';
import ImportModalXml from '../components/ImportModalXml.jsx';
import ImportNfsePdfModal from '../components/ImportNfsePdfModal.jsx';
import ImportResult from '../components/ImportResult.jsx';
import ClassificarItensModal from '../components/ClassificarItensModal.jsx';
import CellUsageBar from '../components/CellUsageBar.jsx';
import { parseCustos } from '../utils/importParse.js';
import { brl, toNum, categoriaBadgeClass } from '../utils/format.js';

const CATEGORIAS_FOLHA = ['FOLHA CANOAS', 'FOLHA POA', 'FOLHA TELE'];
const isFolha = (cat) => CATEGORIAS_FOLHA.includes(String(cat || '').toUpperCase());

const emptyForm = {
  DATA_NOTA: '', NUM_NOTA: '', FORNECEDOR: '', ITEM_UUID: '',
  CATEGORIA: '', SUB_CATEGORIA: '',
  QTD: '', VALOR_UNIT: '', VALOR_TOTAL: '', TAG: '',
};

const norm = (s) => String(s || '').trim().toUpperCase();

// "2026-06-13" (input date) -> "13/06/2026"
function isoToBr(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
// "13/06/2026" -> "2026-06-13"
function brToIso(br) {
  const m = String(br || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

// MM/YYYY distintos presentes nas linhas (que têm data), ordenados.
function mesesAnoDistintos(rows) {
  const set = new Set();
  for (const r of rows) {
    const m = String(r.DATA_NOTA || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) set.add(`${m[2]}/${m[3]}`); // MM/YYYY
  }
  return [...set].sort((a, b) => {
    const [ma, ya] = a.split('/');
    const [mb, yb] = b.split('/');
    return `${ya}${ma}`.localeCompare(`${yb}${mb}`);
  });
}

// "03/2026" -> "31/03/2026" (último dia do mês).
function rotuloUltimoDia(mesAno) {
  const m = String(mesAno || '').match(/^(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const dia = new Date(+m[2], +m[1], 0).getDate();
  return `${String(dia).padStart(2, '0')}/${m[1]}/${m[2]}`;
}

/**
 * Etapa de importação de Custos: resolve as linhas SEM data.
 *  - 0 linhas sem data → não renderiza nada (válido).
 *  - 1 mês/ano no arquivo → usa-o automaticamente (último dia do mês).
 *  - 2+ meses/anos → usuário escolhe qual seguir.
 *  - nenhum mês no arquivo → usuário digita mês/ano manualmente.
 * Em todos os casos preenche extra.fallbackMesAno (MM/YYYY) e a validade.
 */
function CustosDateStep({ parsed, setExtra, setExtraValid }) {
  const semData = useMemo(
    () => parsed.rows.filter((r) => !String(r.DATA_NOTA || '').trim()).length,
    [parsed],
  );
  const meses = useMemo(() => mesesAnoDistintos(parsed.rows), [parsed]);
  const [sel, setSel] = useState('');
  const [mesManual, setMesManual] = useState('');
  const [anoManual, setAnoManual] = useState('');

  useEffect(() => {
    let fallback;
    let valid;
    if (semData === 0) {
      fallback = undefined; valid = true;
    } else if (meses.length === 1) {
      [fallback] = meses; valid = true;
    } else if (meses.length > 1) {
      fallback = sel || undefined; valid = Boolean(sel);
    } else {
      const mm = String(mesManual).padStart(2, '0');
      const ok = /^(0[1-9]|1[0-2])$/.test(mm) && /^\d{4}$/.test(String(anoManual));
      fallback = ok ? `${mm}/${anoManual}` : undefined; valid = ok;
    }
    setExtra((e) => ({ ...e, fallbackMesAno: fallback }));
    setExtraValid(valid);
  }, [semData, meses, sel, mesManual, anoManual, setExtra, setExtraValid]);

  if (semData === 0) return null;

  return (
    <div className="card" style={{ marginTop: 12, padding: 12, background: 'var(--bg-2, #1b1f29)' }}>
      <strong>⚠ {semData} linha(s) sem data</strong>
      {meses.length === 1 && (
        <p className="muted" style={{ marginBottom: 0 }}>
          O arquivo é todo de <b>{meses[0]}</b> — será atribuído <b>{rotuloUltimoDia(meses[0])}</b> a essas linhas.
        </p>
      )}
      {meses.length > 1 && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>O arquivo tem vários meses. Qual mês/ano usar nas linhas sem data?</label>
          <select value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Selecione...</option>
            {meses.map((m) => (
              <option key={m} value={m}>{m} → {rotuloUltimoDia(m)}</option>
            ))}
          </select>
        </div>
      )}
      {meses.length === 0 && (
        <>
          <p className="muted" style={{ marginTop: 4 }}>
            Nenhuma data válida no arquivo. Informe o mês/ano a usar (será o último dia do mês):
          </p>
          <div className="grid grid-2">
            <div className="field">
              <label>Mês (MM)</label>
              <input value={mesManual} onChange={(e) => setMesManual(e.target.value)} placeholder="03" maxLength={2} />
            </div>
            <div className="field">
              <label>Ano (YYYY)</label>
              <input value={anoManual} onChange={(e) => setAnoManual(e.target.value)} placeholder="2026" maxLength={4} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Custos() {
  const [custos, setCustos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [itens, setItens] = useState([]);
  const [subcats, setSubcats] = useState([]);
  const [categoriasCad, setCategoriasCad] = useState([]);
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [itemText, setItemText] = useState(''); // texto digitado no combo de item
  const [criandoItem, setCriandoItem] = useState(false);
  const [totalManual, setTotalManual] = useState(false); // total editado à mão
  const [editing, setEditing] = useState(null); // 'novo' | objeto | null
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showImportXml, setShowImportXml] = useState(false);
  const [showImportNfse, setShowImportNfse] = useState(false);
  const [showClassificar, setShowClassificar] = useState(false);
  const [qtdAClassificar, setQtdAClassificar] = useState(0);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Filtros da listagem.
  const [fMesAno, setFMesAno] = useState('');
  const [fCategoria, setFCategoria] = useState('');
  const [fFornecedor, setFFornecedor] = useState('');
  const [fNota, setFNota] = useState('');
  const [fItem, setFItem] = useState('');

  // Seleção / edição em massa.
  const [selected, setSelected] = useState(() => new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [bulkCampo, setBulkCampo] = useState('TAG');
  const [bulkValor, setBulkValor] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);
  const [bulkDelSaving, setBulkDelSaving] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [c, f, i, t, subs, cats, pend] = await Promise.all([
        custosApi.listar(), fornecedorApi.listar(), itensApi.listar(), tagApi.listar(),
        itensApi.subcategorias(), itensApi.categorias(),
        custosApi.itensAClassificar().catch(() => []),
      ]);
      setCustos(c);
      setFornecedores(f);
      setItens(i);
      setTags(t);
      setSubcats(subs);
      setCategoriasCad(cats);
      setQtdAClassificar(pend.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const itemSelecionado = useMemo(
    () => itens.find((i) => i.UUID === form.ITEM_UUID) || null,
    [itens, form.ITEM_UUID],
  );

  // --- Cascata Categoria → Subcategoria → Item (todos pesquisáveis) ----------
  // Categoria canônica (casa o texto digitado com a lista, case-insensitive).
  const categoriaResolvida = useMemo(
    () => categoriasCad.find((c) => norm(c) === norm(form.CATEGORIA)) || '',
    [categoriasCad, form.CATEGORIA],
  );
  // Subcategoria canônica (objeto { SUB_CATEGORIA, CATEGORIA }).
  const subResolvida = useMemo(
    () => subcats.find((s) => norm(s.SUB_CATEGORIA) === norm(form.SUB_CATEGORIA)) || null,
    [subcats, form.SUB_CATEGORIA],
  );
  // Opções de subcategoria: limitadas à categoria escolhida, se houver.
  const subcatsDaCategoria = useMemo(
    () => (categoriaResolvida ? subcats.filter((s) => s.CATEGORIA === categoriaResolvida) : subcats),
    [subcats, categoriaResolvida],
  );
  // Itens disponíveis no combo, do filtro mais específico para o mais amplo:
  // subcategoria → categoria → todos. Permite buscar o item diretamente,
  // respeitando o que já foi escolhido na cascata.
  const itensDisponiveis = useMemo(() => {
    if (subResolvida) return itens.filter((i) => norm(i.SUB_CATEGORIA) === norm(subResolvida.SUB_CATEGORIA));
    if (categoriaResolvida) return itens.filter((i) => norm(i.CATEGORIA) === norm(categoriaResolvida));
    return itens;
  }, [itens, subResolvida, categoriaResolvida]);
  // Resolve o texto do item para um item existente da lista disponível.
  const resolveItem = (txt) => itensDisponiveis.find((i) => norm(i.DESCRICAO_ITEM) === norm(txt)) || null;
  // Há texto de item novo (não casa com nenhum existente) → habilita criar inline.
  const itemNovo = Boolean(subResolvida && itemText.trim() && !form.ITEM_UUID);

  const exigeTag = isFolha(categoriaResolvida);
  const valorCalculado = toNum(form.QTD) * toNum(form.VALOR_UNIT);
  // Por padrão o total é QTD × V.Unit; se o usuário destravar "editar total",
  // passa a valer o que ele digitou.
  const valorTotal = totalManual ? toNum(form.VALOR_TOTAL) : valorCalculado;

  function abrirNovo() {
    setForm(emptyForm);
    setItemText('');
    setTotalManual(false);
    setEditing('novo');
    setError('');
    setShowForm(true);
  }

  // Cascata: trocar a categoria zera subcategoria/item; trocar a subcategoria zera o item.
  function setCategoria(v) {
    setForm((f) => ({ ...f, CATEGORIA: v, SUB_CATEGORIA: '', ITEM_UUID: '', TAG: '' }));
    setItemText('');
  }
  function setSubcategoria(v) {
    const s = subcats.find((x) => norm(x.SUB_CATEGORIA) === norm(v));
    setForm((f) => ({
      ...f,
      SUB_CATEGORIA: v,
      // Subcategoria que resolve preenche a categoria canônica (mantém consistência).
      CATEGORIA: s ? s.CATEGORIA : f.CATEGORIA,
      ITEM_UUID: '',
      TAG: isFolha(s ? s.CATEGORIA : f.CATEGORIA) ? f.TAG : '',
    }));
    setItemText('');
  }
  function onItemText(v) {
    setItemText(v);
    const it = resolveItem(v);
    setForm((f) => ({
      ...f,
      ITEM_UUID: it ? it.UUID : '',
      // Ao escolher um item direto, herda categoria/subcategoria dele — mantém a
      // cascata coerente mesmo quando o usuário busca pelo item primeiro.
      ...(it ? {
        CATEGORIA: it.CATEGORIA,
        SUB_CATEGORIA: it.SUB_CATEGORIA,
        // Herda a tag cadastrada no item (folha); senão mantém a que já estava.
        TAG: isFolha(it.CATEGORIA) ? (it.TAG || f.TAG) : '',
      } : {}),
    }));
  }
  // Cria o item novo (na subcategoria escolhida) sem sair do formulário e já o seleciona.
  async function criarItemInline() {
    const desc = itemText.trim();
    if (!desc || !subResolvida) return;
    setCriandoItem(true);
    setError('');
    try {
      const novo = await itensApi.criar({ DESCRICAO_ITEM: desc, SUB_CATEGORIA: subResolvida.SUB_CATEGORIA });
      const itemObj = {
        UUID: novo.UUID,
        DESCRICAO_ITEM: novo.DESCRICAO_ITEM,
        SUB_CATEGORIA: novo.SUB_CATEGORIA,
        CATEGORIA: novo.CATEGORIA,
      };
      setItens((prev) => [...prev, itemObj]);
      setForm((f) => ({ ...f, ITEM_UUID: novo.UUID }));
      setItemText(novo.DESCRICAO_ITEM);
    } catch (e) {
      setError(e.message);
    } finally {
      setCriandoItem(false);
    }
  }

  function abrirEdicao(c) {
    const item = itens.find((i) => i.DESCRICAO_ITEM === c.ITEM);
    const qtd = toNum(c.QTD);
    const vUnit = toNum(c.VALOR_UNIT);
    const vTotal = toNum(c.VALOR_TOTAL);
    // Detecta total ajustado à mão: se o gravado difere de QTD × V.Unit, abre já
    // em modo manual para não sobrescrever o ajuste ao salvar.
    const calculado = +(qtd * vUnit).toFixed(2);
    const manual = vTotal > 0 && Math.abs(vTotal - calculado) > 0.005;
    setForm({
      DATA_NOTA: c.DATA_NOTA,
      NUM_NOTA: c.NUM_NOTA,
      FORNECEDOR: c.FORNECEDOR,
      ITEM_UUID: item ? item.UUID : '',
      CATEGORIA: c.CATEGORIA || '',
      SUB_CATEGORIA: c.SUB_CATEGORIA || '',
      QTD: c.QTD,
      VALOR_UNIT: c.VALOR_UNIT,
      VALOR_TOTAL: manual ? c.VALOR_TOTAL : '',
      TAG: c.TAG || '',
    });
    setItemText(c.ITEM || '');
    setTotalManual(manual);
    setEditing(c);
    setError('');
    setShowForm(true);
  }

  function validarLocal() {
    if (!form.DATA_NOTA) return 'Informe a data da nota';
    if (!form.NUM_NOTA) return 'Informe o número da nota';
    if (!form.FORNECEDOR) return 'Selecione o fornecedor';
    if (!categoriaResolvida) return 'Selecione a categoria';
    if (!subResolvida) return 'Selecione a subcategoria';
    if (!form.ITEM_UUID) return itemText.trim() ? 'Crie o item novo (botão) ou selecione um existente' : 'Selecione o item';
    if (toNum(form.QTD) <= 0) return 'Quantidade inválida';
    if (toNum(form.VALOR_UNIT) < 0) return 'Valor unitário inválido';
    if (exigeTag && !form.TAG) return 'Selecione a tag (categoria de folha)';
    return '';
  }

  function tentarSalvar() {
    const msg = validarLocal();
    if (msg) { setError(msg); return; }
    setError('');
    setShowConfirmSave(true);
  }

  async function confirmarSalvar() {
    setError('');
    try {
      const payload = {
        ...form,
        TAG: exigeTag ? form.TAG : '',
        // Só envia total quando editado à mão; vazio = backend calcula QTD × V.Unit.
        VALOR_TOTAL: totalManual ? form.VALOR_TOTAL : '',
      };
      if (editing === 'novo') {
        await custosApi.criar(payload);
      } else {
        await custosApi.atualizar(editing.UUID, payload);
      }
      setShowConfirmSave(false);
      setShowForm(false);
      setEditing(null);
      await carregar();
    } catch (err) {
      setError(err.message);
      setShowConfirmSave(false);
    }
  }

  async function excluir(uuid) {
    try {
      await custosApi.remover(uuid);
      setConfirmDel(null);
      await carregar();
    } catch (err) {
      setError(err.message);
      setConfirmDel(null);
    }
  }

  // Opções de filtro derivadas dos dados.
  const mesesAno = useMemo(
    () => [...new Set(custos.map((c) => c.MES_ANO).filter(Boolean))].sort(),
    [custos],
  );
  const categorias = useMemo(
    () => [...new Set(custos.map((c) => c.CATEGORIA).filter(Boolean))].sort(),
    [custos],
  );

  const filtrados = custos.filter((c) => {
    const nota = fNota.trim().toLowerCase();
    const item = fItem.trim().toLowerCase();
    return (!fMesAno || c.MES_ANO === fMesAno)
      && (!fCategoria || c.CATEGORIA === fCategoria)
      && (!fFornecedor || c.FORNECEDOR === fFornecedor)
      && (!nota || String(c.NUM_NOTA || '').toLowerCase().includes(nota))
      && (!item || String(c.ITEM || '').toLowerCase().includes(item));
  });

  const totalFiltrado = filtrados.reduce((s, c) => s + toNum(c.VALOR_TOTAL), 0);

  // --- Seleção em massa -----------------------------------------------------
  const uuidsFiltrados = filtrados.map((c) => c.UUID);
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
      if (todosVisiveisSelecionados) {
        uuidsFiltrados.forEach((u) => next.delete(u));
      } else {
        uuidsFiltrados.forEach((u) => next.add(u));
      }
      return next;
    });
  }

  function limparSelecao() {
    setSelected(new Set());
  }

  function abrirBulk() {
    setBulkCampo('TAG');
    setBulkValor('');
    setBulkError('');
    setShowBulk(true);
  }

  async function aplicarBulk() {
    setBulkError('');
    if (bulkCampo === 'FORNECEDOR' && !bulkValor) {
      setBulkError('Selecione o fornecedor'); return;
    }
    setBulkSaving(true);
    try {
      const uuids = [...selected];
      await custosApi.atualizarEmMassa({ uuids, campo: bulkCampo, valor: bulkValor });
      setShowBulk(false);
      limparSelecao();
      await carregar();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkSaving(false);
    }
  }

  async function excluirEmMassa() {
    setError('');
    setBulkDelSaving(true);
    try {
      const uuids = [...selected];
      await custosApi.removerEmMassa(uuids);
      setConfirmBulkDel(false);
      limparSelecao();
      await carregar();
    } catch (err) {
      setError(err.message);
      setConfirmBulkDel(false);
    } finally {
      setBulkDelSaving(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Custos</h1>

      <CellUsageBar />

      <div className="toolbar">
        <button className="btn" onClick={abrirNovo}>+ Novo lançamento</button>
        <button className="btn btn-ghost" onClick={() => setShowImport(true)}>Importar planilha</button>
        <button className="btn btn-ghost" onClick={() => setShowImportXml(true)}>Importar NF-e (.zip)</button>
        <button className="btn btn-ghost" onClick={() => setShowImportNfse(true)}>Importar NFS-e (PDF)</button>
        {qtdAClassificar > 0 && (
          <button
            className="btn btn-sm"
            style={{ background: 'var(--down, #e0a800)', color: '#1b1f29' }}
            title="Itens importados sem categoria/subcategoria"
            onClick={() => setShowClassificar(true)}
          >
            ⚠ {qtdAClassificar} item(ns) a classificar
          </button>
        )}
        <div className="spacer" />
        <div className="field" style={{ maxWidth: 150 }}>
          <label>Mês/Ano</label>
          <select value={fMesAno} onChange={(e) => setFMesAno(e.target.value)}>
            <option value="">Todos</option>
            {mesesAno.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 180 }}>
          <label>Categoria</label>
          <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 180 }}>
          <label>Fornecedor</label>
          <select value={fFornecedor} onChange={(e) => setFFornecedor(e.target.value)}>
            <option value="">Todos</option>
            {fornecedores.map((f) => <option key={f.UUID} value={f.NOME_FORNECEDOR}>{f.NOME_FORNECEDOR}</option>)}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 150 }}>
          <label>Nº Nota</label>
          <input value={fNota} onChange={(e) => setFNota(e.target.value)} placeholder="Pesquisar nota..." />
        </div>
        <div className="field" style={{ maxWidth: 180 }}>
          <label>Item</label>
          <input value={fItem} onChange={(e) => setFItem(e.target.value)} placeholder="Pesquisar item..." />
        </div>
      </div>

      <div className="card">
        <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            {filtrados.length} lançamentos · Total {brl(totalFiltrado)}
          </h3>
          {selected.size > 0 && (
            <div className="row-actions" style={{ alignItems: 'center', gap: 8 }}>
              <span className="muted">{selected.size} selecionado(s)</span>
              <button className="btn btn-sm" onClick={abrirBulk}>Editar em massa</button>
              <button className="btn btn-sm btn-danger" onClick={() => setConfirmBulkDel(true)}>Excluir selecionados</button>
              <button className="btn btn-sm btn-ghost" onClick={limparSelecao}>Limpar seleção</button>
            </div>
          )}
        </div>
        {loading ? <div className="empty">Carregando...</div> : (
          <div className="table-wrap">
            <table className="sticky-actions">
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
                  <th>Data</th>
                  <th>Nº Nota</th>
                  <th>Fornecedor</th>
                  <th>Item</th>
                  <th>Categoria</th>
                  <th>Tag</th>
                  <th className="num">Qtd</th>
                  <th className="num">V. Unit</th>
                  <th className="num">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.UUID} className={selected.has(c.UUID) ? 'selected-row' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(c.UUID)}
                        onChange={() => toggleUm(c.UUID)}
                      />
                    </td>
                    <td>{c.DATA_NOTA}</td>
                    <td>{c.NUM_NOTA}</td>
                    <td>{c.FORNECEDOR}</td>
                    <td>{c.ITEM}</td>
                    <td><span className={categoriaBadgeClass(c.CATEGORIA)}>{c.CATEGORIA}</span></td>
                    <td>{c.TAG || '—'}</td>
                    <td className="num">{toNum(c.QTD)}</td>
                    <td className="num">{brl(c.VALOR_UNIT)}</td>
                    <td className="num">{brl(c.VALOR_TOTAL)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => abrirEdicao(c)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDel(c)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && <tr><td colSpan={11} className="empty">Nenhum lançamento.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal
          title={editing === 'novo' ? 'Novo custo' : 'Editar custo'}
          onClose={() => setShowForm(false)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn" onClick={tentarSalvar}>Revisar e salvar</button>
            </>
          )}
        >
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Data da nota</label>
              <input
                type="date"
                value={brToIso(form.DATA_NOTA)}
                onChange={(e) => setForm({ ...form, DATA_NOTA: isoToBr(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Nº Nota</label>
              <input value={form.NUM_NOTA} onChange={(e) => setForm({ ...form, NUM_NOTA: e.target.value })} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Fornecedor</label>
            <input
              list="custo-forn-dl"
              value={form.FORNECEDOR}
              onChange={(e) => setForm({ ...form, FORNECEDOR: e.target.value })}
              placeholder="Selecionar ou digitar..."
            />
            <datalist id="custo-forn-dl">
              {fornecedores.map((f) => <option key={f.UUID} value={f.NOME_FORNECEDOR} />)}
            </datalist>
          </div>

          {/* Cascata Categoria → Subcategoria → Item (todos pesquisáveis por digitação) */}
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Categoria</label>
              <input
                list="custo-cat-dl"
                value={form.CATEGORIA}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Selecionar ou digitar..."
              />
              <datalist id="custo-cat-dl">
                {categoriasCad.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="field">
              <label>Subcategoria</label>
              <input
                list="custo-sub-dl"
                value={form.SUB_CATEGORIA}
                onChange={(e) => setSubcategoria(e.target.value)}
                placeholder={categoriaResolvida ? 'Selecionar ou digitar...' : 'Escolha a categoria (ou digite)'}
              />
              <datalist id="custo-sub-dl">
                {subcatsDaCategoria.map((s) => <option key={s.SUB_CATEGORIA} value={s.SUB_CATEGORIA} />)}
              </datalist>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Item</label>
            <input
              list="custo-item-dl"
              value={itemText}
              onChange={(e) => onItemText(e.target.value)}
              placeholder="Digite para buscar o item..."
            />
            <datalist id="custo-item-dl">
              {itensDisponiveis.map((i) => <option key={i.UUID} value={i.DESCRICAO_ITEM} />)}
            </datalist>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {subResolvida
                ? `Buscando entre os itens da subcategoria ${subResolvida.SUB_CATEGORIA} (${itensDisponiveis.length}).`
                : categoriaResolvida
                  ? `Buscando entre os itens da categoria ${categoriaResolvida} (${itensDisponiveis.length}). Escolha a subcategoria para refinar.`
                  : `Buscando entre todos os itens (${itensDisponiveis.length}). Escolha categoria/subcategoria para refinar.`}
            </p>
            {form.ITEM_UUID && (
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>✓ Item existente selecionado</p>
            )}
            {itemNovo && (
              <div className="row-actions" style={{ marginTop: 6, justifyContent: 'flex-start', alignItems: 'center', gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={criarItemInline} disabled={criandoItem}>
                  {criandoItem ? 'Criando...' : `➕ Criar item "${itemText.trim()}" em ${subResolvida.SUB_CATEGORIA}`}
                </button>
                <span className="muted" style={{ fontSize: 12 }}>item não encontrado nesta subcategoria</span>
              </div>
            )}
            {!form.ITEM_UUID && itemText.trim() && !subResolvida && (
              <span className="muted" style={{ fontSize: 12 }}>
                Para criar um item novo, selecione antes a subcategoria.
              </span>
            )}
          </div>

          {exigeTag && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Tag (obrigatória para folha)</label>
              <select value={form.TAG} onChange={(e) => setForm({ ...form, TAG: e.target.value })}>
                <option value="">Selecione...</option>
                {tags.map((t) => <option key={t.UUID} value={t.TAG}>{t.TAG}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Quantidade</label>
              <input type="number" step="any" value={form.QTD} onChange={(e) => setForm({ ...form, QTD: e.target.value })} />
            </div>
            <div className="field">
              <label>Valor unitário</label>
              <input type="number" step="any" value={form.VALOR_UNIT} onChange={(e) => setForm({ ...form, VALOR_UNIT: e.target.value })} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>Valor total</label>
              {totalManual ? (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setTotalManual(false); setForm({ ...form, VALOR_TOTAL: '' }); }}
                >
                  ↺ recalcular (Qtd × V.Unit)
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setTotalManual(true); setForm({ ...form, VALOR_TOTAL: valorCalculado }); }}
                >
                  ✏ editar total
                </button>
              )}
            </div>
            {totalManual ? (
              <input
                type="number"
                step="any"
                value={form.VALOR_TOTAL}
                onChange={(e) => setForm({ ...form, VALOR_TOTAL: e.target.value })}
              />
            ) : (
              <div className="kpi-value" style={{ marginTop: 4 }}>{brl(valorTotal)}</div>
            )}
            {totalManual && (
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Total ajustado manualmente — calculado seria {brl(valorCalculado)}.
              </p>
            )}
          </div>

          {error && <div className="error-msg">{error}</div>}
        </Modal>
      )}

      {showConfirmSave && (
        <Modal
          title="Confirmar lançamento"
          onClose={() => setShowConfirmSave(false)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setShowConfirmSave(false)}>Voltar</button>
              <button className="btn" onClick={confirmarSalvar}>Confirmar e salvar</button>
            </>
          )}
        >
          <div className="modal-summary">
            <div><span className="muted">Data</span><span>{form.DATA_NOTA}</span></div>
            <div><span className="muted">Nº Nota</span><span>{form.NUM_NOTA}</span></div>
            <div><span className="muted">Fornecedor</span><span>{form.FORNECEDOR}</span></div>
            <div><span className="muted">Item</span><span>{itemSelecionado?.DESCRICAO_ITEM}</span></div>
            <div><span className="muted">Categoria</span><span>{itemSelecionado?.CATEGORIA}</span></div>
            {exigeTag && <div><span className="muted">Tag</span><span>{form.TAG}</span></div>}
            <div><span className="muted">Qtd × V.Unit</span><span>{toNum(form.QTD)} × {brl(form.VALOR_UNIT)}</span></div>
            <div className="total"><span>Total</span><span>{brl(valorTotal)}</span></div>
          </div>
          {error && <div className="error-msg">{error}</div>}
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog
          message={`Excluir o lançamento de ${confirmDel.ITEM} (${confirmDel.DATA_NOTA})?`}
          onConfirm={() => excluir(confirmDel.UUID)}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      {confirmBulkDel && (
        <ConfirmDialog
          message={`Excluir os ${selected.size} lançamentos selecionados? Esta ação não pode ser desfeita.`}
          confirmLabel={bulkDelSaving ? 'Excluindo...' : `Excluir ${selected.size}`}
          onConfirm={excluirEmMassa}
          onCancel={() => setConfirmBulkDel(false)}
        />
      )}

      {showBulk && (
        <Modal
          title={`Editar em massa (${selected.size} lançamentos)`}
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
            O valor escolhido será replicado para os {selected.size} lançamentos selecionados.
          </p>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Campo</label>
            <select
              value={bulkCampo}
              onChange={(e) => { setBulkCampo(e.target.value); setBulkValor(''); setBulkError(''); }}
            >
              <option value="TAG">Tag</option>
              <option value="FORNECEDOR">Fornecedor</option>
            </select>
          </div>
          <div className="field">
            <label>{bulkCampo === 'TAG' ? 'Nova tag' : 'Novo fornecedor'}</label>
            {bulkCampo === 'TAG' ? (
              <select value={bulkValor} onChange={(e) => setBulkValor(e.target.value)}>
                <option value="">(limpar tag)</option>
                {tags.map((t) => <option key={t.UUID} value={t.TAG}>{t.TAG}</option>)}
              </select>
            ) : (
              <select value={bulkValor} onChange={(e) => setBulkValor(e.target.value)}>
                <option value="">Selecione...</option>
                {fornecedores.map((f) => <option key={f.UUID} value={f.NOME_FORNECEDOR}>{f.NOME_FORNECEDOR}</option>)}
              </select>
            )}
          </div>
          {bulkCampo === 'TAG' && (
            <p className="muted" style={{ fontSize: 12 }}>
              Útil para tagear de uma vez os custos de folha (filtre pela categoria, selecione todos e aplique).
            </p>
          )}
          {bulkError && <div className="error-msg">{bulkError}</div>}
        </Modal>
      )}

      {showImport && (
        <ImportModal
          title="Importar Custos"
          hint='Colunas esperadas: DATA, N° NOTA, LISTA FORNECEDOR, ITENS, SUB CATEGORIA, CATEGORIA, UN, VALOR, TOTAL (opcional). O sistema deriva mês/ano da data, usa o TOTAL do arquivo quando vier preenchido (senão calcula UN × VALOR), cria fornecedores e itens que ainda não existem e deixa a tag em branco nos itens de folha. Linhas sem nota viram "Sem Nota", sem fornecedor viram "Sem Fornecedor", e linhas sem data recebem o último dia do mês (do arquivo ou informado abaixo).'
          parse={parseCustos}
          onImport={(rows, extra) => custosApi.importar(rows, extra)}
          renderExtra={(ctx) => <CustosDateStep {...ctx} />}
          chunkSize={2000}
          templateColumns={['DATA', 'N° NOTA', 'LISTA FORNECEDOR', 'ITENS', 'SUB CATEGORIA', 'CATEGORIA', 'UN', 'VALOR', 'TOTAL']}
          templateName="modelo-custos.xlsx"
          renderResult={(r) => <ImportResult result={r} />}
          onClose={() => setShowImport(false)}
          onDone={carregar}
        />
      )}

      {showImportXml && (
        <ImportModalXml
          onImport={(notas) => custosApi.importarXml(notas)}
          renderResult={(r) => <ImportResult result={r} />}
          onClose={() => setShowImportXml(false)}
          onDone={carregar}
        />
      )}

      {showImportNfse && (
        <ImportNfsePdfModal
          fornecedores={fornecedores}
          itens={itens}
          custos={custos}
          onClose={() => setShowImportNfse(false)}
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
    </div>
  );
}
