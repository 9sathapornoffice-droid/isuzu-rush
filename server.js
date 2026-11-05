/**
 * ISUZU RUSH - Standalone Full-Stack Cloud Server
 * Single-file server with built-in SQLite database, Anti-Cheat, Leaderboard, and Admin APIs.
 * Deployable directly on Render, Railway, Fly.io, or locally.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'isuzu_rush.sqlite');
const JSON_DB_FILE = path.join(__dirname, 'isuzu_rush_db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'isuzu2026';

// -------------------------------------------------------------
// 1. PROFANITY FILTER
// -------------------------------------------------------------
const BAD_WORDS_TH = [
  'ควย', 'เหี้ย', 'เย็ด', 'สัส', 'ห่า', 'ดอกทอง', 'ระยำ', 'จัญไร', 'หน้าด้าน',
  'ชาติชั่ว', 'สันดาน', 'มึง', 'กู', 'อีดอก', 'ไอ้สัตว์', 'ไอ้เหี้ย', 'หัวดอ',
  'เงี่ยน', 'หี', 'แตด', 'หรรม', 'จูดู้', 'หงี่', 'ขี้หมา', 'ปอบ', 'เสือก',
  'แม่ง', 'ควาย', 'สถุล', 'พ่อมึง', 'แม่มึง', 'ตายห่า', 'บัดซบ'
];
const BAD_WORDS_EN = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'whore',
  'slut', 'nigger', 'nigga', 'fag', 'faggot', 'bastard', 'cock', 'piss',
  'twat', 'wanker', 'motherfucker', 'retard', 'hitler', 'nazi'
];

function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.toLowerCase().replace(/[\s\-_0-9.]/g, '');
  for (const word of BAD_WORDS_TH) {
    if (normalized.includes(word)) return true;
  }
  for (const word of BAD_WORDS_EN) {
    const regex = new RegExp(`(^|[^a-zA-Z])${word}([^a-zA-Z]|$)`, 'i');
    if (regex.test(text.toLowerCase()) || normalized.includes(word)) return true;
  }
  return false;
}

function sanitizeNickname(text, maxLength = 16) {
  if (!text) return '';
  return text.trim().replace(/[<>"'`;\\/]/g, '').slice(0, maxLength);
}

// -------------------------------------------------------------
// 2. DATABASE SYSTEM (Native node:sqlite or JSON file fallback)
// -------------------------------------------------------------
let dbMode = 'sqlite';
let sqliteDb = null;
let jsonDb = {
  players: [],
  scores: [],
  sessions: [],
  settings: {
    event_name: 'ISUZU RUSH - Trusted Buddy Mascot Edition',
    player_lives: '3',
    difficulty: 'normal',
    registration_phone_required: '0',
    registration_email_required: '0'
  }
};

function loadJsonDb() {
  try {
    if (fs.existsSync(JSON_DB_FILE)) {
      jsonDb = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf-8'));
    }
  } catch (e) {}
}

function saveJsonDb() {
  try {
    fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2), 'utf-8');
  } catch (e) {}
}

function initDb() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    sqliteDb = new DatabaseSync(DB_FILE);
    sqliteDb.exec(`PRAGMA journal_mode = WAL;`);
    sqliteDb.exec(`PRAGMA synchronous = NORMAL;`);
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_uuid TEXT UNIQUE NOT NULL,
        nickname TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        pdpa_consent INTEGER DEFAULT 1,
        pdpa_consent_at TEXT NOT NULL,
        source TEXT DEFAULT 'direct',
        is_banned INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        distance INTEGER NOT NULL,
        coins INTEGER DEFAULT 0,
        tickets INTEGER DEFAULT 0,
        max_combo INTEGER DEFAULT 1,
        play_time_sec INTEGER DEFAULT 0,
        source TEXT DEFAULT 'direct',
        session_id TEXT UNIQUE,
        client_ip TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS game_sessions (
        session_token TEXT PRIMARY KEY,
        player_id INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        client_ip TEXT,
        is_used INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    dbMode = 'sqlite';
    console.log('✓ SQLite database initialized successfully at:', DB_FILE);
  } catch (e) {
    dbMode = 'json';
    loadJsonDb();
    console.log('ℹ Running in JSON file database mode at:', JSON_DB_FILE);
  }
}

initDb();

// DB Methods
function getPlayerByUuid(uuid) {
  if (dbMode === 'sqlite') {
    return sqliteDb.prepare('SELECT * FROM players WHERE player_uuid = ?').get(uuid) || null;
  }
  return jsonDb.players.find(p => p.player_uuid === uuid) || null;
}

function getPlayerById(id) {
  if (dbMode === 'sqlite') {
    return sqliteDb.prepare('SELECT * FROM players WHERE id = ?').get(id) || null;
  }
  return jsonDb.players.find(p => p.id === id) || null;
}

function upsertPlayer({ playerUuid, nickname, phone, email, pdpaConsent, source }) {
  const now = new Date().toISOString();
  if (dbMode === 'sqlite') {
    const existing = playerUuid ? getPlayerByUuid(playerUuid) : null;
    if (existing) {
      sqliteDb.prepare(`
        UPDATE players SET nickname = ?, phone = ?, email = ?, source = ? WHERE id = ?
      `).run(nickname, phone || null, email || null, source || 'direct', existing.id);
      return getPlayerById(existing.id);
    } else {
      const newUuid = playerUuid || `p_${crypto.randomUUID()}`;
      const result = sqliteDb.prepare(`
        INSERT INTO players (player_uuid, nickname, phone, email, pdpa_consent, pdpa_consent_at, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newUuid, nickname, phone || null, email || null, pdpaConsent ? 1 : 0, now, source || 'direct', now);
      return getPlayerById(result.lastInsertRowid);
    }
  } else {
    let p = playerUuid ? jsonDb.players.find(x => x.player_uuid === playerUuid) : null;
    if (p) {
      p.nickname = nickname;
      p.phone = phone || null;
      p.email = email || null;
      p.source = source || 'direct';
    } else {
      p = {
        id: jsonDb.players.length + 1,
        player_uuid: playerUuid || `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        nickname,
        phone: phone || null,
        email: email || null,
        pdpa_consent: pdpaConsent ? 1 : 0,
        pdpa_consent_at: now,
        source: source || 'direct',
        is_banned: 0,
        created_at: now
      };
      jsonDb.players.push(p);
    }
    saveJsonDb();
    return p;
  }
}

function createGameSession(token, playerId, clientIp) {
  const now = Date.now();
  const createdStr = new Date(now).toISOString();
  if (dbMode === 'sqlite') {
    sqliteDb.prepare(`
      INSERT INTO game_sessions (session_token, player_id, start_time, client_ip, is_used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(token, playerId, now, clientIp, createdStr);
    return { session_token: token, player_id: playerId, start_time: now };
  } else {
    const s = { session_token: token, player_id: playerId, start_time: now, client_ip: clientIp, is_used: 0, created_at: createdStr };
    jsonDb.sessions.push(s);
    saveJsonDb();
    return s;
  }
}

function getGameSession(token) {
  if (dbMode === 'sqlite') {
    return sqliteDb.prepare('SELECT * FROM game_sessions WHERE session_token = ?').get(token) || null;
  }
  return jsonDb.sessions.find(s => s.session_token === token) || null;
}

function markGameSessionUsed(token) {
  if (dbMode === 'sqlite') {
    sqliteDb.prepare('UPDATE game_sessions SET is_used = 1 WHERE session_token = ?').run(token);
  } else {
    const s = jsonDb.sessions.find(x => x.session_token === token);
    if (s) { s.is_used = 1; saveJsonDb(); }
  }
}

function recordScore({ playerId, score, distance, coins, tickets, maxCombo, playTimeSec, source, sessionId, clientIp }) {
  const now = new Date().toISOString();
  if (dbMode === 'sqlite') {
    sqliteDb.prepare(`
      INSERT INTO scores (player_id, score, distance, coins, tickets, max_combo, play_time_sec, source, session_id, client_ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(playerId, score, distance, coins, tickets, maxCombo, playTimeSec, source, sessionId, clientIp, now);
  } else {
    jsonDb.scores.push({
      id: jsonDb.scores.length + 1,
      player_id: playerId,
      score,
      distance,
      coins,
      tickets,
      max_combo: maxCombo,
      play_time_sec: playTimeSec,
      source,
      session_id: sessionId,
      client_ip: clientIp,
      created_at: now
    });
    saveJsonDb();
  }
}

function getLeaderboard(period = 'all', limit = 50) {
  const now = new Date();
  let timeFilter = null;
  if (period === 'today') {
    timeFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === 'week') {
    timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  if (dbMode === 'sqlite') {
    let query = `
      SELECT 
        p.id AS player_id,
        p.player_uuid,
        p.nickname,
        MAX(s.score) AS high_score,
        MAX(s.distance) AS best_distance,
        MAX(s.created_at) AS last_played,
        COUNT(s.id) AS total_plays
      FROM scores s
      JOIN players p ON s.player_id = p.id
      WHERE p.is_banned = 0
    `;
    const params = [];
    if (timeFilter) {
      query += ` AND s.created_at >= ?`;
      params.push(timeFilter);
    }
    query += `
      GROUP BY p.id
      ORDER BY high_score DESC, best_distance DESC
      LIMIT ?
    `;
    params.push(limit);

    const rows = sqliteDb.prepare(query).all(...params);
    return rows.map((r, idx) => ({
      rank: idx + 1,
      playerId: r.player_id,
      playerUuid: r.player_uuid,
      nickname: r.nickname,
      score: r.high_score,
      distance: r.best_distance,
      playedAt: r.last_played,
      totalPlays: r.total_plays
    }));
  } else {
    // JSON mode
    const playerMap = new Map();
    for (const s of jsonDb.scores) {
      if (timeFilter && s.created_at < timeFilter) continue;
      const p = jsonDb.players.find(x => x.id === s.player_id);
      if (!p || p.is_banned) continue;
      if (!playerMap.has(p.id) || s.score > playerMap.get(p.id).score) {
        playerMap.set(p.id, {
          playerId: p.id,
          playerUuid: p.player_uuid,
          nickname: p.nickname,
          score: s.score,
          distance: s.distance,
          playedAt: s.created_at,
          totalPlays: (playerMap.get(p.id)?.totalPlays || 0) + 1
        });
      }
    }
    const list = Array.from(playerMap.values());
    list.sort((a, b) => b.score - a.score || b.distance - a.distance);
    return list.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }
}

function getPlayerRank(playerId, period = 'all') {
  const lb = getLeaderboard(period, 1000);
  const found = lb.find(x => x.playerId === playerId);
  return found ? { rank: found.rank, score: found.score, distance: found.distance } : null;
}

// -------------------------------------------------------------
// 2.1 ADMIN DATABASE METHODS
// -------------------------------------------------------------
function checkAdminAuth(req, parsedUrl) {
  const token = req.headers['x-admin-token'] || parsedUrl.query?.adminToken || parsedUrl.query?.pin || '';
  if (!token) return false;
  if (adminSessions.has(token)) return true;
  if (token === ADMIN_PASSWORD) return true;
  return false;
}

function getAdminStats() {
  if (dbMode === 'sqlite') {
    const totalPlayers = sqliteDb.prepare('SELECT COUNT(*) AS c FROM players').get().c;
    const totalPlays = sqliteDb.prepare('SELECT COUNT(*) AS c FROM scores').get().c;
    const avgPlayTime = sqliteDb.prepare('SELECT AVG(play_time_sec) AS avg FROM scores WHERE play_time_sec > 0').get().avg || 0;
    const highScoreAll = sqliteDb.prepare('SELECT MAX(score) AS m FROM scores').get().m || 0;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const playsToday = sqliteDb.prepare(`SELECT COUNT(*) AS c FROM scores WHERE created_at >= ?`).get(startOfDay.toISOString()).c;

    const sourceStats = sqliteDb.prepare(`
      SELECT COALESCE(source, 'direct') as source, COUNT(*) as count 
      FROM scores 
      GROUP BY source 
      ORDER BY count DESC
    `).all();

    const hourly = sqliteDb.prepare(`
      SELECT strftime('%Y-%m-%d %H:00', created_at) as hour, COUNT(*) as count
      FROM scores
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY hour
      ORDER BY hour ASC
    `).all();

    return {
      totalPlayers,
      totalPlays,
      playsToday,
      avgPlayTimeSeconds: Math.round(avgPlayTime),
      highScoreAll,
      sourceStats,
      hourly
    };
  } else {
    const totalPlayers = jsonDb.players.length;
    const totalPlays = jsonDb.scores.length;
    const highScoreAll = jsonDb.scores.reduce((max, s) => Math.max(max, s.score || 0), 0);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();
    const playsToday = jsonDb.scores.filter(s => s.created_at >= startIso).length;
    return {
      totalPlayers,
      totalPlays,
      playsToday,
      avgPlayTimeSeconds: 45,
      highScoreAll,
      sourceStats: [{ source: 'direct', count: totalPlays }],
      hourly: []
    };
  }
}

function getAdminPlayers({ search = '', page = 1, pageSize = 50 } = {}) {
  const offset = (page - 1) * pageSize;
  if (dbMode === 'sqlite') {
    let filter = '';
    let params = [];
    if (search) {
      filter = `WHERE (p.nickname LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)`;
      const term = `%${search}%`;
      params = [term, term, term];
    }

    const countQuery = `SELECT COUNT(*) as c FROM players p ${filter}`;
    const total = sqliteDb.prepare(countQuery).get(...params).c;

    const dataQuery = `
      SELECT 
        p.id,
        p.player_uuid,
        p.nickname,
        p.phone,
        p.email,
        p.source,
        p.is_banned,
        p.created_at,
        COALESCE(MAX(s.score), 0) as high_score,
        COALESCE(MAX(s.distance), 0) as best_distance,
        COUNT(s.id) as games_played,
        MAX(s.created_at) as last_played
      FROM players p
      LEFT JOIN scores s ON p.id = s.player_id
      ${filter}
      GROUP BY p.id
      ORDER BY high_score DESC, best_distance DESC, p.id ASC
      LIMIT ? OFFSET ?
    `;

    const rows = sqliteDb.prepare(dataQuery).all(...params, pageSize, offset);
    const rankedRows = rows.map((r, idx) => ({
      ...r,
      rank: offset + idx + 1
    }));

    return {
      players: rankedRows,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  } else {
    let list = jsonDb.players.map(p => {
      const pScores = jsonDb.scores.filter(s => s.player_id === p.id);
      const highScore = pScores.reduce((max, s) => Math.max(max, s.score || 0), 0);
      const bestDistance = pScores.reduce((max, s) => Math.max(max, s.distance || 0), 0);
      return {
        id: p.id,
        player_uuid: p.player_uuid,
        nickname: p.nickname,
        phone: p.phone,
        email: p.email,
        source: p.source,
        is_banned: p.is_banned || 0,
        created_at: p.created_at,
        high_score: highScore,
        best_distance: bestDistance,
        games_played: pScores.length,
        last_played: pScores[pScores.length - 1]?.created_at || p.created_at
      };
    });

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => 
        (p.nickname && p.nickname.toLowerCase().includes(s)) ||
        (p.phone && p.phone.includes(s)) ||
        (p.email && p.email.toLowerCase().includes(s))
      );
    }

    list.sort((a, b) => b.high_score - a.high_score || b.best_distance - a.best_distance);
    const total = list.length;
    const paginated = list.slice(offset, offset + pageSize).map((item, idx) => ({
      ...item,
      rank: offset + idx + 1
    }));

    return {
      players: paginated,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  }
}

function togglePlayerBan(playerId, isBanned) {
  if (dbMode === 'sqlite') {
    sqliteDb.prepare('UPDATE players SET is_banned = ? WHERE id = ?').run(isBanned ? 1 : 0, playerId);
  } else {
    const p = jsonDb.players.find(x => x.id === playerId);
    if (p) p.is_banned = isBanned ? 1 : 0;
    saveJsonDb();
  }
}

function deleteScore(scoreId) {
  if (dbMode === 'sqlite') {
    sqliteDb.prepare('DELETE FROM scores WHERE id = ?').run(scoreId);
  } else {
    jsonDb.scores = jsonDb.scores.filter(s => s.id !== scoreId);
    saveJsonDb();
  }
}

function resetLeaderboard() {
  if (dbMode === 'sqlite') {
    sqliteDb.exec('DELETE FROM scores;');
    sqliteDb.exec('DELETE FROM game_sessions;');
  } else {
    jsonDb.scores = [];
    jsonDb.sessions = [];
    saveJsonDb();
  }
}

function getAllPlayersForExport(topN = null) {
  let limitClause = '';
  if (topN && parseInt(topN, 10) > 0) {
    limitClause = `LIMIT ${parseInt(topN, 10)}`;
  }

  if (dbMode === 'sqlite') {
    const query = `
      SELECT 
        p.id,
        p.nickname,
        p.phone,
        p.email,
        p.source,
        p.is_banned,
        p.created_at AS registered_at,
        COALESCE(MAX(s.score), 0) AS high_score,
        COALESCE(MAX(s.distance), 0) AS best_distance,
        COUNT(s.id) AS total_games
      FROM players p
      LEFT JOIN scores s ON p.id = s.player_id
      GROUP BY p.id
      ORDER BY high_score DESC, best_distance DESC
      ${limitClause}
    `;
    return sqliteDb.prepare(query).all();
  } else {
    const res = getAdminPlayers({ search: '', page: 1, pageSize: topN ? parseInt(topN, 10) : 10000 });
    return res.players;
  }
}

function getAllSettings() {
  if (dbMode === 'sqlite') {
    try {
      const rows = sqliteDb.prepare('SELECT key, value FROM settings').all();
      const res = {};
      for (const r of rows) res[r.key] = r.value;
      return res;
    } catch (e) { return {}; }
  }
  return jsonDb.settings || {};
}

function updateSetting(key, value) {
  if (dbMode === 'sqlite') {
    sqliteDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  } else {
    jsonDb.settings[key] = String(value);
    saveJsonDb();
  }
}

// -------------------------------------------------------------
// 3. ANTI-CHEAT
// -------------------------------------------------------------
const activeSessions = new Map();
function createSessionToken(playerId, clientIp) {
  const token = crypto.randomBytes(24).toString('hex');
  return createGameSession(token, playerId, clientIp);
}

function validateSubmission({ sessionToken, playerId, score, distance, playTimeSec, clientIp }) {
  if (typeof score !== 'number' || score < 0) return { valid: false, reason: 'Invalid score value' };
  if (typeof distance !== 'number' || distance < 0) return { valid: false, reason: 'Invalid distance value' };

  if (sessionToken && !sessionToken.startsWith('local_') && !sessionToken.startsWith('offline_')) {
    const session = getGameSession(sessionToken);
    if (!session) return { valid: false, reason: 'Invalid session token' };
    if (session.is_used) return { valid: false, reason: 'Session token already used' };
    markGameSessionUsed(sessionToken);
  }
  return { valid: true };
}

// -------------------------------------------------------------
// 4. HTTP REQUEST HANDLER & ROUTER
// -------------------------------------------------------------
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { req.destroy(); reject(new Error('Payload too large')); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

const adminSessions = new Set();

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

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
    // 1. GET /api/health - Health check
    if (pathname === '/api/health') {
      return sendJson(res, 200, { status: 'ok', server: 'ISUZU RUSH Cloud API', time: new Date().toISOString() });
    }

    // 2. GET /api/leaderboard - Realtime Top Leaderboard
    if (pathname === '/api/leaderboard' && method === 'GET') {
      const period = parsedUrl.query.period || 'all';
      const playerUuid = parsedUrl.query.playerUuid || '';
      const limit = Math.min(parseInt(parsedUrl.query.limit, 10) || 50, 100);

      const leaderboard = getLeaderboard(period, limit);
      let playerRank = null;
      if (playerUuid) {
        const player = getPlayerByUuid(playerUuid);
        if (player) {
          playerRank = getPlayerRank(player.id, period);
        }
      }

      return sendJson(res, 200, {
        success: true,
        period,
        updatedAt: new Date().toISOString(),
        leaderboard,
        playerRank
      });
    }

    // 3. POST /api/player/register - Player registration
    if (pathname === '/api/player/register' && method === 'POST') {
      const body = await parseBody(req);
      const nickname = sanitizeNickname(body.nickname);
      if (!nickname || nickname.length < 2) {
        return sendJson(res, 400, { success: false, error: 'กรุณากรอกชื่อเล่น 2-16 ตัวอักษร' });
      }
      if (containsProfanity(nickname)) {
        return sendJson(res, 400, { success: false, error: 'ชื่อเล่นมีคำไม่สุภาพ กรุณาเปลี่ยนชื่อใหม่' });
      }

      const player = upsertPlayer({
        playerUuid: body.playerUuid,
        nickname,
        phone: body.phone,
        email: body.email,
        pdpaConsent: body.pdpaConsent,
        source: body.source
      });

      return sendJson(res, 200, { success: true, player });
    }

    // 4. POST /api/game/start - Start game session
    if (pathname === '/api/game/start' && method === 'POST') {
      const body = await parseBody(req);
      let player = body.playerUuid ? getPlayerByUuid(body.playerUuid) : null;
      if (!player && body.playerUuid) {
        player = upsertPlayer({
          playerUuid: body.playerUuid,
          nickname: body.nickname || 'ผู้เล่น',
          phone: body.phone || '',
          email: body.email || '',
          source: body.source || 'direct',
          pdpaConsent: 1
        });
      }
      const playerId = player ? player.id : 0;
      const session = createSessionToken(playerId, clientIp);

      return sendJson(res, 200, {
        success: true,
        sessionToken: session.session_token,
        config: { playerLives: 3, baseSpeed: 210, maxSpeed: 620 }
      });
    }

    // 5. POST /api/game/submit - Submit score
    if (pathname === '/api/game/submit' && method === 'POST') {
      const body = await parseBody(req);
      let player = body.playerUuid ? getPlayerByUuid(body.playerUuid) : null;
      if (!player && body.playerUuid) {
        player = upsertPlayer({
          playerUuid: body.playerUuid,
          nickname: body.nickname || 'ผู้เล่น',
          phone: body.phone || '',
          email: body.email || '',
          source: body.source || 'direct',
          pdpaConsent: 1
        });
      }
      if (!player) {
        return sendJson(res, 400, { success: false, error: 'Player not found' });
      }

      const val = validateSubmission({
        sessionToken: body.sessionToken,
        playerId: player.id,
        score: parseInt(body.score, 10) || 0,
        distance: parseInt(body.distance, 10) || 0,
        playTimeSec: parseInt(body.playTimeSec, 10) || 0,
        clientIp
      });

      if (!val.valid) {
        return sendJson(res, 400, { success: false, error: val.reason });
      }

      const scoreNum = parseInt(body.score, 10) || 0;
      const distNum = parseInt(body.distance, 10) || 0;
      const coinsNum = parseInt(body.coins, 10) || 0;
      const ticketsNum = parseInt(body.tickets, 10) || 0;
      const maxComboNum = parseInt(body.maxCombo, 10) || 1;
      const playTimeNum = parseInt(body.playTimeSec, 10) || 0;

      recordScore({
        playerId: player.id,
        score: scoreNum,
        distance: distNum,
        coins: coinsNum,
        tickets: ticketsNum,
        maxCombo: maxComboNum,
        playTimeSec: playTimeNum,
        source: body.source || player.source,
        sessionId: body.sessionToken,
        clientIp
      });

      const personalRank = getPlayerRank(player.id, 'all');

      return sendJson(res, 200, {
        success: true,
        personalBest: personalRank ? personalRank.score : scoreNum,
        currentRank: personalRank ? personalRank.rank : 1
      });
    }

    // 5.1 POST /api/game/sync-score - Sync existing offline / local best score
    if (pathname === '/api/game/sync-score' && method === 'POST') {
      const body = await parseBody(req);
      let player = body.playerUuid ? getPlayerByUuid(body.playerUuid) : null;
      if (!player && body.playerUuid) {
        player = upsertPlayer({
          playerUuid: body.playerUuid,
          nickname: body.nickname || 'ผู้เล่น',
          phone: body.phone || '',
          email: body.email || '',
          source: body.source || 'direct',
          pdpaConsent: 1
        });
      }
      if (!player) return sendJson(res, 400, { success: false, error: 'Player required' });

      const scoreNum = parseInt(body.score, 10) || 0;
      const distNum = parseInt(body.distance, 10) || 0;
      if (scoreNum > 0) {
        const currentRank = getPlayerRank(player.id, 'all');
        if (!currentRank || scoreNum > currentRank.score) {
          recordScore({
            playerId: player.id,
            score: scoreNum,
            distance: distNum,
            coins: 0,
            tickets: 0,
            maxCombo: 1,
            playTimeSec: 0,
            source: body.source || player.source,
            sessionId: `sync_${player.id}_${Date.now()}`,
            clientIp
          });
        }
      }
      return sendJson(res, 200, { success: true });
    }

    // 6. Settings & Config
    if (pathname === '/api/settings' && method === 'GET') {
      const settings = getAllSettings();
      delete settings.admin_pin;
      return sendJson(res, 200, { success: true, settings });
    }

    // 7. Admin Login & Auth Check
    if (pathname === '/api/admin/login' && method === 'POST') {
      const body = await parseBody(req);
      if (body.pin === ADMIN_PASSWORD) {
        const token = crypto.randomBytes(32).toString('hex');
        adminSessions.add(token);
        return sendJson(res, 200, { success: true, token });
      }
      return sendJson(res, 401, { success: false, error: 'รหัสผ่านไม่ถูกต้อง (Default: isuzu2026)' });
    }

    // 8. Admin Stats
    if (pathname === '/api/admin/stats' && method === 'GET') {
      if (!checkAdminAuth(req, parsedUrl)) return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      const stats = getAdminStats();
      return sendJson(res, 200, { success: true, stats });
    }

    // 9. Admin Players & Leaderboard inspection
    if (pathname === '/api/admin/players' && method === 'GET') {
      if (!checkAdminAuth(req, parsedUrl)) return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      const search = parsedUrl.query.search || '';
      const page = parseInt(parsedUrl.query.page, 10) || 1;
      const result = getAdminPlayers({ search, page, pageSize: 50 });
      return sendJson(res, 200, { success: true, ...result });
    }

    // 10. Admin Ban/Unban Player
    if (pathname === '/api/admin/player/ban' && method === 'POST') {
      if (!checkAdminAuth(req, parsedUrl)) return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      const body = await parseBody(req);
      togglePlayerBan(body.playerId, body.isBanned);
      return sendJson(res, 200, { success: true });
    }

    // 11. Admin Delete Score
    if (pathname.startsWith('/api/admin/score/') && method === 'DELETE') {
      if (!checkAdminAuth(req, parsedUrl)) return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      const scoreId = parseInt(pathname.split('/').pop(), 10);
      deleteScore(scoreId);
      return sendJson(res, 200, { success: true });
    }

    // 12. Admin Reset Leaderboard
    if (pathname === '/api/admin/reset-leaderboard' && method === 'POST') {
      if (!checkAdminAuth(req, parsedUrl)) return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      resetLeaderboard();
      return sendJson(res, 200, { success: true, message: 'Leaderboard reset complete' });
    }

    // 13. Admin Update Settings
    if (pathname === '/api/admin/settings' && method === 'POST') {
      if (!checkAdminAuth(req, parsedUrl)) return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      const body = await parseBody(req);
      for (const [k, v] of Object.entries(body.settings || {})) {
        updateSetting(k, v);
      }
      return sendJson(res, 200, { success: true });
    }

    // 14. Admin Export CSV
    if (pathname === '/api/admin/export-csv' && method === 'GET') {
      if (!checkAdminAuth(req, parsedUrl)) return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      const topN = parsedUrl.query.topN || null;
      const rows = getAllPlayersForExport(topN);

      let csv = '\uFEFF'; // UTF-8 BOM for Thai Excel
      csv += 'อันดับ,ID,ชื่อเล่น,เบอร์โทรศัพท์,อีเมล,คะแนนสูงสุด,ระยะทาง (ม.),เล่นสะสม,ช่องทาง,สถานะแบน,วันที่ลงทะเบียน\n';
      rows.forEach((r, idx) => {
        csv += `"${idx + 1}","${r.id}","${(r.nickname || '').replace(/"/g, '""')}","${r.phone || ''}","${r.email || ''}","${r.high_score}","${r.best_distance}","${r.total_games || r.games_played || 0}","${r.source || 'direct'}","${r.is_banned ? 'BANNED' : 'ACTIVE'}","${r.registered_at || r.created_at || ''}"\n`;
      });

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="isuzu_rush_leaderboard_${Date.now()}.csv"`,
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(csv);
    }

    // Friendly URL routing
    let routePath = pathname;
    if (routePath === '/' || routePath === '') routePath = 'index.html';
    else if (routePath === '/admin' || routePath === '/admin/') routePath = 'admin.html';
    else if (routePath === '/qr' || routePath === '/qr/') routePath = 'qr.html';
    else if (routePath.startsWith('/')) routePath = routePath.slice(1);

    const filePath = path.join(__dirname, routePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.csv': 'text/csv; charset=utf-8'
      };
      res.writeHead(200, {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    // If file doesn't exist, serve index.html for SPA
    const indexHtml = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return fs.createReadStream(indexHtml).pipe(res);
    }

    return sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('Server error:', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`🚗 ISUZU RUSH Server running on port ${PORT}`);
});
