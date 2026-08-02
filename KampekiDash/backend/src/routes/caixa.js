import { Router } from 'express';
import * as service from '../services/caixa.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try { res.json(await service.listar()); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await service.criar(req.body)); } catch (e) { next(e); }
});

router.put('/:uuid', async (req, res, next) => {
  try { res.json(await service.atualizar(req.params.uuid, req.body)); } catch (e) { next(e); }
});

router.delete('/:uuid', async (req, res, next) => {
  try { res.json(await service.remover(req.params.uuid)); } catch (e) { next(e); }
});

export default router;
