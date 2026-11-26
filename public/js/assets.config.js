/**
 * ISUZU RUSH - Central Asset & Gameplay Configuration
 * Change image paths, theme colors, cheer bubbles, and gameplay rules here without touching core game logic.
 */

window.ASSETS_CONFIG = {
  theme: {
    primaryRed: '#DD0000',      // ISUZU Brand Red
    jumpsuitBlue: '#4A5BB5',    // Rabbit Mascot Blue Suit
    accentGold: '#FFD700',
    neutralDark: '#121216',
    white: '#FFFFFF'
  },

  brand: {
    logo: './assets/brand/isuzu_logo.svg',
    logoPng: './assets/brand/isuzu_logo.png',
    title: 'ISUZU Trusted Buddy',
    subtitle: 'เพื่อนแท้ที่คุณวางใจได้ทุกเส้นทาง (TSH)'
  },

  rabbit: {
    idle: './assets/characters/rabbit_idle.png',
    idleSvg: './assets/characters/rabbit_idle.svg',
    thumbsUp: './assets/characters/rabbit_thumbsup.png',
    thumbsUpSvg: './assets/characters/rabbit_thumbsup.svg',
    cheer: './assets/characters/rabbit_cheer.png',
    cheerSvg: './assets/characters/rabbit_cheer.svg',
    runFrames: [
      './assets/characters/rabbit_run_1.svg',
      './assets/characters/rabbit_run_2.svg',
      './assets/characters/rabbit_run_3.svg'
    ],
    heightRatio: 0.18,          // 18% of screen height (~115px on 640px height)
    hitboxRatio: {
      width: 0.65,              // Fair 65% torso box
      height: 0.65,             // Excludes tall ears from unfair damage
      yOffsetPercent: 0.28      // Shift down to cover body/feet
    }
  },

  // Cheerful speech bubbles spoken by rabbit mascot during run
  cheers: [
    'ไปต่อเลย!',
    'เก่งมาก!',
    'ระวังข้างหน้า!',
    'สู้ๆ นะเพื่อน!',
    'ลุยให้สุดทาง!',
    'กระโดดเร็ว!',
    'จับตาดูทางโค้ง!'
  ],

  gameplay: {
    startingLives: 3,
    doubleJumpEnabled: true,    // Double jump enabled!
    baseSpeed: 6.0,
    maxSpeed: 15.0,
    bossRushIntervalMeters: 1000, // Mini obstacle rush event every 1,000m
    bossRushDurationSec: 10
  },

  items: {
    carrot: {
      src: './assets/items/carrot.svg',
      size: 34,
      score: 10,
      label: '+10'
    },
    ticket: {
      src: './assets/items/ticket.svg',
      size: 40,
      score: 50,
      label: 'VIP +50'
    },
    keyTsh: {
      src: './assets/items/key_tsh.svg',
      size: 40,
      score: 100,
      label: 'TSH KEY +100!',
      multiplierDurationSec: 5  // Extra 2x multiplier for 5s
    },
    charger: {
      src: './assets/items/charger.svg',
      size: 40,
      heal: 1,
      label: '+HEAL!'
    }
  },

  obstacles: {
    cone: {
      src: './assets/obstacles/cone.svg',
      width: 36,
      height: 48
    },
    toolbox: {
      src: './assets/obstacles/toolbox.svg',
      width: 52,
      height: 38
    },
    tire: {
      src: './assets/obstacles/tire.svg',
      width: 48,
      height: 48
    },
    rock: {
      src: './assets/obstacles/rock.svg',
      width: 48,
      height: 35
    },
    pothole: {
      src: './assets/obstacles/pothole.svg',
      width: 60,
      height: 22
    },
    truck: {
      src: './assets/vehicles/truck_obstacle.svg',
      width: 148,
      height: 68,
      isLarge: true
    }
  }
};
