import { Router } from 'express';
import * as service from '../services/recorrentes.js';

const router = Router();

// As rotas de caminho fixo vêm ANTES de '/:uuid', senão o Express casaria
// '/pendentes' como se 'pendentes' fosse um UUID.

// Metadados das frequências (valor, label, se usa DIA_BASE) para montar o select.
router.get('/frequencias', (req, res) => {
  res.json(service.frequencias());
});

// Prévia do "colocar em dia": o que seria lançado agora, sem gravar nada.
// Alimenta também a faixa "N ocorrências vencidas" na abertura da página.
router.get('/pendentes', async (req, res, next) => {
  try { res.json(await service.pendentes({ hoje: req.query.hoje })); } catch (e) { next(e); }
});

// Efetiva os lançamentos vencidos. Body opcional: { uuids: [...] } restringe a
// um ou mais templates. Escrita — o perfil 'leitura' já cai no 403 por método.
router.post('/processar', async (req, res, next) => {
  try {
    const uuids = Array.isArray(req.body?.uuids) ? req.body.uuids : null;
    res.json(await service.processar({ uuids }));
  } catch (e) { next(e); }
});

// Exceções ("só esta data"): ?template=UUID filtra por recorrência.
router.get('/excecoes', async (req, res, next) => {
  try { res.json(await service.listarExcecoes(req.query.template)); } catch (e) { next(e); }
});

// Upsert: já existindo exceção do mesmo template na mesma data, ela é substituída.
router.post('/excecoes', async (req, res, next) => {
  try { res.status(201).json(await service.salvarExcecao(req.body || {})); } catch (e) { next(e); }
});

router.put('/excecoes/:uuid', async (req, res, next) => {
  try { res.json(await service.atualizarExcecao(req.params.uuid, req.body || {})); } catch (e) { next(e); }
});

router.delete('/excecoes/:uuid', async (req, res, next) => {
  try { res.json(await service.removerExcecao(req.params.uuid)); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try { res.json(await service.listar()); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await service.criar(req.body || {})); } catch (e) { next(e); }
});

// Edição "esta e todas as seguintes" — o que já está em CUSTOS não é tocado.
router.put('/:uuid', async (req, res, next) => {
  try { res.json(await service.atualizar(req.params.uuid, req.body || {})); } catch (e) { next(e); }
});

// Cancelamento a partir de uma data (default hoje): grava DATA_FIM na véspera e
// só inativa quando essa data já passou. Não apaga nada de CUSTOS.
router.post('/:uuid/cancelar', async (req, res, next) => {
  try {
    res.json(await service.cancelar(req.params.uuid, { aPartirDe: req.body?.aPartirDe }));
  } catch (e) { next(e); }
});

// Exclusão definitiva do template (some da aba, junto das exceções dele). Os
// custos já lançados permanecem, com o UUID_RECORRENTE como rastro histórico.
router.delete('/:uuid', async (req, res, next) => {
  try { res.json(await service.remover(req.params.uuid)); } catch (e) { next(e); }
});

export default router;
