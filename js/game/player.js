/**
 * ISUZU Trusted Buddy (TSH) - Rabbit Mascot Player Controller
 * 100% Delta-Time Framerate Independent Physics:
 * - gravity: 2400 px/s^2
 * - jumpVelocity: -880 px/s (upward)
 * - hold-jump reduces gravity by 45% (effective: 1320 px/s^2) for ~0.73 - 0.90s air time
 * - double jump support
 * - fair hitbox (~65% of torso, ears excluded)
 * - cheer bubbles & footstep dust
 */

class RabbitPlayer {
  constructor(x, roadY, audio, assetsConfig, gameConfig) {
    this.x = x;
    this.audio = audio;
    this.assetsConfig = assetsConfig || window.ASSETS_CONFIG || {};
    this.gameConfig = gameConfig || window.GAME_CONFIG || {};

    // Sizing: ~18% of screen height (approx 115px height on 640px virtual canvas)
    this.height = 114;
    this.width = 82;
    this.baseY = roadY - this.height + 6;
    this.y = this.baseY;

    // Physics parameters from config
    const phys = this.gameConfig.physics || {};
    this.baseGravity = phys.gravity || 2400;
    this.jumpVelocity = phys.jumpVelocity || -880;
    this.jumpHoldGravityReduction = phys.jumpHoldGravityReduction || 0.45;
    this.maxJumpHoldDuration = phys.maxJumpHoldDurationSec || 0.28;
    this.doubleJumpEnabled = phys.doubleJumpEnabled ?? true;
    this.doubleJumpVelocity = phys.doubleJumpVelocity || -780;

    // Live physics state
    this.vy = 0;
    this.isGrounded = true;
    this.isJumping = false;
    this.isHoldingJump = false;
    this.jumpHoldTimer = 0;
    this.jumpsRemaining = 2;

    // Air time measurement (for debug stats)
    this.lastAirTime = 0;
    this.currentAirTimer = 0;

    // Visuals & Squash / Stretch
    this.scaleX = 1;
    this.scaleY = 1;
    this.tiltAngle = 0.08;
    this.bobTimer = 0;
    this.runFrameIdx = 0;
    this.runFrameTimeAcc = 0;

    // Speech bubble
    this.speechText = '';
    this.speechTimer = 0;
    this.speechCooldown = 3.0; // 3 seconds after start

    // Lives & Invulnerability
    this.maxLives = 3;
    this.lives = 3;
    this.invulnerableTimer = 0;
    this.invulnerableDuration = 1.5; // 1.5s
    this.shakeOffsetX = 0;

    // Particles
    this.dustParticles = [];

    this.loadImages();
  }

  loadImages() {
    this.imgIdle = new Image();
    this.imgIdle.src = this.assetsConfig.rabbit?.idleSvg || './assets/characters/rabbit_idle.svg';

    this.imgThumbsUp = new Image();
    this.imgThumbsUp.src = this.assetsConfig.rabbit?.thumbsUpSvg || './assets/characters/rabbit_thumbsup.svg';

    this.imgCheer = new Image();
    this.imgCheer.src = this.assetsConfig.rabbit?.cheerSvg || './assets/characters/rabbit_cheer.svg';

    this.runFrames = (this.assetsConfig.rabbit?.runFrames || []).map(src => {
      const img = new Image();
      img.src = src;
      return img;
    });

    const checkUserPng = new Image();
    checkUserPng.onload = () => {
      this.imgIdle = checkUserPng;
    };
    checkUserPng.src = this.assetsConfig.rabbit?.idle || './assets/characters/rabbit_idle.png';
  }

  reset(roadY, startingLives = 3) {
    this.baseY = roadY - this.height + 6;
    this.y = this.baseY;
    this.vy = 0;
    this.isGrounded = true;
    this.isJumping = false;
    this.isHoldingJump = false;
    this.jumpHoldTimer = 0;
    this.jumpsRemaining = 2;
    this.maxLives = startingLives;
    this.lives = startingLives;
    this.invulnerableTimer = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.speechText = '';
    this.speechTimer = 0;
    this.speechCooldown = 3.5;
    this.dustParticles = [];
    this.currentAirTimer = 0;
  }

  startJump() {
    this.isHoldingJump = true;

    if (this.isGrounded) {
      // First Jump
      this.vy = this.jumpVelocity;
      this.isGrounded = false;
      this.isJumping = true;
      this.jumpsRemaining = 1;
      this.jumpHoldTimer = this.maxJumpHoldDuration;
      this.currentAirTimer = 0;

      // Upward vertical stretch
      this.scaleX = 0.85;
      this.scaleY = 1.25;

      this.audio.playJump();
      this.createDustBurst(this.x + this.width / 2, this.baseY + this.height - 4, 8);
    } else if (this.doubleJumpEnabled && this.jumpsRemaining > 0) {
      // Double Jump
      this.vy = this.doubleJumpVelocity;
      this.jumpsRemaining = 0;
      this.jumpHoldTimer = this.maxJumpHoldDuration * 0.7;

      this.scaleX = 0.82;
      this.scaleY = 1.28;

      this.audio.playJump();
      this.createDustBurst(this.x + this.width / 2, this.y + this.height - 10, 10, '#4A5BB5');
      this.triggerCheer('ดับเบิ้ลจัมป์!');
    }
  }

  holdJump() {
    this.isHoldingJump = true;
  }

  releaseJump() {
    this.isHoldingJump = false;
    this.jumpHoldTimer = 0;
  }

  takeDamage() {
    if (this.invulnerableTimer > 0) return false;

    this.lives--;
    this.invulnerableTimer = this.invulnerableDuration;
    this.audio.playHit();

    this.scaleX = 1.2;
    this.scaleY = 0.8;
    this.triggerCheer('โอ๊ะ! ระวังหน่อย', 1.5);
    this.createDustBurst(this.x + this.width / 2, this.y + this.height / 2, 14, '#FF5252');

    return true;
  }

  heal() {
    if (this.lives < this.maxLives) {
      this.lives++;
    }
    this.audio.playFuel();
    this.triggerCheer('พลังเต็มเปี่ยม!', 1.8);
  }

  triggerCheer(text = null, durationSec = 2.0) {
    if (text) {
      this.speechText = text;
    } else {
      const cheers = this.assetsConfig.cheers || ['ไปต่อเลย!', 'เก่งมาก!', 'ระวังข้างหน้า!'];
      this.speechText = cheers[Math.floor(Math.random() * cheers.length)];
    }
    this.speechTimer = durationSec;
  }

  update(dt, speed) {
    // 1. Spring return for Squash & Stretch
    const springSpeed = 10;
    this.scaleX += (1 - this.scaleX) * Math.min(1, springSpeed * dt);
    this.scaleY += (1 - this.scaleY) * Math.min(1, springSpeed * dt);

    // 2. Air Physics & Delta-Time Kinematics
    if (!this.isGrounded) {
      this.currentAirTimer += dt;

      // Effective gravity: reduced by 45% while holding jump and ascending
      let effectiveGravity = this.baseGravity;
      if (this.isHoldingJump && this.vy < 0 && this.jumpHoldTimer > 0) {
        effectiveGravity = this.baseGravity * (1 - this.jumpHoldGravityReduction);
        this.jumpHoldTimer -= dt;
      }

      this.vy += effectiveGravity * dt;
      this.y += this.vy * dt;

      // Dynamic tilt based on vertical velocity
      if (this.vy < 0) {
        this.tiltAngle = -0.12; // Tilts up on ascent
      } else {
        this.tiltAngle = 0.10;  // Prepares feet on descent
      }

      // Check ground collision
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.vy = 0;
        this.isGrounded = true;
        this.isJumping = false;
        this.isHoldingJump = false;
        this.jumpsRemaining = 2;
        this.tiltAngle = 0.08;
        this.lastAirTime = this.currentAirTimer;

        // Landing Squash
        this.scaleX = 1.22;
        this.scaleY = 0.82;

        this.createDustBurst(this.x + 20, this.baseY + this.height - 4, 6);
        this.createDustBurst(this.x + this.width - 20, this.baseY + this.height - 4, 6);
      }
    } else {
      // 3. Ground Running Cycle
      this.bobTimer += (speed / 28) * dt;
      this.tiltAngle = 0.08 + Math.sin(this.bobTimer) * 0.03;

      // Running animation frame advancement
      const frameDuration = Math.max(0.06, 0.14 - (speed / 620) * 0.07);
      this.runFrameTimeAcc += dt;
      if (this.runFrameTimeAcc >= frameDuration) {
        this.runFrameTimeAcc = 0;
        this.runFrameIdx = (this.runFrameIdx + 1) % 3;
      }

      // Footstep dust puffs
      if (Math.random() < 12 * dt) {
        this.dustParticles.push({
          x: this.x + 16,
          y: this.baseY + this.height - 6,
          vx: -(speed * 0.4 + Math.random() * 80),
          vy: -(Math.random() * 60),
          size: 3 + Math.random() * 3,
          alpha: 0.7,
          color: '#CFD8DC'
        });
      }
    }

    // 4. Invulnerability shake & timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.shakeOffsetX = Math.sin(this.invulnerableTimer * 30) * 4;
    } else {
      this.shakeOffsetX = 0;
    }

    // 5. Speech Bubble Timer & Periodic Cheers
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
    } else {
      this.speechCooldown -= dt;
      if (this.speechCooldown <= 0) {
        this.triggerCheer();
        this.speechCooldown = 5.0 + Math.random() * 4.0; // Every 5-9 seconds
      }
    }

    // 6. Dust particles update
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= 1.8 * dt;
      p.size += 8 * dt;
      if (p.alpha <= 0) {
        this.dustParticles.splice(i, 1);
      }
    }
  }

  createDustBurst(x, y, count, color = '#ECEFF1') {
    for (let i = 0; i < count; i++) {
      this.dustParticles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 160,
        vy: -Math.random() * 120 - 20,
        size: 3 + Math.random() * 4,
        alpha: 0.8,
        color: color
      });
    }
  }

  getHitbox() {
    const hbCfg = this.assetsConfig.rabbit?.hitboxRatio || { width: 0.65, height: 0.65, yOffsetPercent: 0.28 };
    const hbW = this.width * hbCfg.width;
    const hbH = this.height * hbCfg.height;
    return {
      x: this.x + (this.width - hbW) / 2 + this.shakeOffsetX,
      y: this.y + (this.height * hbCfg.yOffsetPercent),
      width: hbW,
      height: hbH
    };
  }

  render(ctx) {
    // 1. Dust behind
    for (const p of this.dustParticles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Flashing when invulnerable (10 Hz blink)
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 20) % 2 === 0) {
      return;
    }

    ctx.save();

    const centerX = this.x + this.width / 2 + this.shakeOffsetX;
    const groundY = this.y + this.height;

    // Ground shadow
    if (this.isGrounded) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(centerX, groundY - 2, 28 * this.scaleX, 6 * this.scaleY, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.translate(centerX, groundY);
    ctx.rotate(this.tiltAngle);
    ctx.scale(this.scaleX, this.scaleY);

    let activeImg = this.imgIdle;
    if (this.isGrounded) {
      activeImg = this.runFrames[this.runFrameIdx] || this.imgIdle;
    } else {
      activeImg = this.imgCheer || this.imgIdle;
    }

    ctx.drawImage(activeImg, -this.width / 2, -this.height, this.width, this.height);

    ctx.restore();

    // 3. Speech Bubble
    if (this.speechTimer > 0 && this.speechText) {
      this.renderSpeechBubble(ctx);
    }
  }

  renderSpeechBubble(ctx) {
    ctx.save();
    const bx = this.x + this.width / 2 + 10;
    const by = this.y - 18;

    ctx.font = "bold 13px 'Kanit', sans-serif";
    const textW = ctx.measureText(this.speechText).width;
    const padX = 12;
    const bubbleW = textW + padX * 2;
    const bubbleH = 26;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#4A5BB5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx - bubbleW / 2, by - bubbleH, bubbleW, bubbleH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(bx - 6, by);
    ctx.lineTo(bx - 12, by + 8);
    ctx.lineTo(bx, by);
    ctx.fill();

    ctx.fillStyle = '#1A1A1A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.speechText, bx, by - bubbleH / 2);

    ctx.restore();
  }
}

window.RabbitPlayer = RabbitPlayer;
