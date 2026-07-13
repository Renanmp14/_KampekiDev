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

// Subcategorias para a tela de gestão (com flag fixa/personalizada e uso).
router.get('/subcategorias-gestao', async (req, res, next) => {
  try { res.json(await subcategoria.listarGestao()); } catch (e) { next(e); }
});

// Cria uma subcategoria nova: { SUB_CATEGORIA, CATEGORIA }
router.post('/subcategorias', async (req, res, next) => {
  try { res.status(201).json(await subcategoria.criar(req.body || {})); } catch (e) { next(e); }
});

// Edita uma subcategoria (nome e/ou categoria), com cascata em itens/custos:
// { SUB_CATEGORIA (atual), NOVO_NOME, NOVA_CATEGORIA }
router.post('/subcategorias/editar', async (req, res, next) => {
  try { res.json(await subcategoria.editar(req.body || {})); } catch (e) { next(e); }
});

// Exclui uma subcategoria (desclassifica itens/custos que a usavam): { SUB_CATEGORIA }
router.post('/subcategorias/remover', async (req, res, next) => {
  try { res.json(await subcategoria.remover(req.body || {})); } catch (e) { next(e); }
});

// Reprocessa as TAGs nos custos a partir da tag cadastrada em cada item.
router.post('/reprocessar-tags', async (req, res, next) => {
  try { res.json(await service.reprocessarTagsNosCustos()); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json(await service.listar()); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await service.criar(req.body)); } catch (e) { next(e); }
});

// Edição em massa: { ITEM_UUIDS: [...], campo: 'SUB_CATEGORIA'|'TAG', valor }
router.post('/bulk', async (req, res, next) => {
  try { res.json(await service.atualizarEmMassa(req.body || {})); } catch (e) { next(e); }
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
