/**
 * Parallax Background & Biome Crossfade System for ISUZU RUSH
 * - Biome transitions every 350 distance units (City -> Countryside -> Mountain -> Night -> loop)
 * - Smooth 1.0-second crossfade transition between environments
 * - Delta-time framerate-independent parallax scrolling
 */

class BackgroundManager {
  constructor(canvasWidth, canvasHeight, roadY, gameConfig) {
    this.w = canvasWidth;
    this.h = canvasHeight;
    this.roadY = roadY;
    this.gameConfig = gameConfig || window.GAME_CONFIG || {};

    // Scroll offsets
    this.layer1Offset = 0; // Far sky / distant mountains
    this.layer2Offset = 0; // Mid hills / buildings
    this.layer3Offset = 0; // Near trees / street poles
    this.roadOffset = 0;   // Road markings

    // Biome states: 0: City, 1: Countryside, 2: Mountain, 3: Night
    this.currentBiome = 0;
    this.prevBiome = 0;
    this.fadeTimer = 0;
    this.fadeDuration = 1.0; // 1 second smooth crossfade
  }

  resize(w, h, roadY) {
    this.w = w;
    this.h = h;
    this.roadY = roadY;
  }

  update(dt, speed, distance) {
    // 1. Framerate-independent parallax layer scrolling
    const scrollFactor = dt * 60;
    this.layer1Offset = (this.layer1Offset + (speed * 0.08 / 6) * scrollFactor) % this.w;
    this.layer2Offset = (this.layer2Offset + (speed * 0.25 / 6) * scrollFactor) % this.w;
    this.layer3Offset = (this.layer3Offset + (speed * 0.55 / 6) * scrollFactor) % this.w;
    this.roadOffset = (this.roadOffset + (speed * 0.85 / 6) * scrollFactor) % 40;

    // 2. Biome determination: Every 350 distance units, cycle 0 -> 1 -> 2 -> 3 -> loop
    const transitionDist = this.gameConfig.biome?.transitionDistance || 350;
    const targetBiome = Math.floor(distance / transitionDist) % 4;

    if (targetBiome !== this.currentBiome) {
      this.prevBiome = this.currentBiome;
      this.currentBiome = targetBiome;
      this.fadeTimer = this.fadeDuration;
    }

    if (this.fadeTimer > 0) {
      this.fadeTimer = Math.max(0, this.fadeTimer - dt);
    }
  }

  render(ctx) {
    if (this.fadeTimer > 0) {
      // Cross-fade rendering: prevBiome fading out, currentBiome fading in
      const progress = 1 - (this.fadeTimer / this.fadeDuration);

      // Draw Previous Biome
      ctx.save();
      this.renderFullEnvironment(ctx, this.prevBiome);
      ctx.restore();

      // Overlay Current Biome with smooth alpha
      ctx.save();
      ctx.globalAlpha = progress;
      this.renderFullEnvironment(ctx, this.currentBiome);
      ctx.restore();
    } else {
      // Normal single biome rendering
      this.renderFullEnvironment(ctx, this.currentBiome);
    }

    // Always render road on top
    this.renderRoad(ctx);
  }

  renderFullEnvironment(ctx, biome) {
    this.renderSky(ctx, biome);
    this.renderFarLayer(ctx, biome);
    this.renderMidLayer(ctx, biome);
    this.renderNearLayer(ctx, biome);
  }

  renderSky(ctx, biome) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.roadY);

    if (biome === 0) {
      // 1. City: Modern crisp blue
      grad.addColorStop(0, '#74B9FF');
      grad.addColorStop(1, '#DFE6E9');
    } else if (biome === 1) {
      // 2. Countryside: Bright sunny sky
      grad.addColorStop(0, '#55EFC4');
      grad.addColorStop(0.5, '#81ECEC');
      grad.addColorStop(1, '#FFEAA7');
    } else if (biome === 2) {
      // 3. Mountain: Sunset Canyon glow
      grad.addColorStop(0, '#E17055');
      grad.addColorStop(0.5, '#FAB1A0');
      grad.addColorStop(1, '#FFEAA7');
    } else {
      // 4. Night: Midnight Navy / Neon
      grad.addColorStop(0, '#0F0C29');
      grad.addColorStop(0.6, '#302B63');
      grad.addColorStop(1, '#24243E');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.roadY);

    // Sun / Moon
    ctx.save();
    if (biome === 3) {
      ctx.fillStyle = '#FFFDE7';
      ctx.shadowColor = '#FFEB3B';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(this.w - 75, 68, 24, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#FFF9C4';
      ctx.shadowColor = '#FFF59D';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(this.w - 70, 58, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderFarLayer(ctx, biome) {
    ctx.save();
    const baseY = this.roadY - 70;

    if (biome === 0) {
      // City buildings
      ctx.fillStyle = '#B2BEC3';
      for (let i = -1; i <= Math.ceil(this.w / 60) + 1; i++) {
        const x = i * 60 - this.layer1Offset * 0.5;
        const h = 50 + ((i * 37) % 40);
        ctx.fillRect(x, baseY - h + 70, 52, h);
      }
    } else if (biome === 1) {
      // Green rolling hills
      ctx.fillStyle = '#A8E6CF';
      for (let i = -1; i <= Math.ceil(this.w / 120) + 1; i++) {
        const x = i * 120 - this.layer1Offset * 0.4;
        ctx.beginPath();
        ctx.arc(x + 60, baseY + 60, 90, Math.PI, 0);
        ctx.fill();
      }
    } else if (biome === 2) {
      // Mountains
      ctx.fillStyle = '#B0886C';
      for (let i = -1; i <= Math.ceil(this.w / 100) + 1; i++) {
        const x = i * 100 - this.layer1Offset * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, baseY + 70);
        ctx.lineTo(x + 50, baseY - 60 + ((i * 23) % 40));
        ctx.lineTo(x + 100, baseY + 70);
        ctx.fill();
      }
    } else {
      // Night skyline
      ctx.fillStyle = '#1E1E2F';
      for (let i = -1; i <= Math.ceil(this.w / 50) + 1; i++) {
        const x = i * 50 - this.layer1Offset * 0.4;
        const h = 60 + ((i * 43) % 55);
        ctx.fillRect(x, baseY - h + 70, 44, h);
        ctx.fillStyle = '#FFD54F';
        if (i % 2 === 0) ctx.fillRect(x + 10, baseY - h + 85, 4, 6);
        if (i % 3 === 0) ctx.fillRect(x + 26, baseY - h + 95, 4, 6);
        ctx.fillStyle = '#1E1E2F';
      }
    }
    ctx.restore();
  }

  renderMidLayer(ctx, biome) {
    ctx.save();
    const baseY = this.roadY;

    if (biome === 0) {
      ctx.fillStyle = '#636E72';
      for (let i = -1; i <= Math.ceil(this.w / 70) + 1; i++) {
        const x = i * 70 - this.layer2Offset;
        const h = 40 + ((i * 29) % 35);
        ctx.fillRect(x, baseY - h, 60, h);
      }
    } else if (biome === 1) {
      for (let i = -1; i <= Math.ceil(this.w / 60) + 1; i++) {
        const x = i * 60 - this.layer2Offset;
        ctx.fillStyle = '#795548';
        ctx.fillRect(x + 18, baseY - 18, 6, 18);
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(x + 21, baseY - 24, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (biome === 2) {
      ctx.fillStyle = '#8D6E63';
      for (let i = -1; i <= Math.ceil(this.w / 80) + 1; i++) {
        const x = i * 80 - this.layer2Offset;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x + 15, baseY - 35);
        ctx.lineTo(x + 65, baseY - 35);
        ctx.lineTo(x + 80, baseY);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#2C2C54';
      for (let i = -1; i <= Math.ceil(this.w / 65) + 1; i++) {
        const x = i * 65 - this.layer2Offset;
        const h = 45 + ((i * 19) % 40);
        ctx.fillRect(x, baseY - h, 55, h);
        ctx.strokeStyle = i % 2 === 0 ? '#DD0000' : '#4A5BB5';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, baseY - h, 55, h);
      }
    }
    ctx.restore();
  }

  renderNearLayer(ctx, biome) {
    ctx.save();
    const baseY = this.roadY;
    const spacing = 180;

    for (let i = -1; i <= Math.ceil(this.w / spacing) + 1; i++) {
      const x = i * spacing - this.layer3Offset;
      ctx.strokeStyle = '#2D3436';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY - 65);
      ctx.lineTo(x + 16, baseY - 70);
      ctx.stroke();

      ctx.fillStyle = biome === 3 ? '#FFEAA7' : '#DFE6E9';
      ctx.beginPath();
      ctx.arc(x + 16, baseY - 70, 4, 0, Math.PI * 2);
      ctx.fill();

      if (biome === 3) {
        ctx.fillStyle = 'rgba(255, 234, 167, 0.08)';
        ctx.beginPath();
        ctx.moveTo(x + 16, baseY - 70);
        ctx.lineTo(x - 20, baseY);
        ctx.lineTo(x + 50, baseY);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  renderRoad(ctx) {
    ctx.save();
    const roadH = this.h - this.roadY;

    // Red & white racing curb
    ctx.fillStyle = '#DD0000';
    ctx.fillRect(0, this.roadY - 6, this.w, 6);
    ctx.fillStyle = '#FFFFFF';
    for (let i = -1; i <= Math.ceil(this.w / 30) + 1; i++) {
      const x = i * 30 - this.roadOffset;
      if (i % 2 === 0) {
        ctx.fillRect(x, this.roadY - 6, 15, 6);
      }
    }

    // Asphalt surface
    const asphaltGrad = ctx.createLinearGradient(0, this.roadY, 0, this.h);
    asphaltGrad.addColorStop(0, '#2C3E50');
    asphaltGrad.addColorStop(1, '#1A1A1A');
    ctx.fillStyle = asphaltGrad;
    ctx.fillRect(0, this.roadY, this.w, roadH);

    // Yellow dashed lane lines
    ctx.fillStyle = '#F1C40F';
    const dashY = this.roadY + roadH * 0.45;
    for (let i = -1; i <= Math.ceil(this.w / 40) + 1; i++) {
      const x = i * 40 - this.roadOffset;
      ctx.fillRect(x, dashY, 22, 4);
    }

    // Bottom solid white line
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, this.h - 8, this.w, 4);

    ctx.restore();
  }
}

window.BackgroundManager = BackgroundManager;
