// Resolve o argumento de plataforma passado aos comandos `npm run dist <plat>` e
// `npm start <plat>`. Aceita apelidos amigáveis (Apple/Windows) e os nomes
// técnicos (mac/win/darwin/win32), sem diferenciar maiúsculas.
//
//   npm run dist Apple     → build para macOS  (.dmg)
//   npm run dist Windows   → build para Windows (.exe / NSIS)
//   npm start   Apple      → roda o app na máquina (host precisa ser macOS)
//
// Se nenhum argumento for passado, assume a plataforma do computador atual.
const os = require('os');

// apelido digitado → chave interna
const ALIASES = {
  apple: 'mac',
  mac: 'mac',
  macos: 'mac',
  darwin: 'mac',
  osx: 'mac',
  windows: 'win',
  win: 'win',
  win32: 'win',
  win64: 'win',
};

const INFO = {
  mac: { key: 'mac', label: 'macOS', ebFlag: '--mac', hostPlatform: 'darwin' },
  win: { key: 'win', label: 'Windows', ebFlag: '--win', hostPlatform: 'win32' },
};

function hostKey() {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'win';
  return null; // linux/outros: sem alvo padrão
}

// Lê o 1º argumento não-flag da linha de comando (ignora coisas como --foo).
function rawArg() {
  return process.argv.slice(2).find((a) => a && !a.startsWith('-'));
}

// Retorna { key, label, ebFlag, hostPlatform, isHost } ou encerra com erro/uso.
function resolvePlatform({ defaultToHost = true } = {}) {
  const raw = rawArg();

  let key;
  if (raw) {
    key = ALIASES[raw.toLowerCase()];
    if (!key) {
      console.error(`\n[plataforma] Valor não reconhecido: "${raw}"`);
      console.error('Use um destes:  Apple  |  Windows');
      process.exit(1);
    }
  } else if (defaultToHost) {
    key = hostKey();
    if (!key) {
      console.error('\n[plataforma] Não foi possível deduzir a plataforma deste computador.');
      console.error('Informe explicitamente:  Apple  |  Windows');
      process.exit(1);
    }
    console.log(`[plataforma] Nenhuma informada — assumindo a deste computador: ${INFO[key].label}.`);
  } else {
    console.error('\n[plataforma] Informe a plataforma:  Apple  |  Windows');
    process.exit(1);
  }

  const info = INFO[key];
  return { ...info, isHost: info.hostPlatform === process.platform, hostArch: os.arch() };
}

module.exports = { resolvePlatform, INFO };
