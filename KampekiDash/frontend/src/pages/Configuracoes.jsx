import React, { useEffect, useState } from 'react';

// Ponte exposta pelo preload do Electron (só existe no app instalado; no
// navegador em dev, é undefined).
const updater = typeof window !== 'undefined' ? window.kampekiUpdater : null;

export default function Configuracoes() {
  const [versao, setVersao] = useState('');
  // idle | verificando | atual | baixada | disponivel | desativado | erro
  const [estado, setEstado] = useState('idle');
  const [info, setInfo] = useState(null); // { versao?, mensagem? }
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    fetch('/api/version')
      .then((r) => r.json())
      .then((d) => setVersao((d && d.version) || ''))
      .catch(() => {});
  }, []);

  async function verificar() {
    if (!updater) return;
    setEstado('verificando');
    setInfo(null);
    try {
      const r = await updater.verificar();
      setInfo(r || {});
      setEstado((r && r.status) || 'erro');
    } catch (e) {
      setInfo({ mensagem: e.message });
      setEstado('erro');
    }
  }

  async function aplicar() {
    if (!updater) return;
    setAplicando(true);
    try {
      await updater.aplicar();
    } catch {
      setAplicando(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Configurações</h1>

      <div className="card">
        <h3 className="card-title" style={{ marginTop: 0 }}>Atualizações</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Versão instalada: <b>v{versao || '—'}</b>
        </p>

        {!updater && (
          <p className="muted">
            A verificação de atualizações está disponível apenas no aplicativo
            instalado (Windows ou macOS).
          </p>
        )}

        {updater && (
          <>
            <button className="btn" onClick={verificar} disabled={estado === 'verificando' || aplicando}>
              {estado === 'verificando' ? 'Verificando…' : '🔄 Verificar atualizações'}
            </button>

            <div style={{ marginTop: 14 }}>
              {estado === 'atual' && (
                <div className="muted">✅ Você já está na versão mais recente (v{info?.versao || versao}).</div>
              )}

              {estado === 'desativado' && (
                <div className="muted">As atualizações ficam desativadas em modo de desenvolvimento.</div>
              )}

              {estado === 'erro' && (
                <div className="error-msg">Não foi possível verificar: {info?.mensagem || 'erro desconhecido'}</div>
              )}

              {estado === 'baixada' && (
                <div>
                  <div style={{ marginBottom: 10 }}>
                    ⬇ Atualização <b>v{info?.versao}</b> baixada e pronta para instalar.
                  </div>
                  <button className="btn" onClick={aplicar} disabled={aplicando}>
                    {aplicando ? 'Reiniciando…' : 'Reiniciar e atualizar agora'}
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ marginLeft: 8 }}
                    onClick={() => setEstado('idle')}
                    disabled={aplicando}
                  >
                    Agora não
                  </button>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Se escolher “Agora não”, a atualização será aplicada sozinha na
                    próxima vez que você fechar o aplicativo.
                  </p>
                </div>
              )}

              {estado === 'disponivel' && (
                <div>
                  <div style={{ marginBottom: 10 }}>
                    🆕 Nova versão <b>v{info?.versao}</b> disponível.
                  </div>
                  <button className="btn" onClick={aplicar} disabled={aplicando}>Baixar atualização</button>
                  <p className="muted" style={{ marginTop: 8 }}>
                    O download abre no navegador. Depois, abra o arquivo <b>.dmg</b> e
                    arraste o app novo por cima do atual, na pasta Aplicativos.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
