// Roda o app localmente para teste, no mesmo estilo dos dois sistemas:
//   npm start Apple     → testa no macOS
//   npm start Windows   → testa no Windows
//   npm start           → usa a plataforma deste computador
//
// Observação: o Electron sempre executa usando o binário do SISTEMA atual — não
// há como "emular" o outro SO por aqui. O argumento serve para deixar o comando
// simétrico entre as máquinas e para avisar caso você peça um alvo que não bate
// com o computador em que está.
//
// Antes de abrir, buildamos o frontend (vite): o app desktop serve o build do
// React pelo próprio Express (mesma origem das rotas /api). Sem o build, a janela
// mostraria "Cannot GET /". É o mesmo build que o `dist` empacota — assim o
// `npm start` reflete fielmente o que vai no instalador.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { resolvePlatform } = require('./platform');

const DESKTOP_DIR = path.join(__dirname, '..');
const IS_WIN = process.platform === 'win32';

// No Windows, `spawnSync` de arquivos .cmd/.bat (npm.cmd, electron.cmd) exige
// `shell: true` — sem isso o Node ≥18.20/20.12/21 falha com EINVAL (mudança de
// segurança CVE-2024-27980). Com shell, tokens com espaço precisam de aspas.
function q(s) {
  return IS_WIN && /\s/.test(s) ? `"${s}"` : s;
}

function localBin(name) {
  const bin = IS_WIN ? `${name}.cmd` : name;
  const full = path.join(DESKTOP_DIR, 'node_modules', '.bin', bin);
  if (!fs.existsSync(full)) {
    console.error(`\n[start] "${name}" não encontrado. Rode "npm install" dentro de desktop/ primeiro.`);
    process.exit(1);
  }
  return full;
}

// Roda um passo herdando o stdio; encerra tudo se o passo retornar erro.
function run(label, cmd, args) {
  console.log(`\n▶ ${label}`);
  const finalCmd = IS_WIN ? q(cmd) : cmd;
  const finalArgs = IS_WIN ? args.map(q) : args;
  const res = spawnSync(finalCmd, finalArgs, { stdio: 'inherit', cwd: DESKTOP_DIR, shell: IS_WIN });
  if (res.error) {
    console.error(`\n[start] Falha ao executar "${label}": ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`\n[start] "${label}" terminou com erro (código ${res.status}). Abortando.`);
    process.exit(res.status || 1);
  }
}

const plat = resolvePlatform(); // aceita Apple/Windows; sem arg = host

if (!plat.isHost) {
  console.warn(
    `\n[start] Você pediu ${plat.label}, mas este computador é ${process.platform}. `
    + `O Electron vai rodar com o binário deste sistema — para testar de fato em `
    + `${plat.label}, rode "npm start" na máquina ${plat.label}.\n`,
  );
}

// 1) build do frontend (garante que o Express tenha o que servir)
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
run('Build do frontend (vite)', npmCmd, ['--prefix', '../frontend', 'run', 'build']);

// 2) abre o app
console.log(`\n▶ Iniciando Kampeki Finance (teste local — ${plat.label})...`);
const electronBin = localBin('electron');
const res = spawnSync(IS_WIN ? q(electronBin) : electronBin, ['.'], {
  stdio: 'inherit',
  cwd: DESKTOP_DIR,
  shell: IS_WIN,
});
if (res.error) {
  console.error(`\n[start] Falha ao iniciar o Electron: ${res.error.message}`);
  process.exit(1);
}
process.exit(res.status || 0);
