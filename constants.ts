import {SpriteConfig} from './utils/helper';

/**
 * Configuration for Starship Bridge Command ("Trek-ploration")
 */
export const CONFIG = {
  // Game metadata
  title: {
    value: 'Trek-ploration',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1376,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 768,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System Constants for the physics loop
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Thematic elements enforcing the sci-fi starship bridge aesthetic
  backgroundColor: {
    value: '#030712',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#06b6d4',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  accentColor: {
    value: '#f59e0b',
    type: 'color',
    label: 'Accent Color',
    group: 'THEME',
  },
  dangerColor: {
    value: '#ef4444',
    type: 'color',
    label: 'Danger Alert Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'Orbitron, system-ui, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // Audio Levels
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.6,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // Starship Bridge Gameplay Rules & Difficulty (Exposed to playground)
  maxHullIntegrity: {
    value: 100,
    type: 'number',
    label: 'Max Hull Integrity',
    group: 'Rules',
  },
  maxShieldCapacity: {
    value: 100,
    type: 'number',
    label: 'Max Shield Capacity',
    group: 'Rules',
  },
  totalReactorPower: {
    value: 10,
    type: 'number',
    label: 'Total Reactor Energy Units',
    group: 'Rules',
  },
  laserDamage: {
    value: 20,
    type: 'number',
    label: 'Phase Laser Base Damage',
    group: 'Rules',
  },
  torpedoDamage: {
    value: 80,
    type: 'number',
    label: 'Quantum Torpedo Damage',
    group: 'Rules',
  },
  enemySpawnRate: {
    value: 1.0,
    type: 'number',
    label: 'Enemy Spawn Multiplier',
    group: 'Rules',
  },
  shieldRechargeRate: {
    value: 12,
    type: 'number',
    label: 'Shield Recharge Rate',
    group: 'Rules',
  },
  autoAimAssist: {
    value: true,
    type: 'boolean',
    label: 'Tactical Reticle Auto-Assist',
    group: 'Rules',
  },

  // Asset Dimensions and Aspect Ratios (derived from read_assets_metadata)
  assetBgBridgeAspectRatio: {
    value: 1376 / 768,
    type: 'number',
    label: 'Bridge Cockpit Aspect Ratio',
    group: 'ASSETS',
  },
  assetBgNebulaAspectRatio: {
    value: 1376 / 768,
    type: 'number',
    label: 'Deep Nebula Aspect Ratio',
    group: 'ASSETS',
  },
  assetEnemyInterceptorAspectRatio: {
    value: 819 / 279,
    type: 'number',
    label: 'Interceptor Aspect Ratio',
    group: 'ASSETS',
  },
  assetEnemyVoidCruiserAspectRatio: {
    value: 883 / 367,
    type: 'number',
    label: 'Void Cruiser Aspect Ratio',
    group: 'ASSETS',
  },
  assetEnemyBossDreadnoughtAspectRatio: {
    value: 865 / 462,
    type: 'number',
    label: 'Boss Dreadnought Aspect Ratio',
    group: 'ASSETS',
  },
  assetStarshipEnemyCruiserAspectRatio: {
    value: 909 / 574,
    type: 'number',
    label: 'Corsair Cruiser Aspect Ratio',
    group: 'ASSETS',
  },
  assetStarshipPlayerAspectRatio: {
    value: 918 / 548,
    type: 'number',
    label: 'Player Starship Aspect Ratio',
    group: 'ASSETS',
  },
  assetHazardAsteroidAspectRatio: {
    value: 720 / 692,
    type: 'number',
    label: 'Asteroid Aspect Ratio',
    group: 'ASSETS',
  },
  assetHazardPlasmaMineAspectRatio: {
    value: 780 / 776,
    type: 'number',
    label: 'Plasma Mine Aspect Ratio',
    group: 'ASSETS',
  },
  assetProjectileLaserAspectRatio: {
    value: 798 / 139,
    type: 'number',
    label: 'Laser Bolt Aspect Ratio',
    group: 'ASSETS',
  },
  assetProjectileTorpedoAspectRatio: {
    value: 677 / 538,
    type: 'number',
    label: 'Photon Torpedo Aspect Ratio',
    group: 'ASSETS',
  },
  assetUiReticleAspectRatio: {
    value: 666 / 666,
    type: 'number',
    label: 'Tactical Reticle Aspect Ratio',
    group: 'ASSETS',
  },
  assetUiShieldGaugeAspectRatio: {
    value: 425 / 716,
    type: 'number',
    label: 'Shield Gauge Aspect Ratio',
    group: 'ASSETS',
  },
  assetItemEnergyCellAspectRatio: {
    value: 714 / 330,
    type: 'number',
    label: 'Energy Cell Aspect Ratio',
    group: 'ASSETS',
  },
  assetItemNaniteRepairAspectRatio: {
    value: 821 / 384,
    type: 'number',
    label: 'Nanite Repair Aspect Ratio',
    group: 'ASSETS',
  },
  assetItemDilithiumCrystalAspectRatio: {
    value: 658 / 906,
    type: 'number',
    label: 'Dilithium Crystal Aspect Ratio',
    group: 'ASSETS',
  },

  // Sprite Placeholder (preserved template key)
  playerSprite: {
    value: undefined as SpriteConfig | undefined,
    type: 'sprite',
    label: 'Player Sprite',
    group: 'Visuals',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/**
 * Type helper for reading values in game code
 */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export const PRESETS = {};
