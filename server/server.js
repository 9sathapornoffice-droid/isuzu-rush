/**
 * ISUZU RUSH - Game Server & API Backend
 * Pure Node.js (zero external npm dependencies required, native SQLite & crypto).
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('./db');
const antiCheat = require('./antiCheat');
const profanity = require('./profanity');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Initialize Database (Zero fake seed data - real players only)
db.initDatabase();

// In-memory active admin tokens
const adminSessions = new Set();

// MIME Types mapping
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

// Helper: send JSON response
function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    ...headers
  });
  res.end(JSON.stringify(data));
}

// Helper: parse JSON body from request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Request entity too large'));
      }
    });
    req.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {};
        resolve(json);
      } catch (e) {
        reject(new Error('Malformed JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// Helper: check Admin Authorization
function checkAdminAuth(req) {
  const token = req.headers['x-admin-token'] || '';
  if (token && adminSessions.has(token)) {
    return true;
  }
  return false;
}

// Helper: get client IP address
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const clientIp = getClientIp(req);

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  try {
    // -------------------------------------------------------------
    // API ROUTES
    // -------------------------------------------------------------

    // 1. GET /api/settings - Public event settings
    if (pathname === '/api/settings' && method === 'GET') {
      const settings = db.getAllSettings();
      delete settings.admin_pin; // Never expose admin pin
      return sendJson(res, 200, { success: true, settings });
    }

    // 2. POST /api/player/register - Register or login player
    if (pathname === '/api/player/register' && method === 'POST') {
      const body = await parseBody(req);
      let { playerUuid, nickname, phone, email, source, pdpaConsent } = body;

      if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 2) {
        return sendJson(res, 400, { success: false, error: 'กรุณากรอกชื่อเล่นอย่างน้อย 2 ตัวอักษร (Nickname must be at least 2 characters)' });
      }

      nickname = profanity.sanitizeNickname(nickname, 16);
      if (profanity.containsProfanity(nickname)) {
        return sendJson(res, 400, { success: false, error: 'ชื่อเล่นมีคำที่ไม่เหมาะสม กรุณาใช้ชื่ออื่น (Nickname contains inappropriate words)' });
      }

      const settings = db.getAllSettings();
      if (settings.require_phone === 'true' && (!phone || phone.trim().length < 9)) {
        return sendJson(res, 400, { success: false, error: 'กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (Valid phone number required)' });
      }

      if (!playerUuid) {
        playerUuid = 'p_' + crypto.randomUUID();
      }

      const player = db.upsertPlayer({
        playerUuid,
        nickname,
        phone: phone ? phone.trim() : '',
        email: email ? email.trim() : '',
        source: source || 'direct',
        pdpaConsent: pdpaConsent !== false ? 1 : 0
      });

      return sendJson(res, 200, {
        success: true,
        player: {
          id: player.id,
          playerUuid: player.player_uuid,
          nickname: player.nickname,
          phone: player.phone ? player.phone.slice(0, 3) + '****' + player.phone.slice(-3) : '',
          email: player.email,
          source: player.source
        }
      });
    }

    // 3. GET /api/leaderboard - Top 50 scores & current player pinned rank
    if (pathname === '/api/leaderboard' && method === 'GET') {
      const period = parsedUrl.query.period || 'all'; // 'today', 'week', 'all'
      const playerUuid = parsedUrl.query.playerUuid || '';

      const leaderboard = db.getLeaderboard({ period, limit: 50 });
      let playerRank = null;
      if (playerUuid) {
        playerRank = db.getPlayerRank(playerUuid, period);
      }

      return sendJson(res, 200, {
        success: true,
        period,
        updatedAt: new Date().toISOString(),
        leaderboard,
        playerRank
      });
    }

    // 4. POST /api/game/start - Start a game session (Anti-cheat)
    if (pathname === '/api/game/start' && method === 'POST') {
      const body = await parseBody(req);
      const { playerUuid } = body;

      if (!playerUuid) {
        return sendJson(res, 400, { success: false, error: 'Missing playerUuid' });
      }

      const player = db.getPlayerByUuid(playerUuid);
      if (!player) {
        return sendJson(res, 404, { success: false, error: 'Player not found. Please register first.' });
      }

      if (player.is_banned) {
        return sendJson(res, 403, { success: false, error: 'Account has been restricted.' });
      }

      const settings = db.getAllSettings();
      if (settings.event_active === 'false') {
        return sendJson(res, 403, { success: false, error: 'กิจกรรมสิ้นสุดลงแล้ว ขอบคุณที่ร่วมสนุก (Event has ended)' });
      }

      const session = antiCheat.createSession(player.id, clientIp);

      return sendJson(res, 200, {
        success: true,
        sessionToken: session.sessionToken,
        startTime: session.startTime,
        config: {
          playerLives: parseInt(settings.player_lives || '3', 10),
          difficulty: settings.difficulty || 'normal'
        }
      });
    }

    // 5. POST /api/game/submit - Submit game results with validation
    if (pathname === '/api/game/submit' && method === 'POST') {
      const body = await parseBody(req);
      const {
        sessionToken,
        playerUuid,
        score,
        distance,
        coins = 0,
        tickets = 0,
        maxCombo = 1,
        playTimeSec = 0,
        source = 'direct'
      } = body;

      const player = db.getPlayerByUuid(playerUuid);
      if (!player) {
        return sendJson(res, 404, { success: false, error: 'Player not found' });
      }

      if (player.is_banned) {
        return sendJson(res, 403, { success: false, error: 'Account has been suspended' });
      }

      // Run anti-cheat verification
      const validation = antiCheat.validateGameSubmission({
        sessionToken,
        playerId: player.id,
        score: parseInt(score, 10) || 0,
        distance: parseInt(distance, 10) || 0,
        playTimeSec: parseInt(playTimeSec, 10) || 0,
        clientIp
      });

      if (!validation.valid) {
        return sendJson(res, 400, {
          success: false,
          error: `ผลการเล่นไม่ถูกต้อง: ${validation.reason}`
        });
      }

      // Record score
      db.recordScore({
        playerId: player.id,
        score: Math.max(0, parseInt(score, 10) || 0),
        distance: Math.max(0, parseInt(distance, 10) || 0),
        coins: Math.max(0, parseInt(coins, 10) || 0),
        tickets: Math.max(0, parseInt(tickets, 10) || 0),
        maxCombo: Math.max(1, parseInt(maxCombo, 10) || 1),
        playTimeSec: Math.max(1, parseInt(playTimeSec, 10) || 1),
        source: source || player.source || 'direct',
        sessionId: sessionToken,
        clientIp
      });

      // Fetch personal best & current rank
      const personalRank = db.getPlayerRank(playerUuid, 'all');

      return sendJson(res, 200, {
        success: true,
        submittedScore: score,
        personalBest: personalRank?.score || score,
        currentRank: personalRank?.rank || 1
      });
    }

    // -------------------------------------------------------------
    // ADMIN ROUTES
    // -------------------------------------------------------------

    // POST /api/admin/login
    if (pathname === '/api/admin/login' && method === 'POST') {
      const body = await parseBody(req);
      const { pin } = body;
      const settings = db.getAllSettings();
      const actualPin = process.env.ADMIN_PIN || settings.admin_pin || 'isuzu2026';

      if (pin === actualPin) {
        const token = 'adm_' + crypto.randomBytes(24).toString('hex');
        adminSessions.add(token);
        db.logAudit('ADMIN_LOGIN', 'Admin logged in', clientIp);
        return sendJson(res, 200, { success: true, token });
      } else {
        db.logAudit('ADMIN_LOGIN_FAILED', 'Incorrect PIN attempt', clientIp);
        return sendJson(res, 401, { success: false, error: 'รหัสผ่านแอดมินไม่ถูกต้อง (Invalid Admin PIN)' });
      }
    }

    // GET /api/admin/stats
    if (pathname === '/api/admin/stats' && method === 'GET') {
      if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
      const stats = db.getAdminStats();
      return sendJson(res, 200, { success: true, stats });
    }

    // GET /api/admin/players
    if (pathname === '/api/admin/players' && method === 'GET') {
      if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
      const search = parsedUrl.query.search || '';
      const page = parseInt(parsedUrl.query.page, 10) || 1;
      const result = db.getAdminPlayers({ search, page });
      return sendJson(res, 200, { success: true, ...result });
    }

    // POST /api/admin/player/ban
    if (pathname === '/api/admin/player/ban' && method === 'POST') {
      if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
      const body = await parseBody(req);
      db.togglePlayerBan(body.playerId, body.isBanned);
      db.logAudit('PLAYER_BAN_TOGGLE', `Player ${body.playerId} ban set to ${body.isBanned}`, clientIp);
      return sendJson(res, 200, { success: true });
    }

    // DELETE /api/admin/score/:id
    if (pathname.startsWith('/api/admin/score/') && method === 'DELETE') {
      if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
      const scoreId = parseInt(pathname.split('/').pop(), 10);
      db.deleteScore(scoreId);
      db.logAudit('SCORE_DELETED', `Score ID ${scoreId} removed`, clientIp);
      return sendJson(res, 200, { success: true });
    }

    // POST /api/admin/reset-leaderboard
    if (pathname === '/api/admin/reset-leaderboard' && method === 'POST') {
      if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
      db.resetLeaderboard();
      return sendJson(res, 200, { success: true, message: 'Leaderboard reset complete' });
    }

    // POST /api/admin/settings
    if (pathname === '/api/admin/settings' && method === 'POST') {
      if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
      const body = await parseBody(req);
      for (const [k, v] of Object.entries(body.settings || {})) {
        db.updateSetting(k, v);
      }
      db.logAudit('SETTINGS_UPDATED', JSON.stringify(body.settings), clientIp);
      return sendJson(res, 200, { success: true });
    }

    // GET /api/admin/export-csv
    if (pathname === '/api/admin/export-csv' && method === 'GET') {
      if (!checkAdminAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
      const topN = parsedUrl.query.topN || null;
      const rows = db.getAllPlayersForExport(topN);

      let csv = '\uFEFF'; // UTF-8 BOM for Excel in Thai
      csv += 'Rank,ID,Nickname,Phone,Email,High Score,Best Distance (m),Total Plays,Source,Banned,Registered At\n';
      rows.forEach((r, idx) => {
        csv += `"${idx + 1}","${r.id}","${(r.nickname || '').replace(/"/g, '""')}","${r.phone || ''}","${r.email || ''}","${r.high_score}","${r.best_distance}","${r.total_games}","${r.source}","${r.is_banned ? 'YES' : 'NO'}","${r.registered_at}"\n`;
      });

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="isuzu_rush_players_${Date.now()}.csv"`
      });
      return res.end(csv);
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING
    // -------------------------------------------------------------
    let filePath = pathname === '/' ? '/index.html' : pathname;

    // Friendly URL routing
    if (filePath === '/qr') filePath = '/qr.html';
    if (filePath === '/admin') filePath = '/admin.html';

    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(PUBLIC_DIR, safePath);

    // Ensure within PUBLIC_DIR
    if (!fullPath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Access Denied');
    }

    fs.stat(fullPath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for unknown SPA paths
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return fs.createReadStream(indexPath).pipe(res);
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
      }

      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
      });

      fs.createReadStream(fullPath).pipe(res);
    });

  } catch (error) {
    console.error('Server error:', error);
    sendJson(res, 500, { success: false, error: 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚗 ISUZU RUSH - Brand Endless Runner Game Server`);
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`🎮 Game URL:          http://localhost:${PORT}/`);
  console.log(`📱 QR Code Page:      http://localhost:${PORT}/qr`);
  console.log(`🛠 Admin Dashboard:   http://localhost:${PORT}/admin (Default PIN: isuzu2026)`);
  console.log(`====================================================`);
});
