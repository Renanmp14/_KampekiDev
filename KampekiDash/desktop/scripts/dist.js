// Gera o instalador para a plataforma informada:
//   npm run dist Apple     → macOS   (.dmg em desktop/dist/)
//   npm run dist Windows   → Windows (.exe NSIS em desktop/dist/)
//   npm run dist           → usa a plataforma deste computador
//
// Faz, em ordem: valida o build/.env (check-env) → builda o frontend (vite) →
// empacota com o electron-builder mirando o alvo escolhido. Cada passo aborta o
// processo se falhar, para nunca gerar um instalador pela metade.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { resolvePlatform } = require('./platform');

const DESKTOP_DIR = path.join(__dirname, '..');

// Caminho do binário local (evita depender de `npx`/PATH). No Windows o bin tem
// sufixo .cmd; nas demais plataformas é um shell script sem extensão.
function localBin(name) {
  const bin = process.platform === 'win32' ? `${name}.cmd` : name;
  const full = path.join(DESKTOP_DIR, 'node_modules', '.bin', bin);
  if (!fs.existsSync(full)) {
    console.error(`\n[dist] "${name}" não encontrado. Rode "npm install" dentro de desktop/ primeiro.`);
    process.exit(1);
  }
  return full;
}

// Roda um passo herdando o stdio; encerra tudo se o passo retornar erro.
function run(label, cmd, args, opts = {}) {
  console.log(`\n▶ ${label}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: DESKTOP_DIR, ...opts });
  if (res.error) {
    console.error(`\n[dist] Falha ao executar "${label}": ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`\n[dist] "${label}" terminou com erro (código ${res.status}). Abortando.`);
    process.exit(res.status || 1);
  }
}

const plat = resolvePlatform(); // aceita Apple/Windows; sem arg = host

// Buildar para uma plataforma diferente da do computador raramente funciona
// (ex.: gerar .dmg exige macOS; NSIS costuma exigir Windows). Avisa cedo.
if (!plat.isHost) {
  console.warn(
    `\n[dist] Aviso: você pediu um build para ${plat.label}, mas está em `
    + `${process.platform}. Cross-build normalmente falha — rode este comando `
    + `na máquina ${plat.label}.`,
  );
}

console.log(`\n=== Gerando instalador Kampeki Finance para ${plat.label} ===`);

// 1) credenciais reais presentes no build/.env
run('Validando credenciais (check-env)', process.execPath, [path.join(DESKTOP_DIR, 'check-env.js')]);

// 2) build do frontend (vite) — usa o npm que invocou este script
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
run('Build do frontend (vite)', npmCmd, ['--prefix', '../frontend', 'run', 'build']);

// 3) empacotamento com o alvo escolhido
run(`Empacotando (electron-builder ${plat.ebFlag})`, localBin('electron-builder'), [plat.ebFlag]);

console.log(`\n✅ Build de ${plat.label} concluído. Veja os artefatos em desktop/dist/.`);
