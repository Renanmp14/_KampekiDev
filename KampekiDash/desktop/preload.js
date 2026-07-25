// Ponte mínima entre a interface (React, no renderer) e o processo principal do
// Electron. Expõe só o necessário para a verificação manual de atualizações —
// nada de fs, rede ou Node cru (contextIsolation permanece ligado). Fora do
// Electron (dev no navegador), window.kampekiUpdater simplesmente não existe, e a
// tela de Configurações trata essa ausência.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kampekiUpdater', {
  // Procura atualização agora. Resolve com { status, versao?, mensagem? }:
  //   'atual'      → já está na última versão
  //   'baixada'    → (Windows) versão nova baixada, pronta para instalar
  //   'disponivel' → (macOS) versão nova disponível para baixar manualmente
  //   'desativado' → em modo de desenvolvimento
  //   'erro'       → falhou (mensagem no campo)
  verificar: () => ipcRenderer.invoke('updates:check'),
  // Aplica a atualização: Windows → reinicia e instala; macOS → abre o download.
  aplicar: () => ipcRenderer.invoke('updates:apply'),
});
