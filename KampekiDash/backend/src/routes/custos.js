import { Router } from 'express';
import * as service from '../services/custos.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try { res.json(await service.listar()); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await service.criar(req.body)); } catch (e) { next(e); }
});

// Importação em lote de custos antigos: { rows: [ {...} ], fallbackMesAno? }
router.post('/import', async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const { fallbackMesAno } = req.body || {};
    res.json(await service.importarLote(rows, { fallbackMesAno }));
  } catch (e) { next(e); }
});

// Importação a partir de NF-e (zip lido no frontend): { notas: [ {...} ] }
router.post('/import-xml', async (req, res, next) => {
  try {
    const notas = Array.isArray(req.body?.notas) ? req.body.notas : [];
    res.json(await service.importarLoteXml(notas));
  } catch (e) { next(e); }
});

// Itens pendentes de classificação (sem subcategoria/categoria).
router.get('/itens-a-classificar', async (req, res, next) => {
  try { res.json(await service.itensAClassificar()); } catch (e) { next(e); }
});

// Classifica um item pendente e faz back-fill nos custos: { ITEM_UUID, SUB_CATEGORIA }
router.post('/classificar', async (req, res, next) => {
  try { res.json(await service.classificarItem(req.body || {})); } catch (e) { next(e); }
});

// Edição em massa: { uuids: [...], campo: 'TAG'|'FORNECEDOR', valor }
router.post('/bulk', async (req, res, next) => {
  try { res.json(await service.atualizarEmMassa(req.body || {})); } catch (e) { next(e); }
});

router.put('/:uuid', async (req, res, next) => {
  try { res.json(await service.atualizar(req.params.uuid, req.body)); } catch (e) { next(e); }
});

router.delete('/:uuid', async (req, res, next) => {
  try { res.json(await service.remover(req.params.uuid)); } catch (e) { next(e); }
});

export default router;
