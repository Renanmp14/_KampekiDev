import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { authRequired } from './middleware/auth.js';
import { initSheets } from './services/sheets.js';
import { carregar as carregarSubcategorias } from './services/subcategoria.js';

import authRoutes from './routes/auth.js';
import fornecedorRoutes from './routes/fornecedor.js';
import tagRoutes from './routes/tag.js';
import itensRoutes from './routes/itens.js';
import custosRoutes from './routes/custos.js';
import folhaRoutes from './routes/folha.js';

const app = express();
app.use(cors());
// Limite alto para suportar importações em lote (planilhas grandes).
app.use(express.json({ limit: '50mb' }));

// Health check (público).
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Autenticação (público).
app.use('/api/auth', authRoutes);

// Configurações expostas ao frontend (threshold de alerta etc.).
app.get('/api/config', authRequired, (req, res) => {
  res.json({
    growthAlertThreshold: Number(process.env.GROWTH_ALERT_THRESHOLD || 20),
  });
});

// Rotas protegidas por JWT.
app.use('/api/fornecedor', authRequired, fornecedorRoutes);
app.use('/api/tag', authRequired, tagRoutes);
app.use('/api/itens', authRequired, itensRoutes);
app.use('/api/custos', authRequired, custosRoutes);
app.use('/api/folha', authRequired, folhaRoutes);

// Handler de erros centralizado.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  const status = err.status || 400;
  res.status(status).json({ error: err.message || 'Erro interno' });
});

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    await initSheets();
    await carregarSubcategorias();
  } catch (e) {
    console.error('[initSheets] Falha ao inicializar a planilha:', e.message);
    console.error('Verifique GOOGLE_SHEET_ID e GOOGLE_CREDENTIALS_JSON no .env.');
  }
  app.listen(PORT, () => {
    console.log(`Kampeki Finance API rodando em http://localhost:${PORT}`);
  });
}

bootstrap();
