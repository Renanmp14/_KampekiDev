import React, { useEffect, useState } from 'react';

// Controle de zoom da ferramenta — serve para compensar a escala do sistema
// (ex.: 125% em Full HD) sem a tela ficar espremida. Persistido em localStorage.
//
// IMPORTANTE (corrigido na 1.6.2): antes o zoom era aplicado com `zoom` no CSS do
// elemento raiz. Isso escalava a página POR DENTRO, e qualquer código que
// calculasse posição do mouse passava a errar: o Recharts deriva a barra ativa de
// `event.pageX - getBoundingClientRect().left`, e as duas medidas deixavam de
// estar na mesma escala. Resultado: no Dash Custos, clique e tooltip dos gráficos
// caíam na barra errada — erro proporcional à distância da borda do gráfico.
//
// Agora:
//   • No app desktop, usa o zoom NATIVO do Chromium (window.kampekiZoom, exposto
//     por desktop/preload.js). O navegador escala tudo fora do sistema de
//     coordenadas da página, então hit-test e JS seguem coerentes.
//   • No navegador (versão web), não há como um script mudar o zoom nativo. Em
//     vez de reintroduzir o bug com CSS, o controle apenas indica o atalho do
//     próprio navegador (Ctrl + / Ctrl −), que funciona sem distorcer nada.
const KEY = 'kampeki_zoom';
const MIN = 60;
const MAX = 150;
const STEP = 10;

function clamp(z) {
  return Math.min(MAX, Math.max(MIN, z));
}

function ler() {
  const s = Number(localStorage.getItem(KEY));
  return Number.isFinite(s) && s >= MIN && s <= MAX ? s : 100;
}

/** A ponte do Electron, quando o app roda empacotado. `null` no navegador. */
function ponte() {
  const p = typeof window !== 'undefined' ? window.kampekiZoom : null;
  return p && typeof p.definir === 'function' ? p : null;
}

export function temZoomNativo() {
  return !!ponte();
}

function aplicar(pct) {
  const p = ponte();
  if (!p) return false;
  // Garante que não sobrou escala em CSS de versões anteriores do app.
  document.documentElement.style.zoom = '';
  try {
    p.definir(pct / 100);
    return true;
  } catch {
    return false;
  }
}

export function aplicarZoomSalvo() {
  aplicar(ler());
}

export default function ZoomControl() {
  const nativo = temZoomNativo();
  const [zoom, setZoom] = useState(ler);

  useEffect(() => {
    if (!nativo) return;
    if (aplicar(zoom)) localStorage.setItem(KEY, String(zoom));
  }, [zoom, nativo]);

  // Versão web: o zoom é o do navegador. Mostra o atalho em vez de um controle
  // que não funcionaria (ou que voltaria a distorcer os gráficos).
  if (!nativo) {
    return (
      <div className="zoom-control">
        <span className="zoom-label">Zoom da tela</span>
        <span className="zoom-hint">
          Use <b>Ctrl</b> + <b>+</b> / <b>−</b> do navegador
        </span>
      </div>
    );
  }

  return (
    <div className="zoom-control">
      <span className="zoom-label">Zoom da tela</span>
      <div className="zoom-buttons">
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setZoom((z) => clamp(z - STEP))}
          disabled={zoom <= MIN}
          title="Diminuir zoom"
          aria-label="Diminuir zoom"
        >
          −
        </button>
        <button
          type="button"
          className="zoom-pct"
          onClick={() => setZoom(100)}
          title="Restaurar 100%"
        >
          {zoom}%
        </button>
        <button
          type="button"
          className="zoom-btn"
          onClick={() => setZoom((z) => clamp(z + STEP))}
          disabled={zoom >= MAX}
          title="Aumentar zoom"
          aria-label="Aumentar zoom"
        >
          +
        </button>
      </div>
    </div>
  );
}
