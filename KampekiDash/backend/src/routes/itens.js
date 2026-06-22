import { Router } from 'express';
import * as service from '../services/itens.js';
import * as subcategoria from '../services/subcategoria.js';

const router = Router();

// Catálogo de subcategorias (fixas + criadas em runtime) + categoria derivada.
router.get('/subcategorias', (req, res) => {
  res.json(subcategoria.listar());
});

// Categorias disponíveis para associar a uma subcategoria nova.
router.get('/categorias', (req, res) => {
  res.json(subcategoria.categorias());
});

// Cria uma subcategoria nova: { SUB_CATEGORIA, CATEGORIA }
router.post('/subcategorias', async (req, res, next) => {
  try { res.status(201).json(await subcategoria.criar(req.body || {})); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json(await service.listar()); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await service.criar(req.body)); } catch (e) { next(e); }
});

// Importação em lote: { rows: [ { DESCRICAO_ITEM, SUB_CATEGORIA, CATEGORIA? } ] }
router.post('/import', async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    res.json(await service.importarLote(rows));
  } catch (e) { next(e); }
});

router.put('/:uuid', async (req, res, next) => {
  try { res.json(await service.atualizar(req.params.uuid, req.body)); } catch (e) { next(e); }
});

router.delete('/:uuid', async (req, res, next) => {
  try { res.json(await service.remover(req.params.uuid)); } catch (e) { next(e); }
});

export default router;
