const fs = require('fs');

function patchApp(file) {
  let code = fs.readFileSync(file, 'utf8');

  // 1. Add activeEventSettings, applyGameSettings, and loadSettingsFromServer
  if (!code.includes('activeEventSettings')) {
    const searchStr = "let API_BASE = DEFAULT_CLOUD_API;";
    const insertStr = `// --- DYNAMIC EVENT SETTINGS ---
  let activeEventSettings = {
    event_title: 'ISUZU RUSH 2026',
    event_active: 'true',
    difficulty: 'normal',
    require_phone: 'false',
    player_lives: '3',
    base_speed: '6',
    announcement: ''
  };

  function applyGameSettings(s) {
    if (!s) return;
    activeEventSettings = { ...activeEventSettings, ...s };

    if (activeEventSettings.event_title) {
      document.title = activeEventSettings.event_title;
    }

    const annBox = document.getElementById('splashAnnouncement');
    const annText = document.getElementById('splashAnnouncementText');
    if (annBox && annText) {
      if (activeEventSettings.announcement && activeEventSettings.announcement.trim()) {
        annText.textContent = activeEventSettings.announcement.trim();
        annBox.style.display = 'block';
      } else {
        annBox.style.display = 'none';
      }
    }

    const btnStart = document.getElementById('btnStartGame');
    if (btnStart) {
      if (activeEventSettings.event_active === 'false') {
        btnStart.innerHTML = '<span>🏁 กิจกรรมปิดรับการแข่งขันแล้ว</span>';
        btnStart.style.opacity = '0.7';
      } else {
        btnStart.innerHTML = '<span data-i18n="startGame">เริ่มเล่นเลย!</span>';
        btnStart.style.opacity = '1';
      }
    }

    const phoneInput = document.getElementById('regPhone');
    const phoneLabel = document.getElementById('labelRegPhone');
    if (phoneInput && phoneLabel) {
      if (activeEventSettings.require_phone === 'true') {
        phoneInput.required = true;
        phoneLabel.innerHTML = 'เบอร์โทรศัพท์ (จำเป็นสำหรับการรับรางวัล) <span style="color:#FF5252;">*</span>';
      } else {
        phoneInput.required = false;
        phoneLabel.innerHTML = 'เบอร์โทรศัพท์ (ถ้ามี สำหรับรับรางวัล)';
      }
    }

    if (activeEventSettings.difficulty && window.GAME_CONFIG) {
      window.GAME_CONFIG.setDifficulty(activeEventSettings.difficulty);
    }
  }

  async function loadSettingsFromServer() {
    try {
      const res = await fetch(\`\${API_BASE}/api/settings\`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          applyGameSettings(data.settings);
        }
      }
    } catch (e) {
      console.log('Settings load error:', e);
    }
  }

  loadSettingsFromServer();\n\n  let API_BASE = DEFAULT_CLOUD_API;`;

    code = code.replace(searchStr, insertStr);
  }

  // 2. Patch btnStartGame click to block if event_active === 'false'
  code = code.replace(
    /document\.getElementById\('btnStartGame'\)\?\.addEventListener\('click', \(\) => \{/,
    `document.getElementById('btnStartGame')?.addEventListener('click', () => {
    if (activeEventSettings.event_active === 'false') {
      alert('ขณะนี้กิจกรรมปิดรับการแข่งขันชั่วคราว ขอขอบคุณทุกท่านที่ให้ความสนใจครับ!');
      return;
    }`
  );

  // 3. Patch regForm submit to validate require_phone
  code = code.replace(
    /if \(!pdpaConsent\) \{\s*regError\.textContent = window\.t\('errPdpaRequired'\);\s*return;\s*\}/,
    `if (!pdpaConsent) {
      regError.textContent = window.t('errPdpaRequired');
      return;
    }

    if (activeEventSettings.require_phone === 'true') {
      const cleanPhone = phone.replace(/[\\s\\-_]/g, '');
      if (!cleanPhone || cleanPhone.length < 9) {
        regError.textContent = 'กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (จำเป็นสำหรับการรับรางวัล)';
        return;
      }
    }`
  );

  // 4. Patch startGame to use activeEventSettings and server config
  code = code.replace(
    /let gameConfig = \{ playerLives: 3, baseSpeed: 6, maxSpeed: 15 \};[\s\S]*?if \(!game\) \{/,
    `const preset = window.GAME_CONFIG ? window.GAME_CONFIG.getCurrentPreset() : {};
    let lives = parseInt(activeEventSettings.player_lives, 10) || 3;
    let speedStart = preset.speedStart || 210;
    let speedMax = preset.speedMax || 620;
    let acceleration = preset.acceleration || 2.5;

    if (activeEventSettings.base_speed) {
      const bs = parseFloat(activeEventSettings.base_speed);
      if (bs <= 5) speedStart = 170;
      else if (bs >= 7) speedStart = 280;
    }

    let gameConfig = {
      playerLives: lives,
      speedStart: speedStart,
      speedMax: speedMax,
      acceleration: acceleration,
      difficulty: activeEventSettings.difficulty || 'normal'
    };

    try {
      const res = await fetch(\`\${API_BASE}/api/game/start\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerUuid: player.playerUuid || player.player_uuid,
          nickname: player.nickname,
          phone: player.phone,
          email: player.email,
          source: detectedSource
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.config) {
        activeSessionToken = data.sessionToken;
        if (data.config.eventActive === false) {
          alert('ขณะนี้กิจกรรมปิดรับการแข่งขันชั่วคราว');
          return;
        }
        if (data.config.playerLives) {
          gameConfig.playerLives = parseInt(data.config.playerLives, 10);
        }
        if (data.config.difficulty && window.GAME_CONFIG) {
          window.GAME_CONFIG.setDifficulty(data.config.difficulty);
          const p = window.GAME_CONFIG.getCurrentPreset();
          gameConfig.speedStart = data.config.speedStart || p.speedStart;
          gameConfig.speedMax = data.config.speedMax || p.speedMax;
          gameConfig.acceleration = data.config.acceleration || p.acceleration;
        }
      }
    } catch (e) {
      activeSessionToken = 'offline_' + Date.now();
    }

    if (!game) {`
  );

  fs.writeFileSync(file, code, 'utf8');
  console.log('Successfully patched:', file);
}

patchApp('C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush/public/js/app.js');
patchApp('C:/Users/ASUS/.gemini/antigravity/scratch/isuzu-rush/js/app.js');
