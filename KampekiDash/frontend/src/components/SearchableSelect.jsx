import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';

// Normaliza para busca: sem acento, minúsculo, sem espaços nas pontas.
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase();

/**
 * Combobox pesquisável (input + lista filtrada renderizada por nós).
 * Diferente do <datalist> nativo, filtra de forma consistente mesmo com
 * milhares de opções (ex.: fornecedores) e limita a exibição a `maxVisible`.
 *
 * Aceita texto livre: `onChange` recebe o que o usuário digita/seleciona.
 *
 * props:
 *  - value: string atual
 *  - onChange(v): chamado ao digitar ou selecionar
 *  - options: string[] (as opções)
 *  - placeholder, disabled, emptyText, maxVisible
 */
export default function SearchableSelect({
  value = '',
  onChange,
  options = [],
  placeholder = '',
  disabled = false,
  emptyText = 'Nenhuma opção',
  maxVisible = Infinity, // sem corte: mostra todas as opções (a lista rola)
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // `touched` = usuário já digitou algo desde que abriu. Enquanto não digita,
  // a lista mostra TODAS as opções (não pré-filtra pelo valor atual) — assim a
  // abertura fica igual esteja o campo vazio ou já preenchido.
  const [touched, setTouched] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  // Só filtra depois que o usuário digita; antes disso, lista cheia.
  const filterText = touched ? query : '';
  // Mostra o valor atual no campo até o usuário digitar.
  const display = open ? (touched ? query : value) : value;

  const filtered = useMemo(() => {
    const q = norm(filterText);
    const base = q ? options.filter((o) => norm(o).includes(q)) : options;
    return base.slice(0, maxVisible);
  }, [options, filterText, maxVisible]);

  const totalMatches = useMemo(() => {
    const q = norm(filterText);
    return q ? options.filter((o) => norm(o).includes(q)).length : options.length;
  }, [options, filterText]);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function abrir() {
    if (disabled) return;
    setTouched(false);
    setQuery('');
    setHighlight(0);
    setOpen(true);
  }

  function escolher(opt) {
    onChange(opt);
    setQuery(opt);
    setTouched(false);
    setOpen(false);
  }

  function onInput(e) {
    const v = e.target.value;
    setTouched(true);
    setQuery(v);
    onChange(v); // texto livre permitido
    setHighlight(0);
    setOpen(true);
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { abrir(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) { e.preventDefault(); escolher(filtered[highlight]); }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="ss-wrap" ref={wrapRef}>
      <input
        className="ss-input"
        value={display}
        onChange={onInput}
        onFocus={abrir}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && (
        <ul className="ss-list">
          {filtered.length === 0 && <li className="ss-empty">{emptyText}</li>}
          {filtered.map((opt, i) => (
            <li
              key={opt}
              className={`ss-opt${i === highlight ? ' ss-opt-hl' : ''}${norm(opt) === norm(value) ? ' ss-opt-sel' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); escolher(opt); }}
              onMouseEnter={() => setHighlight(i)}
            >
              {opt}
            </li>
          ))}
          {totalMatches > filtered.length && (
            <li className="ss-more">
              +{totalMatches - filtered.length} resultado(s) — refine a busca
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
