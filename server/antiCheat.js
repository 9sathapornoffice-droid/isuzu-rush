/**
 * Anti-Cheat & Game Session Verification
 * Validates player score submissions against server-tracked time and physical limits.
 */

const crypto = require('crypto');
const db = require('./db');

// In-memory IP rate limiter: ip -> [timestamp1, timestamp2, ...]
const ipSubmissions = new Map();

// Configuration limits for reasonable gameplay
const LIMITS = {
  MIN_PLAY_TIME_SEC: 2,          // A game shorter than 2s cannot yield non-zero scores
  MAX_SCORE_PER_SECOND: 250,     // Max reasonable points/sec even with x5 combo & all tickets
  MAX_METERS_PER_SECOND: 25,     // Max theoretical distance speed
  SESSION_MAX_AGE_MS: 15 * 60 * 1000, // 15 minutes session validity
  IP_BURST_COOLDOWN_MS: 2000,    // Min 2 seconds between submissions from same IP
  IP_MAX_SUBMISSIONS_PER_HOUR: 120
};

/**
 * Generate a cryptographically secure random session token
 */
function createSession(playerId, clientIp) {
  const token = crypto.randomBytes(24).toString('hex');
  return db.createGameSession(token, playerId, clientIp);
}

/**
 * Clean up old IP rate limit entries
 */
function cleanupRateLimits() {
  const oneHourAgo = Date.now() - 3600000;
  for (const [ip, timestamps] of ipSubmissions.entries()) {
    const valid = timestamps.filter(t => t > oneHourAgo);
    if (valid.length === 0) {
      ipSubmissions.delete(ip);
    } else {
      ipSubmissions.set(ip, valid);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupRateLimits, 10 * 60 * 1000).unref();

/**
 * Check if IP is exceeding rate limits
 */
function checkIpRateLimit(ip) {
  const now = Date.now();
  const times = ipSubmissions.get(ip) || [];

  if (times.length > 0) {
    const lastTime = times[times.length - 1];
    if (now - lastTime < LIMITS.IP_BURST_COOLDOWN_MS) {
      return { allowed: false, reason: 'Rate limit: Submitting too fast. Please wait.' };
    }
  }

  const oneHourAgo = now - 3600000;
  const recent = times.filter(t => t > oneHourAgo);
  if (recent.length >= LIMITS.IP_MAX_SUBMISSIONS_PER_HOUR) {
    return { allowed: false, reason: 'Hourly submission limit reached for this IP.' };
  }

  recent.push(now);
  ipSubmissions.set(ip, recent);
  return { allowed: true };
}

/**
 * Validate a game submission
 * @param {Object} params
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateGameSubmission({ sessionToken, playerId, score, distance, playTimeSec, clientIp }) {
  // 1. Check IP rate limit
  const ipCheck = checkIpRateLimit(clientIp);
  if (!ipCheck.allowed) {
    return { valid: false, reason: ipCheck.reason };
  }

  // 2. Validate session token existence and freshness
  if (!sessionToken || typeof sessionToken !== 'string') {
    return { valid: false, reason: 'Invalid or missing session token.' };
  }

  const session = db.getGameSession(sessionToken);
  if (!session) {
    return { valid: false, reason: 'Session token not found. Start a game first.' };
  }

  if (session.is_used) {
    return { valid: false, reason: 'Session token has already been submitted.' };
  }

  if (session.player_id !== playerId) {
    return { valid: false, reason: 'Session does not belong to this player.' };
  }

  const now = Date.now();
  const serverElapsedSec = Math.floor((now - session.start_time) / 1000);

  // Check session expiration (15 minutes)
  if (now - session.start_time > LIMITS.SESSION_MAX_AGE_MS) {
    return { valid: false, reason: 'Game session expired.' };
  }

  // 3. Score & Time Sanity Checks
  const reportedTime = Math.max(1, playTimeSec || serverElapsedSec);

  // Minimum time check
  if (score > 50 && serverElapsedSec < LIMITS.MIN_PLAY_TIME_SEC) {
    db.logAudit('CHEAT_DETECTED', `Player ${playerId} submitted score ${score} in ${serverElapsedSec}s`, clientIp);
    return { valid: false, reason: 'Unrealistic play time for score.' };
  }

  // Score per second check
  const scorePerSec = score / reportedTime;
  if (scorePerSec > LIMITS.MAX_SCORE_PER_SECOND) {
    db.logAudit('CHEAT_DETECTED', `Player ${playerId} score/sec: ${scorePerSec.toFixed(1)} exceeded limit`, clientIp);
    return { valid: false, reason: 'Score exceeds maximum allowed rate per second.' };
  }

  // Distance vs Time sanity check
  const metersPerSec = distance / reportedTime;
  if (metersPerSec > LIMITS.MAX_METERS_PER_SECOND) {
    db.logAudit('CHEAT_DETECTED', `Player ${playerId} speed: ${metersPerSec.toFixed(1)} m/s exceeded limit`, clientIp);
    return { valid: false, reason: 'Distance exceeds realistic truck speed.' };
  }

  // Mark session as used immediately so it cannot be re-used
  db.markGameSessionUsed(sessionToken);

  return { valid: true };
}

module.exports = {
  createSession,
  validateGameSubmission,
  LIMITS
};
