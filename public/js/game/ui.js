/**
 * In-Game Canvas HUD for ISUZU RUSH (Rabbit Mascot Edition)
 * Displays Score, Carrots, Distance, Combo, TSH Key Boost, Boss Rush Banner, and Lives.
 */

class GameHUD {
  constructor(canvasWidth, canvasHeight) {
    this.w = canvasWidth;
    this.h = canvasHeight;
    this.safeTop = 0;
  }

  resize(w, h, safeTop = 0) {
    this.w = w;
    this.h = h;
    if (safeTop !== undefined) this.safeTop = safeTop;
  }

  setSafeTop(safeTop) {
    this.safeTop = safeTop || 0;
  }

  render(ctx, {
    score,
    distance,
    carrots,
    combo,
    comboTimer,
    maxComboTimer,
    tshBoostTimer,
    isBossRush,
    lives,
    maxLives,
    isPaused
  }) {
    ctx.save();

    const safeTop = this.safeTop || 0;

    // 1. Top HUD Glass Banner (Seamlessly covers notch/island)
    const bannerH = 50 + safeTop;
    const grad = ctx.createLinearGradient(0, 0, 0, bannerH);
    grad.addColorStop(0, 'rgba(12, 12, 16, 0.95)');
    grad.addColorStop(0.7, 'rgba(16, 16, 22, 0.85)');
    grad.addColorStop(1, 'rgba(16, 16, 22, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, bannerH);

    // 2. Score & Carrot Icon (Top Left)
    ctx.font = "bold 19px 'Kanit', sans-serif";
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`${score}`, 14, safeTop + 28);

    ctx.font = "11px 'Kanit', sans-serif";
    ctx.fillStyle = '#FFA726';
    ctx.fillText(`🥕 ${carrots || 0} ${window.t('score')}`, 14, safeTop + 42);

    // 3. Distance (Center Left)
    ctx.font = "bold 17px 'Kanit', sans-serif";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${Math.floor(distance)} ${window.t('meters')}`, 105, safeTop + 28);

    ctx.font = "11px 'Kanit', sans-serif";
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(window.t('distance'), 105, safeTop + 42);

    // 4. Lives HUD Pill (Positioned below top-right buttons: safeTop + 48, never overlaps sound/pause)
    const heartSpacing = 24;
    const heartSize = 10;
    const heartsWidth = (maxLives - 1) * heartSpacing;
    const badgePadding = 10;
    const badgeW = badgePadding * 2 + 24 + heartsWidth;
    const badgeH = 28;
    const badgeX = this.w - 12 - badgeW;
    const badgeY = safeTop + 48;

    // Dark glass pill container for maximum contrast
    ctx.save();
    ctx.fillStyle = 'rgba(15, 15, 20, 0.85)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // HP label
    ctx.font = "bold 11px 'Kanit', sans-serif";
    ctx.fillStyle = '#FF5252';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('HP', badgeX + badgePadding, badgeY + badgeH / 2);

    // Hearts (glowing filled or outlined empty)
    const heartStartX = badgeX + badgePadding + 26;
    const heartY = badgeY + 8;
    for (let i = 0; i < maxLives; i++) {
      const hx = heartStartX + i * heartSpacing;
      const filled = i < lives;
      this.drawHeart(ctx, hx, heartY, heartSize, filled);
    }
    ctx.restore();

    // 5. Combo Multiplier Badge & Gauge
    if (combo > 1) {
      const comboX = 14;
      const comboY = safeTop + 52;
      const badgeW = 78;
      const badgeH = 22;

      ctx.fillStyle = combo >= 5 ? '#DD0000' : combo >= 3 ? '#FF9100' : '#4A5BB5';
      ctx.beginPath();
      ctx.roundRect(comboX, comboY, badgeW, badgeH, 6);
      ctx.fill();

      ctx.font = "bold 13px 'Kanit', sans-serif";
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`COMBO x${combo}`, comboX + 8, comboY + 16);

      const pct = Math.max(0, comboTimer / maxComboTimer);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(comboX + 4, comboY + badgeH - 4, (badgeW - 8) * pct, 2.5);
    }

    // 6. 2.2 Biturbo Multiplier Boost Indicator
    if (tshBoostTimer > 0) {
      const boostX = combo > 1 ? 98 : 14;
      const boostY = safeTop + 52;
      const pulse = 0.85 + Math.sin(Date.now() * 0.01) * 0.15;
      ctx.fillStyle = `rgba(221, 0, 0, ${pulse})`;
      ctx.beginPath();
      ctx.roundRect(boostX, boostY, 138, 22, 6);
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "bold 11px 'Kanit', sans-serif";
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`⚡ 2.2 BITURBO BOOST x2!`, boostX + 6, boostY + 15);
    }

    // 7. Mini Boss Rush Event Alert (Pulsating Banner)
    if (isBossRush) {
      const pulseAlpha = 0.7 + Math.sin(Date.now() * 0.008) * 0.25;
      ctx.fillStyle = `rgba(221, 0, 0, ${pulseAlpha})`;
      ctx.fillRect(0, safeTop + 80, this.w, 28);

      ctx.font = "bold 14px 'Kanit', sans-serif";
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ SPEED RUSH! หลบสิ่งกีดขวาง 10 วิ! ⚡', this.w / 2, safeTop + 99);
      ctx.textAlign = 'start';
    }

    // 8. Pause Overlay (Canvas backdrop dim; interactive buttons rendered in #pauseModal)
    if (isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, this.w, this.h);
    }

    ctx.restore();
  }

  drawHeart(ctx, x, y, size, filled) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - size / 2, y - size / 2, x - size, y + size / 3, x, y + size);
    ctx.bezierCurveTo(x + size, y + size / 3, x + size / 2, y - size / 2, x, y);

    if (filled) {
      // Vibrant glowing red gradient
      const grad = ctx.createLinearGradient(x, y - size / 2, x, y + size);
      grad.addColorStop(0, '#FF4D4D');
      grad.addColorStop(1, '#D50000');
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(255, 30, 70, 0.65)';
      ctx.shadowBlur = 8;
      ctx.fill();

      // White glossy highlight reflection on top-left curve
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(x - size * 0.35, y + size * 0.05, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Empty / Lost heart: Dark slate with crisp light-gray outline
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(35, 35, 45, 0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 200, 215, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}

window.GameHUD = GameHUD;
