// Gera os ícones da marca em desktop/build/ a partir do favicon (o mesmo selo que
// aparece na aba do navegador em dev):
//   - icon.ico   → Windows (multi-resolução 16→256)
//   - icon.png   → master 1024×1024 (fonte / fallback)
//   - icon.icns  → macOS (gerado só quando rodando no próprio macOS, via iconutil)
//
// Os arquivos gerados são versionados, então o build normal NÃO depende deste
// script nem do sharp. Regenerar (só se mudar a logo): dentro de desktop/ rode
//   npm i -D sharp png-to-ico   &&   npm run icon
// Gere o .icns numa máquina macOS (o iconutil é nativo do macOS).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
// Interop CJS/ESM: versões recentes exportam a função em .default.
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;

const svgPath = path.join(__dirname, '..', 'frontend', 'public', 'favicon.svg');
const outDir = path.join(__dirname, 'build');
const outIco = path.join(outDir, 'icon.ico');
const outPng = path.join(outDir, 'icon.png');
const outIcns = path.join(outDir, 'icon.icns');
const icoSizes = [256, 128, 64, 48, 32, 16];

// macOS: mapa "arquivo do iconset" → tamanho em px (Retina @2x incluídos).
const iconsetSizes = {
  'icon_16x16.png': 16,
  'icon_16x16@2x.png': 32,
  'icon_32x32.png': 32,
  'icon_32x32@2x.png': 64,
  'icon_128x128.png': 128,
  'icon_128x128@2x.png': 256,
  'icon_256x256.png': 256,
  'icon_256x256@2x.png': 512,
  'icon_512x512.png': 512,
  'icon_512x512@2x.png': 1024,
};

const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

async function buildIcns(svg) {
  if (process.platform !== 'darwin') {
    console.log('Pulei o icon.icns (só é gerado no macOS, que tem o iconutil nativo).');
    return;
  }
  const iconset = fs.mkdtempSync(path.join(os.tmpdir(), 'kampeki-iconset-')) + '.iconset';
  fs.mkdirSync(iconset, { recursive: true });
  await Promise.all(
    Object.entries(iconsetSizes).map(async ([name, size]) => {
      fs.writeFileSync(path.join(iconset, name), await png(svg, size));
    }),
  );
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', outIcns]);
  fs.rmSync(iconset, { recursive: true, force: true });
  console.log('Gerado:', outIcns);
}

(async () => {
  const svg = fs.readFileSync(svgPath);
  fs.mkdirSync(outDir, { recursive: true });

  // Windows (.ico)
  const icoPngs = await Promise.all(icoSizes.map((s) => png(svg, s)));
  fs.writeFileSync(outIco, await pngToIco(icoPngs));
  console.log('Gerado:', outIco);

  // Master 1024 (.png) — fonte e fallback multiplataforma
  fs.writeFileSync(outPng, await png(svg, 1024));
  console.log('Gerado:', outPng);

  // macOS (.icns)
  await buildIcns(svg);
})().catch((e) => { console.error(e); process.exit(1); });
