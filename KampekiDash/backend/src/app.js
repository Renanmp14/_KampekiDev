import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

import { authRequired } from './middleware/auth.js';
import { initSheets, getCellUsage } from './services/sheets.js';
import { carregar as carregarSubcategorias } from './services/subcategoria.js';

import authRoutes from './routes/auth.js';
import fornecedorRoutes from './routes/fornecedor.js';
import tagRoutes from './routes/tag.js';
import itensRoutes from './routes/itens.js';
import custosRoutes from './routes/custos.js';
import folhaRoutes from './routes/folha.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Versão exibida no app. Ordem de resolução:
//   1. APP_VERSION — injetada pelo Electron (desktop/main.js) e também
//      aceita como override manual em qualquer ambiente;
//   2. desktop/package.json — a fonte única da versão do app, para que o
//      deploy web (standalone, sem Electron) mostre a MESMA versão do desktop;
//   3. backend/package.json — fallback se o backend for servido sem o resto
//      do repositório ao lado.
function lerVersaoDe(...partes) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, ...partes), 'utf8'));
    return pkg.version || null;
  } catch {
    return null;
  }
}
function resolveVersion() {
  return process.env.APP_VERSION
    || lerVersaoDe('..', '..', 'desktop', 'package.json')
    || lerVersaoDe('..', 'package.json')
    || 'dev';
}
const APP_VERSION = resolveVersion();

const app = express();

// Atrás de um proxy reverso (Caddy, no deploy web), o IP do cliente chega em
// X-Forwarded-For — sem isto, `req.ip` seria sempre 127.0.0.1 e o limite de
// tentativas de login contaria todos os visitantes num único balde.
// Ligado por configuração (TRUST_PROXY=1 na VM) e desligado por padrão: no app
// desktop não há proxy, e confiar no cabeçalho sem proxy permitiria falsear o IP.
if (process.env.TRUST_PROXY) {
  const saltos = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isFinite(saltos) && saltos > 0 ? saltos : 1);
}

app.use(cors());
// Limite alto para suportar importações em lote (planilhas grandes).
app.use(express.json({ limit: '50mb' }));

// Health check (público).
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Versão do app (público — exibida no rodapé, inclusive antes do login).
app.get('/api/version', (req, res) => res.json({ version: APP_VERSION }));

// Autenticação (público).
app.use('/api/auth', authRoutes);

// Configurações expostas ao frontend (threshold de alerta etc.).
app.get('/api/config', authRequired, (req, res) => {
  res.json({
    growthAlertThreshold: Number(process.env.GROWTH_ALERT_THRESHOLD || 20),
  });
});

// Uso de células da planilha (informativo — proximidade do limite de 10M do
// Google Sheets). Protegido por JWT.
app.get('/api/meta/cell-usage', authRequired, async (req, res, next) => {
  try {
    res.json(await getCellUsage());
  } catch (e) {
    next(e);
  }
});

// Rotas protegidas por JWT.
app.use('/api/fornecedor', authRequired, fornecedorRoutes);
app.use('/api/tag', authRequired, tagRoutes);
app.use('/api/itens', authRequired, itensRoutes);
app.use('/api/custos', authRequired, custosRoutes);
app.use('/api/folha', authRequired, folhaRoutes);

// --- Frontend estático (produção / app empacotado) ------------------------
// Quando há um build do frontend disponível, o próprio Express o serve na mesma
// origem das rotas /api (o front chama /api em URL relativa). Em dev isso não é
// usado — o Vite (5173) faz proxy de /api para cá.
const distDir = process.env.FRONTEND_DIST
  || path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  // Fallback SPA: qualquer GET fora de /api devolve o index.html (rotas do
  // React Router resolvidas no cliente).
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    return next();
  });
}

// Handler de erros centralizado.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  const status = err.status || 400;
  res.status(status).json({ error: err.message || 'Erro interno' });
});

/**
 * Sobe o servidor HTTP. Usado tanto standalone (`node src/app.js`) quanto pelo
 * Electron, que passa a porta (fixa, para o localStorage sobreviver — ver
 * desktop/main.js) e o diretório do build do frontend. Resolve com
 * { server, port } (a porta efetiva) e rejeita se o bind falhar.
 */
export async function startServer({ port, staticDir } = {}) {
  if (staticDir) process.env.FRONTEND_DIST = staticDir;
  try {
    await initSheets();
    await carregarSubcategorias();
  } catch (e) {
    console.error('[initSheets] Falha ao inicializar a planilha:', e.message);
    console.error('Verifique GOOGLE_SHEET_ID e GOOGLE_CREDENTIALS_JSON no .env.');
  }
  const listenPort = port !== undefined ? port : (process.env.PORT || 3001);
  return new Promise((resolve, reject) => {
    const server = app.listen(listenPort, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const actual = server.address().port;
      console.log(`Kampeki Finance API (v${APP_VERSION}) em http://127.0.0.1:${actual}`);
      resolve({ server, port: actual });
    });
    // Sem este listener, uma falha de bind (ex.: EADDRINUSE) seria um 'error' sem
    // ouvinte = exceção não tratada. Com ele, quem chamou decide o que fazer.
    server.once('error', reject);
  });
}

// Execução direta (`node src/app.js` / `npm start`) mantém o comportamento
// standalone; quando importado (Electron), apenas exporta startServer.
const invokedDirectly = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  startServer();
}

export { app };
