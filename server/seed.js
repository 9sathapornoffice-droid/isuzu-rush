/**
 * Seed data script for ISUZU RUSH
 * Populates realistic players, scores, and activity across Today, This Week, and All Time.
 */

const db = require('./db');
const crypto = require('crypto');

const THAI_NICKNAMES = [
  'สิงห์รถบรรทุก', 'สายซิ่งเมืองทอง', 'กระบะพันธุ์แกร่ง', 'น้องน้ำหนึ่ง', 'พี่ต้อม_DMax',
  'บิ๊กบอส_Turbo', 'หนุ่มสุพรรณ', 'สาวแว่นลุยเดี่ยว', 'นักซิ่งสายบุญ', 'แรงสุดในซอย',
  'เด็กอู่_2026', 'เสือดำ_V-Cross', 'เก่งลายพราง', 'โก๋หลังวัง', 'ต้นกล้า_Speed',
  'ช่างตั้ม_โมดิฟาย', 'น้องพลอย_สายชิล', 'จ่าแดง_ปืนไว', 'สปีดโบ๊ท_ริมน้ำ', 'ดิว_บางนา',
  'ป๊อป_พระราม2', 'เบลล่า_ทัวร์', 'หมูหวาน_ซิ่ง', 'เอก_สุราษฎร์', 'ชัย_เชียงใหม่',
  'มุก_ขอนแก่น', 'โอ๊ต_โคราช', 'ก้อง_หาดใหญ่', 'นิว_ชลบุรี', 'เต้_ระยอง',
  'อาร์ต_นครปฐม', 'บอล_แปดริ้ว', 'มิ้นท์_สายหวาน', 'แชมป์_ไรเดอร์', 'เบียร์_วิศวะ',
  'ตูน_นักวิ่ง', 'แบงค์_คลองเตย', 'เป้_ดินแดง', 'วิน_รัชดา', 'ฟลุ๊ค_สายไหม',
  'ปอนด์_มีนบุรี', 'ไอซ์_ดอนเมือง', 'แพรว_สาทร', 'ท็อป_ปิ่นเกล้า', 'เจมส์_พัทยา',
  'บอย_หัวหิน', 'เมย์_ภูเก็ต', 'อ้น_อยุธยา', 'กานต์_นนทบุรี', 'นุ้ย_รังสิต',
  'บาส_สามย่าน', 'เอ็ม_ลาดพร้าว', 'ปาล์ม_อโศก', 'นัท_สีลม', 'บิ๊ก_ทองหล่อ'
];

const SOURCES = ['booth_a', 'booth_b', 'ticket', 'line_oa', 'facebook', 'direct'];

function seedDatabase() {
  const d = db.getDb();

  // Check if we already have players seeded
  const count = d.prepare('SELECT COUNT(*) as c FROM players').get().c;
  if (count >= 30) {
    console.log(`ℹ Database already contains ${count} players. Skipping seed.`);
    return;
  }

  console.log('🌱 Seeding sample players and leaderboard scores...');

  const now = Date.now();
  const insertPlayer = d.prepare(`
    INSERT INTO players (player_uuid, nickname, phone, email, pdpa_consent, pdpa_consent_at, source, created_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `);

  const insertScore = d.prepare(`
    INSERT INTO scores (player_id, score, distance, coins, tickets, max_combo, play_time_sec, source, session_id, client_ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '127.0.0.1', ?)
  `);

  // Target score range from 3,850 down to 250 for realistic distribution
  let targetScore = 3850;

  for (let i = 0; i < THAI_NICKNAMES.length; i++) {
    const nickname = THAI_NICKNAMES[i];
    const uuid = 'seed_' + crypto.randomUUID();
    const phone = `08${Math.floor(10000000 + Math.random() * 89999999)}`;
    const email = `player${i + 1}@example.com`;
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];

    // Spread creation time across the last 10 days
    const daysAgo = Math.random() * 9;
    const createdAt = new Date(now - daysAgo * 24 * 3600 * 1000).toISOString();

    const res = insertPlayer.run(uuid, nickname, phone, email, createdAt, source, createdAt);
    const playerId = Number(res.lastInsertRowid);

    // Each player played 1 to 4 games
    const gamesCount = 1 + Math.floor(Math.random() * 3);
    for (let g = 0; g < gamesCount; g++) {
      // Score variation
      const score = Math.max(120, Math.floor(targetScore * (1 - Math.random() * 0.25)));
      const distance = Math.floor(score * (0.8 + Math.random() * 0.4));
      const coins = Math.floor(score * 0.05);
      const tickets = Math.floor(Math.random() * 8);
      const combo = Math.min(5, 1 + Math.floor(Math.random() * 5));
      const playTime = Math.min(90, Math.max(25, Math.floor(distance / 12)));
      const sessionId = 'seed_sess_' + crypto.randomUUID();

      // Recent games vs older games
      const scoreTime = new Date(now - Math.random() * Math.min(daysAgo, 6) * 24 * 3600 * 1000).toISOString();

      insertScore.run(playerId, score, distance, coins, tickets, combo, playTime, source, sessionId, scoreTime);
    }

    // Step down target score
    targetScore = Math.max(180, Math.floor(targetScore * 0.945));
  }

  console.log(`✓ Seeded ${THAI_NICKNAMES.length} players with multiple game sessions.`);
}

module.exports = {
  seedDatabase
};

if (require.main === module) {
  db.initDatabase();
  seedDatabase();
}
