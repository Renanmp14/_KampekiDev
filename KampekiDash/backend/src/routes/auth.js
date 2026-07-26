import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { criarLoginRateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Uma única instância do limitador (o estado das tentativas vive nela).
const limitarTentativas = criarLoginRateLimit();

// POST /api/auth/login — valida contra ADMIN_EMAIL / ADMIN_PASSWORD do .env.
// Protegido por limite de tentativas por IP: esta é a única rota pública que
// aceita credenciais e, na versão web, está exposta na internet.
router.post('/login', limitarTentativas, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const okEmail = String(email).trim().toLowerCase() === String(process.env.ADMIN_EMAIL).toLowerCase();
  const okPass = String(password) === String(process.env.ADMIN_PASSWORD);
  if (!okEmail || !okPass) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { email: process.env.ADMIN_EMAIL, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
  return res.json({ token, email: process.env.ADMIN_EMAIL });
});

export default router;
