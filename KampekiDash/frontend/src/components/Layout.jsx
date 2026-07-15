import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { clearToken, clearCredentials } from '../api/client.js';
import Logo from './Logo.jsx';
import ZoomControl from './ZoomControl.jsx';

const lancamentos = [
  { to: '/custos', label: 'Custos' },
  { to: '/folha', label: 'Folha' },
  { to: '/fornecedor', label: 'Fornecedor' },
  { to: '/tag', label: 'Tag' },
  { to: '/itens', label: 'Itens' },
];

const dashboards = [
  { to: '/dash/custos', label: 'Dash Custos' },
  { to: '/dash/folha', label: 'Dash Folha' },
  { to: '/dash/periodo', label: 'Análise por Período' },
  { to: '/dash/avancado', label: 'Visões avançadas' },
];

const saidas = [
  { to: '/saida', label: 'Saída (Backup mensal)' },
];

export default function Layout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function sair() {
    clearToken();
    clearCredentials(); // logout de verdade: esquece o login salvo
    navigate('/login');
  }
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app-shell">
      {/* Barra de topo só aparece em telas pequenas (CSS) */}
      <header className="topbar">
        <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">☰</button>
        <Logo height={20} />
      </header>

      {menuOpen && <div className="sidebar-backdrop" onClick={closeMenu} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <Logo height={26} />
          <span className="brand-sub">Finance</span>
        </div>

        <div className="nav-section">Dashboards</div>
        {dashboards.map((d) => (
          <NavLink key={d.to} to={d.to} onClick={closeMenu} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            {d.label}
          </NavLink>
        ))}

        <div className="nav-section">Lançamentos</div>
        {lancamentos.map((l) => (
          <NavLink key={l.to} to={l.to} onClick={closeMenu} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            {l.label}
          </NavLink>
        ))}

        <div className="nav-section">Saída</div>
        {saidas.map((s) => (
          <NavLink key={s.to} to={s.to} onClick={closeMenu} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            {s.label}
          </NavLink>
        ))}

        <div className="logout-btn">
          <ZoomControl />
          <button className="nav-link" onClick={sair} style={{ width: '100%', textAlign: 'left' }}>
            Sair
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
