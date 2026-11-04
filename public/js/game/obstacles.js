/**
 * Obstacle Spawner & Collision Manager for ISUZU RUSH (Rabbit Mascot Edition)
 * Balanced with exact time-based spawning formulas & minimum jump clearance guarantees:
 * - spawnInterval = 1.2 + random(0..1.0) - min(0.55, distance / 2500)
 * - First 15s spawns ONLY low traffic cones for beginner safety
 * - Minimum spacing guarantee = speed * airTime + clearanceMargin (never creates impossible jumps)
 * - Delta-time movement in px/s
 */

class ObstacleManager {
  constructor(canvasWidth, roadY, assetsConfig, gameConfig) {
    this.w = canvasWidth;
    this.roadY = roadY;
    this.assetsConfig = assetsConfig || window.ASSETS_CONFIG || {};
    this.gameConfig = gameConfig || window.GAME_CONFIG || {};

    this.obstacles = [];
    this.spawnTimer = 1.8; // Initial grace period before first obstacle (s)
    this.elapsedTime = 0;

    // Boss rush state
    this.isBossRush = false;
    this.bossRushTimer = 0;
    this.lastBossRushDistance = 0;

    // Load assets
    this.images = {
      cone: new Image(),
      toolbox: new Image(),
      tire: new Image(),
      rock: new Image(),
      pothole: new Image(),
      truck: new Image()
    };

    const cfgObs = this.assetsConfig.obstacles || {};
    this.images.cone.src = cfgObs.cone?.src || './assets/obstacles/cone.svg';
    this.images.toolbox.src = cfgObs.toolbox?.src || './assets/obstacles/toolbox.svg';
    this.images.tire.src = cfgObs.tire?.src || './assets/obstacles/tire.svg';
    this.images.rock.src = cfgObs.rock?.src || './assets/obstacles/rock.svg';
    this.images.pothole.src = cfgObs.pothole?.src || './assets/obstacles/pothole.svg';
    this.images.truck.src = cfgObs.truck?.src || './assets/vehicles/truck_obstacle.svg';
  }

  resize(w, roadY) {
    this.w = w;
    this.roadY = roadY;
  }

  reset() {
    this.obstacles = [];
    this.spawnTimer = 2.0; // 2 seconds safety start for beginners
    this.elapsedTime = 0;
    this.isBossRush = false;
    this.bossRushTimer = 0;
    this.lastBossRushDistance = 0;
  }

  calculateNextInterval(distance) {
    const spCfg = this.gameConfig.spawning || {};
    const baseMin = spCfg.baseIntervalMin ?? 1.2;
    const baseRand = spCfg.baseIntervalRandom ?? 1.0;
    const maxReduction = spCfg.maxIntervalReduction ?? 0.55;
    const divisor = spCfg.intervalDistanceDivisor ?? 2500;

    // Exact formula: spawnInterval = 1.2 + random(0..1.0) - min(0.55, distance / 2500)
    const reduction = Math.min(maxReduction, distance / divisor);
    const interval = baseMin + Math.random() * baseRand - reduction;
    return Math.max(0.65, interval); // Never drop below 0.65s for human reaction limits
  }

  update(dt, speed, distance, onBossRushEnd) {
    this.elapsedTime += dt;

    // 1. Move obstacles left (speed * dt)
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      const moveSpeed = (obs.type === 'truck' ? speed * 0.9 : speed);
      obs.x -= moveSpeed * dt;

      if (obs.x + obs.width < -60) {
        this.obstacles.splice(i, 1);
      }
    }

    // 2. Boss Rush Trigger every 1,000m
    const rushInterval = this.assetsConfig.gameplay?.bossRushIntervalMeters || 1000;
    if (distance - this.lastBossRushDistance >= rushInterval && !this.isBossRush) {
      this.isBossRush = true;
      this.lastBossRushDistance = distance;
      this.bossRushTimer = (this.assetsConfig.gameplay?.bossRushDurationSec || 10);
    }

    if (this.isBossRush) {
      this.bossRushTimer -= dt;
      if (this.bossRushTimer <= 0) {
        this.isBossRush = false;
        if (onBossRushEnd) onBossRushEnd();
      }
    }

    // 3. Spawning Timer & Guarantees
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const spawned = this.trySpawnObstacle(speed, distance);
      if (spawned) {
        this.spawnTimer = this.isBossRush ? 
          (0.85 + Math.random() * 0.4) : 
          this.calculateNextInterval(distance);
      } else {
        // Postpone by 0.15s until safe clearance gap is reached
        this.spawnTimer = 0.15;
      }
    }
  }

  trySpawnObstacle(speed, distance) {
    const phys = this.gameConfig.physics || {};
    const airTime = phys.expectedAirTime || 0.73;
    const margin = phys.clearanceMargin || 50;

    // Guarantee jumpability:
    // Minimum distance from previous obstacle must be >= speed * airTime + clearance
    const minSafeGap = speed * airTime + margin;

    if (this.obstacles.length > 0) {
      const last = this.obstacles[this.obstacles.length - 1];
      const currentGap = this.w - last.x;
      if (currentGap < minSafeGap) {
        return false; // Not enough room yet, wait!
      }
    }

    // First 15 seconds: ONLY low traffic cones so beginners learn safely!
    const tutorialTime = this.gameConfig.spawning?.tutorialDurationSec ?? 15;
    let type = 'cone';

    if (this.elapsedTime >= tutorialTime) {
      const available = ['cone', 'toolbox', 'tire', 'rock', 'pothole'];
      // Passing Isuzu Trucks appear after 30s or during boss rush
      if (this.elapsedTime > 30 || this.isBossRush) {
        available.push('truck');
      }
      type = available[Math.floor(Math.random() * available.length)];
    }

    const cfg = this.assetsConfig.obstacles?.[type] || { width: 32, height: 32 };
    let width = cfg.width || 32;
    let height = cfg.height || 32;
    let y = this.roadY - height;

    if (type === 'pothole') {
      y = this.roadY - height + 4;
    }

    this.obstacles.push({
      type,
      x: this.w + 10,
      y,
      width,
      height,
      img: this.images[type],
      hit: false
    });

    return true;
  }

  checkCollision(playerHitbox) {
    for (const obs of this.obstacles) {
      if (obs.hit) continue;

      const obsHitbox = {
        x: obs.x + (obs.type === 'truck' ? 12 : 4),
        y: obs.y + 4,
        width: obs.width - (obs.type === 'truck' ? 24 : 8),
        height: obs.height - 6
      };

      if (
        playerHitbox.x < obsHitbox.x + obsHitbox.width &&
        playerHitbox.x + playerHitbox.width > obsHitbox.x &&
        playerHitbox.y < obsHitbox.y + obsHitbox.height &&
        playerHitbox.y + playerHitbox.height > obsHitbox.y
      ) {
        obs.hit = true;
        return true;
      }
    }
    return false;
  }

  render(ctx) {
    for (const obs of this.obstacles) {
      ctx.drawImage(obs.img, obs.x, obs.y, obs.width, obs.height);
    }
  }
}

window.ObstacleManager = ObstacleManager;
