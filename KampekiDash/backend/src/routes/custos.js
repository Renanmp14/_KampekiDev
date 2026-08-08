import { Router } from 'express';
import * as service from '../services/custos.js';

const router = Router();

// ?dataInicio=DD/MM/YYYY&dataFim=DD/MM/YYYY são opcionais (recorte por DATA_NOTA,
// usado pelo calendário de Recorrentes). Sem eles, devolve tudo, como antes.
router.get('/', async (req, res, next) => {
  try {
    const { dataInicio, dataFim } = req.query;
    res.json(await service.listar({ dataInicio, dataFim }));
  } catch (e) { next(e); }
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

// Importação de UMA NFS-e de serviço (PDF já extraído no frontend).
// Chave duplicada devolve 409 para a tela de conferência tratar/bloquear.
router.post('/import-nfse', async (req, res, next) => {
  try {
    res.status(201).json(await service.importarNfse(req.body || {}));
  } catch (e) {
    if (e.code === 'CHAVE_DUPLICADA') { res.status(409).json({ error: e.message, code: e.code }); return; }
    next(e);
  }
});

// Importação de VÁRIAS NFS-e num lote (PDFs já extraídos/ajustados no frontend):
// { notas: [ { chaveNfse, numNota, dataNota, fornecedor, item, valor } ] }
// Notas com chave já existente são puladas e reportadas (não bloqueia o lote).
router.post('/import-nfse-lote', async (req, res, next) => {
  try {
    const notas = Array.isArray(req.body?.notas) ? req.body.notas : [];
    res.status(201).json(await service.importarNfseLote(notas));
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

// Classificação em lote (mesma subcategoria p/ vários): { ITEM_UUIDS: [...], SUB_CATEGORIA }
router.post('/classificar-lote', async (req, res, next) => {
  try { res.json(await service.classificarItensEmLote(req.body || {})); } catch (e) { next(e); }
});

// Classificação em lote com subcategorias variadas por item (o usuário preenche
// item a item e confirma tudo): { classificacoes: [ { ITEM_UUID, SUB_CATEGORIA }, ... ] }
router.post('/classificar-lote-variado', async (req, res, next) => {
  try { res.json(await service.classificarItensLoteVariado(req.body || {})); } catch (e) { next(e); }
});

// Edição em massa: { uuids: [...], campo: 'TAG'|'FORNECEDOR', valor }
router.post('/bulk', async (req, res, next) => {
  try { res.json(await service.atualizarEmMassa(req.body || {})); } catch (e) { next(e); }
});

// Exclusão em massa: { uuids: [...] }
router.post('/bulk-delete', async (req, res, next) => {
  try { res.json(await service.removerEmMassa(req.body || {})); } catch (e) { next(e); }
});

router.put('/:uuid', async (req, res, next) => {
  try { res.json(await service.atualizar(req.params.uuid, req.body)); } catch (e) { next(e); }
});

router.delete('/:uuid', async (req, res, next) => {
  try { res.json(await service.remover(req.params.uuid)); } catch (e) { next(e); }
});

export default router;
