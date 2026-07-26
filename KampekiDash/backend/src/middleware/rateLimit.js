// Limite de tentativas de login — proteção contra força bruta.
//
// Contexto: com a versão web (VM Oracle), o POST /api/auth/login passou a ficar
// exposto na internet. Antes, no app desktop, ele só existia em 127.0.0.1 na
// máquina do próprio usuário, e tentativas ilimitadas eram inofensivas.
//
// Estratégia (por IP, em memória):
//   1. Conta apenas as tentativas que FALHAM (resposta 401). Um login que dá
//      certo zera o contador do IP.
//   2. Atingido o limite dentro da janela, o IP recebe 429 até o bloqueio expirar.
//   3. Reincidência escala o bloqueio (dobra a cada ciclo, com teto), para que
//      quem insiste espere cada vez mais.
//   4. Antes disso, um atraso progressivo em cada tentativa já derruba a
//      velocidade de qualquer varredura automatizada.
//
// Decisão consciente: NÃO existe bloqueio global (agregando todos os IPs). Com
// um único usuário administrador, um bloqueio global viraria arma contra o dono
// — bastaria um atacante disparar tentativas para trancar o acesso legítimo.
// O limite por IP protege sem criar essa porta.
//
// Em memória (Map) é adequado aqui: um único processo Node, um único usuário.
// Reiniciar o app zera os contadores — aceitável, já que reiniciar não é algo
// que um atacante remoto consegue provocar.

const DEFAULTS = {
  maxTentativas: 5,      // falhas toleradas dentro da janela
  janelaMin: 15,         // janela de contagem, em minutos
  bloqueioMin: 15,       // duração do 1º bloqueio, em minutos
  bloqueioMaxMin: 60,    // teto do bloqueio após escalada
  atrasoMaxMs: 2000,     // teto do atraso progressivo por tentativa
  maxIpsMonitorados: 5000, // trava de memória
};

function numeroDeEnv(nome, padrao) {
  const n = Number(process.env[nome]);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Identifica o cliente. Atrás do proxy reverso (Caddy), `req.ip` só devolve o
 * IP real se o Express estiver com 'trust proxy' ligado — ver app.js. Sem isso,
 * todos os visitantes da web apareceriam como 127.0.0.1 e dividiriam o mesmo
 * contador.
 */
function identificar(req) {
  return req.ip || req.socket?.remoteAddress || 'desconhecido';
}

export function criarLoginRateLimit(opcoes = {}) {
  const cfg = {
    ...DEFAULTS,
    ...opcoes,
    maxTentativas: numeroDeEnv('LOGIN_MAX_TENTATIVAS', opcoes.maxTentativas ?? DEFAULTS.maxTentativas),
    janelaMin: numeroDeEnv('LOGIN_JANELA_MIN', opcoes.janelaMin ?? DEFAULTS.janelaMin),
    bloqueioMin: numeroDeEnv('LOGIN_BLOQUEIO_MIN', opcoes.bloqueioMin ?? DEFAULTS.bloqueioMin),
  };
  const janelaMs = cfg.janelaMin * 60_000;
  const bloqueioMs = cfg.bloqueioMin * 60_000;
  const bloqueioMaxMs = cfg.bloqueioMaxMin * 60_000;

  /** ip -> { falhas, janelaAte, bloqueadoAte, ciclos } */
  const registros = new Map();

  function limpar(agora) {
    for (const [ip, r] of registros) {
      const expirou = r.bloqueadoAte <= agora && r.janelaAte <= agora;
      if (expirou) registros.delete(ip);
    }
    // Trava de memória: se ainda estiver grande (varredura distribuída), descarta
    // os registros mais antigos — perder contagem de IPs frios é inofensivo.
    if (registros.size > cfg.maxIpsMonitorados) {
      const ordenados = [...registros.entries()].sort((a, b) => a[1].janelaAte - b[1].janelaAte);
      const excedente = registros.size - cfg.maxIpsMonitorados;
      for (let i = 0; i < excedente; i += 1) registros.delete(ordenados[i][0]);
    }
  }

  function registrarFalha(ip) {
    const agora = Date.now();
    const r = registros.get(ip) || { falhas: 0, janelaAte: 0, bloqueadoAte: 0, ciclos: 0 };
    // Janela expirada reinicia a contagem (mas preserva os ciclos, para a escalada).
    if (r.janelaAte <= agora) r.falhas = 0;
    r.falhas += 1;
    r.janelaAte = agora + janelaMs;
    if (r.falhas >= cfg.maxTentativas) {
      r.ciclos += 1;
      const duracao = Math.min(bloqueioMs * 2 ** (r.ciclos - 1), bloqueioMaxMs);
      r.bloqueadoAte = agora + duracao;
      r.falhas = 0;
      console.warn(
        `[login] IP ${ip} bloqueado por ${Math.round(duracao / 60_000)} min `
        + `após ${cfg.maxTentativas} tentativas inválidas (ciclo ${r.ciclos}).`,
      );
    }
    registros.set(ip, r);
  }

  function limparRegistro(ip) {
    registros.delete(ip);
  }

  async function middleware(req, res, next) {
    const agora = Date.now();
    limpar(agora);

    const ip = identificar(req);
    const r = registros.get(ip);

    if (r && r.bloqueadoAte > agora) {
      const segundos = Math.ceil((r.bloqueadoAte - agora) / 1000);
      res.set('Retry-After', String(segundos));
      const minutos = Math.ceil(segundos / 60);
      return res.status(429).json({
        error: `Muitas tentativas de login. Tente novamente em ${minutos} minuto(s).`,
      });
    }

    // Atraso progressivo: quem já errou paga tempo na tentativa seguinte
    // (1 falha → 300ms, 2 → 600ms, …, com teto). Só afeta quem errou; o acesso
    // legítimo na primeira tentativa (0 falhas) não sente nada, e um usuário que
    // digitou torto uma vez espera 300ms — imperceptível. Para uma varredura
    // automatizada, é o que derruba a velocidade antes mesmo do bloqueio.
    if (r && r.falhas > 0) {
      await esperar(Math.min(300 * r.falhas, cfg.atrasoMaxMs));
    }

    // O resultado só é conhecido depois do handler; o status da resposta diz tudo.
    res.on('finish', () => {
      if (res.statusCode === 401) registrarFalha(ip);
      else if (res.statusCode >= 200 && res.statusCode < 300) limparRegistro(ip);
    });

    return next();
  }

  // Exposto para os testes.
  middleware._registros = registros;
  middleware._cfg = cfg;
  return middleware;
}

export default criarLoginRateLimit;
