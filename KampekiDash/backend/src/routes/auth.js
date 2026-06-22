import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// POST /api/auth/login — valida contra ADMIN_EMAIL / ADMIN_PASSWORD do .env.
router.post('/login', (req, res) => {
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
