const fs = require('fs');

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // 1. Update API_BASE
  code = code.replace(
    /const API_BASE = \(window\.location\.hostname === 'localhost'[\s\S]*?: \(localStorage\.getItem\('isuzu_rush_api_url'\) \|\| DEFAULT_CLOUD_API\);/,
    `let API_BASE = DEFAULT_CLOUD_API;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('onrender.com')) {
    API_BASE = '';
  } else if (localStorage.getItem('isuzu_rush_api_url')) {
    API_BASE = localStorage.getItem('isuzu_rush_api_url');
  }`
  );

  // 2. Update startGame payload
  code = code.replace(
    /body: JSON\.stringify\(\{\s*playerUuid: player\.playerUuid\s*\}\)/,
    `body: JSON.stringify({
          playerUuid: player.playerUuid,
          nickname: player.nickname,
          phone: player.phone,
          email: player.email,
          source: detectedSource
        })`
  );

  // 3. Update submitScore payload
  code = code.replace(
    /playerUuid: player \? player\.playerUuid : '',\s*score: stats\.score,/,
    `playerUuid: player ? player.playerUuid : '',
          nickname: player ? player.nickname : '',
          phone: player ? player.phone : '',
          email: player ? player.email : '',
          score: stats.score,`
  );

  // 4. Add syncLocalPlayerWithServer before the closing `updateSoundButtons();\n});`
  if (!code.includes('syncLocalPlayerWithServer')) {
    const lastIdx = code.lastIndexOf('updateSoundButtons();');
    if (lastIdx !== -1) {
      const syncFn = `
  // Auto-sync player registration and offline best scores to cloud server
  async function syncLocalPlayerWithServer() {
    const player = getSavedPlayer();
    if (!player || !player.nickname) return;

    try {
      await fetch(\`\${API_BASE}/api/player/register\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerUuid: player.playerUuid,
          nickname: player.nickname,
          phone: player.phone || '',
          email: player.email || '',
          source: detectedSource,
          pdpaConsent: true
        })
      });

      const bestScore = parseInt(localStorage.getItem('isuzu_rush_best') || '0', 10);
      const bestDistance = parseInt(localStorage.getItem('isuzu_rush_best_distance') || '0', 10);
      if (bestScore > 0) {
        await fetch(\`\${API_BASE}/api/game/sync-score\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerUuid: player.playerUuid,
            nickname: player.nickname,
            phone: player.phone || '',
            email: player.email || '',
            score: bestScore,
            distance: bestDistance,
            source: detectedSource
          })
        });
      }

      fetchLeaderboard(currentLbPeriod);
    } catch (e) {
      console.log('Sync offline:', e);
    }
  }

  syncLocalPlayerWithServer();\n\n  `;
      code = code.slice(0, lastIdx) + syncFn + code.slice(lastIdx);
    }
  }

  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Successfully updated:', filePath);
}

updateFile('C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush/public/js/app.js');
updateFile('C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush/js/app.js');
