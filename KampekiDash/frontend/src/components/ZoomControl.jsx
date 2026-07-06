import React, { useEffect, useState } from 'react';

// Controle de zoom global da ferramenta. Aplica um zoom via CSS no elemento raiz
// (suportado no Chromium/Electron), persistido em localStorage — assim o usuário
// pode compensar a escala do sistema (ex.: 125% em Full HD) sem a tela ficar
// espremida. Disponível em todas as telas autenticadas (fica na sidebar).
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

export function aplicarZoomSalvo() {
  document.documentElement.style.zoom = `${ler()}%`;
}

export default function ZoomControl() {
  const [zoom, setZoom] = useState(ler);

  useEffect(() => {
    document.documentElement.style.zoom = `${zoom}%`;
    localStorage.setItem(KEY, String(zoom));
  }, [zoom]);

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
