import React from 'react';
import SearchableSelect from './SearchableSelect.jsx';

/**
 * Campo de filtro de Fornecedor (multi-seleção com chips), usado por todos os
 * dashboards para que o comportamento seja idêntico em todos.
 *
 * O `SearchableSelect` entra como ADICIONADOR (`value=""` + `onPick`), o mesmo
 * padrão do filtro de tags do Dash Folha: digitar reduz a lista a cada tecla
 * (busca por trecho, sem acento/caixa) e a escolha vira um chip removível.
 *
 * `opcoes` deve chegar MEMOIZADO no pai — o SearchableSelect normaliza as opções
 * por identidade do array, e um array novo a cada render refaria esse trabalho.
 * É também onde nasce a cascata: quem monta `opcoes` já filtrou por
 * categoria/subcategoria/item (ver utils/fornecedorFiltro.js).
 */
export default function FornecedorFiltro({
  valores = [], onAdd, onRemove, opcoes = [], style,
}) {
  return (
    <div className="field" style={{ minWidth: 200, maxWidth: 260, margin: 0, ...style }}>
      <label>Fornecedor (um ou mais)</label>
      <SearchableSelect
        value=""
        onPick={onAdd}
        options={opcoes}
        placeholder="Adicionar fornecedor..."
        emptyText="Nenhum fornecedor no recorte"
      />
      {valores.length > 0 && (
        <div className="filtro-chips">
          {valores.map((f) => (
            <span key={f} className="filtro-chip">
              {f}
              <button type="button" onClick={() => onRemove(f)}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
