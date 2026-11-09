/**
 * Admin Dashboard Controller for ISUZU RUSH
 * Handles PIN authentication, live statistics, player moderation, CSV exports, and game configurations.
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_CLOUD_API = 'https://isuzu-rush-1.onrender.com';
  const urlParams = new URLSearchParams(window.location.search);
  const customApi = urlParams.get('api') || localStorage.getItem('isuzu_rush_api_url');
  let API_BASE = DEFAULT_CLOUD_API;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('onrender.com')) {
    API_BASE = '';
  } else if (customApi) {
    API_BASE = customApi;
  }

  let adminToken = sessionStorage.getItem('isuzu_admin_token') || '';
  let currentPage = 1;
  let currentSearch = '';

  const loginOverlay = document.getElementById('adminLoginOverlay');
  const mainContent = document.getElementById('adminMainContent');
  const loginForm = document.getElementById('adminLoginForm');
  const loginError = document.getElementById('adminLoginError');

  // Check initial login state
  if (adminToken) {
    showDashboard();
  } else {
    showLogin();
  }

  function showLogin() {
    loginOverlay.style.display = 'flex';
    mainContent.style.display = 'none';
  }

  function showDashboard() {
    loginOverlay.style.display = 'none';
    mainContent.style.display = 'block';
    loadStats();
    loadPlayers();
    loadSettings();
  }

  // --- LOGIN ---
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const pin = document.getElementById('adminPinInput').value.trim();

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        loginError.textContent = data.error || 'รหัส PIN ไม่ถูกต้อง';
        return;
      }

      adminToken = data.token;
      sessionStorage.setItem('isuzu_admin_token', adminToken);
      showDashboard();
    } catch (err) {
      loginError.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
    }
  });

  document.getElementById('btnAdminLogout')?.addEventListener('click', () => {
    sessionStorage.removeItem('isuzu_admin_token');
    adminToken = '';
    showLogin();
  });

  // --- STATS & HOURLY CHART ---
  async function loadStats() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 401) showLogin();
        return;
      }

      const s = data.stats;
      document.getElementById('statTotalPlayers').textContent = (s.totalPlayers || 0).toLocaleString();
      document.getElementById('statTotalPlays').textContent = (s.totalPlays || 0).toLocaleString();
      document.getElementById('statPlaysToday').textContent = (s.playsToday || 0).toLocaleString();
      document.getElementById('statAvgTime').textContent = `${s.avgPlayTimeSeconds || 0}s`;

      renderHourlyChart(s.hourly);
      renderSourceStats(s.sourceStats);
    } catch (e) {
      console.error(e);
    }
  }

  function renderHourlyChart(hourlyData) {
    const container = document.getElementById('hourlyChartContainer');
    if (!hourlyData || hourlyData.length === 0) {
      container.innerHTML = '<div style="color:#888; text-align:center; padding:30px;">ไม่มีข้อมูลการเล่นใน 24 ชม. ที่ผ่านมา</div>';
      return;
    }

    const maxCount = Math.max(...hourlyData.map(d => d.count), 1);
    const barsHtml = hourlyData.map(d => {
      const pct = (d.count / maxCount) * 100;
      const hourLabel = d.hour.slice(-5);
      return `
        <div class="chart-bar-col" title="${d.hour}: ${d.count} ครั้ง">
          <div class="chart-bar-value">${d.count}</div>
          <div class="chart-bar-fill" style="height: ${Math.max(6, pct)}%;"></div>
          <div class="chart-bar-label">${hourLabel}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="chart-flex">${barsHtml}</div>`;
  }

  function renderSourceStats(sourceStats) {
    const container = document.getElementById('sourceStatsContainer');
    if (!sourceStats || sourceStats.length === 0) {
      container.innerHTML = '<div style="color:#888; text-align:center; padding:20px;">ไม่มีข้อมูลแหล่งที่มา</div>';
      return;
    }

    container.innerHTML = sourceStats.map(s => `
      <div class="source-badge">
        <span class="source-name">${s.source || 'direct'}</span>
        <span class="source-count">${s.count} ครั้ง</span>
      </div>
    `).join('');
  }

  // --- PLAYERS LIST & MODERATION ---
  async function loadPlayers(page = 1, search = currentSearch) {
    currentPage = page;
    currentSearch = search;
    const tbody = document.getElementById('adminPlayersTableBody');

    try {
      const res = await fetch(`${API_BASE}/api/admin/players?page=${page}&search=${encodeURIComponent(search)}`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      const data = await res.json();
      if (!res.ok || !data.success) return;

      if (!data.players || data.players.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#888; padding:30px;">ไม่พบข้อมูลผู้เล่นที่ตรงกับเงื่อนไข</td></tr>`;
        return;
      }

      tbody.innerHTML = data.players.map(p => {
        const medal = p.rank === 1 ? '🥇 อันดับ 1' : p.rank === 2 ? '🥈 อันดับ 2' : p.rank === 3 ? '🥉 อันดับ 3' : `#${p.rank}`;
        const lastPlayText = p.last_played 
          ? new Date(p.last_played).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) 
          : (p.created_at ? new Date(p.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-');
        return `
        <tr class="${p.is_banned ? 'row-banned' : ''}">
          <td style="text-align:center;"><strong style="font-size:14px; color:${p.rank <= 3 ? '#FFD700' : '#FFF'}">${medal}</strong></td>
          <td><strong>${escapeHtml(p.nickname)}</strong></td>
          <td>${p.phone ? `<a href="tel:${escapeHtml(p.phone)}" style="color:#00D26A; text-decoration:none; font-weight:600;">📞 ${escapeHtml(p.phone)}</a>` : '<span style="color:#666;">-</span>'}</td>
          <td>${p.email ? `<span style="color:#8F95A3;">${escapeHtml(p.email)}</span>` : '<span style="color:#666;">-</span>'}</td>
          <td style="text-align:right;"><span class="score-badge">${(p.high_score || 0).toLocaleString()}</span></td>
          <td style="text-align:right;">${p.best_distance ? p.best_distance.toLocaleString() + ' ม.' : '-'}</td>
          <td style="text-align:center;">${p.games_played || 0}</td>
          <td style="font-size:12px; color:#8F95A3;">${lastPlayText}</td>
          <td style="text-align:center;"><span class="tag-source">${escapeHtml(p.source || 'direct')}</span></td>
          <td style="text-align:center;">
            <button class="btn-action ${p.is_banned ? 'btn-unban' : 'btn-ban'}" onclick="toggleBan(${p.id}, ${p.is_banned ? 0 : 1})">
              ${p.is_banned ? 'ปลดแบน' : 'แบน'}
            </button>
          </td>
        </tr>
      `}).join('');

      document.getElementById('adminPageInfo').textContent = `หน้า ${data.page} จาก ${data.totalPages || 1} (รวมทั้งหมด ${data.total || 0} คน)`;
      document.getElementById('btnPrevPage').disabled = data.page <= 1;
      document.getElementById('btnNextPage').disabled = data.page >= data.totalPages;
    } catch (e) {
      console.error(e);
    }
  }

  window.toggleBan = async function (playerId, shouldBan) {
    if (!confirm(`คุณต้องการ ${shouldBan ? 'แบน' : 'ปลดแบน'} ผู้เล่น ID #${playerId} ใช่หรือไม่?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/player/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({ playerId, isBanned: shouldBan === 1 })
      });
      if (res.ok) {
        loadPlayers(currentPage, currentSearch);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
  };

  let searchTimeout = null;
  document.getElementById('adminSearchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadPlayers(1, e.target.value.trim());
    }, 250);
  });

  document.getElementById('btnPrevPage')?.addEventListener('click', () => {
    if (currentPage > 1) loadPlayers(currentPage - 1, currentSearch);
  });

  document.getElementById('btnNextPage')?.addEventListener('click', () => {
    loadPlayers(currentPage + 1, currentSearch);
  });

  // --- REAL-TIME POLLING & MANUAL REFRESH ---
  let adminRefreshInterval = setInterval(() => {
    if (adminToken && mainContent && mainContent.style.display !== 'none') {
      loadStats();
      loadPlayers(currentPage, currentSearch);
    }
  }, 5000);

  document.getElementById('btnManualRefresh')?.addEventListener('click', () => {
    loadStats();
    loadPlayers(currentPage, currentSearch);
  });

  // --- CSV EXPORT ---
  document.getElementById('btnExportTop50')?.addEventListener('click', () => {
    window.location.href = `${API_BASE}/api/admin/export-csv?topN=50&adminToken=${encodeURIComponent(adminToken)}`;
  });

  document.getElementById('btnExportAll')?.addEventListener('click', () => {
    window.location.href = `${API_BASE}/api/admin/export-csv?adminToken=${encodeURIComponent(adminToken)}`;
  });

  // --- GAME CONFIG SETTINGS ---
  async function loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      const data = await res.json();
      if (!res.ok || !data.success) return;

      const s = data.settings;
      if (document.getElementById('cfgEventTitle')) document.getElementById('cfgEventTitle').value = s.event_title || '';
      if (document.getElementById('cfgEventActive')) document.getElementById('cfgEventActive').value = s.event_active || 'true';
      if (document.getElementById('cfgDifficulty')) document.getElementById('cfgDifficulty').value = s.difficulty || 'normal';
      if (document.getElementById('cfgLives')) document.getElementById('cfgLives').value = s.player_lives || '3';
      if (document.getElementById('cfgBaseSpeed')) document.getElementById('cfgBaseSpeed').value = s.base_speed || '6';
      if (document.getElementById('cfgRequirePhone')) document.getElementById('cfgRequirePhone').value = s.require_phone || 'false';
      if (document.getElementById('cfgAnnouncement')) document.getElementById('cfgAnnouncement').value = s.announcement || '';
    } catch (e) {
      console.error(e);
    }
  }

  document.getElementById('adminConfigForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const settings = {
      event_title: document.getElementById('cfgEventTitle').value,
      event_active: document.getElementById('cfgEventActive').value,
      difficulty: document.getElementById('cfgDifficulty')?.value || 'normal',
      player_lives: document.getElementById('cfgLives').value,
      base_speed: document.getElementById('cfgBaseSpeed').value,
      require_phone: document.getElementById('cfgRequirePhone').value,
      announcement: document.getElementById('cfgAnnouncement').value
    };

    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        alert('✅ บันทึกการตั้งค่ากิจกรรมเรียบร้อยแล้ว!\nมีผลกับผู้เล่นทุกคนทันที');
        loadSettings();
      }
    } catch (e) {
      alert('บันทึกการตั้งค่าล้มเหลว');
    }
  });

  // --- RESET LEADERBOARD ---
  document.getElementById('btnResetLeaderboard')?.addEventListener('click', async () => {
    const code = prompt('คำเตือน: การล้าง Leaderboard จะลบสถิติคะแนนทั้งหมดอย่างถาวร!\n\nพิมพ์คำว่า "RESET" เพื่อยืนยัน:');
    if (code !== 'RESET') return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/reset-leaderboard`, {
        method: 'POST',
        headers: { 'X-Admin-Token': adminToken }
      });
      if (res.ok) {
        alert('ล้างตารางอันดับเรียบร้อยแล้ว');
        loadStats();
        loadPlayers();
      }
    } catch (e) {
      alert('Reset failed');
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
});
