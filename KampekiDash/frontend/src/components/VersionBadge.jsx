import React, { useEffect, useState } from 'react';

/**
 * Selo fixo no canto inferior direito mostrando a versão do app.
 * Busca /api/version (público) — funciona antes do login e tanto no app
 * empacotado (Electron) quanto no navegador em dev.
 */
export default function VersionBadge() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    let vivo = true;
    fetch('/api/version')
      .then((r) => r.json())
      .then((d) => { if (vivo && d && d.version) setVersion(d.version); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (!version) return null;
  return <div className="version-badge" title={`Kampeki Finance — versão ${version}`}>v{version}</div>;
}
