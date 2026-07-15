import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/resources.js';
import { getCredentials, saveCredentials, clearCredentials } from '../api/client.js';
import Logo from '../components/Logo.jsx';

export default function Login() {
  const navigate = useNavigate();
  const saved = useRef(getCredentials()).current;
  const [email, setEmail] = useState(saved?.email || '');
  const [password, setPassword] = useState(saved?.password || '');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const autoTried = useRef(false);

  async function doLogin(em, pw, lembrar, auto = false) {
    setError('');
    setLoading(true);
    try {
      await login(em, pw);
      if (lembrar) saveCredentials(em, pw);
      else clearCredentials();
      navigate('/');
    } catch (err) {
      setError(err.message);
      // Credenciais salvas inválidas (ex.: senha mudou no .env): limpa para não
      // ficar tentando o auto-login em loop e deixa o usuário digitar de novo.
      if (auto) clearCredentials();
    } finally {
      setLoading(false);
    }
  }

  // Auto-login com credenciais salvas (uma única vez, ao abrir o app).
  useEffect(() => {
    if (saved?.email && saved?.password && !autoTried.current) {
      autoTried.current = true;
      doLogin(saved.email, saved.password, true, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e) {
    e.preventDefault();
    doLogin(email, password, remember);
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-brand"><Logo height={34} /></div>
        <div className="login-sub">Finance · acesso restrito</div>
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Manter-me conectado neste computador</span>
          </label>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {error && <div className="error-msg">{error}</div>}
        </form>
      </div>
    </div>
  );
}
