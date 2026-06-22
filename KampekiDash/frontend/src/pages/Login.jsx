import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/resources.js';
import Logo from '../components/Logo.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {error && <div className="error-msg">{error}</div>}
        </form>
      </div>
    </div>
  );
}
