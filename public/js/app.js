/**
 * Main Application Controller for ISUZU RUSH SPA
 * Handles Screen switching, Registration, Anti-Cheat Session lifecycle, and Live Leaderboard.
 * Supports both online server mode (http://localhost:3000) and offline file:/// fallback.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check file:/// protocol
  const isFileProtocol = window.location.protocol === 'file:';
  const fileBanner = document.getElementById('fileProtocolBanner');
  if (isFileProtocol && fileBanner) {
    fileBanner.style.display = 'block';
  }

  // Elements
  const screens = {
    splash: document.getElementById('screen-splash'),
    register: document.getElementById('screen-register'),
    tutorial: document.getElementById('screen-tutorial'),
    game: document.getElementById('screen-game'),
    gameover: document.getElementById('screen-gameover'),
    leaderboard: document.getElementById('screen-leaderboard')
  };

  const canvas = document.getElementById('gameCanvas');
  const modalPdpa = document.getElementById('modal-pdpa');

  // Shared state
  const audio = new AudioManager();
  let game = null;
  let activeSessionToken = null;
  let currentTutorialSlide = 0;
  let leaderboardPollingInterval = null;
  let currentLbPeriod = 'all';

  // Get URL Source Tracking (?src=ticket, ?src=booth, etc.)
  const urlParams = new URLSearchParams(window.location.search);
  const detectedSource = urlParams.get('src') || localStorage.getItem('isuzu_rush_source') || 'direct';
  localStorage.setItem('isuzu_rush_source', detectedSource);

  // Central API Configuration (Supports Localhost, Cloud Server, and Offline Mode)
  const DEFAULT_CLOUD_API = 'https://isuzu-rush-1.onrender.com';
  const queryApi = urlParams.get('api');
  if (queryApi) {
    localStorage.setItem('isuzu_rush_api_url', queryApi);
  }

  let API_BASE = DEFAULT_CLOUD_API;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('onrender.com')) {
    API_BASE = '';
  } else if (localStorage.getItem('isuzu_rush_api_url')) {
    API_BASE = localStorage.getItem('isuzu_rush_api_url');
  }

  // --- DYNAMIC EVENT SETTINGS ---
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
      const res = await fetch(`${API_BASE}/api/settings`);
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

  loadSettingsFromServer();

  // Initialize Language
  window.setLanguage(window.getLanguage());

  // Check saved player registration
  function getSavedPlayer() {
    try {
      const data = localStorage.getItem('isuzu_rush_player');
      if (!data) return null;
      const p = JSON.parse(data);
      if (p) {
        const uuid = p.playerUuid || p.player_uuid || '';
        p.playerUuid = uuid;
        p.player_uuid = uuid;
      }
      return p;
    } catch (e) {
      return null;
    }
  }

  function savePlayer(player) {
    if (!player) return;
    const uuid = player.playerUuid || player.player_uuid || '';
    player.playerUuid = uuid;
    player.player_uuid = uuid;
    localStorage.setItem('isuzu_rush_player', JSON.stringify(player));
  }

  // --- SCREEN SWITCHER ---
  function showScreen(name) {
    if (name !== 'game') {
      showPauseModal(false);
      if (typeof game !== 'undefined' && game && (game.state === 'playing' || game.state === 'paused')) {
        game.stop();
      }
    }
    Object.keys(screens).forEach(key => {
      if (screens[key]) {
        screens[key].classList.toggle('active', key === name);
      }
    });

    // Stop leaderboard polling if leaving leaderboard
    if (name !== 'leaderboard' && leaderboardPollingInterval) {
      clearInterval(leaderboardPollingInterval);
      leaderboardPollingInterval = null;
    }

    // Refresh texts
    window.updateDOMTexts();
  }

  // --- AUDIO & UI CONTROLS ---
  const btnSoundToggle = document.getElementById('btnSoundToggle');
  const btnInGameSound = document.getElementById('btnInGameSound');
  const btnInGamePause = document.getElementById('btnInGamePause');

  function updateSoundButtons() {
    const isMuted = audio.isMuted();
    const label = isMuted ? '🔇' : '🔊';
    if (btnSoundToggle) btnSoundToggle.innerHTML = `${label} <span>${isMuted ? window.t('soundOff') : window.t('soundOn')}</span>`;
    if (btnInGameSound) btnInGameSound.innerHTML = label;
  }

  btnSoundToggle?.addEventListener('click', () => {
    audio.unlock();
    audio.toggleSound();
    updateSoundButtons();
  });

  btnInGameSound?.addEventListener('click', () => {
    audio.toggleSound();
    updateSoundButtons();
  });

    const pauseModal = document.getElementById('pauseModal');
  const btnResumeGame = document.getElementById('btnResumeGame');
  const btnRestartGame = document.getElementById('btnRestartGame');
  const btnBackToSplash = document.getElementById('btnBackToSplash');
  const btnBackFromRegister = document.getElementById('btnBackFromRegister');
  const btnBackFromTutorial = document.getElementById('btnBackFromTutorial');
  const btnBackFromGameOver = document.getElementById('btnBackFromGameOver');

  function showPauseModal(show) {
    const modal = document.getElementById('pauseModal');
    if (modal) {
      if (show) {
        modal.style.setProperty('display', 'flex', 'important');
        modal.classList.add('active');
      } else {
        modal.style.setProperty('display', 'none', 'important');
        modal.classList.remove('active');
      }
    }
  }

  function pauseGameAndShowMenu() {
    if (game) {
      game.pause();
    }
    showPauseModal(true);
  }

  function resumeGameAndHideMenu() {
    showPauseModal(false);
    if (game) {
      game.resume();
    }
  }

  function restartGameFromMenu() {
    showPauseModal(false);
    startGame();
  }

  function exitGameToSplash() {
    showPauseModal(false);
    if (game) {
      game.stop();
    }
    showScreen('splash');
  }

  let lastPauseTap = 0;
  function onPauseBtnPressed(e) {
    const now = performance.now();
    if (now - lastPauseTap < 250) return;
    lastPauseTap = now;
    if (e) {
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault && e.cancelable) e.preventDefault();
    }
    pauseGameAndShowMenu();
  }

  btnInGamePause?.addEventListener('click', onPauseBtnPressed);
  btnInGamePause?.addEventListener('touchend', onPauseBtnPressed);

  btnResumeGame?.addEventListener('click', (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    resumeGameAndHideMenu();
  });
  btnResumeGame?.addEventListener('touchend', (e) => {
    if (e) {
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault && e.cancelable) e.preventDefault();
    }
    resumeGameAndHideMenu();
  });

  btnRestartGame?.addEventListener('click', (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    restartGameFromMenu();
  });
  btnRestartGame?.addEventListener('touchend', (e) => {
    if (e) {
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault && e.cancelable) e.preventDefault();
    }
    restartGameFromMenu();
  });

  btnBackToSplash?.addEventListener('click', (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    exitGameToSplash();
  });
  btnBackToSplash?.addEventListener('touchend', (e) => {
    if (e) {
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault && e.cancelable) e.preventDefault();
    }
    exitGameToSplash();
  });

  btnBackFromRegister?.addEventListener('click', () => {
    showScreen('splash');
  });

  btnBackFromTutorial?.addEventListener('click', () => {
    showScreen('splash');
  });

  btnBackFromGameOver?.addEventListener('click', () => {
    showScreen('splash');
  });

  document.getElementById('btnLangToggle')?.addEventListener('click', () => {
    const nextLang = window.getLanguage() === 'th' ? 'en' : 'th';
    window.setLanguage(nextLang);
    updateSoundButtons();
  });

  // --- SPLASH SCREEN ACTIONS ---
  document.getElementById('btnStartGame')?.addEventListener('click', () => {
    if (activeEventSettings.event_active === 'false') {
      alert('ขณะนี้กิจกรรมปิดรับการแข่งขันชั่วคราว ขอขอบคุณทุกท่านที่ให้ความสนใจครับ!');
      return;
    }
    audio.unlock();
    const player = getSavedPlayer();
    if (!player) {
      showScreen('register');
    } else {
      const tutorialSeen = localStorage.getItem('isuzu_rush_tutorial_seen');
      if (!tutorialSeen) {
        showTutorial();
      } else {
        startGame();
      }
    }
  });

  document.getElementById('btnOpenLeaderboard')?.addEventListener('click', () => {
    showLeaderboard();
  });

  document.getElementById('btnOpenTutorial')?.addEventListener('click', () => {
    showTutorial();
  });

  // --- REGISTRATION SCREEN ---
  const regForm = document.getElementById('regForm');
  const regError = document.getElementById('regError');

  regForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    regError.textContent = '';

    const nickname = document.getElementById('regNickname').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pdpaConsent = document.getElementById('regPdpaConsent').checked;

    if (!nickname || nickname.length < 2) {
      regError.textContent = window.t('errNicknameRequired');
      return;
    }

    if (!pdpaConsent) {
      regError.textContent = window.t('errPdpaRequired');
      return;
    }

    if (activeEventSettings.require_phone === 'true') {
      const cleanPhone = phone.replace(/[\s\-_]/g, '');
      if (!cleanPhone || cleanPhone.length < 9) {
        regError.textContent = 'กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (จำเป็นสำหรับการรับรางวัล)';
        return;
      }
    }

    try {
      const existing = getSavedPlayer();
      const res = await fetch(`${API_BASE}/api/player/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerUuid: existing?.playerUuid,
          nickname,
          phone,
          email,
          source: detectedSource,
          pdpaConsent: true
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        regError.textContent = data.error || 'Registration failed';
        return;
      }

      savePlayer(data.player);
      showTutorial();
    } catch (err) {
      // Offline fallback: save locally and allow playing!
      const localPlayer = {
        playerUuid: 'local_' + Date.now(),
        nickname,
        phone,
        email,
        source: detectedSource
      };
      savePlayer(localPlayer);
      showTutorial();
    }
  });

  // PDPA Modal
  document.getElementById('btnOpenPdpaModal')?.addEventListener('click', (e) => {
    e.preventDefault();
    modalPdpa.classList.add('active');
  });

  document.getElementById('btnClosePdpaModal')?.addEventListener('click', () => {
    modalPdpa.classList.remove('active');
  });

  // --- TUTORIAL SCREEN ---
  const slides = document.querySelectorAll('.tutorial-slide');
  const dots = document.querySelectorAll('.slide-dot');
  const btnNextSlide = document.getElementById('btnNextSlide');
  const btnSkipTutorial = document.getElementById('btnSkipTutorial');

  function showTutorialSlide(idx) {
    currentTutorialSlide = idx;
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));

    if (idx === slides.length - 1) {
      btnNextSlide.textContent = window.t('btnStartTutorialDone');
    } else {
      btnNextSlide.textContent = window.t('next');
    }
  }

  function showTutorial() {
    showTutorialSlide(0);
    showScreen('tutorial');
  }

  btnNextSlide?.addEventListener('click', () => {
    if (currentTutorialSlide < slides.length - 1) {
      showTutorialSlide(currentTutorialSlide + 1);
    } else {
      localStorage.setItem('isuzu_rush_tutorial_seen', 'true');
      startGame();
    }
  });

  btnSkipTutorial?.addEventListener('click', () => {
    localStorage.setItem('isuzu_rush_tutorial_seen', 'true');
    startGame();
  });

  // --- GAME START & ANTI-CHEAT ---
  async function startGame() {
    const player = getSavedPlayer();
    if (!player) {
      showScreen('register');
      return;
    }

    const preset = window.GAME_CONFIG ? window.GAME_CONFIG.getCurrentPreset() : {};
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
      const res = await fetch(`${API_BASE}/api/game/start`, {
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

    if (!game) {
      game = new RunnerGame(canvas, audio, handleGameOver);
    }
    game.onPauseStateChange = (isPaused) => {
      showPauseModal(isPaused);
    };
    showPauseModal(false);

    showScreen('game');
    game.start(gameConfig);
  }

  // --- REAL PLAYER SCORES STORAGE (Zero Fake Data) ---
  function getLocalRealScores() {
    try {
      const raw = localStorage.getItem('isuzu_rush_real_scores');
      let list = raw ? JSON.parse(raw) : [];

      // Auto-migrate: If list is empty but saved player has a previous best score, register it!
      if (list.length === 0) {
        const player = getSavedPlayer();
        const best = parseInt(localStorage.getItem('isuzu_rush_best') || '0', 10);
        if (player && player.nickname && best > 0) {
          list.push({
            playerUuid: player.playerUuid || 'local_1',
            nickname: player.nickname.trim(),
            score: best,
            date: new Date().toISOString()
          });
          localStorage.setItem('isuzu_rush_real_scores', JSON.stringify(list));
        }
      }
      return list;
    } catch (e) {
      return [];
    }
  }

  function saveLocalRealScore(player, score, distance, coins, tickets) {
    if (!player || !player.nickname || typeof score !== 'number' || score <= 0) return;
    const list = getLocalRealScores();
    const cleanNick = player.nickname.trim();
    const existingIdx = list.findIndex(item => 
      (item.playerUuid && player.playerUuid && item.playerUuid === player.playerUuid) ||
      (item.nickname && item.nickname.trim().toLowerCase() === cleanNick.toLowerCase())
    );
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      // Update score if new score is higher or equal
      if (score >= list[existingIdx].score) {
        list[existingIdx].score = score;
        list[existingIdx].distance = Math.max(list[existingIdx].distance || 0, distance || 0);
        list[existingIdx].coins = Math.max(list[existingIdx].coins || 0, coins || 0);
        list[existingIdx].tickets = Math.max(list[existingIdx].tickets || 0, tickets || 0);
        list[existingIdx].date = now;
      }
    } else {
      list.push({
        playerUuid: player.playerUuid || ('local_' + Date.now()),
        nickname: cleanNick,
        score: score,
        distance: distance || 0,
        coins: coins || 0,
        tickets: tickets || 0,
        date: now
      });
    }

    localStorage.setItem('isuzu_rush_real_scores', JSON.stringify(list));
  }

  function getFilteredRealScores(period = 'all') {
    const allScores = getLocalRealScores();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - (7 * 24 * 60 * 60 * 1000);

    const filtered = allScores.filter(item => {
      if (period === 'all') return true;
      const itemTime = item.date ? new Date(item.date).getTime() : now.getTime();
      if (period === 'today') return itemTime >= startOfToday;
      if (period === 'week') return itemTime >= startOfWeek;
      return true;
    });

    // Sort descending by score
    filtered.sort((a, b) => b.score - a.score);

    // Assign true ranks
    return filtered.map((item, index) => ({
      rank: index + 1,
      playerUuid: item.playerUuid,
      nickname: item.nickname,
      score: item.score,
      date: item.date
    }));
  }

  // --- GAME OVER & SUBMIT SCORE ---
  async function handleGameOver(stats) {
    const player = getSavedPlayer();
    showScreen('gameover');

    document.getElementById('resScore').textContent = stats.score;
    document.getElementById('resDistance').textContent = `${stats.distance} ${window.t('meters')}`;
    
    // Save personal best locally
    const savedBest = parseInt(localStorage.getItem('isuzu_rush_best') || '0', 10);
    const newBest = Math.max(savedBest, stats.score);
    localStorage.setItem('isuzu_rush_best', String(newBest));

    document.getElementById('resBestScore').textContent = newBest;

    // Save to real leaderboard storage immediately
    if (player && player.nickname) {
      saveLocalRealScore(player, stats.score, stats.distance, stats.carrots, stats.tickets);
    }

    // Calculate REAL rank among actual players
    const rankedList = getFilteredRealScores('all');
    let finalRank = 1;
    if (player && player.nickname) {
      const myIdx = rankedList.findIndex(item => 
        (item.playerUuid && player.playerUuid && item.playerUuid === player.playerUuid) ||
        (item.nickname && item.nickname.trim().toLowerCase() === player.nickname.trim().toLowerCase())
      );
      if (myIdx >= 0) {
        finalRank = myIdx + 1;
      }
    }

    const mascotImgEl = document.getElementById('resMascotImg');
    const cheerMsgEl = document.getElementById('resCheerMsg');

    function updateRankView(rank) {
      document.getElementById('resCurrentRank').textContent = `#${rank}`;
      if (rank <= 10) {
        if (mascotImgEl) mascotImgEl.src = './assets/characters/rabbit_thumbsup.svg';
        if (cheerMsgEl) cheerMsgEl.textContent = window.t('topRankMsg');
      } else {
        if (mascotImgEl) mascotImgEl.src = './assets/characters/rabbit_cheer.svg';
        if (cheerMsgEl) cheerMsgEl.textContent = window.t('cheerMsg');
      }
    }

    updateRankView(finalRank);

    // Submit to server if online
    try {
      const res = await fetch(`${API_BASE}/api/game/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: activeSessionToken,
          playerUuid: player ? (player.playerUuid || player.player_uuid || '') : '',
          player_uuid: player ? (player.playerUuid || player.player_uuid || '') : '',
          nickname: player ? player.nickname : '',
          phone: player ? player.phone : '',
          email: player ? player.email : '',
          score: stats.score,
          distance: stats.distance,
          coins: stats.carrots || 0,
          tickets: stats.tickets || 0,
          maxCombo: stats.maxCombo,
          playTimeSec: stats.playTimeSec,
          source: detectedSource
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          document.getElementById('resBestScore').textContent = data.personalBest;
          updateRankView(data.currentRank || 1);
        }
      }
    } catch (e) {}
  }

  document.getElementById('btnPlayAgain')?.addEventListener('click', () => {
    startGame();
  });

  document.getElementById('btnGameOverLeaderboard')?.addEventListener('click', () => {
    showLeaderboard();
  });

  document.getElementById('btnShareScore')?.addEventListener('click', () => {
    const score = document.getElementById('resScore').textContent;
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
    const shareUrl = isFileProtocol ? 'http://localhost:3000/?src=share' : `${window.location.origin}${basePath}?src=share`;
    const text = window.t('shareText', { score, url: shareUrl });

    if (navigator.share) {
      navigator.share({
        title: window.t('gameTitle'),
        text: text,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        alert(window.t('shareCopied'));
      });
    }
  });

  // --- LEADERBOARD & REALTIME POLLING ---
  async function fetchLeaderboard(period = currentLbPeriod) {
    const player = getSavedPlayer();
    const playerUuid = player ? player.playerUuid : '';

    try {
      const res = await fetch(`${API_BASE}/api/leaderboard?period=${period}&playerUuid=${playerUuid}`);
      if (!res.ok) throw new Error('API unavailable');
      const data = await res.json();

      if (!data.success) throw new Error('API error');

      renderLeaderboardRows(data.leaderboard, data.playerRank, player);
    } catch (e) {
      // Real players fallback (NO FAKE / MOCK DATA)
      const rankedList = getFilteredRealScores(period);
      let playerRank = null;
      if (player && player.nickname) {
        const myRankItem = rankedList.find(item => 
          (item.playerUuid && player.playerUuid && item.playerUuid === player.playerUuid) ||
          (item.nickname && item.nickname.trim().toLowerCase() === player.nickname.trim().toLowerCase())
        );
        const myBest = parseInt(localStorage.getItem('isuzu_rush_best') || '0', 10);
        if (myRankItem) {
          playerRank = { rank: myRankItem.rank, score: myRankItem.score };
        } else if (myBest > 0) {
          playerRank = { rank: rankedList.length + 1, score: myBest };
        }
      }

      renderLeaderboardRows(rankedList, playerRank, player);
    }
  }

  function renderLeaderboardRows(list, playerRank, player) {
    const container = document.getElementById('lbListContainer');
    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="lb-empty" style="padding: 40px 16px; text-align: center; color: var(--text-muted); font-size: 14px; line-height: 1.6;">
          🏁 ยังไม่มีข้อมูลคะแนนของผู้เล่นจริงในรอบนี้<br>
          <span style="color: var(--brand-red); font-weight: 700; display: inline-block; margin-top: 6px;">
            มากด "เริ่มเล่น" เพื่อเป็นอันดับ 1 คนแรกกันเถอะ!
          </span>
        </div>
      `;
    } else {
      container.innerHTML = list.map(item => {
        const isCurrentPlayer = player && (
          (item.playerUuid && player.playerUuid && item.playerUuid === player.playerUuid) ||
          (item.nickname && player.nickname && item.nickname.trim().toLowerCase() === player.nickname.trim().toLowerCase())
        );
        const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;
        return `
          <div class="lb-row ${item.rank <= 3 ? 'top-' + item.rank : ''} ${isCurrentPlayer ? 'is-me' : ''}">
            <div class="lb-rank">${medal}</div>
            <div class="lb-nick">${escapeHtml(item.nickname)}</div>
            <div class="lb-score">${item.score.toLocaleString()}</div>
          </div>
        `;
      }).join('');
    }

    const pinnedEl = document.getElementById('lbPinnedPlayer');
    if (player && playerRank && playerRank.score > 0) {
      pinnedEl.style.display = 'flex';
      pinnedEl.innerHTML = `
        <div class="lb-rank">#${playerRank.rank}</div>
        <div class="lb-nick">⭐ ${escapeHtml(player.nickname)} (${window.t('yourRank')})</div>
        <div class="lb-score">${(playerRank.score || 0).toLocaleString()}</div>
      `;
    } else {
      pinnedEl.style.display = 'none';
    }
  }

  function showLeaderboard() {
    showScreen('leaderboard');
    fetchLeaderboard(currentLbPeriod);

    if (leaderboardPollingInterval) clearInterval(leaderboardPollingInterval);
    leaderboardPollingInterval = setInterval(() => {
      fetchLeaderboard(currentLbPeriod);
    }, 5000);
  }

  // Leaderboard Tabs
  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentLbPeriod = tab.getAttribute('data-period');
      fetchLeaderboard(currentLbPeriod);
    });
  });

  document.getElementById('btnBackFromLb')?.addEventListener('click', () => {
    showScreen('splash');
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  
  // Auto-sync player registration and offline best scores to cloud server
  async function syncLocalPlayerWithServer() {
    const player = getSavedPlayer();
    if (!player || !player.nickname) return;

    try {
      await fetch(`${API_BASE}/api/player/register`, {
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
        await fetch(`${API_BASE}/api/game/sync-score`, {
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

  syncLocalPlayerWithServer();

  updateSoundButtons();

    // Register PWA Service Worker for native mobile install (Chrome/Safari)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }
});
