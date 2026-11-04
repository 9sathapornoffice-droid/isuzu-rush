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

  // Initialize Language
  window.setLanguage(window.getLanguage());

  // Check saved player registration
  function getSavedPlayer() {
    try {
      const data = localStorage.getItem('isuzu_rush_player');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function savePlayer(player) {
    localStorage.setItem('isuzu_rush_player', JSON.stringify(player));
  }

  // --- SCREEN SWITCHER ---
  function showScreen(name) {
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

  btnInGamePause?.addEventListener('click', () => {
    if (game) game.pause();
  });

  document.getElementById('btnLangToggle')?.addEventListener('click', () => {
    const nextLang = window.getLanguage() === 'th' ? 'en' : 'th';
    window.setLanguage(nextLang);
    updateSoundButtons();
  });

  // --- SPLASH SCREEN ACTIONS ---
  document.getElementById('btnStartGame')?.addEventListener('click', () => {
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

    try {
      const existing = getSavedPlayer();
      const res = await fetch('/api/player/register', {
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

    let gameConfig = { playerLives: 3, baseSpeed: 6, maxSpeed: 15 };

    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerUuid: player.playerUuid })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        activeSessionToken = data.sessionToken;
        if (data.config) {
          gameConfig = data.config;
          if (data.config.difficulty && window.GAME_CONFIG) {
            window.GAME_CONFIG.setDifficulty(data.config.difficulty);
          }
        }
      }
    } catch (e) {
      // Offline fallback
      activeSessionToken = 'offline_' + Date.now();
    }

    if (!game) {
      game = new RunnerGame(canvas, audio, handleGameOver);
    }

    showScreen('game');
    game.start(gameConfig);
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
    let finalRank = 12;

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
      const res = await fetch('/api/game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: activeSessionToken,
          playerUuid: player.playerUuid,
          score: stats.score,
          distance: stats.distance,
          coins: stats.carrots || 0,
          tickets: stats.tickets || 0,
          maxCombo: stats.maxCombo,
          playTimeSec: stats.playTimeSec,
          source: detectedSource
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        document.getElementById('resBestScore').textContent = data.personalBest;
        updateRankView(data.currentRank || 1);
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
    const shareUrl = isFileProtocol ? 'http://localhost:3000/?src=share' : (window.location.origin + '?src=share');
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

  // Mock sample leaderboard if server is offline
  const MOCK_LEADERBOARD = [
    { rank: 1, nickname: 'สิงห์รถบรรทุก', score: 3850 },
    { rank: 2, nickname: 'สายซิ่งเมืองทอง', score: 3620 },
    { rank: 3, nickname: 'กระบะพันธุ์แกร่ง', score: 3410 },
    { rank: 4, nickname: 'บิ๊กบอส_Turbo', score: 3150 },
    { rank: 5, nickname: 'พี่ต้อม_DMax', score: 2980 },
    { rank: 6, nickname: 'เสือดำ_V-Cross', score: 2840 },
    { rank: 7, nickname: 'น้องน้ำหนึ่ง', score: 2650 },
    { rank: 8, nickname: 'หนุ่มสุพรรณ', score: 2510 },
    { rank: 9, nickname: 'เด็กอู่_2026', score: 2390 },
    { rank: 10, nickname: 'ช่างตั้ม_โมดิฟาย', score: 2200 }
  ];

  // --- LEADERBOARD & REALTIME POLLING ---
  async function fetchLeaderboard(period = currentLbPeriod) {
    const player = getSavedPlayer();
    const playerUuid = player ? player.playerUuid : '';
    const container = document.getElementById('lbListContainer');

    try {
      const res = await fetch(`/api/leaderboard?period=${period}&playerUuid=${playerUuid}`);
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error('API error');

      renderLeaderboardRows(data.leaderboard, data.playerRank, player);
    } catch (e) {
      // Offline fallback: render mock leaderboard
      const localBest = parseInt(localStorage.getItem('isuzu_rush_best') || '0', 10);
      renderLeaderboardRows(MOCK_LEADERBOARD, { rank: 12, score: localBest }, player);
    }
  }

  function renderLeaderboardRows(list, playerRank, player) {
    const container = document.getElementById('lbListContainer');
    if (!list || list.length === 0) {
      container.innerHTML = `<div class="lb-empty">${window.t('noData')}</div>`;
    } else {
      container.innerHTML = list.map(item => {
        const isCurrentPlayer = player && (item.playerUuid === player.playerUuid || item.nickname === player.nickname);
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
    if (player && playerRank) {
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
    }, 15000);
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

  updateSoundButtons();
});
