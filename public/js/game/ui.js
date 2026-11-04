/**
 * In-Game Canvas HUD for ISUZU RUSH (Rabbit Mascot Edition)
 * Displays Score, Carrots, Distance, Combo, TSH Key Boost, Boss Rush Banner, and Lives.
 */

class GameHUD {
  constructor(canvasWidth, canvasHeight) {
    this.w = canvasWidth;
    this.h = canvasHeight;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
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

    // 1. Top HUD Glass Banner
    const bannerH = 52;
    const grad = ctx.createLinearGradient(0, 0, 0, bannerH);
    grad.addColorStop(0, 'rgba(18, 18, 22, 0.95)');
    grad.addColorStop(1, 'rgba(18, 18, 22, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, bannerH);

    // 2. Score & Carrot Icon (Top Left)
    ctx.font = "bold 20px 'Kanit', sans-serif";
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`${score}`, 16, 32);

    ctx.font = "11px 'Kanit', sans-serif";
    ctx.fillStyle = '#FFA726';
    ctx.fillText(`🥕 ${carrots || 0} ${window.t('score')}`, 16, 45);

    // 3. Distance (Center Left)
    ctx.font = "bold 18px 'Kanit', sans-serif";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${Math.floor(distance)} ${window.t('meters')}`, 115, 32);

    ctx.font = "11px 'Kanit', sans-serif";
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(window.t('distance'), 115, 45);

    // 4. Lives (Hearts - Center Right)
    const heartStartX = this.w - 120;
    for (let i = 0; i < maxLives; i++) {
      const hx = heartStartX + i * 22;
      const hy = 24;
      const filled = i < lives;
      this.drawHeart(ctx, hx, hy, 8, filled ? '#DD0000' : '#444444');
    }

    // 5. Combo Multiplier Badge & Gauge
    if (combo > 1) {
      const comboX = 16;
      const comboY = 64;
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

    // 6. TSH Key 2X Multiplier Boost Indicator
    if (tshBoostTimer > 0) {
      const boostX = 100;
      const boostY = 64;
      ctx.fillStyle = '#FFB300';
      ctx.beginPath();
      ctx.roundRect(boostX, boostY, 110, 22, 6);
      ctx.fill();

      ctx.font = "bold 12px 'Kanit', sans-serif";
      ctx.fillStyle = '#1A1A1A';
      ctx.fillText(`🔑 TSH BOOST x2!`, boostX + 8, boostY + 16);
    }

    // 7. Mini Boss Rush Event Alert (Pulsating Banner)
    if (isBossRush) {
      const pulseAlpha = 0.7 + Math.sin(Date.now() * 0.008) * 0.25;
      ctx.fillStyle = `rgba(221, 0, 0, ${pulseAlpha})`;
      ctx.fillRect(0, 92, this.w, 28);

      ctx.font = "bold 14px 'Kanit', sans-serif";
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ SPEED RUSH! หลบสิ่งกีดขวาง 10 วิ! ⚡', this.w / 2, 111);
      ctx.textAlign = 'start';
    }

    // 8. Pause Overlay
    if (isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, this.w, this.h);

      ctx.textAlign = 'center';
      ctx.font = "bold 32px 'Kanit', sans-serif";
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(window.t('paused'), this.w / 2, this.h / 2 - 20);

      ctx.font = "16px 'Kanit', sans-serif";
      ctx.fillStyle = '#CCCCCC';
      ctx.fillText(window.t('btnResume'), this.w / 2, this.h / 2 + 25);
      ctx.textAlign = 'start';
    }

    ctx.restore();
  }

  drawHeart(ctx, x, y, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - size / 2, y - size / 2, x - size, y + size / 3, x, y + size);
    ctx.bezierCurveTo(x + size, y + size / 3, x + size / 2, y - size / 2, x, y);
    ctx.fill();
    ctx.restore();
  }
}

window.GameHUD = GameHUD;
