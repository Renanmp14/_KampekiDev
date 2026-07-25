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
const IS_WIN = process.platform === 'win32';

// No Windows, `spawnSync` de arquivos .cmd/.bat (npm.cmd, electron-builder.cmd)
// exige `shell: true` — sem isso o Node ≥18.20/20.12/21 falha com EINVAL
// (mudança de segurança CVE-2024-27980). Com shell, os tokens que tenham espaço
// precisam ser citados na mão (o caminho do .bin pode conter espaços).
function q(s) {
  return IS_WIN && /\s/.test(s) ? `"${s}"` : s;
}

// Caminho do binário local (evita depender de `npx`/PATH). No Windows o bin tem
// sufixo .cmd; nas demais plataformas é um shell script sem extensão.
function localBin(name) {
  const bin = IS_WIN ? `${name}.cmd` : name;
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
  const finalCmd = IS_WIN ? q(cmd) : cmd;
  const finalArgs = IS_WIN ? args.map(q) : args;
  const res = spawnSync(finalCmd, finalArgs, { stdio: 'inherit', cwd: DESKTOP_DIR, shell: IS_WIN, ...opts });
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

// O instalador NÃO empacota mais segredos: o .env fica no computador do cliente
// (userData), fora do pacote. Por isso o antigo passo "check-env" foi removido —
// não há credencial a validar no build. (Para conferir seu build/.env local antes
// de rodar o app em dev, use `npm run check-env`.)

// 1) build do frontend (vite) — usa o npm que invocou este script
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
run('Build do frontend (vite)', npmCmd, ['--prefix', '../frontend', 'run', 'build']);

// 2) empacotamento com o alvo escolhido.
// macOS sem certificado Apple (CSC_LINK ausente): força build ad-hoc
// (identity=null), como era o padrão — sem isso o electron-builder geraria um app
// sem assinatura, que nem abre no Apple Silicon. Com CSC_LINK definido, assina.
const ebArgs = [plat.ebFlag];
if (plat.key === 'mac' && !process.env.CSC_LINK) {
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  ebArgs.push('--config.mac.identity=null');
}
run(`Empacotando (electron-builder ${plat.ebFlag})`, localBin('electron-builder'), ebArgs);

console.log(`\n✅ Build de ${plat.label} concluído. Veja os artefatos em desktop/dist/.`);
