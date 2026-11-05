const fs = require('fs');
const path = require('path');

const publicDir = 'C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush/public';
const rootDir = 'C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush';

let qrHtml = fs.readFileSync(path.join(publicDir, 'qr.html'), 'utf-8');
const adminCss = fs.readFileSync(path.join(publicDir, 'css/admin.css'), 'utf-8');
const qrLib = fs.readFileSync(path.join(publicDir, 'js/qrcode-lib.js'), 'utf-8');
const logoSvg = fs.readFileSync(path.join(publicDir, 'assets/images/logo.svg'), 'base64');
const logoData = 'data:image/svg+xml;base64,' + logoSvg;

qrHtml = qrHtml.replace('<link rel="stylesheet" href="./css/admin.css">', '<style>\n' + adminCss + '\n</style>');
qrHtml = qrHtml.split('./assets/images/logo.svg').join(logoData);
qrHtml = qrHtml.replace('<script src="./js/qrcode-lib.js"></script>', '<script>\n' + qrLib + '\n</script>');

fs.writeFileSync(path.join(publicDir, 'qr.html'), qrHtml, 'utf-8');
fs.writeFileSync(path.join(rootDir, 'qr.html'), qrHtml, 'utf-8');
console.log('✓ Standalone qr.html created successfully!');
