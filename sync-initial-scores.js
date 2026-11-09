const https = require('https');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body), 'utf8');
    const req = https.request('https://isuzu-rush-1.onrender.com' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': data.length
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Register and submit score for ปูน
  const p1 = await post('/api/player/register', {
    nickname: 'ปูน',
    phone: '089-123-4567',
    email: 'poon@isuzu-tsh.com',
    source: 'mobile',
    pdpaConsent: true
  });
  console.log('Player 1 registered:', p1);

  const s1 = await post('/api/game/start', { playerUuid: p1.player.player_uuid });
  const sub1 = await post('/api/game/submit', {
    sessionToken: s1.sessionToken,
    playerUuid: p1.player.player_uuid,
    nickname: 'ปูน',
    phone: '089-123-4567',
    score: 13716,
    distance: 1850,
    coins: 24,
    tickets: 3,
    maxCombo: 8,
    playTimeSec: 62,
    source: 'mobile'
  });
  console.log('Player 1 score submitted:', sub1);
}

main();
