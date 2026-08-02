import React, { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import ImportModal from './ImportModal.jsx';
import ImportResult from './ImportResult.jsx';
import { podeEscrever } from '../api/client.js';

// CRUD genérico para cadastros de campo único (Fornecedor, Tag).
// importConfig (opcional): { hint, parse, onImport } habilita o botão de importação.
// searchable (opcional): exibe um campo de busca livre que filtra a lista.
export default function SimpleCrudPage({
  title, fieldLabel, fieldKey, api, importConfig, searchable = false,
}) {
  // Perfil de consulta não vê os controles de escrita (o backend também barra).
  const escrever = podeEscrever();
  const [items, setItems] = useState([]);
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // UUID em edição
  const [editValue, setEditValue] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => String(it[fieldKey] || '').toLowerCase().includes(q));
  }, [items, query, fieldKey]);

  async function carregar() {
    setLoading(true);
    try {
      setItems(await api.listar());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function adicionar(e) {
    e.preventDefault();
    setError('');
    if (!value.trim()) return;
    try {
      await api.criar({ [fieldKey]: value.trim() });
      setValue('');
      await carregar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function salvarEdicao(uuid) {
    setError('');
    try {
      await api.atualizar(uuid, { [fieldKey]: editValue.trim() });
      setEditing(null);
      await carregar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function excluir(uuid) {
    setError('');
    try {
      await api.remover(uuid);
      setConfirm(null);
      await carregar();
    } catch (err) {
      setError(err.message);
      setConfirm(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">{title}</h1>

      <div className="card">
        {escrever && (
          <form className="form-row" onSubmit={adicionar}>
            <div className="field">
              <label>{fieldLabel}</label>
              <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={fieldLabel} />
            </div>
            <button className="btn" type="submit">Adicionar</button>
            {importConfig && (
              <button type="button" className="btn btn-ghost" onClick={() => setShowImport(true)}>
                Importar planilha
              </button>
            )}
          </form>
        )}
        {error && <div className="error-msg">{error}</div>}
      </div>

      <div className="card">
        <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            Cadastrados ({searchable && query.trim() ? `${visibleItems.length}/${items.length}` : items.length})
          </h3>
          {searchable && (
            <input
              style={{ maxWidth: 260 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Pesquisar ${fieldLabel.toLowerCase()}...`}
            />
          )}
        </div>
        {loading ? <div className="empty">Carregando...</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{fieldLabel}</th>
                  <th style={{ width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((it) => (
                  <tr key={it.UUID}>
                    <td>
                      {editing === it.UUID ? (
                        <input value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                      ) : it[fieldKey]}
                    </td>
                    <td>
                      <div className="row-actions">
                        {editing === it.UUID ? (
                          <>
                            <button className="btn btn-sm" onClick={() => salvarEdicao(it.UUID)}>Salvar</button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
                          </>
                        ) : escrever && (
                          <>
                            <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(it.UUID); setEditValue(it[fieldKey]); }}>Editar</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setConfirm(it)}>Excluir</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleItems.length === 0 && (
                  <tr><td colSpan={2} className="empty">
                    {items.length === 0 ? 'Nenhum registro.' : 'Nenhum resultado para a busca.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          message={`Excluir "${confirm[fieldKey]}"?`}
          onConfirm={() => excluir(confirm.UUID)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {showImport && importConfig && (
        <ImportModal
          title={`Importar ${title}`}
          hint={importConfig.hint}
          parse={importConfig.parse}
          onImport={importConfig.onImport}
          chunkSize={importConfig.chunkSize}
          templateColumns={importConfig.templateColumns}
          templateName={importConfig.templateName}
          renderResult={(r) => <ImportResult result={r} />}
          onClose={() => setShowImport(false)}
          onDone={carregar}
        />
      )}
    </div>
  );
}
