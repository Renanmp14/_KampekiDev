// Ponte mínima entre a interface (React, no renderer) e o processo principal do
// Electron. Expõe só o necessário para a verificação manual de atualizações —
// nada de fs, rede ou Node cru (contextIsolation permanece ligado). Fora do
// Electron (dev no navegador), window.kampekiUpdater simplesmente não existe, e a
// tela de Configurações trata essa ausência.
const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Zoom NATIVO da janela. Antes o front escalava a página com `zoom` no CSS, o
// que quebrava qualquer cálculo de coordenada do mouse: getBoundingClientRect()
// passava a devolver medidas na escala visual enquanto event.pageX continuava na
// escala do viewport. Efeito prático: no Dash Custos, cliques e tooltip dos
// gráficos caíam na barra errada, com erro proporcional à distância da borda.
// O zoom nativo é aplicado pelo Chromium FORA do sistema de coordenadas da
// página, então layout, hit-test e JS continuam consistentes entre si.
contextBridge.exposeInMainWorld('kampekiZoom', {
  obter: () => webFrame.getZoomFactor(),
  definir: (fator) => {
    webFrame.setZoomFactor(fator);
    return webFrame.getZoomFactor();
  },
});

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
