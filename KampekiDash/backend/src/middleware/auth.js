import jwt from 'jsonwebtoken';
import { podeEscrever } from '../services/usuarios.js';

// Valida o JWT presente no header Authorization: Bearer <token>.
export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token ausente' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/**
 * Barra escrita para quem não é admin. Qualquer método que não seja de leitura
 * (ou seja: POST, PUT, PATCH, DELETE) exige perfil 'admin'.
 *
 * Aplicado no `app.js` junto do authRequired, em TODOS os grupos de rota — logo
 * vale também para módulos futuros, sem depender de alguém lembrar de proteger
 * cada rota nova. Vários POSTs do app são importações/edições em massa, então
 * bloquear por método (e não por caminho) é o que cobre o conjunto inteiro.
 */
export function escritaRequerAdmin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Tokens emitidos por versões anteriores só têm `role` — daí o fallback.
  const perfil = req.user?.perfil || req.user?.role;
  if (podeEscrever(perfil)) return next();
  return res.status(403).json({
    error: 'Seu usuário tem acesso apenas de consulta e não pode fazer lançamentos.',
  });
}
