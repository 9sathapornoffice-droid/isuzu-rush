/**
 * i18n Localization Dictionary for ISUZU RUSH (Rabbit Mascot Edition)
 * Supports Thai (TH - default) and English (EN)
 */

const I18N = {
  th: {
    // Brand & General
    gameTitle: 'ISUZU RUSH',
    mascotName: 'ISUZU Trusted Buddy (TSH)',
    tagline: 'เพื่อนแท้ที่คุณวางใจได้ทุกเส้นทาง',
    loading: 'กำลังโหลด...',
    error: 'เกิดข้อผิดพลาด',
    close: 'ปิด',
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    back: 'ย้อนกลับ',
    next: 'ถัดไป',
    skip: 'ข้าม',

    // Splash Screen
    btnStart: 'เริ่มวิ่งเลย!',
    btnLeaderboard: 'ตารางอันดับ',
    btnHowToPlay: 'วิธีเล่น',
    soundOn: 'เปิดเสียง',
    soundOff: 'ปิดเสียง',

    // Registration Screen
    regTitle: 'ลงทะเบียนร่วมสนุก',
    regSubtitle: 'กรอกข้อมูลเพื่อบันทึกสถิติและลุ้นรับของรางวัลพิเศษกับ ISUZU Trusted Buddy',
    labelNickname: 'ชื่อเล่นในเกม *',
    placeholderNickname: 'เช่น กระต่ายสายซิ่ง (2-16 ตัวอักษร)',
    labelPhone: 'เบอร์โทรศัพท์ (สำหรับรับรางวัล)',
    placeholderPhone: '08X-XXX-XXXX',
    labelEmail: 'อีเมล (ถ้ามี)',
    placeholderEmail: 'name@example.com',
    pdpaConsent: 'ฉันยอมรับข้อตกลงและยินยอมให้เก็บรวบรวมข้อมูลส่วนบุคคลตาม',
    privacyPolicyLink: 'นโยบายความเป็นส่วนตัว (PDPA)',
    btnSubmitRegister: 'พร้อมแล้ว ลุยเลย!',
    errNicknameRequired: 'กรุณากรอกชื่อเล่น 2-16 ตัวอักษร',
    errPdpaRequired: 'กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนเล่น',

    // Tutorial Screen (3 slides)
    tutorialTitle: 'วิธีเล่น ISUZU RUSH',
    slide1Title: '1. แตะเพื่อกระโดด & ดับเบิ้ลจัมป์',
    slide1Desc: 'แตะหน้าจอ หรือกด Spacebar เพื่อกระโดด แตะค้างเพื่อกระโดดสูง หรือแตะซ้ำกลางอากาศเพื่อกระโดด 2 จังหวะ (Double Jump)!',
    slide2Title: '2. เก็บแครอทและไอเท็มพิเศษ',
    slide2Desc: 'แครอท (+10) • ตั๋ว VIP (+50) • กุญแจ TSH (+100 & ตัวคูณ 2 เท่า 5 วินาที) • ที่ชาร์จ (ฟื้นพลังชีวิต)',
    slide3Title: '3. หลบสิ่งกีดขวาง & รถกระบะ',
    slide3Desc: 'หลบกล่องเครื่องมือ ยางรถยนต์ กรวย หลุม และรถกระบะอีซูซุที่วิ่งสวนมา! ทำ Combo รับคะแนน x2, x3, x5!',
    btnStartTutorialDone: 'เข้าใจแล้ว! ลุยเลย',

    // In-Game HUD
    score: 'คะแนน',
    distance: 'ระยะทาง',
    combo: 'คอมโบ',
    meters: 'ม.',
    paused: 'หยุดชั่วคราว',
    btnResume: 'เล่นต่อ',
    btnQuit: 'กลับหน้าหลัก',

    // Game Over Screen
    gameOverTitle: 'เกมจบแล้ว!',
    finalScore: 'คะแนนของคุณ',
    finalDistance: 'ระยะทางที่ทำได้',
    personalBest: 'สถิติสูงสุดส่วนตัว',
    currentRank: 'อันดับปัจจุบัน',
    topRankMsg: 'สุดยอดมาก! ติดอันดับ Top 10 ของตาราง!',
    cheerMsg: 'พยายามได้ดีมาก! วิ่งใหม่อีกรอบเพื่อทำสถิติดีกว่าเดิม',
    btnPlayAgain: 'วิ่งอีกครั้ง',
    btnViewLeaderboard: 'ดูตารางอันดับ',
    btnShareScore: 'แชร์คะแนน',
    shareText: 'ฉันพากระต่าย ISUZU Trusted Buddy วิ่งทำคะแนนได้ {score} แต้ม! มาท้าดวลกันเลย: {url}',
    shareCopied: 'คัดลอกลิงก์แชร์คะแนนเรียบร้อยแล้ว!',

    // Leaderboard Screen
    lbTitle: 'ตารางผู้นำความเร็ว',
    tabToday: 'วันนี้',
    tabWeek: 'สัปดาห์นี้',
    tabAll: 'ตลอดกาล',
    colRank: 'อันดับ',
    colPlayer: 'ผู้เล่น',
    colScore: 'คะแนน',
    yourRank: 'อันดับของคุณ',
    noData: 'ยังไม่มีข้อมูลคะแนน',
    refreshing: 'อัปเดตทุก 15 วินาที',

    // PDPA Policy Modal
    pdpaModalTitle: 'นโยบายความเป็นส่วนตัว (PDPA)',
    pdpaContent: `
      <p><strong>1. ข้อมูลที่เราเก็บรวบรวม:</strong> ชื่อเล่น, เบอร์โทรศัพท์, อีเมล (ถ้ามี), สถิติและคะแนนการเล่นในเกม</p>
      <p><strong>2. วัตถุประสงค์:</strong> เพื่อจัดอันดับ Leaderboard, มอบของรางวัลแก่ผู้ชนะกิจกรรม และวิเคราะห์ความพึงพอใจในกิจกรรมโปรโมตแบรนด์ ISUZU Trusted Buddy</p>
      <p><strong>3. การเปิดเผยข้อมูล:</strong> ข้อมูลเบอร์โทรศัพท์และอีเมลจะถูกเก็บเป็นความลับและไม่แสดงต่อสาธารณะ บน Leaderboard จะแสดงเฉพาะชื่อเล่นเท่านั้น</p>
      <p><strong>4. สิทธิของเจ้าของข้อมูล:</strong> คุณสามารถติดต่อผู้จัดงานเพื่อขอตรวจสอบ แก้ไข หรือขอลบข้อมูลส่วนตัวของคุณได้ตลอดเวลา</p>
    `
  },

  en: {
    // Brand & General
    gameTitle: 'ISUZU RUSH',
    mascotName: 'ISUZU Trusted Buddy (TSH)',
    tagline: 'Your Trusted Partner on Every Road',
    loading: 'Loading...',
    error: 'An error occurred',
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    back: 'Back',
    next: 'Next',
    skip: 'Skip',

    // Splash Screen
    btnStart: 'RUSH NOW!',
    btnLeaderboard: 'Leaderboard',
    btnHowToPlay: 'How to Play',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',

    // Registration Screen
    regTitle: 'Player Registration',
    regSubtitle: 'Enter details to record your record and enter lucky prize draws with ISUZU Trusted Buddy',
    labelNickname: 'Nickname *',
    placeholderNickname: 'e.g. TurboBunny (2-16 chars)',
    labelPhone: 'Phone Number (For prizes)',
    placeholderPhone: '08X-XXX-XXXX',
    labelEmail: 'Email (Optional)',
    placeholderEmail: 'name@example.com',
    pdpaConsent: 'I accept the terms and consent to the collection of personal data under the',
    privacyPolicyLink: 'Privacy Policy (PDPA)',
    btnSubmitRegister: "Let's Race!",
    errNicknameRequired: 'Nickname must be between 2 and 16 characters',
    errPdpaRequired: 'Please accept the privacy policy to continue',

    // Tutorial Screen
    tutorialTitle: 'How to Play ISUZU RUSH',
    slide1Title: '1. Jump & Double Jump',
    slide1Desc: 'Tap screen or press Spacebar to jump. Hold for high jumps or tap again in mid-air to Double Jump!',
    slide2Title: '2. Carrots & Power-Ups',
    slide2Desc: 'Carrots (+10) • VIP Tickets (+50) • TSH Key (+100 & 2X multiplier for 5s) • Charger (Restore Health)',
    slide3Title: '3. Dodge Obstacles & Trucks',
    slide3Desc: 'Dodge toolboxes, tires, cones, potholes, and oncoming Isuzu trucks! Chain pickups for x2, x3, x5 Combos!',
    btnStartTutorialDone: "Got it! Let's Go",

    // In-Game HUD
    score: 'Score',
    distance: 'Distance',
    combo: 'Combo',
    meters: 'm',
    paused: 'PAUSED',
    btnResume: 'Resume',
    btnQuit: 'Quit',

    // Game Over Screen
    gameOverTitle: 'GAME OVER',
    finalScore: 'Final Score',
    finalDistance: 'Distance Covered',
    personalBest: 'Personal Best',
    currentRank: 'Current Rank',
    topRankMsg: 'Amazing! You made the Top 10 leaderboard!',
    cheerMsg: 'Great effort! Run again to beat your personal record!',
    btnPlayAgain: 'Run Again',
    btnViewLeaderboard: 'Leaderboard',
    btnShareScore: 'Share Score',
    shareText: 'I ran with ISUZU Trusted Buddy and scored {score} pts! Can you beat my record? {url}',
    shareCopied: 'Share link copied to clipboard!',

    // Leaderboard Screen
    lbTitle: 'Speed Leaderboard',
    tabToday: 'Today',
    tabWeek: 'This Week',
    tabAll: 'All Time',
    colRank: 'Rank',
    colPlayer: 'Player',
    colScore: 'Score',
    yourRank: 'Your Rank',
    noData: 'No score entries yet',
    refreshing: 'Live updates every 15s',

    // PDPA Policy Modal
    pdpaModalTitle: 'Privacy Policy (PDPA)',
    pdpaContent: `
      <p><strong>1. Data Collected:</strong> Nickname, phone number, email (if provided), in-game scores and gameplay stats.</p>
      <p><strong>2. Purpose:</strong> To rank players on leaderboards, deliver prizes, and measure brand campaign engagement.</p>
      <p><strong>3. Data Disclosure:</strong> Contact details are encrypted and kept strictly confidential. Only your chosen nickname is shown publicly on the Leaderboard.</p>
      <p><strong>4. Your Rights:</strong> You may request access to, correction of, or deletion of your personal data at any time by contacting event staff.</p>
    `
  }
};

let currentLang = localStorage.getItem('isuzu_rush_lang') || 'th';

function setLanguage(lang) {
  if (lang !== 'th' && lang !== 'en') lang = 'th';
  currentLang = lang;
  localStorage.setItem('isuzu_rush_lang', lang);
  updateDOMTexts();
}

function getLanguage() {
  return currentLang;
}

function t(key, params = {}) {
  const dict = I18N[currentLang] || I18N.th;
  let text = dict[key] || I18N.th[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${k}}`, 'g'), v);
  }
  return text;
}

function updateDOMTexts() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.innerHTML = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });

  const langToggleBtn = document.getElementById('btnLangToggle');
  if (langToggleBtn) {
    langToggleBtn.textContent = currentLang === 'th' ? 'EN' : 'ไทย';
  }
}

window.I18N = I18N;
window.t = t;
window.setLanguage = setLanguage;
window.getLanguage = getLanguage;
window.updateDOMTexts = updateDOMTexts;
