/**
 * Core 2D Endless Runner Engine for ISUZU RUSH (Rabbit Mascot Edition)
 * Pure Delta-Time Framerate Independent Engine with Smooth Acceleration & Balancing:
 * - speedStart: 210 px/s, speedMax: 620 px/s, acceleration: 2.5 px/s^2 (linear, reaches max in ~2.7 mins)
 * - distance = accumulated from (speed * dt / 40)
 * - Interactive Debug HUD (?debug=1) showing live speeds, spawn intervals, airtime, and presets
 */

class RunnerGame {
  constructor(canvas, audio, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.onGameOver = onGameOver;
    this.assetsConfig = window.ASSETS_CONFIG || {};
    this.gameConfig = window.GAME_CONFIG || {};

    this.virtualWidth = 360;
    this.virtualHeight = 640;
    this.roadY = 520;

    this.state = 'idle';

    // Difficulty Preset
    const preset = this.gameConfig.getCurrentPreset();
    this.speedStart = preset.speedStart;
    this.speedMax = preset.speedMax;
    this.acceleration = preset.acceleration;
    this.currentSpeed = this.speedStart;

    // Subsystems
    this.background = new BackgroundManager(this.virtualWidth, this.virtualHeight, this.roadY, this.gameConfig);
    this.player = new RabbitPlayer(45, this.roadY, this.audio, this.assetsConfig, this.gameConfig);
    this.obstacles = new ObstacleManager(this.virtualWidth, this.roadY, this.assetsConfig, this.gameConfig);
    this.items = new ItemManager(this.virtualWidth, this.roadY, this.audio, this.assetsConfig, this.gameConfig);
    this.hud = new GameHUD(this.virtualWidth, this.virtualHeight);

    // Gameplay stats
    this.score = 0;
    this.distance = 0;
    this.carrots = 0;
    this.tickets = 0;
    this.tshKeys = 0;
    this.combo = 1;
    this.maxComboReached = 1;
    this.comboTimer = 0;
    this.maxComboTimer = 3.0; // 3 seconds
    this.tshBoostTimer = 0;   // 5 seconds
    this.elapsedTime = 0;
    this.playTimeSec = 0;
    this.startTime = 0;
    this.playerLives = this.assetsConfig.gameplay?.startingLives || 3;
    this.onPauseStateChange = null;

    // Input state
    this.isPressing = false;
    this.animFrameId = null;

    // FPS measurement for debug HUD
    this.fps = 60;
    this.fpsCount = 0;
    this.fpsTimer = 0;

    this.bindInputs();
    this.setupResize();
  }

  setupResize() {
    const handleResize = () => {
      const parent = this.canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : this.canvas.getBoundingClientRect();
      const clientW = Math.max(320, rect.width || window.innerWidth);
      const clientH = Math.max(480, rect.height || window.innerHeight);

      // Measure safe area top on device (iOS notch/dynamic island, Android punch-hole)
      let safeTop = 0;
      if (typeof window !== 'undefined' && document.body) {
        const testDiv = document.createElement('div');
        testDiv.style.cssText = 'position:fixed;top:0;left:0;height:env(safe-area-inset-top, 0px);visibility:hidden;pointer-events:none;z-index:-1;';
        document.body.appendChild(testDiv);
        const rawSafeTop = testDiv.offsetHeight || 0;
        document.body.removeChild(testDiv);
        safeTop = Math.round(rawSafeTop * (360 / clientW));
      }

      // Responsive aspect ratio: Fixed 360 width, scale virtualHeight to exact screen ratio
      this.virtualWidth = 360;
      const targetAspect = clientH / clientW;
      this.virtualHeight = Math.max(540, Math.round(360 * targetAspect));
      this.roadY = this.virtualHeight - 120;

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.canvas.width = Math.round(this.virtualWidth * dpr);
      this.canvas.height = Math.round(this.virtualHeight * dpr);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);

      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';

      // Propagate resize to all subsystems
      if (this.background) this.background.resize(this.virtualWidth, this.virtualHeight, this.roadY);
      if (this.player) this.player.resize(this.roadY);
      if (this.obstacles) this.obstacles.resize(this.virtualWidth, this.roadY);
      if (this.items) this.items.resize(this.virtualWidth, this.roadY);
      if (this.hud) this.hud.resize(this.virtualWidth, this.virtualHeight, safeTop);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 150);
    });
    handleResize();
  }

  bindInputs() {
    let lastTouchStartTime = 0;

    const triggerJumpStart = (e) => {
      if (this.state !== 'playing') return;
      if (e) {
        if (e.target && e.target.closest && e.target.closest('.btn-ingame') || e.target.closest('.pause-modal-overlay')) return;
        if (e.cancelable) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }

      // Debounce micro touch bounces (< 45ms)
      const now = performance.now();
      if (now - lastTouchStartTime < 45) return;
      lastTouchStartTime = now;

      this.isPressing = true;
      this.player.startJump();
    };

    const triggerJumpEnd = (e) => {
      if (e) {
        if (e.cancelable) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
      this.isPressing = false;
      this.player.releaseJump();
    };

    // Attach to canvas exclusively with stopPropagation to ensure single, crisp tap delivery
    this.canvas.addEventListener('touchstart', triggerJumpStart, { passive: false });
    this.canvas.addEventListener('touchend', triggerJumpEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', triggerJumpEnd, { passive: false });

    this.canvas.addEventListener('mousedown', triggerJumpStart);
    this.canvas.addEventListener('mouseup', triggerJumpEnd);

    // Keyboard support
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'playing' || this.state === 'paused') {
          e.preventDefault();
          this.togglePause();
          return;
        }
      }

      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (this.state === 'playing') {
          e.preventDefault();
          if (!e.repeat) triggerJumpStart();
        }
      }

      // Debug mode hotkeys to switch difficulty presets live on screen
      if (this.gameConfig.debug?.enabled) {
        const key = e.key.toLowerCase();
        if (key === 'e' || key === 'n' || key === 'h') {
          const diffMap = { e: 'easy', n: 'normal', h: 'hard' };
          const newDiff = diffMap[key];
          this.gameConfig.setDifficulty(newDiff);
          const p = this.gameConfig.getCurrentPreset();
          this.speedStart = p.speedStart;
          this.speedMax = p.speedMax;
          this.acceleration = p.acceleration;
          this.currentSpeed = Math.min(this.speedMax, Math.max(this.speedStart, this.currentSpeed));
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (this.state === 'playing') {
          e.preventDefault();
          triggerJumpEnd();
        }
      }
    });
  }

  start(customConfig = {}) {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    // Refresh active preset
    const preset = this.gameConfig.getCurrentPreset();
    this.speedStart = customConfig.speedStart || preset.speedStart;
    this.speedMax = customConfig.speedMax || preset.speedMax;
    this.acceleration = customConfig.acceleration || preset.acceleration;
    this.currentSpeed = this.speedStart;
    this.playerLives = customConfig.playerLives || this.assetsConfig.gameplay?.startingLives || 3;

    this.score = 0;
    this.distance = 0;
    this.carrots = 0;
    this.tickets = 0;
    this.tshKeys = 0;
    this.combo = 1;
    this.maxComboReached = 1;
    this.comboTimer = 0;
    this.tshBoostTimer = 0;
    this.elapsedTime = 0;
    this.startTime = Date.now();
    this.playTimeSec = 0;

    this.player.reset(this.roadY, this.playerLives);
    this.obstacles.reset();
    this.items.reset();

    this.state = 'playing';
    this.audio.unlock();
    this.audio.startBGM();

    this.lastTime = performance.now();
    this.loop();
  }

  pause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.audio.stopBGM();
      if (this.onPauseStateChange) this.onPauseStateChange(true);
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.audio.startBGM();
      this.lastTime = performance.now();
      if (this.onPauseStateChange) this.onPauseStateChange(false);
    }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.pause();
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  stop() {
    this.state = 'stopped';
    this.audio.stopBGM();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.onPauseStateChange) this.onPauseStateChange(false);
  }

  gameOver() {
    this.state = 'gameover';
    this.audio.stopBGM();
    this.audio.playGameOver();

    this.playTimeSec = Math.max(1, Math.floor(this.elapsedTime));

    if (this.onGameOver) {
      this.onGameOver({
        score: this.score,
        distance: Math.floor(this.distance),
        carrots: this.carrots,
        tickets: this.tickets,
        tshKeys: this.tshKeys,
        maxCombo: this.maxComboReached,
        playTimeSec: this.playTimeSec
      });
    }
  }

  loop() {
    if (this.state !== 'playing' && this.state !== 'paused') {
      return;
    }

    const now = performance.now();
    // Delta time clamped between 1ms and 50ms to prevent spiral-of-death on background tab
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    // FPS calculation
    this.fpsCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsCount / this.fpsTimer);
      this.fpsCount = 0;
      this.fpsTimer = 0;
    }

    if (this.state === 'playing') {
      this.update(dt);
    }

    this.render();

    this.animFrameId = requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    this.elapsedTime += dt;

    // 1. Hold jump check
    if (this.isPressing) {
      this.player.holdJump();
    }

    // 2. Continuous linear speed acceleration (speedStart -> speedMax)
    this.currentSpeed = Math.min(this.speedMax, this.currentSpeed + this.acceleration * dt);

    // 3. Distance: accumulated strictly from (speed * dt / 40)
    const distanceDelta = (this.currentSpeed * dt) / 40;
    this.distance += distanceDelta;

    // Distance points
    const boostMultiplier = this.tshBoostTimer > 0 ? 2 : 1;
    this.score += Math.round(distanceDelta * 4 * boostMultiplier);

    // 4. Update Subsystems
    this.background.update(dt, this.currentSpeed, this.distance);
    this.player.update(dt, this.currentSpeed);

    // Obstacles update with Boss Rush Clear handler
    this.obstacles.update(dt, this.currentSpeed, this.distance, () => {
      const bonus = 250 * this.combo * boostMultiplier;
      this.score += bonus;
      this.items.addFloatingText(`RUSH CLEAR! +${bonus}`, this.virtualWidth / 2, 160, '#FFD700', 24);
      this.player.triggerCheer('สุดยอด! ผ่านช่วงยากแล้ว!', 2.5);
    });

    this.items.update(dt, this.currentSpeed);

    // 5. Collision Check
    const playerHitbox = this.player.getHitbox();
    if (this.obstacles.checkCollision(playerHitbox)) {
      const damaged = this.player.takeDamage();
      if (damaged) {
        this.combo = 1;
        this.comboTimer = 0;
        this.items.addFloatingText('ชนแล้ว!', this.player.x + 30, this.player.y + 10, '#FF1744', 20);

        if (this.player.lives <= 0) {
          this.gameOver();
          return;
        }
      }
    }

    // 6. Item Pickups (Generous collection hitbox + magnetic pull for smooth jump collection)
    const itemHitbox = this.player.getItemHitbox ? this.player.getItemHitbox() : playerHitbox;
    this.items.checkCollection(itemHitbox, this.player, (type, pts, x, y) => {
      const activeMultiplier = this.combo * (this.tshBoostTimer > 0 ? 2 : 1);

      if (type === 'carrot') {
        this.carrots++;
        const added = pts * activeMultiplier;
        this.score += added;
        this.items.addFloatingText(`+${added}`, x, y, '#FFA726', 17);

        // Combo increment
        this.comboTimer = this.maxComboTimer;
        if (this.carrots % 5 === 0) {
          if (this.combo < 5) {
            this.combo = this.combo === 1 ? 2 : this.combo === 2 ? 3 : 5;
            this.maxComboReached = Math.max(this.maxComboReached, this.combo);
            this.items.addFloatingText(`COMBO x${this.combo}!`, this.player.x + 10, this.player.y - 15, '#DD0000', 22);
            this.player.triggerCheer(`คอมโบ x${this.combo}!`, 1.8);
          }
        }
      } else if (type === 'ticket') {
        this.tickets++;
        const added = pts * activeMultiplier;
        this.score += added;
        this.items.addFloatingText(`VIP +${added}!`, x, y, '#00B0FF', 22);
      } else if (type === 'keyTsh') {
        this.tshKeys++;
        const added = pts * activeMultiplier;
        this.score += added;
        this.tshBoostTimer = 5.0; // 5.0 seconds
        this.items.addFloatingText(`KEY BOOST x2! +${added}`, x, y, '#FFD700', 24);
        this.player.triggerCheer('ได้กุญแจ TSH แล้ว ลุยยย!', 2.2);
      } else if (type === 'charger') {
        this.player.heal();
        this.items.addFloatingText('+LIFE ฟื้นพลัง!', x, y, '#00E676', 22);
      }
    });

    // 7. Combo & Boost Decay Timers in Seconds
    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    if (this.tshBoostTimer > 0) {
      this.tshBoostTimer = Math.max(0, this.tshBoostTimer - dt);
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

    // 1. World
    this.background.render(this.ctx);

    // 2. Obstacles & Items
    this.obstacles.render(this.ctx);
    this.items.render(this.ctx);

    // 3. Rabbit Mascot Player
    this.player.render(this.ctx);

    // 4. In-Game HUD
    this.hud.render(this.ctx, {
      score: this.score,
      distance: this.distance,
      carrots: this.carrots,
      combo: this.combo,
      comboTimer: this.comboTimer,
      maxComboTimer: this.maxComboTimer,
      tshBoostTimer: this.tshBoostTimer,
      isBossRush: this.obstacles.isBossRush,
      lives: this.player.lives,
      maxLives: this.player.maxLives,
      isPaused: this.state === 'paused'
    });

    // 5. Debug Mode Overlay (?debug=1)
    if (this.gameConfig.debug?.enabled) {
      this.renderDebugOverlay();
    }
  }

  renderDebugOverlay() {
    const ctx = this.ctx;
    ctx.save();

    const boxW = 270;
    const boxH = 175;
    const boxX = 10;
    const boxY = 60;

    // Dark semi-transparent box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 11px monospace";
    ctx.fillStyle = '#00E5FF';
    ctx.fillText(`🔧 DEBUG MODE [?debug=1] | FPS: ${this.fps}`, boxX + 10, boxY + 18);

    ctx.font = "11px monospace";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`Difficulty: ${this.gameConfig.activeDifficulty.toUpperCase()} (preset)`, boxX + 10, boxY + 34);
    ctx.fillText(`Speed: ${this.currentSpeed.toFixed(1)} / ${this.speedMax} px/s`, boxX + 10, boxY + 50);
    ctx.fillText(`Accel: +${this.acceleration} px/s² | Time: ${this.elapsedTime.toFixed(1)}s`, boxX + 10, boxY + 66);
    ctx.fillText(`Distance: ${this.distance.toFixed(1)} m`, boxX + 10, boxY + 82);

    // Next obstacle spawn info
    const nextSpawn = Math.max(0, this.obstacles.spawnTimer).toFixed(2);
    ctx.fillText(`Next Obstacle In: ${nextSpawn}s`, boxX + 10, boxY + 98);

    // Airtime & jump clearance check
    const clearance = Math.round(this.currentSpeed * 0.73);
    const maxObsWidth = 105; // Isuzu Truck obstacle
    const isSafe = clearance > maxObsWidth + 40;
    ctx.fillStyle = isSafe ? '#00E676' : '#FF5252';
    ctx.fillText(`Jump Distance: ${clearance}px (Truck: ${maxObsWidth}px) ${isSafe ? '✓ OK' : '! TIGHT'}`, boxX + 10, boxY + 114);

    // Biome status
    ctx.fillStyle = '#FFA726';
    const biomes = ['City', 'Countryside', 'Mountain', 'Night'];
    const bName = biomes[this.background.currentBiome] || 'City';
    const nextDist = 350 - (Math.floor(this.distance) % 350);
    ctx.fillText(`Biome: ${bName} (Next in: ${nextDist}m)`, boxX + 10, boxY + 130);

    // Interactive preset hints
    ctx.fillStyle = '#B0BEC5';
    ctx.fillText(`Presets: [E]asy [N]ormal [H]ard`, boxX + 10, boxY + 148);

    ctx.restore();
  }
}

window.RunnerGame = RunnerGame;
