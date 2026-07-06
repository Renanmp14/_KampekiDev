// Processo principal do Electron (CommonJS).
// Sobe o backend Express embutido numa porta livre em 127.0.0.1 e abre a janela
// apontando para ele (o Express serve o build do frontend + as rotas /api).
const {
  app, BrowserWindow, shell, dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const isDev = !app.isPackaged;

// Caminhos dos recursos: em dev leem da árvore do repositório; empacotado, de
// process.resourcesPath (definido pelo extraResources do electron-builder).
function resourcePaths() {
  if (isDev) {
    return {
      backendEntry: path.join(__dirname, '..', 'backend', 'src', 'app.js'),
      frontendDist: path.join(__dirname, '..', 'frontend', 'dist'),
      envFile: path.join(__dirname, 'build', '.env'),
    };
  }
  const res = process.resourcesPath;
  return {
    backendEntry: path.join(res, 'backend', 'src', 'app.js'),
    frontendDist: path.join(res, 'frontend-dist'),
    envFile: path.join(res, '.env'),
  };
}

let mainWindow = null;
let serverInfo = null;

async function startBackend() {
  const { backendEntry, frontendDist, envFile } = resourcePaths();

  // Carrega o .env empacotado para process.env (dotenv não sobrescreve o que já
  // existe). É aqui que a "conexão fixa" (Service Account, JWT, admin) entra.
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
  }
  process.env.APP_VERSION = app.getVersion();
  process.env.FRONTEND_DIST = frontendDist;

  // Import dinâmico do backend (ESM) por caminho absoluto. port: 0 = porta livre.
  const backend = await import(pathToFileURL(backendEntry).href);
  serverInfo = await backend.startServer({ port: 0, staticDir: frontendDist });
  return serverInfo;
}

function createWindow(url) {
  const opts = {
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: `Kampeki Finance v${app.getVersion()}`,
    backgroundColor: '#0e1b18',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  };
  // Em dev o ícone da janela vem do build/icon.ico; empacotado, a janela herda
  // o ícone do próprio .exe (build/ fica fora do asar).
  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  if (fs.existsSync(iconPath)) opts.icon = iconPath;
  // Abre maximizado (show: false evita o "flash" do tamanho restaurado antes de
  // maximizar): sob escala 125% do Windows, dá o máximo de largura útil à tela,
  // mantendo a sidebar visível. O tamanho de opts vale ao restaurar a janela.
  opts.show = false;
  mainWindow = new BrowserWindow(opts);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.maximize();
  mainWindow.show();
  mainWindow.loadURL(url);
  // Links externos abrem no navegador padrão, não dentro do app.
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// Auto-update: fica DORMENTE até você definir UPDATE_FEED_URL (no build/.env).
// Quando definida, o app checa esse feed HTTP genérico a cada abertura e baixa/
// instala a versão nova sozinho. Sem a URL, é um no-op (modo handoff manual).
function setupAutoUpdate() {
  const feed = process.env.UPDATE_FEED_URL || '';
  if (!feed || isDev) return;
  try {
    // eslint-disable-next-line global-require
    const { autoUpdater } = require('electron-updater');
    autoUpdater.setFeedURL({ provider: 'generic', url: feed });
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.error('[updater]', e.message);
  }
}

// Instância única: evita subir dois backends/janelas.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const info = await startBackend();
      createWindow(`http://127.0.0.1:${info.port}`);
      setupAutoUpdate();
    } catch (e) {
      dialog.showErrorBox('Kampeki Finance', `Falha ao iniciar o aplicativo:\n\n${e.message}`);
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && serverInfo) {
        createWindow(`http://127.0.0.1:${serverInfo.port}`);
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
