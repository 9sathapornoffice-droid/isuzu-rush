/**
 * Database manager for ISUZU RUSH
 * Uses Node.js native SQLite (node:sqlite DatabaseSync) with automatic table creation & migrations.
 */

const path = require('path');
const fs = require('fs');

let db = null;
const DB_FILE = path.join(__dirname, 'isuzu_rush.sqlite');

function initDatabase() {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_FILE);

  // Enable WAL mode for high concurrency
  db.exec(`PRAGMA journal_mode = WAL;`);
  db.exec(`PRAGMA synchronous = NORMAL;`);

  // Create tables
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT,
      ip TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_id);
    CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
    CREATE INDEX IF NOT EXISTS idx_scores_created ON scores(created_at);
    CREATE INDEX IF NOT EXISTS idx_players_uuid ON players(player_uuid);
  `);

  // Default game configuration in settings
  const defaults = {
    'event_title': 'ISUZU RUSH 2026',
    'event_active': 'true',
    'admin_pin': 'isuzu2026',
    'difficulty': 'normal',
    'require_phone': 'false',
    'player_lives': '3',
    'base_speed': '6',
    'max_speed': '15',
    'announcement': 'ยินดีต้อนรับสู่ ISUZU RUSH! ขับให้สุดทาง ชิงรางวัลใหญ่ประจำสัปดาห์'
  };

  const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

  for (const [k, v] of Object.entries(defaults)) {
    insertStmt.run(k, v);
  }

  console.log('✓ SQLite database initialized successfully at:', DB_FILE);
  return db;
}

function getDb() {
  if (!db) {
    initDatabase();
  }
  return db;
}

// ----------------- PLAYER METHODS -----------------

function upsertPlayer({ playerUuid, nickname, phone = '', email = '', source = 'direct', pdpaConsent = 1 }) {
  const d = getDb();
  const now = new Date().toISOString();

  const findStmt = d.prepare('SELECT * FROM players WHERE player_uuid = ?');
  const existing = findStmt.get(playerUuid);

  if (existing) {
    const updateStmt = d.prepare(`
      UPDATE players 
      SET nickname = ?, phone = COALESCE(NULLIF(?, ''), phone), email = COALESCE(NULLIF(?, ''), email), source = COALESCE(NULLIF(?, ''), source)
      WHERE player_uuid = ?
    `);
    updateStmt.run(nickname, phone, email, source, playerUuid);
    return findStmt.get(playerUuid);
  } else {
    const insertStmt = d.prepare(`
      INSERT INTO players (player_uuid, nickname, phone, email, pdpa_consent, pdpa_consent_at, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(playerUuid, nickname, phone, email, pdpaConsent ? 1 : 0, now, source, now);
    return findStmt.get(playerUuid);
  }
}

function getPlayerByUuid(playerUuid) {
  const d = getDb();
  const stmt = d.prepare('SELECT * FROM players WHERE player_uuid = ?');
  return stmt.get(playerUuid);
}

function getPlayerById(id) {
  const d = getDb();
  const stmt = d.prepare('SELECT * FROM players WHERE id = ?');
  return stmt.get(id);
}

// ----------------- LEADERBOARD METHODS -----------------

/**
 * Get Leaderboard: Highest score per player
 * Supports period: 'today', 'week', 'all'
 */
function getLeaderboard({ period = 'all', limit = 50 } = {}) {
  const d = getDb();
  let timeFilter = '';

  const now = new Date();
  if (period === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    timeFilter = `AND s.created_at >= '${startOfDay}'`;
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    timeFilter = `AND s.created_at >= '${weekAgo}'`;
  }

  // Max score per non-banned player
  const query = `
    SELECT 
      p.id AS player_id,
      p.player_uuid,
      p.nickname,
      p.source,
      MAX(s.score) AS max_score,
      MAX(s.distance) AS max_distance,
      MAX(s.created_at) AS latest_play_at,
      COUNT(s.id) AS total_plays
    FROM players p
    INNER JOIN scores s ON p.id = s.player_id
    WHERE p.is_banned = 0 ${timeFilter}
    GROUP BY p.id
    ORDER BY max_score DESC, max_distance DESC, latest_play_at ASC
    LIMIT ?
  `;

  const rows = d.prepare(query).all(limit);

  // Assign 1-based ranks
  return rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    playerUuid: row.player_uuid,
    nickname: row.nickname,
    score: row.max_score,
    distance: row.max_distance,
    playedAt: row.latest_play_at,
    totalPlays: row.total_plays
  }));
}

/**
 * Get a specific player's personal rank and high score in a given period
 */
function getPlayerRank(playerUuid, period = 'all') {
  const d = getDb();
  const player = getPlayerByUuid(playerUuid);
  if (!player || player.is_banned) return null;

  let timeFilter = '';
  const now = new Date();
  if (period === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    timeFilter = `AND s.created_at >= '${startOfDay}'`;
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    timeFilter = `AND s.created_at >= '${weekAgo}'`;
  }

  // Find player's max score
  const personalBest = d.prepare(`
    SELECT MAX(s.score) AS max_score, MAX(s.distance) AS max_distance
    FROM scores s
    WHERE s.player_id = ? ${timeFilter}
  `).get(player.id);

  if (!personalBest || personalBest.max_score === null) {
    return {
      rank: '-',
      score: 0,
      distance: 0,
      nickname: player.nickname
    };
  }

  // Count players with higher score
  const countHigher = d.prepare(`
    SELECT COUNT(DISTINCT s.player_id) AS higher_count
    FROM scores s
    JOIN players p ON p.id = s.player_id
    WHERE p.is_banned = 0 ${timeFilter}
      AND s.score > ?
  `).get(personalBest.max_score);

  const rank = (countHigher?.higher_count || 0) + 1;

  return {
    rank,
    score: personalBest.max_score,
    distance: personalBest.max_distance,
    nickname: player.nickname,
    playerUuid: player.player_uuid
  };
}

// ----------------- SCORE RECORDING -----------------

function recordScore({ playerId, score, distance, coins, tickets, maxCombo, playTimeSec, source, sessionId, clientIp }) {
  const d = getDb();
  const now = new Date().toISOString();

  const insert = d.prepare(`
    INSERT INTO scores (player_id, score, distance, coins, tickets, max_combo, play_time_sec, source, session_id, client_ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(playerId, score, distance, coins, tickets, maxCombo, playTimeSec, source || 'direct', sessionId, clientIp, now);

  return {
    success: true,
    savedScore: score,
    createdAt: now
  };
}

// ----------------- SESSION METHODS (Anti-cheat) -----------------

function createGameSession(sessionToken, playerId, clientIp) {
  const d = getDb();
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  const stmt = d.prepare(`
    INSERT INTO game_sessions (session_token, player_id, start_time, client_ip, is_used, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `);

  stmt.run(sessionToken, playerId, nowMs, clientIp, nowIso);
  return { sessionToken, startTime: nowMs };
}

function getGameSession(sessionToken) {
  const d = getDb();
  const stmt = d.prepare('SELECT * FROM game_sessions WHERE session_token = ?');
  return stmt.get(sessionToken);
}

function markGameSessionUsed(sessionToken) {
  const d = getDb();
  const stmt = d.prepare('UPDATE game_sessions SET is_used = 1 WHERE session_token = ?');
  stmt.run(sessionToken);
}

// ----------------- SETTINGS METHODS -----------------

function getAllSettings() {
  const d = getDb();
  const rows = d.prepare('SELECT key, value FROM settings').all();
  const res = {};
  for (const r of rows) {
    res[r.key] = r.value;
  }
  return res;
}

function updateSetting(key, value) {
  const d = getDb();
  const stmt = d.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run(key, String(value));
}

// ----------------- ADMIN & STATS METHODS -----------------

function getAdminStats() {
  const d = getDb();

  const totalPlayers = d.prepare('SELECT COUNT(*) AS c FROM players').get().c;
  const totalPlays = d.prepare('SELECT COUNT(*) AS c FROM scores').get().c;
  const avgPlayTime = d.prepare('SELECT AVG(play_time_sec) AS avg FROM scores WHERE play_time_sec > 0').get().avg || 0;
  const highScoreAll = d.prepare('SELECT MAX(score) AS m FROM scores').get().m || 0;

  // Plays today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const playsToday = d.prepare(`SELECT COUNT(*) AS c FROM scores WHERE created_at >= ?`).get(startOfDay.toISOString()).c;

  // Source breakdown
  const sourceStats = d.prepare(`
    SELECT source, COUNT(*) as count 
    FROM scores 
    GROUP BY source 
    ORDER BY count DESC
  `).all();

  // Hourly plays for the last 24 hours
  const hourly = d.prepare(`
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
}

function getAdminPlayers({ search = '', page = 1, pageSize = 50 } = {}) {
  const d = getDb();
  const offset = (page - 1) * pageSize;

  let filter = '';
  let params = [];
  if (search) {
    filter = `WHERE p.nickname LIKE ? OR p.phone LIKE ? OR p.email LIKE ?`;
    const term = `%${search}%`;
    params = [term, term, term];
  }

  const countQuery = `SELECT COUNT(*) as c FROM players p ${filter}`;
  const total = d.prepare(countQuery).get(...params).c;

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
      MAX(s.score) as high_score,
      MAX(s.distance) as best_distance,
      COUNT(s.id) as games_played
    FROM players p
    LEFT JOIN scores s ON p.id = s.player_id
    ${filter}
    GROUP BY p.id
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `;

  const rows = d.prepare(dataQuery).all(...params, pageSize, offset);

  return {
    players: rows,
    total,
    page,
    totalPages: Math.ceil(total / pageSize)
  };
}

function togglePlayerBan(playerId, isBanned) {
  const d = getDb();
  const stmt = d.prepare('UPDATE players SET is_banned = ? WHERE id = ?');
  stmt.run(isBanned ? 1 : 0, playerId);
}

function deleteScore(scoreId) {
  const d = getDb();
  const stmt = d.prepare('DELETE FROM scores WHERE id = ?');
  stmt.run(scoreId);
}

function resetLeaderboard() {
  const d = getDb();
  d.exec('DELETE FROM scores;');
  d.exec('DELETE FROM game_sessions;');
  logAudit('RESET_LEADERBOARD', 'All scores and active sessions were wiped by admin', 'system');
}

function logAudit(action, details, ip = '') {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare('INSERT INTO audit_logs (action, details, ip, created_at) VALUES (?, ?, ?, ?)').run(action, details, ip, now);
}

function getAllPlayersForExport(topN = null) {
  const d = getDb();
  let limitClause = '';
  if (topN && parseInt(topN, 10) > 0) {
    limitClause = `LIMIT ${parseInt(topN, 10)}`;
  }

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

  return d.prepare(query).all();
}

module.exports = {
  initDatabase,
  getDb,
  upsertPlayer,
  getPlayerByUuid,
  getPlayerById,
  getLeaderboard,
  getPlayerRank,
  recordScore,
  createGameSession,
  getGameSession,
  markGameSessionUsed,
  getAllSettings,
  updateSetting,
  getAdminStats,
  getAdminPlayers,
  togglePlayerBan,
  deleteScore,
  resetLeaderboard,
  logAudit,
  getAllPlayersForExport
};
