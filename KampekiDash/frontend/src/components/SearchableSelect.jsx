import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';

// Normaliza para busca: sem acento, minúsculo, sem espaços nas pontas.
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase();

const ROW_H = 34; // altura fixa de cada opção (px) — base da virtualização
const VIEWPORT_H = 260; // deve casar com o max-height de .ss-list no CSS
const OVERSCAN = 8; // linhas extras acima/abaixo da viewport (rolagem suave)

/**
 * Combobox pesquisável (input + lista renderizada por nós).
 * Projetado para listas MUITO grandes (ex.: itens, ~10k+): a lista é
 * VIRTUALIZADA (só as linhas visíveis vão ao DOM) e as opções são normalizadas
 * uma única vez (memo), então filtrar/abrir não trava mesmo com dezenas de
 * milhares de opções. Diferente do <datalist> nativo, segue o CSS do app.
 *
 * IMPORTANTE (performance): passe `options` com identidade ESTÁVEL (memoize o
 * array no pai). Se um novo array for criado a cada tecla, a normalização de
 * todas as opções refaz a cada keystroke e volta a travar.
 *
 * Aceita texto livre: `onChange` recebe o que o usuário digita/seleciona.
 *
 * props:
 *  - value, onChange(v), onPick(opt), options: string[]
 *  - placeholder, disabled, emptyText
 *  - fixedMenu: lista com position:fixed (escapa de contêineres com overflow).
 *  - debounceMs: adia o filtro e o onChange até a pessoa PARAR de digitar (a
 *    digitação fica fluida; o trabalho pesado — filtrar 10k+ e o re-render do
 *    pai — só roda na pausa). 0 desliga o debounce.
 */
export default function SearchableSelect({
  value = '',
  onChange,
  onPick,
  options = [],
  placeholder = '',
  disabled = false,
  emptyText = 'Nenhuma opção',
  fixedMenu = false,
  debounceMs = 500,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(''); // texto imediato (o que o campo mostra)
  const [debounced, setDebounced] = useState(''); // texto "confirmado" (filtra/onChange)
  // `touched` = usuário já digitou algo desde que abriu. Enquanto não digita,
  // a lista mostra TODAS as opções (não pré-filtra pelo valor atual).
  const [touched, setTouched] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuStyle, setMenuStyle] = useState(null); // posição fixed (fixedMenu)
  const [scrollTop, setScrollTop] = useState(0); // virtualização
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const timerRef = useRef(null); // debounce da digitação

  // O filtro usa o texto DEBOUNCED (só muda quando a pessoa para de digitar); o
  // campo mostra o texto imediato — por isso a digitação nunca "engasga".
  const filterText = touched ? debounced : '';
  const display = open ? (touched ? query : value) : value;

  // Normaliza as opções UMA vez (por identidade de `options`) — evita reprocessar
  // dezenas de milhares de strings a cada tecla.
  const normalized = useMemo(() => options.map((o) => norm(o)), [options]);

  // Filtra reusando as strings já normalizadas (busca por trecho).
  const filtered = useMemo(() => {
    const q = norm(filterText);
    if (!q) return options;
    const res = [];
    for (let i = 0; i < options.length; i += 1) {
      if (normalized[i].includes(q)) res.push(options[i]);
    }
    return res;
  }, [options, normalized, filterText]);

  const nValue = norm(value);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    // Fase de CAPTURA (true): roda antes de qualquer stopPropagation no caminho do
    // evento. Necessário porque o Modal faz onMouseDown stopPropagation no seu
    // conteúdo — sem a captura, cliques dentro do modal não chegariam aqui e a
    // lista só fecharia no Esc.
    document.addEventListener('mousedown', onDocClick, true);
    return () => document.removeEventListener('mousedown', onDocClick, true);
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

  // Ao abrir ou trocar a busca, volta a rolagem ao topo.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [open, filterText]);

  // Mantém a opção destacada (teclado) visível dentro da viewport rolável.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current;
    const top = highlight * ROW_H;
    const bottom = top + ROW_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + VIEWPORT_H) el.scrollTop = bottom - VIEWPORT_H;
  }, [highlight, open]);

  // Limpa o debounce pendente (ao escolher, fechar ou desmontar).
  function cancelarDebounce() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }
  useEffect(() => cancelarDebounce, []);

  function abrir() {
    if (disabled) return;
    cancelarDebounce();
    setTouched(false);
    setQuery('');
    setDebounced('');
    setHighlight(0);
    setOpen(true);
  }

  function escolher(opt) {
    cancelarDebounce();
    if (onPick) onPick(opt); else onChange(opt);
    setQuery(opt);
    setDebounced(opt);
    setTouched(false);
    setOpen(false);
  }

  function onInput(e) {
    const v = e.target.value;
    setTouched(true);
    setQuery(v); // mostra na hora — digitação fluida
    setHighlight(0);
    setOpen(true);
    // Adia o trabalho pesado (filtro + onChange no pai) até a pausa da digitação.
    cancelarDebounce();
    if (debounceMs > 0) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setDebounced(v);
        onChange(v);
      }, debounceMs);
    } else {
      setDebounced(v);
      onChange(v);
    }
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
      // Se há filtro pendente (debounce), aplica-o AGORA em vez de selecionar sobre
      // uma lista desatualizada — evita escolher o item errado ao digitar rápido.
      if (timerRef.current) {
        e.preventDefault();
        cancelarDebounce();
        setDebounced(query);
        onChange(query);
        return;
      }
      if (open && filtered[highlight]) { e.preventDefault(); escolher(filtered[highlight]); }
    } else if (e.key === 'Escape') {
      cancelarDebounce();
      setOpen(false);
    }
  }

  // Janela virtual: só as linhas visíveis (± overscan) vão ao DOM. Spacers no
  // topo/base preservam a altura total (barra de rolagem coerente com o total).
  const total = filtered.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(total, Math.ceil((scrollTop + VIEWPORT_H) / ROW_H) + OVERSCAN);
  const topPad = startIndex * ROW_H;
  const botPad = Math.max(0, (total - endIndex) * ROW_H);
  const visible = filtered.slice(startIndex, endIndex);

  const optStyle = {
    height: ROW_H,
    lineHeight: `${ROW_H}px`,
    padding: '0 10px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

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
        <ul
          className="ss-list"
          ref={listRef}
          style={fixedMenu ? (menuStyle || undefined) : undefined}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          {total === 0 && <li className="ss-empty">{emptyText}</li>}
          {total > 0 && topPad > 0 && <li aria-hidden style={{ height: topPad }} />}
          {visible.map((opt, i) => {
            const idx = startIndex + i;
            return (
              <li
                key={`${idx}-${opt}`}
                className={`ss-opt${idx === highlight ? ' ss-opt-hl' : ''}${norm(opt) === nValue ? ' ss-opt-sel' : ''}`}
                style={optStyle}
                title={opt}
                onMouseDown={(e) => { e.preventDefault(); escolher(opt); }}
                onMouseEnter={() => setHighlight(idx)}
              >
                {opt}
              </li>
            );
          })}
          {total > 0 && botPad > 0 && <li aria-hidden style={{ height: botPad }} />}
        </ul>
      )}
    </div>
  );
}
