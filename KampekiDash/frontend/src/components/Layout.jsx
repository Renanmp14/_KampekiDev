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

// Caixa (dinheiro físico) — módulo desacoplado dos lançamentos de custo/folha,
// por isso ganha seção própria em vez de entrar em "Lançamentos".
const caixa = [
  { to: '/caixa', label: 'Caixa' },
];

// Recorrentes tem tela própria (calendário) e regra própria de lançamento, então
// ganha seção em vez de virar mais um item de "Lançamentos" — mesmo precedente do
// Caixa.
const recorrentes = [
  { to: '/recorrentes', label: 'Recorrentes' },
];

const saidas = [
  { to: '/saida', label: 'Saída (Backup mensal)' },
];

const sistema = [
  { to: '/configuracoes', label: 'Configurações' },
];

// Seções da navegação. O ícone e o título compõem o cabeçalho destacado de cada
// grupo (ver .nav-section no styles.css) — a hierarquia fica legível de relance,
// em vez de quatro listas visualmente iguais.
const secoes = [
  { titulo: 'Dashboards', icone: '📊', itens: dashboards },
  { titulo: 'Lançamentos', icone: '✏️', itens: lancamentos },
  { titulo: 'Recorrentes', icone: '🗓', itens: recorrentes },
  { titulo: 'Caixa', icone: '💵', itens: caixa },
  { titulo: 'Backup', icone: '💾', itens: saidas },
  { titulo: 'Sistema', icone: '⚙️', itens: sistema },
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

        <nav className="nav">
          {secoes.map((sec) => (
            <div className="nav-group" key={sec.titulo}>
              <div className="nav-section">
                <span className="nav-ico" aria-hidden="true">{sec.icone}</span>
                {sec.titulo}
              </div>
              {sec.itens.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

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
