/**
 * Profanity filter for Nicknames (Thai & English)
 * Filters offensive, vulgar, and inappropriate words while allowing normal Thai names.
 */

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

/**
 * Check if a text contains any bad words
 * @param {string} text
 * @returns {boolean} true if bad word is found
 */
function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.toLowerCase().replace(/[\s\-_0-9.]/g, '');

  for (const word of BAD_WORDS_TH) {
    if (normalized.includes(word)) return true;
  }

  for (const word of BAD_WORDS_EN) {
    // English words checked as substrings in normalized text or exact word bounds
    const regex = new RegExp(`(^|[^a-zA-Z])${word}([^a-zA-Z]|$)`, 'i');
    if (regex.test(text.toLowerCase()) || normalized.includes(word)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize nickname (strip bad characters, trim, limit length)
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeNickname(text, maxLength = 16) {
  if (!text) return '';
  return text
    .trim()
    .replace(/[<>"'`;\\/]/g, '')
    .slice(0, maxLength);
}

module.exports = {
  containsProfanity,
  sanitizeNickname
};
