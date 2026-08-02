import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { criarLoginRateLimit } from '../middleware/rateLimit.js';
import { autenticar } from '../services/usuarios.js';

const router = Router();

// Uma única instância do limitador (o estado das tentativas vive nela).
const limitarTentativas = criarLoginRateLimit();

// POST /api/auth/login — valida contra os usuários do .env (USUARIOS_JSON e/ou
// ADMIN_EMAIL/ADMIN_PASSWORD). Protegido por limite de tentativas por IP: esta é
// a única rota pública que aceita credenciais e, na versão web, está exposta na
// internet.
router.post('/login', limitarTentativas, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const usuario = autenticar(email, password);
  if (!usuario) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    // `role` é mantido junto de `perfil` por compatibilidade com tokens/versões
    // anteriores, que só conheciam esse campo.
    { email: usuario.email, perfil: usuario.perfil, role: usuario.perfil },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
  return res.json({ token, email: usuario.email, perfil: usuario.perfil });
});

export default router;
