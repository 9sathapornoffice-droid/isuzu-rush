const fs = require('fs');
const bg = fs.readFileSync('C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush/public/js/game/background.js', 'utf8');
const lines = bg.split('\n');
console.log(lines.slice(280, 330).join('\n'));
