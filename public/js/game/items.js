/**
 * Collectibles & Pickups Manager for ISUZU RUSH (Rabbit Mascot Edition)
 * Delta-time framerate independent item movement and spawning.
 */

class ItemManager {
  constructor(canvasWidth, roadY, audio, assetsConfig, gameConfig) {
    this.w = canvasWidth;
    this.roadY = roadY;
    this.audio = audio;
    this.assetsConfig = assetsConfig || window.ASSETS_CONFIG || {};
    this.gameConfig = gameConfig || window.GAME_CONFIG || {};

    this.items = [];
    this.floatingTexts = [];
    this.sparkles = [];
    this.spawnTimer = 0.8;

    // Load assets
    this.carrotImg = new Image();
    this.carrotImg.src = this.assetsConfig.items?.carrot?.src || './assets/items/carrot.svg';

    this.ticketImg = new Image();
    this.ticketImg.src = this.assetsConfig.items?.ticket?.src || './assets/items/ticket.svg';

    this.keyTshImg = new Image();
    this.keyTshImg.src = this.assetsConfig.items?.keyTsh?.src || './assets/items/key_tsh.svg';

    this.chargerImg = new Image();
    this.chargerImg.src = this.assetsConfig.items?.charger?.src || './assets/items/charger.svg';
  }

  resize(w, roadY) {
    this.w = w;
    this.roadY = roadY;
  }

  reset() {
    this.items = [];
    this.floatingTexts = [];
    this.sparkles = [];
    this.spawnTimer = 0.8;
  }

  update(dt, speed) {
    // 1. Move items left
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.x -= speed * dt;
      item.bobAngle = (item.bobAngle + 4.8 * dt) % (Math.PI * 2);
      item.currentY = item.baseY + Math.sin(item.bobAngle) * 4;

      if (item.x + item.size < -30) {
        this.items.splice(i, 1);
      }
    }

    // 2. Spawn item patterns
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnItemPattern();
      this.spawnTimer = 0.9 + Math.random() * 0.9;
    }

    // 3. Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= ft.vy * dt * 60;
      ft.alpha -= 1.4 * dt;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 4. Update sparkles
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.x += sp.vx * dt * 60;
      sp.y += sp.vy * dt * 60;
      sp.alpha -= 2.2 * dt;
      if (sp.alpha <= 0) {
        this.sparkles.splice(i, 1);
      }
    }
  }

  spawnItemPattern() {
    const roll = Math.random();

    if (roll < 0.65) {
      // Carrot Arc (3-5 carrots for jump collection)
      const count = 3 + Math.floor(Math.random() * 3);
      const startX = this.w + 20;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const arcHeight = Math.sin(t * Math.PI) * 65;
        this.items.push({
          type: 'carrot',
          x: startX + i * 36,
          baseY: this.roadY - 38 - arcHeight,
          currentY: this.roadY - 38 - arcHeight,
          size: 28,
          bobAngle: i * 0.5,
          img: this.carrotImg
        });
      }
    } else if (roll < 0.85) {
      // Blue VIP Ticket
      this.items.push({
        type: 'ticket',
        x: this.w + 30,
        baseY: this.roadY - 80,
        currentY: this.roadY - 80,
        size: 34,
        bobAngle: 0,
        img: this.ticketImg
      });
    } else if (roll < 0.95) {
      // TSH Car Key
      this.items.push({
        type: 'keyTsh',
        x: this.w + 30,
        baseY: this.roadY - 65,
        currentY: this.roadY - 65,
        size: 36,
        bobAngle: 0,
        img: this.keyTshImg
      });
    } else {
      // Charger / Fuel Canister
      this.items.push({
        type: 'charger',
        x: this.w + 30,
        baseY: this.roadY - 60,
        currentY: this.roadY - 60,
        size: 32,
        bobAngle: 0,
        img: this.chargerImg
      });
    }
  }

  checkCollection(playerHitbox, onCollect) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const itemHitbox = {
        x: item.x,
        y: item.currentY,
        width: item.size,
        height: item.size
      };

      if (
        playerHitbox.x < itemHitbox.x + itemHitbox.width &&
        playerHitbox.x + playerHitbox.width > itemHitbox.x &&
        playerHitbox.y < itemHitbox.y + itemHitbox.height &&
        playerHitbox.y + playerHitbox.height > itemHitbox.y
      ) {
        this.createSparkles(item.x + item.size / 2, item.currentY + item.size / 2, item.type);

        if (item.type === 'carrot') {
          this.audio.playCoin();
          onCollect('carrot', 10, item.x, item.currentY);
        } else if (item.type === 'ticket') {
          this.audio.playTicket();
          onCollect('ticket', 50, item.x, item.currentY);
        } else if (item.type === 'keyTsh') {
          this.audio.playFuel();
          onCollect('keyTsh', 100, item.x, item.currentY);
        } else if (item.type === 'charger') {
          onCollect('charger', 0, item.x, item.currentY);
        }

        this.items.splice(i, 1);
      }
    }
  }

  addFloatingText(text, x, y, color = '#FFD700', fontSize = 18) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: 1.6,
      alpha: 1,
      color,
      fontSize
    });
  }

  createSparkles(x, y, type) {
    const color = type === 'carrot' ? '#FF9100' : type === 'ticket' ? '#00E5FF' : type === 'keyTsh' ? '#FFD700' : '#00E676';
    for (let i = 0; i < 9; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.6 + Math.random() * 2.8;
      this.sparkles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color,
        size: 2.5 + Math.random() * 3
      });
    }
  }

  render(ctx) {
    for (const item of this.items) {
      ctx.drawImage(item.img, item.x, item.currentY, item.size, item.size);
    }

    for (const sp of this.sparkles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.alpha);
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `bold ${ft.fontSize}px 'Kanit', sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}

window.ItemManager = ItemManager;
