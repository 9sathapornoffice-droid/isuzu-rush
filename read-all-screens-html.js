const fs = require('fs');

const html = fs.readFileSync('C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush/public/index.template.html', 'utf8');

const screens = [
  'screen-splash',
  'screen-register',
  'screen-tutorial',
  'screen-game',
  'screen-gameover',
  'screen-leaderboard'
];

screens.forEach(s => {
  const idx = html.indexOf(`id="${s}"`);
  if (idx !== -1) {
    console.log(`\n=================== ${s} ===================`);
    console.log(html.substring(idx, idx + 600));
  }
});
