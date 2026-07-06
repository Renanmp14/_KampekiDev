import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import VersionBadge from './components/VersionBadge.jsx';
import { aplicarZoomSalvo } from './components/ZoomControl.jsx';
import './styles.css';

// Aplica o zoom salvo antes de renderizar (evita "flash" na tela de login).
aplicarZoomSalvo();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <VersionBadge />
    </BrowserRouter>
  </React.StrictMode>,
);
