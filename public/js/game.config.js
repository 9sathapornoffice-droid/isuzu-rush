/**
 * ISUZU RUSH - Central Game Balancing & Difficulty Configuration
 * All physics, speed, spawning formulas, presets, and debug options are tuned here.
 */

(function (root, factory) {
  if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.GAME_CONFIG = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // Check URL query parameters
  let urlParams = null;
  if (typeof window !== 'undefined' && window.location) {
    urlParams = new URLSearchParams(window.location.search);
  }

  // Active difficulty preset: URL param > localStorage > default 'normal'
  const initialDifficulty = (urlParams && urlParams.get('difficulty')) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('isuzu_rush_difficulty')) ||
    'normal';

  const debugEnabled = urlParams && (urlParams.get('debug') === '1' || urlParams.get('debug') === 'true');

  const config = {
    // Active difficulty preset name ('easy', 'normal', 'hard')
    activeDifficulty: initialDifficulty,

    // 1. Difficulty Presets (Pixels per second on 360px virtual width)
    presets: {
      easy: {
        name: 'Easy (ง่าย - สำหรับมือใหม่/เด็ก)',
        speedStart: 170,
        speedMax: 500,
        acceleration: 1.8 // Reaches max at ~183s (~3 mins)
      },
      normal: {
        name: 'Normal (มาตรฐาน - ค่าเริ่มต้น)',
        speedStart: 210,
        speedMax: 620,
        acceleration: 2.5 // Reaches max at ~164s (~2.7 mins)
      },
      hard: {
        name: 'Hard (ยาก - สำหรับสายซิ่งตัวจริง)',
        speedStart: 280,
        speedMax: 760,
        acceleration: 4.0 // Reaches max at ~120s (~2 mins)
      }
    },

    // 2. Jumping & Gravity Physics (Exact pixel/sec values)
    physics: {
      gravity: 2400,                   // Downward gravity in px/s^2
      jumpVelocity: -880,              // Initial upward jump impulse in px/s
      jumpHoldGravityReduction: 0.45,  // 45% gravity reduction while holding jump (effective: 1320 px/s^2)
      maxJumpHoldDurationSec: 0.28,    // Max duration for hold-float boost in seconds
      doubleJumpEnabled: true,         // Allow double jump
      doubleJumpVelocity: -780,        // Second jump upward impulse
      expectedAirTime: 0.73,           // Average air time for obstacle clearance calculation (s)
      clearanceMargin: 40              // Extra safety clearance margin (px)
    },

    // 3. Spawning & Difficulty Ramp
    spawning: {
      tutorialDurationSec: 15,         // First 15s spawns ONLY low cones for beginner onboarding
      baseIntervalMin: 1.2,            // Base minimum seconds between obstacles
      baseIntervalRandom: 1.0,         // Random range added (0..1.0s)
      maxIntervalReduction: 0.55,      // Maximum interval reduction as distance increases
      intervalDistanceDivisor: 2500,   // Distance factor: min(0.55, distance / 2500)
      
      // Items (Carrots, Tickets, Keys, Charger)
      itemIntervalMin: 1.0,
      itemIntervalRandom: 1.2
    },

    // 4. Parallax Background & Biome Transitions
    biome: {
      transitionDistance: 350,         // Change biome every 350 distance units
      fadeDurationSec: 1.0,            // Smooth 1.0s cross-fade transition
      distanceDivisor: 40,             // distance = accumulated from (speed * dt / 40)
      sequence: ['city', 'countryside', 'mountain', 'night']
    },

    // 5. Debug Mode
    debug: {
      enabled: debugEnabled
    },

    /**
     * Helper to get active preset settings
     */
    getCurrentPreset() {
      return this.presets[this.activeDifficulty] || this.presets.normal;
    },

    /**
     * Set active difficulty preset
     */
    setDifficulty(diff) {
      if (this.presets[diff]) {
        this.activeDifficulty = diff;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('isuzu_rush_difficulty', diff);
        }
      }
    }
  };

  return config;
}));
