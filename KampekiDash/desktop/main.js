// Processo principal do Electron (CommonJS).
// Sobe o backend Express embutido numa porta fixa em 127.0.0.1 e abre a janela
// apontando para ele (o Express serve o build do frontend + as rotas /api).
const {
  app, BrowserWindow, shell, dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { pathToFileURL } = require('url');

const isDev = !app.isPackaged;

// Repositório de releases (usado no aviso de atualização do macOS).
const GH_OWNER = 'Renanmp14';
const GH_REPO = '_KampekiDev';

// A porta precisa ser ESTÁVEL entre aberturas: o localStorage do Chromium é
// isolado por origem, e a origem inclui a porta. Com porta sorteada (o antigo
// `port: 0`), cada abertura era uma origem nova e vazia — login salvo e zoom se
// perdiam sempre. 43117 fica fora da faixa dinâmica do Windows (49152-65535),
// que é de onde o SO tira portas para outros programas, então a colisão é
// improvável. As alternativas cobrem o caso raro de a porta estar ocupada: o app
// abre igual, só perde o login salvo daquela sessão.
const PORTAS_PREFERIDAS = [43117, 43118, 43119];

function portaLivre(porta) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(porta, '127.0.0.1');
  });
}

// Escolhe a porta ANTES de subir o backend: assim uma porta ocupada não custa um
// initSheets (lento) por tentativa. 0 = último recurso (o SO escolhe uma livre).
async function escolherPorta() {
  for (const porta of PORTAS_PREFERIDAS) {
    // eslint-disable-next-line no-await-in-loop
    if (await portaLivre(porta)) return porta;
  }
  return 0;
}

// Local do arquivo de configuração (.env) no computador do cliente. Fica em
// userData (Windows: %APPDATA%\Kampeki Finance; macOS: ~/Library/Application
// Support/Kampeki Finance), NÃO na pasta de instalação: a instalação é
// substituída a cada atualização, mas userData sobrevive — então o .env que o
// cliente colocou uma vez continua valendo depois dos updates. O segredo NÃO é
// mais empacotado no instalador (o cliente recebe o .env separadamente e o
// deposita aqui). KAMPEKI_ENV_FILE permite apontar para outro caminho, se preciso.
function clientEnvFile() {
  return process.env.KAMPEKI_ENV_FILE || path.join(app.getPath('userData'), '.env');
}

// Caminhos dos recursos: em dev leem da árvore do repositório; empacotado, de
// process.resourcesPath (definido pelo extraResources do electron-builder). O
// .env, porém, vem sempre do local do cliente (clientEnvFile), nunca do pacote.
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
    envFile: clientEnvFile(),
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

  // Import dinâmico do backend (ESM) por caminho absoluto.
  const backend = await import(pathToFileURL(backendEntry).href);
  const porta = await escolherPorta();
  try {
    serverInfo = await backend.startServer({ port: porta, staticDir: frontendDist });
  } catch (e) {
    // Corrida rara: alguém tomou a porta entre o teste e o listen. Vale mais
    // abrir o app numa porta qualquer do que falhar.
    if (e.code !== 'EADDRINUSE') throw e;
    serverInfo = await backend.startServer({ port: 0, staticDir: frontendDist });
  }
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
  // Em dev o ícone vem do build/; empacotado, cada plataforma herda o ícone do
  // próprio pacote (.exe no Windows, .app/.icns no macOS — build/ fica fora do
  // asar). No Windows a janela usa o .ico; no macOS a janela não tem ícone (só o
  // dock), então usamos o .png e setamos o dock abaixo.
  const iconFile = process.platform === 'darwin' ? 'icon.png' : 'icon.ico';
  const iconPath = path.join(__dirname, 'build', iconFile);
  if (fs.existsSync(iconPath)) {
    opts.icon = iconPath;
    if (isDev && process.platform === 'darwin' && app.dock) app.dock.setIcon(iconPath);
  }
  // Abre maximizado (show: false evita o "flash" do tamanho restaurado antes de
  // maximizar): sob escala 125% do Windows, dá o máximo de largura útil à tela,
  // mantendo a sidebar visível. O tamanho de opts vale ao restaurar a janela.
  opts.show = false;
  mainWindow = new BrowserWindow(opts);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.maximize();
  mainWindow.show();
  mainWindow.loadURL(url);
  // Links externos abrem no navegador padrão, não dentro do app. Exceção: PDFs de
  // conferência (import de NFS-e) são blob:/data: locais ao renderer — o navegador
  // externo não os enxergaria, então abrem numa janela interna com o visualizador
  // de PDF do Chromium ligado.
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^(blob:|data:)/i.test(u)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false, plugins: true },
        },
      };
    }
    shell.openExternal(u);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// Compara duas versões "x.y.z". Retorna true se `a` é mais nova que `b`.
function versaoMaisNova(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// macOS: como o app NÃO é assinado (sem custo de certificado Apple), o sistema
// proíbe a auto-atualização silenciosa. Então aqui só CHECAMOS a última release
// no GitHub e, se houver versão nova, avisamos com um link para baixar o .dmg —
// o cliente instala por cima manualmente. Sem dependências externas (https nativo).
function checkMacUpdate() {
  const https = require('https');
  const opts = {
    hostname: 'api.github.com',
    path: `/repos/${GH_OWNER}/${GH_REPO}/releases/latest`,
    headers: { 'User-Agent': 'KampekiFinance', Accept: 'application/vnd.github+json' },
  };
  https.get(opts, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      try {
        const rel = JSON.parse(body);
        const tag = String(rel.tag_name || '').replace(/^v/i, '');
        if (!tag || !versaoMaisNova(tag, app.getVersion())) return;
        const asset = (rel.assets || []).find((a) => /\.dmg$/i.test(a.name));
        const url = asset ? asset.browser_download_url : (rel.html_url || '');
        const r = dialog.showMessageBoxSync(mainWindow, {
          type: 'info',
          title: 'Kampeki Finance — atualização disponível',
          message: `Nova versão disponível: v${tag} (você está na v${app.getVersion()}).`,
          detail: 'No macOS a atualização é manual. Clique em "Baixar" para pegar a nova versão e instalar por cima da atual.',
          buttons: ['Baixar', 'Agora não'],
          defaultId: 0,
          cancelId: 1,
        });
        if (r === 0 && url) shell.openExternal(url);
      } catch (e) {
        console.error('[updater mac]', e.message);
      }
    });
  }).on('error', (e) => console.error('[updater mac]', e.message));
}

// Auto-update. Windows: o electron-updater lê o app-update.yml embutido (gerado
// a partir do `build.publish` = GitHub Releases) e baixa/instala a versão nova
// sozinho, notificando o usuário. macOS: sem assinatura não há update silencioso,
// então apenas avisamos (checkMacUpdate). Em dev, no-op.
function setupAutoUpdate() {
  if (isDev) return;
  if (process.platform === 'darwin') {
    checkMacUpdate();
    return;
  }
  try {
    // eslint-disable-next-line global-require
    const { autoUpdater } = require('electron-updater');
    // Compat: um feed genérico explícito (UPDATE_FEED_URL) ainda é respeitado;
    // sem ele, usa o app-update.yml embutido (provider github do package.json).
    const feed = process.env.UPDATE_FEED_URL || '';
    if (feed) autoUpdater.setFeedURL({ provider: 'generic', url: feed });
    autoUpdater.autoDownload = true;
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
      // Configuração ausente (app empacotado): o cliente precisa depositar o
      // arquivo .env (enviado a ele) na pasta de configuração. Sem ele, o backend
      // não conecta à planilha nem valida login — então avisamos onde colocar,
      // abrimos a pasta e encerramos (em vez de subir pela metade).
      const { envFile } = resourcePaths();
      if (!isDev && !fs.existsSync(envFile)) {
        const dir = path.dirname(envFile);
        const escolha = dialog.showMessageBoxSync({
          type: 'warning',
          title: 'Kampeki Finance — configuração ausente',
          message: 'Arquivo de configuração (.env) não encontrado.',
          detail: `Coloque o arquivo ".env" que você recebeu nesta pasta e reabra o aplicativo:\n\n${dir}`,
          buttons: ['Abrir a pasta', 'Sair'],
          defaultId: 0,
          cancelId: 1,
        });
        if (escolha === 0) {
          try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignora */ }
          shell.openPath(dir);
        }
        app.quit();
        return;
      }

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
