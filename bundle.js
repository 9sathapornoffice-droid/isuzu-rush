const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

console.log('Bundling ISUZU RUSH into a single standalone index.html...');

// 1. Gather all assets and convert to Data URIs
const assetMap = {};
function scanAssets(dir, relPrefix = '') {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanAssets(fullPath, path.join(relPrefix, item));
    } else {
      const ext = path.extname(item).toLowerCase();
      let mime = 'application/octet-stream';
      if (ext === '.svg') mime = 'image/svg+xml';
      else if (ext === '.png') mime = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.gif') mime = 'image/gif';
      else continue;

      const fileBuffer = fs.readFileSync(fullPath);
      const base64Data = fileBuffer.toString('base64');
      const dataUri = `data:${mime};base64,${base64Data}`;

      const relUnix = path.join('assets', relPrefix, item).replace(/\\/g, '/');
      assetMap[`./${relUnix}`] = dataUri;
      assetMap[relUnix] = dataUri;
      assetMap[`/${relUnix}`] = dataUri;
    }
  }
}

scanAssets(path.join(PUBLIC_DIR, 'assets'));
console.log(`Found and encoded ${Object.keys(assetMap).length / 3} assets to Base64.`);

// 2. Read and replace asset paths in CSS
let css = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'style.css'), 'utf-8');
for (const [relPath, dataUri] of Object.entries(assetMap)) {
  css = css.split(relPath).join(dataUri);
}

// 3. Read and replace asset paths in JS files
const jsFiles = [
  'js/assets.config.js',
  'js/game.config.js',
  'js/i18n.js',
  'js/qrcode-lib.js',
  'js/game/audio.js',
  'js/game/background.js',
  'js/game/player.js',
  'js/game/obstacles.js',
  'js/game/items.js',
  'js/game/ui.js',
  'js/game/engine.js',
  'js/app.js'
];

let combinedJs = '';
for (const jsRel of jsFiles) {
  let jsContent = fs.readFileSync(path.join(PUBLIC_DIR, jsRel), 'utf-8');
  for (const [relPath, dataUri] of Object.entries(assetMap)) {
    jsContent = jsContent.split(`'${relPath}'`).join(`'${dataUri}'`);
    jsContent = jsContent.split(`"${relPath}"`).join(`"${dataUri}"`);
  }
  combinedJs += `\n/* --- ${jsRel} --- */\n` + jsContent + '\n';
}

// 4. Read HTML and replace CSS link and Script tags with inlined content
let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf-8');

// Replace asset paths in HTML
for (const [relPath, dataUri] of Object.entries(assetMap)) {
  html = html.split(`"${relPath}"`).join(`"${dataUri}"`);
  html = html.split(`'${relPath}'`).join(`'${dataUri}'`);
}

// Replace CSS link with inline style
html = html.replace(
  /<link rel="stylesheet" href="\.\/css\/style\.css">/,
  `<style>\n${css}\n</style>`
);

// Replace script tags with single inline script
const scriptTagsRegex = /<!-- Scripts -->[\s\S]*?<\/body>/;
html = html.replace(
  scriptTagsRegex,
  `<!-- Inlined Standalone Scripts -->\n<script>\n${combinedJs}\n</script>\n</body>`
);

// 5. Output bundled index.html
fs.writeFileSync(path.join(ROOT_DIR, 'index.html'), html, 'utf-8');
fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html, 'utf-8');

const sizeKb = Math.round(fs.statSync(path.join(ROOT_DIR, 'index.html')).size / 1024);
console.log(`✓ Standalone bundled index.html successfully created! Size: ${sizeKb} KB`);
