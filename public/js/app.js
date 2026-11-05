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
  const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : (localStorage.getItem('isuzu_rush_api_url') || DEFAULT_CLOUD_API);

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

    let gameConfig = { playerLives: 3, baseSpeed: 6, maxSpeed: 15 };

    try {
      const res = await fetch(`${API_BASE}/api/game/start`, {
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
          playerUuid: player ? player.playerUuid : '',
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
