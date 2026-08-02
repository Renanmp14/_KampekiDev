// Usuários e perfis de acesso.
//
// Fonte: a variável `USUARIOS_JSON` do .env (lista de objetos). O usuário único
// `ADMIN_EMAIL`/`ADMIN_PASSWORD` continua valendo como **fallback**, para que
// toda instalação existente — em especial o app desktop, cujo .env vive na
// máquina do cliente — siga funcionando sem nenhuma alteração de arquivo.
//
// Exemplo de USUARIOS_JSON (uma linha só no .env):
//   [{"email":"gestor@kampeki","senha":"...","perfil":"admin"},
//    {"email":"aux@kampeki","senha":"...","perfil":"leitura"}]
//
// ⚠ Alcance real da restrição: na versão WEB o backend roda no servidor, então
// o perfil é uma trava de verdade. No app DESKTOP o backend roda na máquina do
// próprio usuário, que tem acesso de leitura/escrita ao .env — ali o perfil é
// proteção contra engano, não contra intenção.

export const PERFIS = ['admin', 'leitura'];

const igual = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Aceita alguns sinônimos comuns. Qualquer coisa não reconhecida cai em
// 'leitura' — menor privilégio: um perfil escrito errado nunca deve virar
// acesso total por acidente.
export function normalizarPerfil(valor) {
  const p = String(valor || '').trim().toLowerCase();
  if (['admin', 'administrador', 'gestor'].includes(p)) return 'admin';
  if (['leitura', 'consulta', 'somente-leitura', 'readonly', 'read-only'].includes(p)) return 'leitura';
  if (p) console.warn(`[usuarios] perfil desconhecido "${valor}" — tratado como "leitura"`);
  return 'leitura';
}

/** Lista de usuários válidos: os de USUARIOS_JSON + o admin do .env (fallback). */
export function listarUsuarios() {
  const lista = [];

  const raw = process.env.USUARIOS_JSON;
  if (raw && raw.trim()) {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) throw new Error('deve ser uma lista []');
      arr.forEach((u) => {
        const email = String(u?.email || '').trim();
        const senha = String(u?.senha ?? u?.password ?? '');
        if (!email || !senha) return;
        lista.push({ email, senha, perfil: normalizarPerfil(u?.perfil ?? u?.role) });
      });
    } catch (e) {
      // Não derruba o login: o fallback do admin abaixo mantém o acesso.
      console.error('[usuarios] USUARIOS_JSON inválido —', e.message);
    }
  }

  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
  const adminSenha = String(process.env.ADMIN_PASSWORD || '');
  if (adminEmail && adminSenha && !lista.some((u) => igual(u.email, adminEmail))) {
    lista.push({ email: adminEmail, senha: adminSenha, perfil: 'admin' });
  }

  return lista;
}

/**
 * Valida email + senha. Devolve { email, perfil } (email na grafia cadastrada)
 * ou null. Email é case-insensitive; senha é comparada exatamente.
 */
export function autenticar(email, senha) {
  const achado = listarUsuarios().find(
    (u) => igual(u.email, email) && String(u.senha) === String(senha),
  );
  return achado ? { email: achado.email, perfil: achado.perfil } : null;
}

/** Só 'admin' escreve. */
export function podeEscrever(perfil) {
  return normalizarPerfil(perfil) === 'admin';
}
