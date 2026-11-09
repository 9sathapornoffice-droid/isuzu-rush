const fs = require('fs');

// 1. UPDATE SERVER.JS
let serverCode = fs.readFileSync('C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush/server.js', 'utf8');

// Insert defaults in initDb
if (!serverCode.includes('defaultSettings = {')) {
  serverCode = serverCode.replace(
    /CREATE TABLE IF NOT EXISTS settings \(\s*key TEXT PRIMARY KEY,\s*value TEXT NOT NULL\s*\);\s*`\);/,
    `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    \`);

    const defaultSettings = {
      'event_title': 'ISUZU RUSH 2026',
      'event_active': 'true',
      'difficulty': 'normal',
      'require_phone': 'false',
      'player_lives': '3',
      'base_speed': '6',
      'announcement': ''
    };
    const ins = sqliteDb.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(defaultSettings)) {
      ins.run(k, String(v));
    }`
  );
}

// Update getAllSettings with defaults
serverCode = serverCode.replace(
  /function getAllSettings\(\) \{[\s\S]*?return jsonDb\.settings \|\| \{\};\s*\}/,
  `function getAllSettings() {
  const defaults = {
    'event_title': 'ISUZU RUSH 2026',
    'event_active': 'true',
    'difficulty': 'normal',
    'require_phone': 'false',
    'player_lives': '3',
    'base_speed': '6',
    'announcement': ''
  };

  if (dbMode === 'sqlite') {
    try {
      const rows = sqliteDb.prepare('SELECT key, value FROM settings').all();
      const res = { ...defaults };
      for (const r of rows) res[r.key] = r.value;
      return res;
    } catch (e) { return defaults; }
  }
  return { ...defaults, ...(jsonDb.settings || {}) };
}`
);

// Update /api/game/start to load and return real settings
serverCode = serverCode.replace(
  /const playerId = player \? player\.id : 0;\s*const session = createSessionToken\(playerId, clientIp\);[\s\S]*?config: \{ playerLives: 3, baseSpeed: 210, maxSpeed: 620 \}\s*\}\);/,
  `const settings = getAllSettings();
      if (settings.event_active === 'false') {
        return sendJson(res, 403, { success: false, error: 'ขณะนี้กิจกรรมปิดรับการแข่งขันชั่วคราว' });
      }

      const playerLives = parseInt(settings.player_lives, 10) || 3;
      const difficulty = settings.difficulty || 'normal';
      let speedStart = 210;
      let speedMax = 620;
      let acceleration = 2.5;

      if (difficulty === 'easy') { speedStart = 170; speedMax = 500; acceleration = 1.8; }
      else if (difficulty === 'hard') { speedStart = 280; speedMax = 760; acceleration = 4.0; }

      if (settings.base_speed) {
        const bs = parseFloat(settings.base_speed);
        if (bs <= 5) speedStart = 170;
        else if (bs >= 7) speedStart = 280;
      }

      const playerId = player ? player.id : 0;
      const session = createSessionToken(playerId, clientIp);

      return sendJson(res, 200, {
        success: true,
        sessionToken: session.session_token,
        playerUuid: player ? player.player_uuid : '',
        config: {
          eventActive: settings.event_active !== 'false',
          difficulty,
          playerLives,
          speedStart,
          speedMax,
          acceleration,
          announcement: settings.announcement || '',
          eventTitle: settings.event_title || ''
        }
      });`
);

// Update /api/player/register with require_phone validation
serverCode = serverCode.replace(
  /const nickname = sanitizeNickname\(body\.nickname\);[\s\S]*?if \(containsProfanity\(nickname\)\) \{/,
  `const nickname = sanitizeNickname(body.nickname);
      if (!nickname || nickname.length < 2) {
        return sendJson(res, 400, { success: false, error: 'กรุณากรอกชื่อเล่น 2-16 ตัวอักษร' });
      }
      if (containsProfanity(nickname)) {
        return sendJson(res, 400, { success: false, error: 'ชื่อเล่นมีคำไม่สุภาพ กรุณาเปลี่ยนชื่อใหม่' });
      }

      const settings = getAllSettings();
      if (settings.require_phone === 'true') {
        const clean = (body.phone || '').replace(/[\\s\\-_]/g, '');
        if (!clean || clean.length < 9) {
          return sendJson(res, 400, { success: false, error: 'กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (จำเป็นสำหรับการรับรางวัล)' });
        }
      }

      if (false) {`
);

fs.writeFileSync('C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush/server.js', serverCode, 'utf8');
console.log('server.js updated with dynamic settings');
