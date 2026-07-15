// Wrapper de fetch com token JWT e tratamento de expiração.

const TOKEN_KEY = 'kampeki_token';
const LOGIN_KEY = 'kampeki_login';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

// --- Credenciais salvas ("manter-me conectado") ---
// Guardadas neste computador para reautenticar sem redigitar quando o token
// expira. Codificadas em base64 apenas para não ficarem à vista — NÃO é
// criptografia; coerente com o modelo (app desktop de 1 usuário de confiança,
// que já carrega o .env em texto puro no disco).
export function saveCredentials(email, password) {
  try {
    localStorage.setItem(LOGIN_KEY, btoa(encodeURIComponent(JSON.stringify({ email, password }))));
  } catch { /* localStorage indisponível: ignora */ }
}

export function getCredentials() {
  try {
    const raw = localStorage.getItem(LOGIN_KEY);
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(atob(raw)));
  } catch { return null; }
}

export function clearCredentials() {
  localStorage.removeItem(LOGIN_KEY);
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    // Redireciona ao login se o token expirou/é inválido.
    if (!path.startsWith('/auth/login')) {
      window.location.href = '/login';
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Não autorizado');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
};
