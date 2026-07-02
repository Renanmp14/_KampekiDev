// Gera  desktop/build/icon.ico  a partir do favicon da marca (o mesmo selo que
// aparece na aba do navegador em dev). ICO multi-resolução (16→256).
//
// Regenerar (só se mudar a logo): dentro de desktop/ rode
//   npm i -D sharp png-to-ico   &&   npm run icon
// O icon.ico gerado é versionado, então o build normal não depende dessas libs.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
// Interop CJS/ESM: versões recentes exportam a função em .default.
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;

const svgPath = path.join(__dirname, '..', 'frontend', 'public', 'favicon.svg');
const outDir = path.join(__dirname, 'build');
const outIco = path.join(outDir, 'icon.ico');
const sizes = [256, 128, 64, 48, 32, 16];

(async () => {
  const svg = fs.readFileSync(svgPath);
  const pngs = await Promise.all(
    sizes.map((s) => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer()),
  );
  const ico = await pngToIco(pngs);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outIco, ico);
  console.log('Gerado:', outIco, `(${ico.length} bytes)`);
})().catch((e) => { console.error(e); process.exit(1); });
