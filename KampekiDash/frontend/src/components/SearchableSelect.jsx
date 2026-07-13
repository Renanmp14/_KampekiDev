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
 *  - onPick(opt): chamado APENAS quando uma opção é escolhida (clique/Enter) —
 *    útil para usar o combo como "adicionador" (multi-seleção via chips).
 *  - options: string[] (as opções)
 *  - placeholder, disabled, emptyText, maxVisible
 *  - fixedMenu: quando true, a lista abre com position:fixed (ancorada ao input),
 *    escapando de contêineres com overflow (ex.: tabela rolável dentro de modal).
 */
export default function SearchableSelect({
  value = '',
  onChange,
  onPick,
  options = [],
  placeholder = '',
  disabled = false,
  emptyText = 'Nenhuma opção',
  maxVisible = Infinity, // sem corte: mostra todas as opções (a lista rola)
  fixedMenu = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // `touched` = usuário já digitou algo desde que abriu. Enquanto não digita,
  // a lista mostra TODAS as opções (não pré-filtra pelo valor atual) — assim a
  // abertura fica igual esteja o campo vazio ou já preenchido.
  const [touched, setTouched] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuStyle, setMenuStyle] = useState(null); // posição fixed (fixedMenu)
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

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

  // Modo fixedMenu: ancora a lista ao input via position:fixed, recalculando ao
  // rolar/redimensionar (inclusive rolagem de contêineres internos, via capture).
  useEffect(() => {
    if (!fixedMenu || !open) { setMenuStyle(null); return undefined; }
    function reposicionar() {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed', top: r.bottom + 4, left: r.left, width: r.width, right: 'auto',
      });
    }
    reposicionar();
    window.addEventListener('scroll', reposicionar, true);
    window.addEventListener('resize', reposicionar);
    return () => {
      window.removeEventListener('scroll', reposicionar, true);
      window.removeEventListener('resize', reposicionar);
    };
  }, [fixedMenu, open]);

  function abrir() {
    if (disabled) return;
    setTouched(false);
    setQuery('');
    setHighlight(0);
    setOpen(true);
  }

  function escolher(opt) {
    if (onPick) onPick(opt); else onChange(opt);
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
        ref={inputRef}
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
        <ul className="ss-list" style={fixedMenu ? (menuStyle || undefined) : undefined}>
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
