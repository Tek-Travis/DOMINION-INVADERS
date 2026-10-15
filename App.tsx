// tslint:disable
/* eslint-disable */
import {
  Play,
  Pause,
  RotateCw,
  Volume2,
  VolumeX,
  Shield,
  Zap,
  Activity,
  Sparkles,
  Gamepad,
  Info,
  Menu,
  X,
  Trophy,
  ArrowLeft,
  Flame,
  Radio,
  Crosshair,
  Wrench,
  Gauge,
  User,
  Users,
  AlertTriangle,
  Radar,
  Compass,
} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {getConfig} from './constants';
import {
  SpriteRenderer,
  SpriteActionConfig,
  SpriteAnimationState,
} from './SpriteRenderer';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  createFixedStepper,
  drawAsset,
  formatTime,
  GameState,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  useAssets,
  useAutoFocus,
  useInput,
  useIsMobile,
  gameAudio,
  clamp,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

// Audio track
const BACKGROUND_MUSIC_URL = 'assets/audio/bgm_bridge_command.mp3';

// Subsystem IDs
type SubsystemId = 'weapons' | 'shields' | 'engines' | 'sensors';

interface PowerGrid {
  weapons: number;
  shields: number;
  engines: number;
  sensors: number;
}

interface StarfieldStar {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  color: string;
}

interface Projectile {
  id: string;
  type: 'player_laser' | 'player_torpedo' | 'enemy_laser' | 'enemy_torpedo' | 'enemy_plasma';
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  targetId?: string;
  homing?: boolean;
  angle: number;
  life: number;
}

interface EnemyShip {
  id: string;
  type: 'interceptor' | 'cruiser' | 'corsair' | 'dreadnought' | 'asteroid' | 'plasma_mine';
  x: number;
  y: number;
  z: number; // For 2.5D scaling into viewport
  vx: number;
  vy: number;
  vz: number;
  width: number;
  height: number;
  baseWidth: number;
  baseHeight: number;
  aspectRatio: number;
  health: number;
  maxHealth: number;
  fireCooldown: number;
  shield?: number;
  maxShield?: number;
  rotation: number;
  rotSpeed: number;
  scoreValue: number;
  phase?: number;
  hitFlash?: number;
}

interface ResourceDrop {
  id: string;
  type: 'energy_cell' | 'nanite_repair' | 'dilithium_crystal';
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  aspectRatio: number;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface BridgeConduit {
  id: number;
  station: SubsystemId;
  name: string;
  x: number;
  y: number;
  damaged: boolean;
  sparkTimer: number;
}

interface OfficerDialogue {
  officer: string;
  role: string;
  text: string;
  color: string;
  timer: number;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

const BONUS_POINT_SECTORS = [
  2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 25,
];

const CREW_SPRITE_CONFIG: Record<string, SpriteActionConfig> = {
  officer_captain_idle: {
    imageUrl: 'officer_captain_idle',
    totalFrames: 4,
    frameWidth: 512,
    frameHeight: 512,
    fps: 4,
    loop: true,
  },
  officer_tactical_idle: {
    imageUrl: 'officer_tactical_idle',
    totalFrames: 4,
    frameWidth: 512,
    frameHeight: 512,
    fps: 4,
    loop: true,
  },
  officer_science_idle: {
    imageUrl: 'officer_science_idle',
    totalFrames: 4,
    frameWidth: 512,
    frameHeight: 512,
    fps: 4,
    loop: true,
  },
  officer_engineer_idle: {
    imageUrl: 'officer_engineer_idle',
    totalFrames: 4,
    frameWidth: 512,
    frameHeight: 512,
    fps: 4,
    loop: true,
  },
  crew_tactical_idle: {
    imageUrl: 'crew_tactical_idle',
    totalFrames: 4,
    frameWidth: 512,
    frameHeight: 512,
    fps: 4,
    loop: true,
  },
};

const OFFICER_STATIONS = [
  {
    role: 'tactical' as const,
    name: 'Cmdr. Vance',
    title: 'TACTICAL ARCH',
    xFactor: 0.14,
    yFactor: 0.56,
    charSize: 136,
    stateKey: 'tactical',
    color: '#f87171',
    quote: 'Weapons arrays calibrated. Ready to unleash full phasers!',
  },
  {
    role: 'helm' as const,
    name: 'Lt. Sulu',
    title: 'HELM CONSOLE',
    xFactor: 0.32,
    yFactor: 0.60,
    charSize: 132,
    stateKey: 'helm',
    color: '#fb923c',
    quote: 'Impulse engines steady at standard combat speed.',
  },
  {
    role: 'captain' as const,
    name: 'Capt. Reynolds',
    title: 'COMMAND CHAIR',
    xFactor: 0.50,
    yFactor: 0.55,
    charSize: 148,
    stateKey: 'captain',
    color: '#fbbf24',
    quote: 'Command is holding steady. Stay on target, crew!',
  },
  {
    role: 'science' as const,
    name: 'Lt. T\'Mera',
    title: 'SCIENCE SENSORS',
    xFactor: 0.68,
    yFactor: 0.60,
    charSize: 132,
    stateKey: 'science',
    color: '#38bdf8',
    quote: 'Subspace sensors actively sweeping the sector perimeter.',
  },
  {
    role: 'engineer' as const,
    name: 'Chief O\'Malley',
    title: 'ENGINEERING',
    xFactor: 0.86,
    yFactor: 0.56,
    charSize: 136,
    stateKey: 'engineer',
    color: '#f59e0b',
    quote: 'Warp conduits stable. Emergency repairs on standby!',
  },
];

const MAX_PARTICLES = 350;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>();
  const isMobile = useIsMobile();

  // --- GLOBAL PAUSE STATE ---
  const lastCancelRef = useRef(false);

  // --- PLAYGROUND SDK INTEGRATION ---
  const {sdk} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');

  // Asset Manifest - Clean, strictly active assets
  const ASSETS_MANIFEST = useMemo(
    () => ({
      bg_bridge_cockpit: 'assets/images/bg_bridge_cockpit.png',
      bg_deep_nebula: 'assets/images/bg_deep_nebula.png',
      starship_player: 'assets/images/starship_player.png',
      starship_enemy_cruiser: 'assets/images/starship_enemy_cruiser.png',
      enemy_interceptor: 'assets/images/enemy_interceptor.png',
      enemy_void_cruiser: 'assets/images/enemy_void_cruiser.png',
      enemy_boss_dreadnought: 'assets/images/enemy_boss_dreadnought.png',
      hazard_asteroid: 'assets/images/hazard_asteroid.png',
      hazard_plasma_mine: 'assets/images/hazard_plasma_mine.png',
      projectile_laser_bolt: 'assets/images/projectile_laser_bolt.png',
      projectile_photon_torpedo: 'assets/images/projectile_photon_torpedo.png',
      ui_tactical_reticle: 'assets/images/ui_tactical_reticle.png',
      ui_shield_gauge: 'assets/images/ui_shield_gauge.png',
      item_energy_cell: 'assets/images/item_energy_cell.png',
      item_nanite_repair: 'assets/images/item_nanite_repair.png',
      item_dilithium_crystal: 'assets/images/item_dilithium_crystal.png',
      officer_captain_idle: 'assets/images/officer_captain_idle.png',
      officer_tactical_idle: 'assets/images/officer_tactical_idle.png',
      officer_science_idle: 'assets/images/officer_science_idle.png',
      officer_engineer_idle: 'assets/images/officer_engineer_idle.png',
      crew_tactical_idle: 'assets/images/crew_tactical_officer_idle.png',
    }),
    [],
  );

  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  const canvasWidth = getConfig('baseCanvasWidth') as number;
  const canvasHeight = getConfig('baseCanvasHeight') as number;

  // Adjust only these fractions to tune the arena inside the transparent opening.

const VIEWSCREEN_BOUNDS = {
  x: 0.095,
  y: 0.18,
  width: 0.81,
  height: 0.23,
};

const getSpaceViewport = () => {
  const sourceWidth = canvasWidth;
  const sourceHeight = canvasHeight * 0.55;

  const width = canvasWidth * VIEWSCREEN_BOUNDS.width;
  const height = canvasHeight * VIEWSCREEN_BOUNDS.height;

  return {
    x: canvasWidth * VIEWSCREEN_BOUNDS.x,
    y: canvasHeight * VIEWSCREEN_BOUNDS.y,
    width,
    height,
    scaleX: width / sourceWidth,
    scaleY: height / sourceHeight,
  };
};


  if (!stepperRef.current) {
    const stepMs = getConfig('stepMs');
    const maxSubSteps = getConfig('maxSubSteps');
    stepperRef.current = createFixedStepper(stepMs, maxSubSteps);
  }

  // Audio toggles and volume sliders for pause/settings menu
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [sfxVolume, setSfxVolume] = useState(0.6);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  // Sync SFX volume with GameAudio engine
  useEffect(() => {
    gameAudio.setVolume(isSfxMuted ? 0 : sfxVolume);
  }, [sfxVolume, isSfxMuted]);

  const [dilithiumReserve, setDilithiumReserve] = useState(0);

  // 4 Upgradable Systems (Weapons, Shields, Engines, Sensors) - 5 levels each (0 to 5)
  const [subsystemLevels, setSubsystemLevels] = useState<{
    weapons: number;
    shields: number;
    engines: number;
    sensors: number;
  }>({
    weapons: 0,
    shields: 0,
    engines: 0,
    sensors: 0,
  });
  const subsystemLevelsRef = useRef(subsystemLevels);
  subsystemLevelsRef.current = subsystemLevels;

  // Exactly 20 bonus points earned across rounds 2 to 25 (0 at start)
  const [bonusPoints, setBonusPoints] = useState(0);
  const bonusPointsRef = useRef(bonusPoints);
  bonusPointsRef.current = bonusPoints;

  // Floating combat text queue (CRIT and EVADED visual feedback)
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Persistent Ship Upgrades (legacy compatibility)
  const [shipUpgrades, setShipUpgrades] = useState({
    hullPlating: 0,
    cannonsMk: 0,
    shieldMatrix: 0,
    subspaceSensors: 0,
  });

  // Game UI state
  const [gameState, setGameState] = useState<GameState>(
    () => ({
      status: 'START',
      score: 0,
      level: 1, // Sector 1 to 25
      hull: (getConfig('maxHullIntegrity') as number) || 100,
      maxHull: (getConfig('maxHullIntegrity') as number) || 100,
      shields: (getConfig('maxShieldCapacity') as number) || 100,
      maxShields: (getConfig('maxShieldCapacity') as number) || 100,
      torpedoes: 5,
      maxTorpedoes: 25,
      sectorProgress: 0, // 0 to 100% to trigger warp gate
      alertLevel: 'NORMAL', // 'NORMAL' | 'YELLOW' | 'RED'
    }),
  );

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    (window as any).canHandleBackKey = gameState.status !== 'START';
  }, [gameState.status]);

  const inputRef = useInput(canvasRef, true, {
    width: canvasWidth,
    height: canvasHeight,
  });

  // Tactical Reticle state (Crosshair on viewport)
  const reticleRef = useRef({
    x: canvasWidth / 2,
    y: canvasHeight * 0.28,
    lockedTargetId: null as string | null,
    lockProgress: 0,
  });

  // Bridge Power Allocation
  const [powerGrid, setPowerGrid] = useState<PowerGrid>({
    weapons: 1,
    shields: 1,
    engines: 1,
    sensors: 1,
  });
  const powerGridRef = useRef(powerGrid);
  powerGridRef.current = powerGrid;

  // Starship Simulation Dynamics
  const simRef = useRef({
    hull: 100,
    shields: 100,
    torpedoes: 5,
    score: 0,
    playerShipX: canvasWidth / 2,
    playerShipY: canvasHeight * 0.44,
    playerShipTilt: 0,
    playerShipThrustTimer: 0,
    playerShipDodgeTimer: 0,
    sectorProgress: 0,
    enemiesDefeatedInSector: 0,
    cameraShake: 0,
    laserCooldown: 0,
    torpedoCooldown: 0,
    shieldPulseCooldown: 0,
    shieldPulseActiveTimer: 0,
    emergencyRepairCooldown: 0,
    warpJumpAnimation: 0,
    alertStatus: 'NORMAL' as 'NORMAL' | 'YELLOW' | 'RED',
    redAlertStrobe: 0,
    dilithiumCollected: 0,
    radarScanAngle: 0,
  });

  // Throttled HUD update timer
  const hudSyncTimerRef = useRef(0);

  // Officer dialogue callout
  const [activeDialogue, setActiveDialogue] = useState<OfficerDialogue | null>({
    officer: 'Cmdr. Vance',
    role: 'Tactical',
    text: 'Bridge online. Phasers and torpedoes armed. Ready for orders!',
    color: '#f87171',
    timer: 4.0,
  });

// Simulation Entities
const starsRef = useRef<StarfieldStar[]>([]);
const enemiesRef = useRef<EnemyShip[]>([]);
const projectilesRef = useRef<Projectile[]>([]);

const phaserBeamsRef = useRef<
  {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    expiresAt: number;
  }[]
>([]);

const dropsRef = useRef<ResourceDrop[]>([]);
const particlesRef = useRef<Particle[]>([]);
const conduitsRef = useRef<BridgeConduit[]>([
  {id: 1, station: 'weapons', name: 'Tactical Array', x: 200, y: 640, damaged: false, sparkTimer: 0},
  {id: 2, station: 'engines', name: 'Helm Thrusters', x: 440, y: 650, damaged: false, sparkTimer: 0},
  {id: 3, station: 'sensors', name: 'Subspace Sensor', x: 920, y: 650, damaged: false, sparkTimer: 0},
  {id: 4, station: 'shields', name: 'Warp Conduit', x: 1160, y: 640, damaged: false, sparkTimer: 0},
]);
  // Sprite Renderers
  const crewRenderer = useRef<SpriteRenderer | null>(null);
  const animStates = useRef<Record<string, SpriteAnimationState>>({
    captain: {currentAction: 'officer_captain_idle', currentFrame: 0, timer: 0},
    tactical: {currentAction: 'officer_tactical_idle', currentFrame: 0, timer: 0},
    science: {currentAction: 'officer_science_idle', currentFrame: 0, timer: 0},
    engineer: {currentAction: 'officer_engineer_idle', currentFrame: 0, timer: 0},
    helm: {currentAction: 'crew_tactical_idle', currentFrame: 0, timer: 0},
  });

  // Key tracking for edge triggers
  const keyEdges = useRef<{
    fireLaser: boolean;
  }>({
    fireLaser: false,
  });

  // Particle spawning helper with bounded pool to prevent GC spikes
  const spawnParticle = useCallback(
    (
      x: number,
      y: number,
      vx: number,
      vy: number,
      size: number,
      color: string,
      life: number,
    ) => {
      const parts = particlesRef.current;
      if (parts.length >= MAX_PARTICLES) {
        // Reuse oldest particle
        const p = parts[0];
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.size = size;
        p.color = color;
        p.life = life;
        p.maxLife = life;
        p.alpha = 1;
        // Move to back
        parts.push(parts.shift()!);
      } else {
        parts.push({
          x,
          y,
          vx,
          vy,
          size,
          color,
          alpha: 1,
          life,
          maxLife: life,
        });
      }
    },
    [],
  );

  // Initialize starfield
  useEffect(() => {
    const stars: StarfieldStar[] = [];
    const numStars = 200;
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: (Math.random() - 0.5) * canvasWidth * 2.2,
        y: (Math.random() - 0.5) * canvasHeight * 1.8,
        z: Math.random() * 800 + 40,
        size: Math.random() * 2.2 + 1,
        speed: Math.random() * 450 + 200,
        color:
          Math.random() > 0.85
            ? '#38bdf8'
            : Math.random() > 0.7
              ? '#c084fc'
              : Math.random() > 0.5
                ? '#fde047'
                : '#ffffff',
      });
    }
    starsRef.current = stars;
  }, [canvasWidth, canvasHeight]);

  // Initialize sprite renderer
  if (!crewRenderer.current) {
    crewRenderer.current = new SpriteRenderer(CREW_SPRITE_CONFIG);
  }

  // Trigger bridge dialogue
  const speakDialogue = useCallback(
    (officer: string, role: string, text: string, color: string) => {
      setActiveDialogue({officer, role, text, color, timer: 3.5});
    },
    [],
  );

  // --- Initialise Game Loop & Reset ---
  const initGame = useCallback(() => {
    const initialMaxHull = (getConfig('maxHullIntegrity') as number) || 100;
    const initialMaxShield = (getConfig('maxShieldCapacity') as number) || 100;

    simRef.current = {
      hull: initialMaxHull,
      shields: initialMaxShield,
      torpedoes: 5,
      score: 0,
      playerShipX: canvasWidth / 2,
      playerShipY: canvasHeight * 0.44,
      playerShipTilt: 0,
      playerShipThrustTimer: 0,
      playerShipDodgeTimer: 0,
      sectorProgress: 0,
      enemiesDefeatedInSector: 0,
      cameraShake: 0,
      laserCooldown: 0,
      torpedoCooldown: 0,
      shieldPulseCooldown: 0,
      shieldPulseActiveTimer: 0,
      emergencyRepairCooldown: 0,
      warpJumpAnimation: 0,
      alertStatus: 'NORMAL',
      redAlertStrobe: 0,
      dilithiumCollected: 0,
      radarScanAngle: 0,
    };

    enemiesRef.current.length = 0;
    projectilesRef.current.length = 0;
    dropsRef.current.length = 0;
    particlesRef.current.length = 0;
    floatingTextsRef.current.length = 0;

    // Reset conduits
    conduitsRef.current.forEach((c) => {
      c.damaged = false;
      c.sparkTimer = 0;
    });

    // Reset 4 Subsystems and 20 Bonus Points
    setSubsystemLevels({
      weapons: 0,
      shields: 0,
      engines: 0,
      sensors: 0,
    });
    subsystemLevelsRef.current = {
      weapons: 0,
      shields: 0,
      engines: 0,
      sensors: 0,
    };
    setBonusPoints(0);
    bonusPointsRef.current = 0;

    setPowerGrid({
      weapons: 1,
      shields: 1,
      engines: 1,
      sensors: 1,
    });

    setGameState({
      status: 'PLAYING',
      score: 0,
      level: 1,
      hull: initialMaxHull,
      maxHull: initialMaxHull,
      shields: initialMaxShield,
      maxShields: initialMaxShield,
      torpedoes: 5,
      maxTorpedoes: 25,
      sectorProgress: 0,
      alertLevel: 'NORMAL',
    });

    speakDialogue(
      'Capt. Reynolds',
      'Command',
      'All stations: standard patrol underway. Monitor long-range sensors!',
      '#fbbf24',
    );

    if (sdk) {
      sdk.startGame();
    }
  }, [sdk, canvasWidth, canvasHeight, speakDialogue]);

  // Audio lifecycle reactions
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    } else if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
    }
  }, [gameState.status]);

  // Hook for reporting lifecycle & scores to host playground
  usePlaygroundGameLifecycle(gameState, sdk);

  // Auto-start when ?autoplay is in the URL
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame();
    }
  }, [initGame]);

  // Subsystem Bonus Point Allocation (Max 5 per system, total 20 points)
  const allocateBonusPoint = (system: 'weapons' | 'shields' | 'engines' | 'sensors') => {
    if (bonusPointsRef.current <= 0) return;
    if (subsystemLevelsRef.current[system] >= 5) return;

    setSubsystemLevels((prev) => {
      const next = { ...prev, [system]: prev[system] + 1 };
      subsystemLevelsRef.current = next;
      return next;
    });
    setBonusPoints((prev) => {
      const next = prev - 1;
      bonusPointsRef.current = next;
      return next;
    });
    gameAudio.playPowerupChime();
  };

  const refundBonusPoint = (system: 'weapons' | 'shields' | 'engines' | 'sensors') => {
    if (subsystemLevelsRef.current[system] <= 0) return;

    setSubsystemLevels((prev) => {
      const next = { ...prev, [system]: prev[system] - 1 };
      subsystemLevelsRef.current = next;
      return next;
    });
    setBonusPoints((prev) => {
      const next = prev + 1;
      bonusPointsRef.current = next;
      return next;
    });
    gameAudio.playCrispClick();
  };

  const adjustPower = (station: SubsystemId, delta: number) => {
    if (delta > 0) {
      allocateBonusPoint(station);
    } else {
      refundBonusPoint(station);
    }
  };

  // Universal Pause / Unpause
  const togglePause = useCallback(() => {
    setGameState((prev) => {
      if (prev.status === 'PLAYING') {
        return { ...prev, status: 'PAUSED' };
      } else if (prev.status === 'PAUSED') {
        return { ...prev, status: 'PLAYING' };
      }
      return prev;
    });
  }, []);

  const addFloatingText = (text: string, x: number, y: number, color: string) => {
    floatingTextsRef.current.push({
      id: Date.now() + Math.random(),
      text,
      x,
      y,
      color,
      life: 0.65,
      maxLife: 0.65,
    });
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      // Toggle pause at any time
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameStateRef.current.status === 'PLAYING' || gameStateRef.current.status === 'PAUSED') {
          e.preventDefault();
          togglePause();
          return;
        }
      }

      if (gameStateRef.current.status !== 'PLAYING') return;

      if (e.key.toLowerCase() === 't') {
        triggerFireTorpedo();
      } else if (e.key.toLowerCase() === 'f') {
        triggerShieldDeflectorPulse();
      } else if (e.key.toLowerCase() === 'c') {
        triggerQuickRepair();
      }
    };

    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [togglePause]);

// Fire actions
const triggerFireLaser = () => {
  const sim = simRef.current;
  if (sim.laserCooldown > 0) return;

  const wpLevel = subsystemLevelsRef.current.weapons;
  const senLevel = subsystemLevelsRef.current.sensors;
  const baseDmg = getConfig('laserDamage') as number;
  const damageMultiplier = 1.0 + wpLevel * 0.20;
  let finalDamage = Math.round(baseDmg * damageMultiplier);

  const critChance = senLevel * 0.10;
  const isCrit = Math.random() < critChance;
  if (isCrit) {
    finalDamage *= 2;
  }

  const reticle = reticleRef.current;

  // Single centered phaser emitter.
  const cannonY = sim.playerShipY - 10;
  const cannonXs = [sim.playerShipX];

  const enemies = enemiesRef.current;
  const beamRange = Math.hypot(canvasWidth, canvasHeight) * 2;
  const expiresAt = performance.now() + 140;

  for (const cannonX of cannonXs) {
    const angle = Math.atan2(
      reticle.y - cannonY,
      reticle.x - cannonX,
    );

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let nearestDistance = beamRange;
    let hitIndex = -1;

    // Find the nearest enemy intersected by this beam.
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const halfW = enemy.width / 2 + 10;
      const halfH = enemy.height / 2 + 10;

      const minX = enemy.x - halfW;
      const maxX = enemy.x + halfW;
      const minY = enemy.y - halfH;
      const maxY = enemy.y + halfH;

      let entry = 0;
      let exit = beamRange;

      if (Math.abs(dx) < 0.000001) {
        if (cannonX < minX || cannonX > maxX) continue;
      } else {
        const t1 = (minX - cannonX) / dx;
        const t2 = (maxX - cannonX) / dx;

        entry = Math.max(entry, Math.min(t1, t2));
        exit = Math.min(exit, Math.max(t1, t2));
      }

      if (Math.abs(dy) < 0.000001) {
        if (cannonY < minY || cannonY > maxY) continue;
      } else {
        const t1 = (minY - cannonY) / dy;
        const t2 = (maxY - cannonY) / dy;

        entry = Math.max(entry, Math.min(t1, t2));
        exit = Math.min(exit, Math.max(t1, t2));
      }

      if (entry <= exit && entry < nearestDistance) {
        nearestDistance = entry;
        hitIndex = i;
      }
    }

    const endX = cannonX + dx * nearestDistance;
    const endY = cannonY + dy * nearestDistance;

    // Record the visual beam.
    phaserBeamsRef.current.push({
      startX: cannonX,
      startY: cannonY,
      endX,
      endY,
      expiresAt,
    });

    if (hitIndex >= 0) {
      const enemy = enemies[hitIndex];
      enemy.hitFlash = 1.0;

      // Shields absorb damage before hull health.
      if (enemy.shield && enemy.shield > 0) {
        const shieldDmg = Math.min(enemy.shield, finalDamage);
        enemy.shield -= shieldDmg;
        enemy.health -= finalDamage - shieldDmg;
      } else {
        enemy.health -= finalDamage;
      }

      if (isCrit) {
        // Golden critical sparks & combat text
        for (let s = 0; s < 8; s++) {
          spawnParticle(
            endX,
            endY,
            (Math.random() - 0.5) * 260,
            (Math.random() - 0.5) * 260,
            Math.random() * 5 + 3,
            '#facc15',
            0.35,
          );
        }
        addFloatingText(`CRIT!`, endX, endY - 22, '#facc15');
      } else {
        // Orange impact sparks
        for (let s = 0; s < 4; s++) {
          spawnParticle(
            endX,
            endY,
            (Math.random() - 0.5) * 160,
            (Math.random() - 0.5) * 160,
            Math.random() * 4 + 2,
            '#ff6a00',
            0.25,
          );
        }
      }

      if (enemy.health <= 0) {
        handleEnemyDestroyed(enemy);
        enemies[hitIndex] = enemies[enemies.length - 1];
        enemies.pop();
      }
    }

    // Orange muzzle flash particles.
    for (let i = 0; i < 2; i++) {
      spawnParticle(
        cannonX,
        cannonY,
        (Math.random() - 0.5) * 80,
        -Math.random() * 100,
        Math.random() * 4 + 2,
        '#ff6a00',
        0.12,
      );
    }
  }

  gameAudio.playArcadeLaser();

  sim.laserCooldown = Math.max(
    0.1,
    0.35 - wpLevel * 0.04,
  );
};

  const triggerFireTorpedo = () => {
    if (simRef.current.torpedoes <= 0 || simRef.current.torpedoCooldown > 0) {
      gameAudio.playErrorBuzz();
      return;
    }
    simRef.current.torpedoes -= 1;
    setGameState((prev) => ({...prev, torpedoes: simRef.current.torpedoes}));

    const baseTorpDmg = getConfig('torpedoDamage') as number;
    const wpLevel = subsystemLevelsRef.current.weapons;
    const finalDamage = Math.round(
      baseTorpDmg * (1.0 + wpLevel * 0.20),
    );

    const reticle = reticleRef.current;
    const shipX = simRef.current.playerShipX;
    const shipY = simRef.current.playerShipY - 20;

    const angle = Math.atan2(reticle.y - shipY, reticle.x - shipX);
    const speed = 620;

    projectilesRef.current.push({
      id: `p_torp_${Date.now()}`,
      type: 'player_torpedo',
      x: shipX,
      y: shipY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      width: 28,
      height: 24,
      damage: finalDamage,
      angle: angle,
      homing: true,
      targetId: reticle.lockedTargetId || undefined,
      life: 3.5,
    });

    gameAudio.playGunshotBlast();
    simRef.current.torpedoCooldown = 0.9;

    speakDialogue(
      'Cmdr. Vance',
      'Tactical',
      'Quantum Torpedo away! Homing locked.',
      '#f87171',
    );
  };

  const triggerShieldDeflectorPulse = () => {
    if (simRef.current.shieldPulseCooldown > 0 || simRef.current.shields < 15) {
      gameAudio.playErrorBuzz();
      return;
    }

    simRef.current.shields -= 15;
    simRef.current.shieldPulseActiveTimer = 2.0;
    simRef.current.shieldPulseCooldown = 30;
    gameAudio.playShieldBlock();

    speakDialogue(
      'Lt. T\'Mera',
      'Science',
      'Deflector pulse wave active! Deflecting incoming fire.',
      '#38bdf8',
    );

    // Deflector blast clears nearby enemy projectiles
    const projs = projectilesRef.current;
    for (let pIdx = projs.length - 1; pIdx >= 0; pIdx--) {
      const p = projs[pIdx];
      if (p.type === 'enemy_laser' || p.type === 'enemy_torpedo' || p.type === 'enemy_plasma') {
        for (let i = 0; i < 4; i++) {
          spawnParticle(
            p.x,
            p.y,
            (Math.random() - 0.5) * 180,
            (Math.random() - 0.5) * 180,
            Math.random() * 4 + 2,
            '#38bdf8',
            0.25,
          );
        }
        projs[pIdx] = projs[projs.length - 1];
        projs.pop();
      }
    }

    // Ring expansion effect
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      spawnParticle(
        simRef.current.playerShipX,
        simRef.current.playerShipY,
        Math.cos(ang) * 450,
        Math.sin(ang) * 320,
        4.5,
        '#06b6d4',
        0.5,
      );
    }
  };

  const triggerQuickRepair = () => {
    if (simRef.current.emergencyRepairCooldown > 0) {
      gameAudio.playErrorBuzz();
      return;
    }

    conduitsRef.current.forEach((c) => {
      c.damaged = false;
    });

    const maxH =
      (getConfig('maxHullIntegrity') as number) + shipUpgrades.hullPlating * 25;
    const healAmount = 30 + shipUpgrades.subspaceSensors * 5;
    simRef.current.hull = Math.min(maxH, simRef.current.hull + healAmount);
    simRef.current.emergencyRepairCooldown = 30.0;

    gameAudio.playPowerupChime();
    speakDialogue(
      'Chief O\'Malley',
      'Engineering',
      'Damage control teams dispatched! Hull breaches sealed.',
      '#f59e0b',
    );

    setGameState((prev) => ({
      ...prev,
      hull: Math.round(simRef.current.hull),
      alertLevel: simRef.current.hull < 35 ? 'RED' : 'NORMAL',
    }));
  };

  // --- MAIN SIMULATION TICK ---
  const update = (dt: number) => {
    if (gameStateRef.current.status !== 'PLAYING') return;

    const input = inputRef.current;
    const pGrid = powerGridRef.current;
    const sim = simRef.current;
    const level = gameStateRef.current.level;

    // Cooldown timers
    if (sim.laserCooldown > 0) sim.laserCooldown -= dt;
    if (sim.torpedoCooldown > 0) sim.torpedoCooldown -= dt;
    if (sim.shieldPulseCooldown > 0) sim.shieldPulseCooldown -= dt;
    if (sim.shieldPulseActiveTimer > 0) sim.shieldPulseActiveTimer -= dt;
    if (sim.emergencyRepairCooldown > 0) sim.emergencyRepairCooldown -= dt;

    // Radar & Dialogue timers
    sim.radarScanAngle = (sim.radarScanAngle + dt * 2.5) % (Math.PI * 2);
    if (activeDialogue) {
      activeDialogue.timer -= dt;
      if (activeDialogue.timer <= 0) {
        setActiveDialogue(null);
      }
    }

    // Camera shake decay
    if (sim.cameraShake > 0) {
      sim.cameraShake = Math.max(0, sim.cameraShake - dt * 14);
    }

    // Shield passive recharge
    const baseRecharge = getConfig('shieldRechargeRate') as number;
    const maxShield =
      (getConfig('maxShieldCapacity') as number) + shipUpgrades.shieldMatrix * 20;
    const rechargeMultiplier = 0.5 + pGrid.shields * 0.35;
    if (sim.shields < maxShield && sim.hull > 0) {
      sim.shields = Math.min(maxShield, sim.shields + baseRecharge * rechargeMultiplier * dt);
    }

    // Update Crew Animation States in-place
    if (crewRenderer.current) {
      const states = animStates.current;
      crewRenderer.current.getNextState(states.captain, dt);
      crewRenderer.current.getNextState(states.tactical, dt);
      crewRenderer.current.getNextState(states.science, dt);
      crewRenderer.current.getNextState(states.engineer, dt);
      crewRenderer.current.getNextState(states.helm, dt);
    }

    // Update Starfield motion
    const warpBoost = sim.warpJumpAnimation > 0 ? 14 : 1;
    const engineSpeedMod = 0.6 + pGrid.engines * 0.25;
    const stars = starsRef.current;
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      star.z -= star.speed * engineSpeedMod * warpBoost * dt;
      if (star.z <= 10) {
        star.z = 800;
        star.x = (Math.random() - 0.5) * canvasWidth * 2.2;
        star.y = (Math.random() - 0.5) * canvasHeight * 1.8;
      }
    }

    // Viewport Reticle Control (Mouse/Touch or D-Pad/WASD)
    const reticle = reticleRef.current;
    const viewportMinX = canvasWidth * 0.06;
    const viewportMaxX = canvasWidth * 0.94;
    const viewportMinY = canvasHeight * 0.04;
    const viewportMaxY = canvasHeight * 0.52;

    const pointerViewport = getSpaceViewport();
    if (input.pointer.down || input.pointer.x > 0) {
      const pointerX = input.pointer.x;
      const pointerY = input.pointer.y;
      if (
        pointerX >= pointerViewport.x &&
        pointerX <= pointerViewport.x + pointerViewport.width &&
        pointerY >= pointerViewport.y &&
        pointerY <= pointerViewport.y + pointerViewport.height
      ) {
reticle.x = clamp(
  (pointerX - pointerViewport.x) / pointerViewport.scaleX,
  viewportMinX,
  viewportMaxX,
);

reticle.y = clamp(
  (pointerY - pointerViewport.y) / pointerViewport.scaleY,
  viewportMinY,
  viewportMaxY,
);
      }
    }

    // Interactive Tap on Bridge Officers
    if (input.pointer.down && input.actions.tap && input.pointer.y >= canvasHeight * 0.52) {
      for (let i = 0; i < OFFICER_STATIONS.length; i++) {
        const st = OFFICER_STATIONS[i];
        const stX = canvasWidth * st.xFactor;
        const stY = canvasHeight * st.yFactor;
        const charSize = st.charSize;
        const dx = input.pointer.x - stX;
        const dy = input.pointer.y - (stY + charSize / 2);
        if (Math.abs(dx) < charSize * 0.55 && Math.abs(dy) < charSize * 0.55) {
          gameAudio.playCrispClick();
          speakDialogue(st.name, st.role.toUpperCase(), st.quote, st.color);
          break;
        }
      }
    }

    // Keyboard steer reticle
    const steerSpeed = 480 + pGrid.engines * 80;
    if (input.actions.left) reticle.x -= steerSpeed * dt;
    if (input.actions.right) reticle.x += steerSpeed * dt;
    if (input.actions.up) reticle.y -= steerSpeed * dt;
    if (input.actions.down) reticle.y += steerSpeed * dt;

    reticle.x = clamp(reticle.x, viewportMinX, viewportMaxX);
    reticle.y = clamp(reticle.y, viewportMinY, viewportMaxY);

    // Player Starship smooth movement following reticle X with slight tilt
    const targetShipX = canvasWidth * 0.5 + (reticle.x - canvasWidth * 0.5) * 0.45;
    const targetShipTilt = (reticle.x - sim.playerShipX) * 0.0015;
    sim.playerShipX += (targetShipX - sim.playerShipX) * dt * 4.0;
    sim.playerShipTilt += (targetShipTilt - sim.playerShipTilt) * dt * 6.0;

    // Thruster exhaust particles
    sim.playerShipThrustTimer += dt;
    if (sim.playerShipThrustTimer > 0.05) {
      sim.playerShipThrustTimer = 0;
      spawnParticle(
        sim.playerShipX - 22,
        sim.playerShipY + 18,
        (Math.random() - 0.5) * 20,
        120 + Math.random() * 80,
        Math.random() * 4 + 2,
        '#38bdf8',
        0.22,
      );
      spawnParticle(
        sim.playerShipX + 22,
        sim.playerShipY + 18,
        (Math.random() - 0.5) * 20,
        120 + Math.random() * 80,
        Math.random() * 4 + 2,
        '#38bdf8',
        0.22,
      );
    }

    // Auto-Aim Assist
    const autoAim = getConfig('autoAimAssist') as boolean;
    let closestEnemy: EnemyShip | null = null;
    let closestDist = 999999;
    const lockRadius = 150 + pGrid.sensors * 40;
    const enemies = enemiesRef.current;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.z > 60) {
        const dx = e.x - reticle.x;
        const dy = e.y - reticle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < lockRadius && dist < closestDist) {
          closestDist = dist;
          closestEnemy = e;
        }
      }
    }

    if (closestEnemy && autoAim) {
      const e = closestEnemy as EnemyShip;
      reticle.lockedTargetId = e.id;
      reticle.lockProgress = Math.min(1.0, reticle.lockProgress + dt * 3.0);
      reticle.x += (e.x - reticle.x) * dt * (3.5 + pGrid.sensors * 0.9);
      reticle.y += (e.y - reticle.y) * dt * (3.5 + pGrid.sensors * 0.9);
    } else {
      reticle.lockedTargetId = null;
      reticle.lockProgress = Math.max(0, reticle.lockProgress - dt * 3.0);
    }

    // Firing edge detection
    const isConfirmPressed = input.actions.confirm;
    if (isConfirmPressed && !keyEdges.current.fireLaser) {
      triggerFireLaser();
    }
    keyEdges.current.fireLaser = isConfirmPressed;

// Warp Jump Transition Animation Handling
if (sim.warpJumpAnimation > 0) {
  sim.warpJumpAnimation = Math.max(
    0,
    sim.warpJumpAnimation - dt,
  );

  if (sim.warpJumpAnimation <= 0) {
    if (level >= 25) {
      setGameState((prev) => ({
        ...prev,
        status: 'VICTORY',
      }));
      return;
    } else {
      const nextLevel = level + 1;

      // Reset progress for the new sector.
      sim.sectorProgress = 0;
      sim.enemiesDefeatedInSector = 0;

      // Award 5 torpedoes, carrying unused forward (max 25)
      sim.torpedoes = Math.min(25, sim.torpedoes + 5);

      // Award +1 bonus point if nextLevel is in BONUS_POINT_SECTORS
      const earnsBonusPoint = BONUS_POINT_SECTORS.includes(nextLevel);
      if (earnsBonusPoint) {
        setBonusPoints((prev) => {
          const next = prev + 1;
          bonusPointsRef.current = next;
          return next;
        });
      }

      // Restore 25 hull integrity on sector transit
      sim.hull = Math.min(100, sim.hull + 25);

      // Update the displayed sector and ammunition.
      setGameState((prev) => ({
        ...prev,
        level: nextLevel,
        score: prev.score + 1000,
        torpedoes: sim.torpedoes,
        maxTorpedoes: 25,
        sectorProgress: 0,
      }));

      gameAudio.playPowerupChime();

      speakDialogue(
        'Capt. Reynolds',
        'Command',
        `Warp completed. Entering Sector ${nextLevel}/25. All stations ready!`,
        '#fbbf24',
      );
    }
  }

  return;
}

// --- ENEMY SPAWNING & COMBAT ARENA MANAGEMENT (25 SECTORS) ---
const spawnMultiplier = getConfig('enemySpawnRate') as number;
const maxEnemiesOnScreen = Math.min(6, 2 + Math.floor((level - 1) / 5));
const spawnPace = 0.16;

if (
  enemies.length < maxEnemiesOnScreen &&
  Math.random() <
    0.035 * spawnMultiplier * (1 + level * 0.08) * spawnPace
) {
  const isBossSector = level % 5 === 0;
  const hasBossSpawned = enemies.some(
    (e) =>
      e.type === 'dreadnought' ||
      (isBossSector && e.maxHealth >= 350 && (e.type === 'cruiser' || e.type === 'corsair')),
  );

  if (isBossSector && !hasBossSpawned && sim.sectorProgress >= 20) {
    if (level === 5) {
      // Sector 5 Boss: Void Vanguard Cruiser
      const cruiserRatio =
        (getConfig('assetEnemyVoidCruiserAspectRatio') as number) || 883 / 367;
      const bW = 240;
      const bH = Math.round(bW / cruiserRatio);
      enemies.push({
        id: `boss_vanguard_${Date.now()}`,
        type: 'cruiser',
        x: canvasWidth / 2,
        y: canvasHeight * 0.22,
        z: 700,
        vx: 35,
        vy: 0,
        vz: -25,
        width: bW * 0.45,
        height: bH * 0.45,
        baseWidth: bW,
        baseHeight: bH,
        aspectRatio: cruiserRatio,
        health: 450,
        maxHealth: 450,
        shield: 200,
        maxShield: 200,
        fireCooldown: 1.6,
        rotation: 0,
        rotSpeed: 0,
        scoreValue: 2500,
        phase: 1,
      });
      sim.alertStatus = 'RED';
      speakDialogue(
        "Lt. T'Mera",
        'Science',
        'RED ALERT! Sector 5 Boss: Dominion Vanguard Cruiser detected!',
        '#ef4444',
      );
    } else if (level === 10) {
      // Sector 10 Boss: Twin Strike Cruisers
      const cruiserRatio =
        (getConfig('assetEnemyVoidCruiserAspectRatio') as number) || 883 / 367;
      const bW = 220;
      const bH = Math.round(bW / cruiserRatio);
      enemies.push(
        {
          id: `boss_twin_1_${Date.now()}`,
          type: 'cruiser',
          x: canvasWidth * 0.35,
          y: canvasHeight * 0.22,
          z: 720,
          vx: 30,
          vy: 0,
          vz: -25,
          width: bW * 0.42,
          height: bH * 0.42,
          baseWidth: bW,
          baseHeight: bH,
          aspectRatio: cruiserRatio,
          health: 500,
          maxHealth: 500,
          shield: 250,
          maxShield: 250,
          fireCooldown: 1.8,
          rotation: 0,
          rotSpeed: 0,
          scoreValue: 2000,
          phase: 1,
        },
        {
          id: `boss_twin_2_${Date.now()}`,
          type: 'cruiser',
          x: canvasWidth * 0.65,
          y: canvasHeight * 0.22,
          z: 720,
          vx: -30,
          vy: 0,
          vz: -25,
          width: bW * 0.42,
          height: bH * 0.42,
          baseWidth: bW,
          baseHeight: bH,
          aspectRatio: cruiserRatio,
          health: 500,
          maxHealth: 500,
          shield: 250,
          maxShield: 250,
          fireCooldown: 1.8,
          rotation: 0,
          rotSpeed: 0,
          scoreValue: 2000,
          phase: 1,
        },
      );
      sim.alertStatus = 'RED';
      speakDialogue(
        'Cmdr. Vance',
        'Tactical',
        'RED ALERT! Sector 10 Boss: Dominion Twin Strike Cruisers closing in!',
        '#ef4444',
      );
    } else if (level === 15) {
      // Sector 15 Boss: Armored Corsair Warlord
      const corsairRatio =
        (getConfig('assetStarshipEnemyCruiserAspectRatio') as number) || 909 / 574;
      const bW = 260;
      const bH = Math.round(bW / corsairRatio);
      enemies.push({
        id: `boss_corsair_${Date.now()}`,
        type: 'corsair',
        x: canvasWidth / 2,
        y: canvasHeight * 0.24,
        z: 700,
        vx: 40,
        vy: 0,
        vz: -22,
        width: bW * 0.45,
        height: bH * 0.45,
        baseWidth: bW,
        baseHeight: bH,
        aspectRatio: corsairRatio,
        health: 1000,
        maxHealth: 1000,
        shield: 500,
        maxShield: 500,
        fireCooldown: 1.5,
        rotation: 0,
        rotSpeed: 0,
        scoreValue: 5000,
        phase: 1,
      });
      sim.alertStatus = 'RED';
      speakDialogue(
        "Lt. T'Mera",
        'Science',
        'RED ALERT! Sector 15 Boss: Armored Corsair Warlord locking weapons!',
        '#ef4444',
      );
    } else if (level === 20) {
      // Sector 20 Boss: Dominion Battle Dreadnought
      const dreadRatio =
        (getConfig('assetEnemyBossDreadnoughtAspectRatio') as number) || 865 / 462;
      const bW = 310;
      const bH = Math.round(bW / dreadRatio);
      enemies.push({
        id: `boss_dread_20_${Date.now()}`,
        type: 'dreadnought',
        x: canvasWidth / 2,
        y: canvasHeight * 0.22,
        z: 700,
        vx: 28,
        vy: 0,
        vz: -20,
        width: bW * 0.4,
        height: bH * 0.4,
        baseWidth: bW,
        baseHeight: bH,
        aspectRatio: dreadRatio,
        health: 1800,
        maxHealth: 1800,
        shield: 800,
        maxShield: 800,
        fireCooldown: 1.6,
        rotation: 0,
        rotSpeed: 0,
        scoreValue: 8000,
        phase: 1,
      });
      sim.alertStatus = 'RED';
      speakDialogue(
        'Capt. Reynolds',
        'Command',
        'RED ALERT! Sector 20 Boss: Dominion Battle Dreadnought entering viewport!',
        '#ef4444',
      );
    } else if (level === 25) {
      // Sector 25 Boss: Supreme Command Dreadnought (Final Boss!)
      const dreadRatio =
        (getConfig('assetEnemyBossDreadnoughtAspectRatio') as number) || 865 / 462;
      const bW = 340;
      const bH = Math.round(bW / dreadRatio);
      enemies.push({
        id: `boss_supreme_${Date.now()}`,
        type: 'dreadnought',
        x: canvasWidth / 2,
        y: canvasHeight * 0.22,
        z: 700,
        vx: 32,
        vy: 0,
        vz: -18,
        width: bW * 0.45,
        height: bH * 0.45,
        baseWidth: bW,
        baseHeight: bH,
        aspectRatio: dreadRatio,
        health: 2600,
        maxHealth: 2600,
        shield: 1200,
        maxShield: 1200,
        fireCooldown: 1.4,
        rotation: 0,
        rotSpeed: 0,
        scoreValue: 15000,
        phase: 1,
      });
      sim.alertStatus = 'RED';
      speakDialogue(
        'Capt. Reynolds',
        'Command',
        'RED ALERT! FINAL SECTOR 25: Supreme Dominion Flagship Dreadnought engaged! Fire at will!',
        '#ef4444',
      );
    }
  } else {
    const roll = Math.random();

    const spawnX =
      viewportMinX +
      60 +
      Math.random() * (viewportMaxX - viewportMinX - 120);

    const spawnY =
      viewportMinY +
      40 +
      Math.random() * (viewportMaxY - viewportMinY - 80);

    if (roll < 0.35) {
      const interceptorRatio =
        (getConfig('assetEnemyInterceptorAspectRatio') as number) ||
        819 / 279;

      const w = 120;
      const h = Math.round(w / interceptorRatio);

      enemies.push({
        id: `enemy_int_${Date.now()}_${Math.random()}`,
        type: 'interceptor',
        x: spawnX,
        y: spawnY,
        z: 750,
        vx: (Math.random() - 0.5) * 130,
        vy: (Math.random() - 0.5) * 90,
        vz: -(90 + level * 20),
        width: w * 0.500,
        height: h * 0.500,
        baseWidth: w,
        baseHeight: h,
        aspectRatio: interceptorRatio,
        health: 45 + level * 12,
        maxHealth: 45 + level * 12,
        fireCooldown: 1.2 + Math.random() * 1.5,
        rotation: 0,
        rotSpeed: 0,
        scoreValue: 150 + level * 25,
      });
    } else if (roll < 0.6 && level >= 2) {
      const cruiserRatio =
        (getConfig('assetEnemyVoidCruiserAspectRatio') as number) ||
        883 / 367;

      const w = 190;
      const h = Math.round(w / cruiserRatio);

      enemies.push({
        id: `enemy_cruiser_${Date.now()}_${Math.random()}`,
        type: 'cruiser',
        x: spawnX,
        y: spawnY,
        z: 780,
        vx: (Math.random() - 0.5) * 70,
        vy: (Math.random() - 0.5) * 50,
        vz: -(65 + level * 15),
        width: w * 0.500,
        height: h * 0.500,
        baseWidth: w,
        baseHeight: h,
        aspectRatio: cruiserRatio,
        health: 150 + level * 35,
        maxHealth: 150 + level * 35,
        shield: 60 + level * 20,
        maxShield: 60 + level * 20,
        fireCooldown: 2.0,
        rotation: 0,
        rotSpeed: 0,
        scoreValue: 400 + level * 60,
      });
    } else if (roll < 0.75 && level >= 3) {
      const corsairRatio =
        (getConfig('assetStarshipEnemyCruiserAspectRatio') as number) ||
        909 / 574;

      const w = 210;
      const h = Math.round(w / corsairRatio);

      enemies.push({
        id: `enemy_corsair_${Date.now()}_${Math.random()}`,
        type: 'corsair',
        x: spawnX,
        y: spawnY,
        z: 780,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 40,
        vz: -(55 + level * 12),
        width: w * 0.500,
        height: h * 0.500,
        baseWidth: w,
        baseHeight: h,
        aspectRatio: corsairRatio,
        health: 220 + level * 40,
        maxHealth: 220 + level * 40,
        shield: 100 + level * 25,
        maxShield: 100 + level * 25,
        fireCooldown: 2.2,
        rotation: 0,
        rotSpeed: 0,
        scoreValue: 600 + level * 80,
      });
    } else if (roll < 0.88) {
      const astRatio =
        (getConfig('assetHazardAsteroidAspectRatio') as number) || 1.0;

      const w = 95 + Math.random() * 40;
      const h = Math.round(w / astRatio);

      enemies.push({
        id: `hazard_ast_${Date.now()}_${Math.random()}`,
        type: 'asteroid',
        x: spawnX,
        y: spawnY,
        z: 800,
        vx: (Math.random() - 0.5) * 90,
        vy: (Math.random() - 0.5) * 70,
        vz: -120,
        width: w * 0.500,
        height: h * 0.500,
        baseWidth: w,
        baseHeight: h,
        aspectRatio: astRatio,
        health: 40 + level * 10,
        maxHealth: 40 + level * 10,
        fireCooldown: 9999,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2,
        scoreValue: 90,
      });
    } else {
      const mineRatio =
        (getConfig('assetHazardPlasmaMineAspectRatio') as number) || 1.0;

      const w = 80;
      const h = Math.round(w / mineRatio);

      enemies.push({
        id: `hazard_mine_${Date.now()}_${Math.random()}`,
        type: 'plasma_mine',
        x: spawnX,
        y: spawnY,
        z: 800,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        vz: -80,
        width: w * 0.500,
        height: h * 0.500,
        baseWidth: w,
        baseHeight: h,
        aspectRatio: mineRatio,
        health: 30,
        maxHealth: 30,
        fireCooldown: 9999,
        rotation: 0,
        rotSpeed: 1.8,
        scoreValue: 140,
      });
    }
  }
}
    // --- UPDATE ENEMIES & ENEMY ACTIONS ---
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.z += e.vz * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rotation += e.rotSpeed * dt;
      if (e.hitFlash && e.hitFlash > 0) e.hitFlash -= dt * 6;

      // Keep enemies in viewport horizontal bounds
      if (e.x < viewportMinX + 60 || e.x > viewportMaxX - 60) e.vx *= -1;
      if (e.y < viewportMinY + 30 || e.y > viewportMaxY - 20) e.vy *= -1;

      // 2.5D Scale factor: scale increases as Z approaches 100
      const scale = Math.max(0.2, (800 - e.z) / 600);
      e.width = e.baseWidth * scale;
      e.height = e.baseHeight * scale;

      // Enemy firing logic
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.z < 620 && e.z > 140) {
        if (e.type === 'interceptor') {
          const ang = Math.atan2(sim.playerShipY - e.y, sim.playerShipX - e.x);
          const spd = 380;
          projectilesRef.current.push({
            id: `e_laser_${Date.now()}_${Math.random()}`,
            type: 'enemy_laser',
            x: e.x,
            y: e.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            width: 26,
            height: 8,
            damage: 12 + level * 2,
            angle: ang,
            life: 2.2,
          });
          e.fireCooldown = 1.8 + Math.random() * 1.2;
        } else if (e.type === 'cruiser') {
          projectilesRef.current.push(
            {
              id: `e_beam_1_${Date.now()}`,
              type: 'enemy_laser',
              x: e.x - e.width * 0.3,
              y: e.y,
              vx: -20,
              vy: 360,
              width: 30,
              height: 10,
              damage: 16 + level * 2,
              angle: Math.PI / 2,
              life: 2.0,
            },
            {
              id: `e_beam_2_${Date.now()}`,
              type: 'enemy_laser',
              x: e.x + e.width * 0.3,
              y: e.y,
              vx: 20,
              vy: 360,
              width: 30,
              height: 10,
              damage: 16 + level * 2,
              angle: Math.PI / 2,
              life: 2.0,
            },
          );
          e.fireCooldown = 2.4;
        } else if (e.type === 'corsair') {
          projectilesRef.current.push({
            id: `e_torp_${Date.now()}`,
            type: 'enemy_plasma',
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 60,
            vy: 280,
            width: 26,
            height: 26,
            damage: 28 + level * 4,
            angle: Math.PI / 2,
            life: 2.8,
          });
          e.fireCooldown = 2.6;
        } else if (e.type === 'dreadnought') {
          for (let b = -2; b <= 2; b++) {
            const ang = Math.PI / 2 + b * 0.22;
            projectilesRef.current.push({
              id: `boss_proj_${Date.now()}_${b}`,
              type: b % 2 === 0 ? 'enemy_plasma' : 'enemy_laser',
              x: e.x + b * 40,
              y: e.y + 20,
              vx: Math.cos(ang) * 320,
              vy: Math.sin(ang) * 320,
              width: 24,
              height: 16,
              damage: 22,
              angle: ang,
              life: 2.8,
            });
          }
          e.fireCooldown = 2.2;
        }
      }

      // Keep enemy warships in combat range - they DO NOT crash into the starship and must be destroyed!
      if (e.type !== 'asteroid' && e.type !== 'plasma_mine') {
        if (e.z <= 220 && e.vz < 0) {
          e.vz = Math.abs(e.vz) * (0.85 + Math.random() * 0.35);
          e.vx = (Math.random() - 0.5) * 160;
        } else if (e.z >= 680 && e.vz > 0) {
          e.vz = -Math.abs(e.vz);
        }
      }

      // Cosmic Hazards (Asteroids and Plasma Mines) WILL crash into the player ship if not destroyed!
      if (e.z <= 120 && (e.type === 'asteroid' || e.type === 'plasma_mine')) {
        // Asteroids specifically damage SHIELDS; Mines specifically damage HULL
        const impactDamage = e.type === 'asteroid' ? 40 : 30;
        applyHazardDamageToShip(e.type, impactDamage);
        gameAudio.playChiptuneExplosion();

        for (let p = 0; p < 14; p++) {
          spawnParticle(
            e.x,
            e.y,
            (Math.random() - 0.5) * 350,
            (Math.random() - 0.5) * 350,
            Math.random() * 6 + 3,
            e.type === 'asteroid' ? '#94a3b8' : '#a855f7',
            0.45,
          );
        }
        enemies[i] = enemies[enemies.length - 1];
        enemies.pop();
        continue;
      }
    }

    // --- UPDATE PROJECTILES ---
    const projs = projectilesRef.current;
    for (let pIdx = projs.length - 1; pIdx >= 0; pIdx--) {
      const p = projs[pIdx];
      p.life -= dt;

      // Homing for torpedoes
      if (p.homing && p.targetId) {
        const target = enemies.find((e) => e.id === p.targetId);
        if (target) {
          const dx = target.x - p.x;
          const dy = target.y - p.y;
          const targetAngle = Math.atan2(dy, dx);
          let diff = targetAngle - p.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          p.angle += clamp(diff, -5.5 * dt, 5.5 * dt);
          const spd = 650;
          p.vx = Math.cos(p.angle) * spd;
          p.vy = Math.sin(p.angle) * spd;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Torpedo rocket exhaust trail
      if (p.type === 'player_torpedo') {
        spawnParticle(
          p.x - Math.cos(p.angle) * 14,
          p.y - Math.sin(p.angle) * 14,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40,
          Math.random() * 4 + 2,
          '#fbbf24',
          0.18,
        );
      }

      // Player Projectiles vs Enemies
      if (p.type === 'player_laser' || p.type === 'player_torpedo') {
        let hit = false;
        for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
          const e = enemies[eIdx];
          const halfW = e.width / 2 + 10;
          const halfH = e.height / 2 + 10;
          if (
            p.x >= e.x - halfW &&
            p.x <= e.x + halfW &&
            p.y >= e.y - halfH &&
            p.y <= e.y + halfH
          ) {
            hit = true;
            e.hitFlash = 1.0;

            if (e.shield && e.shield > 0) {
              const shieldDmg = Math.min(e.shield, p.damage);
              e.shield -= shieldDmg;
              const overflow = p.damage - shieldDmg;
              e.health -= overflow;
            } else {
              e.health -= p.damage;
            }

            const isTorp = p.type === 'player_torpedo';
            const numSparks = isTorp ? 12 : 4;
            for (let s = 0; s < numSparks; s++) {
              spawnParticle(
                p.x,
                p.y,
                (Math.random() - 0.5) * (isTorp ? 320 : 160),
                (Math.random() - 0.5) * (isTorp ? 320 : 160),
                Math.random() * 4 + 2,
                isTorp ? '#fbbf24' : '#38bdf8',
                0.25,
              );
            }

            if (isTorp) {
              gameAudio.playChiptuneExplosion();
            }

            if (e.health <= 0) {
              handleEnemyDestroyed(e);
              enemies[eIdx] = enemies[enemies.length - 1];
              enemies.pop();
            }
            break;
          }
        }
        if (hit || p.life <= 0) {
          projs[pIdx] = projs[projs.length - 1];
          projs.pop();
          continue;
        }
      }

      // Enemy Projectiles vs Starship
      if (p.type === 'enemy_laser' || p.type === 'enemy_torpedo' || p.type === 'enemy_plasma') {
        const dx = p.x - sim.playerShipX;
        const dy = p.y - sim.playerShipY;
        const hitDistance = Math.sqrt(dx * dx + dy * dy);

        if (hitDistance < 45 || p.y >= canvasHeight * 0.48) {
          applyDamageToShip(p.damage);
          for (let sp = 0; sp < 6; sp++) {
            spawnParticle(
              p.x,
              p.y,
              (Math.random() - 0.5) * 200,
              -Math.random() * 140,
              Math.random() * 4 + 2,
              '#ef4444',
              0.3,
            );
          }
          projs[pIdx] = projs[projs.length - 1];
          projs.pop();
          continue;
        }
        if (p.life <= 0) {
          projs[pIdx] = projs[projs.length - 1];
          projs.pop();
          continue;
        }
      }
    }

    // --- UPDATE RESOURCE DROPS ---
    const drops = dropsRef.current;
    for (let dIdx = drops.length - 1; dIdx >= 0; dIdx--) {
      const drop = drops[dIdx];
      drop.life -= dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;

      const dx = reticle.x - drop.x;
      const dy = reticle.y - drop.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const collectRadius = 80 + pGrid.sensors * 20;

      if (dist < collectRadius || drop.y > canvasHeight * 0.48) {
        if (drop.type === 'energy_cell') {
          sim.shields = Math.min(
            (getConfig('maxShieldCapacity') as number) +
              shipUpgrades.shieldMatrix * 20,
            sim.shields + 30,
          );
          sim.score += 100;
          gameAudio.playCoinPickup();
        } else if (drop.type === 'nanite_repair') {
          const maxH =
            (getConfig('maxHullIntegrity') as number) +
            shipUpgrades.hullPlating * 25;
          sim.hull = Math.min(maxH, sim.hull + 25);
          sim.score += 150;
          gameAudio.playPowerupChime();
        } else if (drop.type === 'dilithium_crystal') {
          sim.dilithiumCollected += 1;
          sim.score += 250;
          setDilithiumReserve((prev) => prev + 1);
          gameAudio.playCoinPickup();
        }
        drops[dIdx] = drops[drops.length - 1];
        drops.pop();
        continue;
      }

      if (drop.life <= 0) {
        drops[dIdx] = drops[drops.length - 1];
        drops.pop();
      }
    }

    // --- UPDATE PARTICLES ---
    const particles = particlesRef.current;
    for (let pIdx = particles.length - 1; pIdx >= 0; pIdx--) {
      const part = particles[pIdx];
      part.life -= dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.alpha = Math.max(0, part.life / part.maxLife);
      if (part.life <= 0) {
        particles[pIdx] = particles[particles.length - 1];
        particles.pop();
      }
    }

    // --- UPDATE FLOATING COMBAT TEXTS ---
    const ftexts = floatingTextsRef.current;
    for (let fIdx = ftexts.length - 1; fIdx >= 0; fIdx--) {
      const ft = ftexts[fIdx];
      ft.life -= dt;
      ft.y -= 40 * dt;
      if (ft.life <= 0) {
        ftexts[fIdx] = ftexts[ftexts.length - 1];
        ftexts.pop();
      }
    }

    // --- UPDATE CONDUIT SPARKS ---
    const conduits = conduitsRef.current;
    for (let cIdx = 0; cIdx < conduits.length; cIdx++) {
      const conduit = conduits[cIdx];
      if (conduit.damaged) {
        conduit.sparkTimer -= dt;
        if (conduit.sparkTimer <= 0) {
          conduit.sparkTimer = 0.2 + Math.random() * 0.4;
          for (let i = 0; i < 3; i++) {
            spawnParticle(
              conduit.x,
              conduit.y,
              (Math.random() - 0.5) * 120,
              -Math.random() * 150,
              Math.random() * 3 + 2,
              Math.random() > 0.5 ? '#f59e0b' : '#ef4444',
              0.25,
            );
          }
        }
      }
    }

    // Alert status calculation
    if (sim.hull < 35) {
      sim.alertStatus = 'RED';
      sim.redAlertStrobe = (sim.redAlertStrobe + dt * 5) % (Math.PI * 2);
    } else if (enemies.some((e) => e.type === 'cruiser' || e.type === 'corsair' || e.type === 'dreadnought')) {
      sim.alertStatus = 'YELLOW';
    } else {
      sim.alertStatus = 'NORMAL';
    }

    // Sector Progress & Warp trigger (25 Sectors)
    if (sim.warpJumpAnimation <= 0) {
      const isBossLevel = level % 5 === 0;
      const targetKills = isBossLevel ? 1 : Math.min(18, 5 + level);
      sim.sectorProgress = Math.min(
        100,
        Math.round((sim.enemiesDefeatedInSector / targetKills) * 100),
      );

      const hasBossAlive = enemies.some(
        (e) =>
          e.type === 'dreadnought' ||
          (isBossLevel && e.maxHealth >= 350 && (e.type === 'cruiser' || e.type === 'corsair')),
      );

      if (sim.sectorProgress >= 100 && enemies.length === 0 && !hasBossAlive) {
        if (level >= 25) {
          setGameState((prev) => ({...prev, status: 'VICTORY'}));
          return;
        }
        sim.warpJumpAnimation = 2.5;
        gameAudio.playVictoryFanfare();
        speakDialogue(
          'Capt. Reynolds',
          'Command',
          `Sector ${level} cleared! Engaging warp drive to next waypoint.`,
          '#fbbf24',
        );
      }
    }

    // Throttled HUD sync (every ~80ms) with reference guard to prevent 60 FPS React re-renders
    hudSyncTimerRef.current += dt;
    if (hudSyncTimerRef.current >= 0.08) {
      hudSyncTimerRef.current = 0;
      setGameState((prev) => {
        const roundedHull = Math.round(sim.hull);
        const roundedShields = Math.round(sim.shields);
        if (
          prev.hull === roundedHull &&
          prev.shields === roundedShields &&
          prev.torpedoes === sim.torpedoes &&
          prev.sectorProgress === sim.sectorProgress &&
          prev.alertLevel === sim.alertStatus &&
          prev.score === sim.score
        ) {
          return prev;
        }
        return {
          ...prev,
          hull: roundedHull,
          shields: roundedShields,
          torpedoes: sim.torpedoes,
          sectorProgress: sim.sectorProgress,
          alertLevel: sim.alertStatus,
          score: sim.score,
        };
      });
    }
  };

  // Helper when taking ship damage
  const applyDamageToShip = (rawDamage: number) => {
    const sim = simRef.current;
    const dodgeChance = subsystemLevelsRef.current.engines * 0.08;
    if (Math.random() < dodgeChance) {
      sim.playerShipDodgeTimer = 0.4;
      addFloatingText('EVADED!', sim.playerShipX, sim.playerShipY - 45, '#38bdf8');
      gameAudio.playShieldBlock();
      return;
    }

    const pulseMod = sim.shieldPulseActiveTimer > 0 ? 0.2 : 1.0;
    const actualDmg = rawDamage * pulseMod;
    sim.cameraShake = Math.min(20, sim.cameraShake + actualDmg * 0.45);

    if (sim.shields > 0) {
      const absorbed = Math.min(sim.shields, actualDmg);
      sim.shields -= absorbed;
      const leftover = actualDmg - absorbed;
      sim.hull -= leftover;
      gameAudio.playShieldBlock();
    } else {
      sim.hull -= actualDmg;
      gameAudio.playGunshotBlast();

      if (Math.random() < 0.45) {
        const undamagedConduits = conduitsRef.current.filter((c) => !c.damaged);
        if (undamagedConduits.length > 0) {
          const randomConduit =
            undamagedConduits[Math.floor(Math.random() * undamagedConduits.length)];
          randomConduit.damaged = true;
          speakDialogue(
            'Chief O\'Malley',
            'Engineering',
            `Console overload at ${randomConduit.name}! Damage control needed!`,
            '#ef4444',
          );
        }
      }
    }

    if (sim.hull <= 0) {
      sim.hull = 0;
      setGameState((prev) => ({...prev, status: 'GAME_OVER'}));
    }
  };

  // Helper when cosmic hazards (Asteroids and Mines) hit the starship
  const applyHazardDamageToShip = (hazardType: 'asteroid' | 'plasma_mine', rawDamage: number) => {
    const sim = simRef.current;
    const dodgeChance = subsystemLevelsRef.current.engines * 0.08;
    if (Math.random() < dodgeChance) {
      sim.playerShipDodgeTimer = 0.4;
      addFloatingText('EVADED!', sim.playerShipX, sim.playerShipY - 45, '#38bdf8');
      gameAudio.playShieldBlock();
      return;
    }

    const pulseMod = sim.shieldPulseActiveTimer > 0 ? 0.2 : 1.0;
    const actualDmg = rawDamage * pulseMod;
    sim.cameraShake = Math.min(20, sim.cameraShake + actualDmg * 0.5);

    if (hazardType === 'asteroid') {
      // ASTEROIDS damage the player's SHIELDS
      if (sim.shields > 0) {
        const absorbed = Math.min(sim.shields, actualDmg);
        sim.shields -= absorbed;
        const leftover = actualDmg - absorbed;
        sim.hull -= leftover;
        gameAudio.playShieldBlock();
      } else {
        sim.hull -= actualDmg;
        gameAudio.playGunshotBlast();
      }
    } else {
      // MINES pierce shields and damage the player's HULL directly
      sim.hull -= actualDmg;
      gameAudio.playGunshotBlast();

      const undamagedConduits = conduitsRef.current.filter((c) => !c.damaged);
      if (undamagedConduits.length > 0) {
        const randomConduit =
          undamagedConduits[Math.floor(Math.random() * undamagedConduits.length)];
        randomConduit.damaged = true;
        speakDialogue(
          'Chief O\'Malley',
          'Engineering',
          `Plasma Mine detonation! Console overload at ${randomConduit.name}!`,
          '#ef4444',
        );
      }
    }

    if (sim.hull <= 0) {
      sim.hull = 0;
      setGameState((prev) => ({...prev, status: 'GAME_OVER'}));
    }
  };

  // Helper when an enemy is destroyed
  const handleEnemyDestroyed = (e: EnemyShip) => {
    const sim = simRef.current;
    sim.enemiesDefeatedInSector += 1;
    sim.score += e.scoreValue;

    gameAudio.playChiptuneExplosion();

    for (let p = 0; p < 18; p++) {
      spawnParticle(
        e.x,
        e.y,
        (Math.random() - 0.5) * 400,
        (Math.random() - 0.5) * 400,
        Math.random() * 7 + 3,
        Math.random() > 0.6
          ? '#f97316'
          : Math.random() > 0.3
            ? '#fbbf24'
            : '#ef4444',
        0.55,
      );
    }

    const dropRoll = Math.random();
    if (dropRoll < 0.35) {
      const cellRatio = (getConfig('assetItemEnergyCellAspectRatio') as number) || 2.0;
      const w = 44;
      dropsRef.current.push({
        id: `drop_${Date.now()}_${Math.random()}`,
        type: 'energy_cell',
        x: e.x,
        y: e.y,
        vx: (Math.random() - 0.5) * 40,
        vy: 70,
        width: w,
        height: Math.round(w / cellRatio),
        aspectRatio: cellRatio,
        life: 8.0,
      });
    } else if (dropRoll < 0.65) {
      const naniteRatio = (getConfig('assetItemNaniteRepairAspectRatio') as number) || 2.0;
      const w = 44;
      dropsRef.current.push({
        id: `drop_${Date.now()}_${Math.random()}`,
        type: 'nanite_repair',
        x: e.x,
        y: e.y,
        vx: (Math.random() - 0.5) * 40,
        vy: 70,
        width: w,
        height: Math.round(w / naniteRatio),
        aspectRatio: naniteRatio,
        life: 8.0,
      });
    } else if (dropRoll < 0.95 || e.type === 'cruiser' || e.type === 'corsair' || e.type === 'dreadnought') {
      const crystalRatio = (getConfig('assetItemDilithiumCrystalAspectRatio') as number) || 0.72;
      const w = 38;
      dropsRef.current.push({
        id: `drop_${Date.now()}_${Math.random()}`,
        type: 'dilithium_crystal',
        x: e.x,
        y: e.y,
        vx: (Math.random() - 0.5) * 40,
        vy: 70,
        width: w,
        height: Math.round(w / crystalRatio),
        aspectRatio: crystalRatio,
        life: 10.0,
      });
    }
  };

  // --- DRAW FUNCTION ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    prepareCanvas(ctx, canvasWidth, canvasHeight);

    const sim = simRef.current;

// Camera shake strength: 0 = off, 1 = original strength.
const shakeStrength = 0.25;

const shakeX =
  (Math.random() - 0.5) * sim.cameraShake * shakeStrength;

const shakeY =
  (Math.random() - 0.5) * sim.cameraShake * shakeStrength;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Fill behind the bridge opening, including unused space around the arena.
    const backdrop = assets['bg_deep_nebula'];
    if (backdrop && backdrop.complete && backdrop.naturalWidth > 0) {
      ctx.drawImage(backdrop, 0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    const spaceViewport = getSpaceViewport();
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      spaceViewport.x,
      spaceViewport.y,
      spaceViewport.width,
      spaceViewport.height,
    );
    ctx.clip();
    ctx.translate(spaceViewport.x, spaceViewport.y);
    ctx.scale(spaceViewport.scaleX, spaceViewport.scaleY);


    // ==========================================
    // LAYER 1: DEEP SPACE NEBULA & STARFIELD
    // ==========================================
    const nebulaImg = assets['bg_deep_nebula'];
    if (nebulaImg && nebulaImg.complete && nebulaImg.naturalWidth > 0) {
      ctx.drawImage(nebulaImg, 0, 0, canvasWidth, canvasHeight);
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.5, '#090d24');
      bgGrad.addColorStop(1, '#030712');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.beginPath();
      ctx.arc(canvasWidth * 0.3, canvasHeight * 0.25, 220, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
      ctx.beginPath();
      ctx.arc(canvasWidth * 0.7, canvasHeight * 0.28, 260, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dynamic Starfield with Warp Streaks
    const isWarping = sim.warpJumpAnimation > 0;
    const stars = starsRef.current;
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const k = 400 / Math.max(1, star.z);
      const px = star.x * k + canvasWidth / 2;
      const py = star.y * k + canvasHeight * 0.28;

      if (px >= 0 && px <= canvasWidth && py >= 0 && py <= canvasHeight * 0.55) {
        ctx.fillStyle = star.color;
        if (isWarping) {
          ctx.strokeStyle = star.color;
          ctx.lineWidth = star.size * 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(
            px + (px - canvasWidth / 2) * 0.25,
            py + (py - canvasHeight * 0.28) * 0.25,
          );
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, Math.max(0.5, star.size * k * 0.8), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ==========================================
    // LAYER 2: IN-SPACE COMBAT ARENA
    // ==========================================

    // 2A. Draw Resource Drops
    const drops = dropsRef.current;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const dropImg =
        d.type === 'energy_cell'
          ? assets['item_energy_cell']
          : d.type === 'nanite_repair'
            ? assets['item_nanite_repair']
            : assets['item_dilithium_crystal'];

      drawAsset(
        ctx,
        dropImg,
        d.x - d.width / 2,
        d.y - d.height / 2,
        d.width,
        d.height,
        (fbCtx) => {
          fbCtx.save();
          fbCtx.fillStyle =
            d.type === 'energy_cell'
              ? '#06b6d4'
              : d.type === 'nanite_repair'
                ? '#10b981'
                : '#ec4899';
          fbCtx.shadowColor = fbCtx.fillStyle;
          fbCtx.shadowBlur = 8;
          fbCtx.beginPath();
          fbCtx.arc(d.x, d.y, d.width / 2, 0, Math.PI * 2);
          fbCtx.fill();
          fbCtx.restore();
        },
      );
    }

    // 2B. Draw Enemy Alien Ships & Space Hazards
    const enemies = enemiesRef.current;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.rotation !== 0) {
        ctx.rotate(e.rotation);
      }

      const drawW = Math.max(16, e.width);
      const drawH = Math.max(16, e.height);

      if (e.type === 'interceptor') {
        drawAsset(
          ctx,
          assets['enemy_interceptor'],
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH,
          (fbCtx) => {
            fbCtx.fillStyle = e.hitFlash && e.hitFlash > 0 ? '#ffffff' : '#ef4444';
            fbCtx.beginPath();
            fbCtx.moveTo(0, drawH / 2);
            fbCtx.lineTo(drawW / 2, -drawH / 2);
            fbCtx.lineTo(0, -drawH / 3);
            fbCtx.lineTo(-drawW / 2, -drawH / 2);
            fbCtx.closePath();
            fbCtx.fill();

            fbCtx.fillStyle = '#f97316';
            fbCtx.beginPath();
            fbCtx.arc(0, -drawH / 3, drawW * 0.12, 0, Math.PI * 2);
            fbCtx.fill();
          },
        );
      } else if (e.type === 'cruiser') {
        drawAsset(
          ctx,
          assets['enemy_void_cruiser'],
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH,
          (fbCtx) => {
            fbCtx.fillStyle = e.hitFlash && e.hitFlash > 0 ? '#ffffff' : '#8b5cf6';
            fbCtx.beginPath();
            fbCtx.moveTo(0, drawH / 2);
            fbCtx.lineTo(drawW / 2, drawH * 0.1);
            fbCtx.lineTo(drawW * 0.35, -drawH / 2);
            fbCtx.lineTo(-drawW * 0.35, -drawH / 2);
            fbCtx.lineTo(-drawW / 2, drawH * 0.1);
            fbCtx.closePath();
            fbCtx.fill();

            fbCtx.fillStyle = '#c084fc';
            fbCtx.fillRect(-drawW * 0.15, -drawH * 0.1, drawW * 0.3, drawH * 0.2);
          },
        );
      } else if (e.type === 'corsair') {
        drawAsset(
          ctx,
          assets['starship_enemy_cruiser'],
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH,
          (fbCtx) => {
            fbCtx.fillStyle = e.hitFlash && e.hitFlash > 0 ? '#ffffff' : '#047857';
            fbCtx.beginPath();
            fbCtx.ellipse(0, 0, drawW / 2, drawH / 2, 0, 0, Math.PI * 2);
            fbCtx.fill();

            fbCtx.fillStyle = '#34d399';
            fbCtx.fillRect(-drawW * 0.2, -drawH * 0.2, drawW * 0.4, drawH * 0.4);
          },
        );
      } else if (e.type === 'dreadnought') {
        drawAsset(
          ctx,
          assets['enemy_boss_dreadnought'],
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH,
          (fbCtx) => {
            fbCtx.fillStyle = e.hitFlash && e.hitFlash > 0 ? '#ffffff' : '#b91c1c';
            fbCtx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);

            fbCtx.fillStyle = '#fbbf24';
            fbCtx.beginPath();
            fbCtx.arc(0, 0, drawW * 0.2, 0, Math.PI * 2);
            fbCtx.fill();
          },
        );
      } else if (e.type === 'asteroid') {
        drawAsset(
          ctx,
          assets['hazard_asteroid'],
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH,
          (fbCtx) => {
            fbCtx.fillStyle = '#78716c';
            fbCtx.beginPath();
            fbCtx.arc(0, 0, drawW / 2, 0, Math.PI * 2);
            fbCtx.fill();
          },
        );
      } else if (e.type === 'plasma_mine') {
        drawAsset(
          ctx,
          assets['hazard_plasma_mine'],
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH,
          (fbCtx) => {
            fbCtx.fillStyle = '#f59e0b';
            fbCtx.beginPath();
            fbCtx.arc(0, 0, drawW / 2, 0, Math.PI * 2);
            fbCtx.fill();
          },
        );
      }

      // Shield Bubble Aura on Enemy
      if (e.shield && e.maxShield && e.shield > 0) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, drawW * 0.65, drawH * 0.65, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Enemy Health & Shield Bar
      if (e.type !== 'asteroid' && e.type !== 'plasma_mine') {
        const barW = Math.max(34, drawW * 0.9);
        const barH = 4;
        const hpPct = clamp(e.health / e.maxHealth, 0, 1);

        if (e.shield && e.maxShield && e.shield > 0) {
          const sPct = clamp(e.shield / e.maxShield, 0, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(-barW / 2, -drawH / 2 - 14, barW, 3);
          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(-barW / 2, -drawH / 2 - 14, barW * sPct, 3);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(-barW / 2, -drawH / 2 - 8, barW, barH);
        ctx.fillStyle =
          hpPct > 0.5 ? '#10b981' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(-barW / 2, -drawH / 2 - 8, barW * hpPct, barH);
      }

      ctx.restore();
    }

// 2B. Draw Orange-Red Phaser Beam
{
  const now = performance.now();

  phaserBeamsRef.current = phaserBeamsRef.current.filter(
    (beam) => beam.expiresAt > now,
  );

  ctx.save();
  ctx.lineCap = 'round';

  for (const beam of phaserBeamsRef.current) {
    const fade = Math.min(
      1,
      Math.max(0, (beam.expiresAt - now) / 140),
    );

    ctx.beginPath();
    ctx.moveTo(beam.startX, beam.startY);
    ctx.lineTo(beam.endX, beam.endY);

    // Wide, soft red glow.
    ctx.globalAlpha = fade * 0.35;
    ctx.strokeStyle = '#ff2400';
    ctx.lineWidth = 14;
    ctx.shadowColor = '#ff2400';
    ctx.shadowBlur = 28;
    ctx.stroke();

    // Bright orange beam body.
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#ff6a00';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#ff4500';
    ctx.shadowBlur = 18;
    ctx.stroke();

    // Hot golden-white inner core.
    ctx.strokeStyle = '#ffe0a3';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff9500';
    ctx.shadowBlur = 8;
    ctx.stroke();
  }

  ctx.restore();
}
    // 2C. Draw Projectiles (Lasers, Plasma, Photon Torpedoes)
    const projs = projectilesRef.current;
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.type === 'player_laser') {
        drawAsset(
          ctx,
          assets['projectile_laser_bolt'],
          -p.width / 2,
          -p.height / 2,
          p.width,
          p.height,
          (fbCtx) => {
            fbCtx.fillStyle = '#38bdf8';
            fbCtx.shadowColor = '#06b6d4';
            fbCtx.shadowBlur = 10;
            fbCtx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          },
        );
      } else if (p.type === 'player_torpedo') {
        drawAsset(
          ctx,
          assets['projectile_photon_torpedo'],
          -p.width / 2,
          -p.height / 2,
          p.width,
          p.height,
          (fbCtx) => {
            fbCtx.fillStyle = '#f59e0b';
            fbCtx.shadowColor = '#fbbf24';
            fbCtx.shadowBlur = 12;
            fbCtx.beginPath();
            fbCtx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
            fbCtx.fill();
          },
        );
} else if (p.type === 'enemy_laser') {
  ctx.fillStyle = '#a855f7';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 10;
  ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
} else if (p.type === 'enemy_torpedo' || p.type === 'enemy_plasma') {
        ctx.fillStyle = '#a855f7';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2D. Draw Particles
    const particles = particlesRef.current;
    for (let i = 0; i < particles.length; i++) {
      const part = particles[i];
      ctx.save();
      ctx.globalAlpha = part.alpha;
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, Math.max(0.5, part.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2E. Draw Player Starship Exterior in Viewscreen Lower Section
    ctx.save();
    ctx.translate(sim.playerShipX, sim.playerShipY);
    ctx.rotate(sim.playerShipTilt);

    const shipW = 140;
    const shipH = 84;
    const playerShipImg = assets['starship_player'];

    if (sim.playerShipDodgeTimer > 0 && playerShipImg && playerShipImg.complete) {
      ctx.save();
      ctx.globalAlpha = 0.5 * (sim.playerShipDodgeTimer / 0.4);
      ctx.drawImage(playerShipImg, -shipW / 2 - 16, -shipH / 2, shipW, shipH);
      ctx.drawImage(playerShipImg, -shipW / 2 + 16, -shipH / 2, shipW, shipH);
      ctx.restore();
    }

    drawAsset(
      ctx,
      playerShipImg,
      -shipW / 2,
      -shipH / 2,
      shipW,
      shipH,
      (fbCtx) => {
        fbCtx.fillStyle = '#e2e8f0';
        fbCtx.strokeStyle = '#06b6d4';
        fbCtx.lineWidth = 2;
        fbCtx.beginPath();
        fbCtx.ellipse(0, -10, 48, 28, 0, 0, Math.PI * 2);
        fbCtx.fill();
        fbCtx.stroke();

        fbCtx.fillStyle = '#06b6d4';
        fbCtx.beginPath();
        fbCtx.arc(0, -10, 8, 0, Math.PI * 2);
        fbCtx.fill();

        fbCtx.fillStyle = '#94a3b8';
        fbCtx.fillRect(-12, 10, 24, 20);

        fbCtx.fillStyle = '#64748b';
        fbCtx.fillRect(-45, 0, 14, 38);
        fbCtx.fillRect(31, 0, 14, 38);

        fbCtx.fillStyle = '#38bdf8';
        fbCtx.fillRect(-45, 0, 14, 8);
        fbCtx.fillRect(31, 0, 14, 8);

        fbCtx.fillStyle = '#ef4444';
        fbCtx.fillRect(-8, 26, 16, 5);
      },
    );

    // Deflector Shield Pulse Wave
    if (sim.shieldPulseActiveTimer > 0) {
      const pulseAlpha = Math.min(0.7, sim.shieldPulseActiveTimer / 1.5);
      ctx.strokeStyle = `rgba(6, 182, 212, ${pulseAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, shipW * 0.75, shipH * 0.85, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(6, 182, 212, ${pulseAlpha * 0.2})`;
      ctx.fill();
    }
    ctx.restore();

    // 2F. Draw Floating Combat Texts (Crits and Dodges)
    const ftexts = floatingTextsRef.current;
    for (let i = 0; i < ftexts.length; i++) {
      const ft = ftexts[i];
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // ==========================================
    // LAYER 3: VIEWSCREEN FRAME & HOLOGRAPHIC TACTICAL RETICLE
    // ==========================================

    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 20, canvasWidth - 60, canvasHeight * 0.50);

    const cornerSize = 24;
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(30, 20 + cornerSize);
    ctx.lineTo(30, 20);
    ctx.lineTo(30 + cornerSize, 20);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(canvasWidth - 30 - cornerSize, 20);
    ctx.lineTo(canvasWidth - 30, 20);
    ctx.lineTo(canvasWidth - 30, 20 + cornerSize);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(30, canvasHeight * 0.52 - cornerSize);
    ctx.lineTo(30, canvasHeight * 0.52);
    ctx.lineTo(30 + cornerSize, canvasHeight * 0.52);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(canvasWidth - 30 - cornerSize, canvasHeight * 0.52);
    ctx.lineTo(canvasWidth - 30, canvasHeight * 0.52);
    ctx.lineTo(canvasWidth - 30, canvasHeight * 0.52 - cornerSize);
    ctx.stroke();

    // Holographic Subspace Radar in Top-Right of Viewscreen

    // Interactive Holographic Targeting Reticle
    const reticle = reticleRef.current;
    ctx.save();
    ctx.translate(reticle.x, reticle.y);
    const reticleSize = 54;

    const reticleImg = assets['ui_tactical_reticle'];
    if (reticleImg && reticleImg.complete && reticleImg.naturalWidth > 0) {
      ctx.drawImage(
        reticleImg,
        -reticleSize / 2,
        -reticleSize / 2,
        reticleSize,
        reticleSize,
      );
    } else {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, reticleSize / 2, 0, Math.PI * 2);
      ctx.moveTo(-reticleSize / 2, 0);
      ctx.lineTo(reticleSize / 2, 0);
      ctx.moveTo(0, -reticleSize / 2);
      ctx.lineTo(0, reticleSize / 2);
      ctx.stroke();
    }

    if (reticle.lockedTargetId) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        (reticleSize / 2 + 8) * (1 - reticle.lockProgress * 0.2),
        0,
        Math.PI * 2 * reticle.lockProgress,
      );
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TARGET LOCKED', 0, -reticleSize / 2 - 8);
    }
    ctx.restore();
    ctx.restore();

    ctx.restore(); // End space viewport; bridge and crew stay full-size.

    // ==========================================
    // LAYER 4: BRIDGE COMMAND INTERIOR & CREW STATIONS
    // ==========================================
    const bridgeY = canvasHeight * 0.52;

    const deckGrad = ctx.createLinearGradient(0, bridgeY, 0, canvasHeight);
    deckGrad.addColorStop(0, '#0f172a');
    deckGrad.addColorStop(0.5, '#090d16');
    deckGrad.addColorStop(1, '#020617');
    ctx.fillStyle = deckGrad;
    ctx.fillRect(0, bridgeY, canvasWidth, canvasHeight - bridgeY);

    const alertStripColor =
      sim.alertStatus === 'RED'
        ? '#ef4444'
        : sim.alertStatus === 'YELLOW'
          ? '#f59e0b'
          : '#06b6d4';
    ctx.fillStyle = alertStripColor;
    ctx.fillRect(0, bridgeY, canvasWidth, 3);

const bridgeImg = assets['bg_bridge_cockpit'];

if (bridgeImg && bridgeImg.complete && bridgeImg.naturalWidth > 0) {
  ctx.save();

  // Keep the bridge opaque; the PNG's opening remains transparent.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Draw the entire bridge image across the canvas.
  ctx.drawImage(
    bridgeImg,
    0,
    0,
    canvasWidth,
    canvasHeight,
  );

  ctx.restore();
}
    if (sim.alertStatus === 'RED') {
      const redAlpha = Math.sin(sim.redAlertStrobe) * 0.16 + 0.16;
      ctx.fillStyle = `rgba(239, 68, 68, ${redAlpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else if (sim.alertStatus === 'YELLOW') {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // 4B. Damaged Conduit Indicators
    const conduits = conduitsRef.current;
    for (let i = 0; i < conduits.length; i++) {
      const conduit = conduits[i];
      if (conduit.damaged) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(conduit.x, conduit.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Orbitron, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', conduit.x, conduit.y + 4);
        ctx.restore();
      }
    }

    // 4C. Officer Dialogue Bubble


    ctx.restore(); // Restore camera shake





  };

  // --- Game Loop Hook ---
  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      if (inputRef.current) {
        const cancelPressed = inputRef.current.actions.cancel;
        if (cancelPressed && !lastCancelRef.current) {
          const currentStatus = gameStateRef.current.status;
          if (currentStatus === 'PLAYING') {
            setGameState((prev) => ({...prev, status: 'PAUSED'}));
          } else if (currentStatus === 'PAUSED') {
            setGameState((prev) => ({...prev, status: 'PLAYING'}));
          } else if (currentStatus === 'START') {
            void exitChat({});
          } else if (
            ['GAME_OVER', 'VICTORY', 'LEVEL_COMPLETE'].includes(currentStatus)
          ) {
            setGameState((prev) => ({...prev, status: 'START'}));
          }
        }
        lastCancelRef.current = cancelPressed;
      }

      stepperRef.current?.(time, (dt) => updateRef.current(dt));

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawRef.current(ctx);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isMusicPlaying = !['START', 'GAME_OVER', 'VICTORY'].includes(
    gameState.status,
  );

  const startBtnRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'START',
  );

  const buyUpgrade = (type: keyof typeof shipUpgrades, cost: number) => {
    if (dilithiumReserve >= cost) {
      setDilithiumReserve((prev) => prev - cost);
      setShipUpgrades((prev) => ({...prev, [type]: prev[type] + 1}));
      gameAudio.playPowerupChime();
    } else {
      gameAudio.playErrorBuzz();
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-between bg-slate-950 text-white font-mono select-none">
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-cyan-400 font-mono">
          <div className="text-2xl font-black animate-pulse tracking-widest">
            INITIALIZING BRIDGE TELEMETRY...
          </div>
        </div>
      )}

      {/* Audio Engine */}
      <BackgroundMusic
        url={BACKGROUND_MUSIC_URL}
        isPlaying={isMusicPlaying}
        isMuted={isMusicMuted}
        volume={musicVolume}
      />

      {/* TOP DIEGETIC COMMAND HUD BAR */}
      <header className="w-full bg-slate-900/95 border-b border-cyan-500/30 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 shadow-lg text-xs md:text-sm">
        {/* Left: Starship Identity & Sector Progress */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider">
            <Radio size={16} className="text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">U.S.S. AVALON</span>
            <span className="sm:hidden">AVALON</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 text-xs">
            <span className="text-slate-400">SECTOR:</span>
            <span className="text-yellow-400 font-bold font-mono">
              {gameState.level}/25
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">WARP:</span>
            <span className="text-cyan-300 font-bold font-mono">
              {gameState.sectorProgress}%
            </span>
          </div>
        </div>

        {/* Center: Hull & Shield Status Meters */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Hull */}
          <div className="flex items-center gap-1.5">
            <Activity
              size={15}
              className={
                gameState.hull < 35
                  ? 'text-red-500 animate-bounce'
                  : 'text-emerald-400'
              }
            />
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              HULL:
            </span>
            <div className="w-18 sm:w-28 bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
              <div
                className={`h-full transition-all duration-300 ${
                  gameState.hull > 50
                    ? 'bg-emerald-500'
                    : gameState.hull > 25
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{
                  width: `${clamp((gameState.hull / gameState.maxHull) * 100, 0, 100)}%`,
                }}
              />
            </div>
            <span className="font-mono text-xs text-slate-200">
              {gameState.hull}%
            </span>
          </div>

          {/* Shields */}
          <div className="flex items-center gap-1.5">
            <Shield size={15} className="text-cyan-400" />
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              SHIELDS:
            </span>
            <div className="w-18 sm:w-28 bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-cyan-400 transition-all duration-200"
                style={{
                  width: `${clamp((gameState.shields / gameState.maxShields) * 100, 0, 100)}%`,
                }}
              />
            </div>
            <span className="font-mono text-xs text-cyan-300">
              {gameState.shields}%
            </span>
          </div>
        </div>

        {/* Right: Score, Pause, Crew Roster & Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-xs text-yellow-400 font-bold">
            <Trophy size={13} />
            <span>{gameState.score}</span>
          </div>

          {/* Dedicated Pause / Unpause Button */}
          <button
            onClick={togglePause}
            title={gameState.status === 'PAUSED' ? 'Resume Command (P / Esc)' : 'Pause Command (P / Esc)'}
            className={`p-1.5 rounded-lg border flex items-center gap-1 text-xs font-bold transition-all min-w-[34px] min-h-[34px] ${
              gameState.status === 'PAUSED'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
            }`}>
            {gameState.status === 'PAUSED' ? <Play size={16} /> : <Pause size={16} />}
            <span className="hidden md:inline">{gameState.status === 'PAUSED' ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Officer Roster modal trigger */}
          <button
            onClick={() => setIsRosterOpen(true)}
            title="Bridge Crew Roster"
            className="bg-slate-800 hover:bg-slate-700 text-cyan-300 p-1.5 rounded-lg border border-cyan-500/40 flex items-center justify-center min-w-[34px] min-h-[34px]">
            <Users size={16} />
          </button>

          {/* Persistent Game Menu Trigger */}
          <button
            onClick={() => setIsGameMenuOpen(true)}
            data-testid="menu-button"
            className="bg-cyan-900/80 hover:bg-cyan-700 text-cyan-200 p-1.5 rounded-lg border border-cyan-500/50 flex items-center justify-center transition-colors min-w-[34px] min-h-[34px]">
            <Menu size={16} />
          </button>
        </div>
      </header>

      {/* MAIN GAME CANVAS CONTAINER */}
      <div className="flex-1 w-full min-h-0 flex items-center justify-center bg-slate-950 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            width: `min(100%, calc(100vh * ${canvasWidth} / ${canvasHeight}))`,
          }}
          className="h-auto max-w-full max-h-full drop-shadow-2xl shadow-cyan-950 cursor-crosshair"
        />

        {/* Warp Jump Streak Banner Alert */}
        {simRef.current.warpJumpAnimation > 0 && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-cyan-950/60 backdrop-blur-sm pointer-events-none text-center px-4">
            <h2 className="text-3xl sm:text-5xl font-black text-cyan-300 tracking-widest animate-pulse drop-shadow-[0_0_20px_#06b6d4]">
              WARP ENGAGED
            </h2>
            <p className="text-slate-100 mt-2 text-base sm:text-xl font-bold font-mono">
              TRANSITING TO SECTOR {gameState.level} / 25
            </p>
            {gameState.level % 5 === 0 ? (
              <div className="mt-3 px-4 py-1.5 bg-red-950/90 border-2 border-red-500 rounded-full text-red-300 font-black text-xs sm:text-sm tracking-wider animate-bounce">
                ⚠️ RED ALERT: DOMINION FLAGSHIP IN SECTOR!
              </div>
            ) : BONUS_POINT_SECTORS.includes(gameState.level) ? (
              <div className="mt-3 px-4 py-1.5 bg-amber-950/80 border border-amber-500 rounded-full text-amber-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg">
                <Sparkles size={16} className="text-amber-400" />
                <span>+1 SUBSYSTEM BONUS POINT AWARDED</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* BOTTOM DIEGETIC CONSOLE & 4-SYSTEM UPGRADE BAR */}
      <footer className="w-full bg-slate-900/95 border-t border-cyan-500/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 shadow-2xl">
        {/* 4 Systems (Weapons, Shields, Engines, Sensors) - 5 Levels Each */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1">
          {/* Available Bonus Points Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs font-bold transition-all ${
              bonusPoints > 0
                ? 'bg-amber-950/90 text-amber-300 border-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
            <Sparkles size={14} className={bonusPoints > 0 ? 'text-yellow-400' : 'text-slate-500'} />
            <span>POINTS: {bonusPoints}</span>
          </div>

          {/* WEAPONS */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded border border-red-500/40">
            <Zap size={14} className="text-red-400" />
            <span className="text-[11px] font-bold text-red-300" title="+20% Weapon Damage per Level">
              WPN ({subsystemLevels.weapons}/5)
            </span>
            <div className="flex gap-0.5 mx-1" title={`+${subsystemLevels.weapons * 20}% Damage`}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-3.5 rounded-sm ${
                    i < subsystemLevels.weapons ? 'bg-red-500 shadow-[0_0_4px_#ef4444]' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => refundBonusPoint('weapons')}
              disabled={subsystemLevels.weapons <= 0}
              className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                subsystemLevels.weapons > 0 ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}>
              -
            </button>
            <button
              onClick={() => allocateBonusPoint('weapons')}
              disabled={bonusPoints <= 0 || subsystemLevels.weapons >= 5}
              className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                bonusPoints > 0 && subsystemLevels.weapons < 5
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}>
              +
            </button>
          </div>

          {/* SHIELDS */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded border border-cyan-500/40">
            <Shield size={14} className="text-cyan-400" />
            <span className="text-[11px] font-bold text-cyan-300" title="+40 Max Shields & +10% Regen per Level">
              SHD ({subsystemLevels.shields}/5)
            </span>
            <div className="flex gap-0.5 mx-1" title={`Max Shields: ${100 + subsystemLevels.shields * 40}`}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-3.5 rounded-sm ${
                    i < subsystemLevels.shields ? 'bg-cyan-400 shadow-[0_0_4px_#06b6d4]' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => refundBonusPoint('shields')}
              disabled={subsystemLevels.shields <= 0}
              className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                subsystemLevels.shields > 0 ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}>
              -
            </button>
            <button
              onClick={() => allocateBonusPoint('shields')}
              disabled={bonusPoints <= 0 || subsystemLevels.shields >= 5}
              className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                bonusPoints > 0 && subsystemLevels.shields < 5
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}>
              +
            </button>
          </div>

          {/* ENGINES (DODGE) */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded border border-amber-500/40">
            <Gauge size={14} className="text-amber-400" />
            <span className="text-[11px] font-bold text-amber-300" title="+8% Dodge Chance per Level">
              ENG ({subsystemLevels.engines}/5)
            </span>
            <div className="flex gap-0.5 mx-1" title={`${subsystemLevels.engines * 8}% Dodge Chance`}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-3.5 rounded-sm ${
                    i < subsystemLevels.engines ? 'bg-amber-400 shadow-[0_0_4px_#f59e0b]' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => refundBonusPoint('engines')}
              disabled={subsystemLevels.engines <= 0}
              className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                subsystemLevels.engines > 0 ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}>
              -
            </button>
            <button
              onClick={() => allocateBonusPoint('engines')}
              disabled={bonusPoints <= 0 || subsystemLevels.engines >= 5}
              className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                bonusPoints > 0 && subsystemLevels.engines < 5
                  ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}>
              +
            </button>
          </div>

          {/* SENSORS (CRITICAL HITS) */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded border border-emerald-500/40">
            <Crosshair size={14} className="text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-300" title="+10% Critical Hit Chance (2x damage) per Level">
              SEN ({subsystemLevels.sensors}/5)
            </span>
            <div className="flex gap-0.5 mx-1" title={`${subsystemLevels.sensors * 10}% Critical Hit Chance`}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-3.5 rounded-sm ${
                    i < subsystemLevels.sensors ? 'bg-emerald-400 shadow-[0_0_4px_#10b981]' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => refundBonusPoint('sensors')}
              disabled={subsystemLevels.sensors <= 0}
              className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                subsystemLevels.sensors > 0 ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}>
              -
            </button>
            <button
              onClick={() => allocateBonusPoint('sensors')}
              disabled={bonusPoints <= 0 || subsystemLevels.sensors >= 5}
              className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                bonusPoints > 0 && subsystemLevels.sensors < 5
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}>
              +
            </button>
          </div>
        </div>

{/* Tactical Actions Hotbar */}
<div className="flex items-center gap-2">
  {/* Phaser Beam */}
  <button
    onClick={triggerFireLaser}
    className="bg-orange-600 hover:bg-orange-500 text-white font-black px-3 py-1.5 rounded-lg border border-orange-400 shadow-[0_0_14px_rgba(255,69,0,0.65)] flex items-center gap-1 text-xs active:scale-95 transition-all min-h-[38px]">
    <Zap size={14} />
    <span>PHASER [SPC]</span>
  </button>

          {/* Photon Torpedo */}
          <button
            onClick={triggerFireTorpedo}
            disabled={gameState.torpedoes <= 0}
            className={`font-black px-3 py-1.5 rounded-lg border shadow-md flex items-center gap-1 text-xs active:scale-95 transition-all min-h-[38px] ${
              gameState.torpedoes > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            }`}>
            <Flame size={14} />
            <span>TORPEDO ({gameState.torpedoes}) [T]</span>
          </button>

          {/* Shield Deflector Pulse */}
          <button
            onClick={triggerShieldDeflectorPulse}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg border border-indigo-400 shadow-md flex items-center gap-1 text-xs active:scale-95 transition-all min-h-[38px]">
            <Shield size={14} />
            <span className="hidden sm:inline">DEFLECTOR [F]</span>
            <span className="sm:hidden">SHIELD [F]</span>
          </button>

          {/* Damage Control / Nanite Quick-Fix */}
          <button
            onClick={triggerQuickRepair}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg border border-emerald-400 shadow-md flex items-center gap-1 text-xs active:scale-95 transition-all min-h-[38px]">
            <Wrench size={14} />
            <span className="hidden sm:inline">REPAIR [C]</span>
            <span className="sm:hidden">REPAIR</span>
          </button>
        </div>
      </footer>

      {/* --- OVERLAYS & MODALS --- */}

      {/* 1. START GAME / CAPTAIN BRIEFING MENU */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral" zIndex={40}>
          <div className="w-full max-w-md flex flex-col items-center bg-slate-900 border-2 border-cyan-500/60 rounded-2xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.25)]">
            <div className="w-16 h-16 rounded-full bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center mb-4 text-cyan-300 shadow-lg">
              <Radio size={32} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 text-cyan-400 text-center tracking-widest uppercase drop-shadow-[0_0_12px_#06b6d4]">
              DOMINION INVADERS
            </h1>
            <p className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-4">
              Starship Bridge Command
            </p>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-slate-300 text-xs sm:text-sm space-y-2 mb-6 w-full">
              <p>
                🎖️ <b className="text-cyan-300">Captain's Log:</b> Hostile forces have begun an invasion of the Alpha Quadrant, The Dominion threat to the Alpha Quadrant and Starfleet. Command bridge officers, steer the tactical viewport,
                and navigate through 5 sectors!
              </p>
              <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                <span className="text-cyan-400 font-bold">CONTROLS:</span> Aim
                Reticle with Pointer/WASD • Fire Phasers with Space/Click • Launch
                Locking Torpedoes (T) • Deflector Pulse (F) • Power Grid (1-4).
              </div>
            </div>

            <button
              ref={startBtnRef}
              autoFocus
              onClick={initGame}
              data-testid="start-button"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 px-8 py-3.5 rounded-full font-black text-lg hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30">
              <Play size={22} className="fill-slate-950" />
              TAKE THE COMMAND CHAIR
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* 2. BRIDGE CREW ROSTER MODAL */}
      {isRosterOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-lg flex flex-col bg-slate-900 border-2 border-cyan-500/60 rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-lg font-black text-cyan-400 tracking-wider flex items-center gap-2">
                <Users size={18} />
                BRIDGE COMMAND OFFICERS
              </h3>
              <button
                onClick={() => setIsRosterOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-slate-950 p-3 rounded-xl border border-yellow-500/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-400 flex items-center justify-center text-yellow-300 font-bold">
                  CPT
                </div>
                <div>
                  <div className="font-bold text-yellow-400 text-sm">CAPTAIN (You)</div>
                  <div className="text-slate-400">Station: Command Dais • Role: Tactical Decisions & Power Routing</div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-red-500/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-400 flex items-center justify-center text-red-300 font-bold">
                  TAC
                </div>
                <div>
                  <div className="font-bold text-red-400 text-sm">TACTICAL</div>
                  <div className="text-slate-400">Station: Tactical Arch • Role: Phasers & Torpedo Fire Matrix</div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-orange-500/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-400 flex items-center justify-center text-orange-300 font-bold">
                  HLM
                </div>
                <div>
                  <div className="font-bold text-orange-400 text-sm">HELM</div>
                  <div className="text-slate-400">Station: Helm Console • Role: Impulse Evasion & Warp Trajectory</div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-sky-500/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-300 font-bold">
                  SCI
                </div>
                <div>
                  <div className="font-bold text-sky-400 text-sm">SCIENCE</div>
                  <div className="text-slate-400">Station: Science Sensors • Role: Subspace Radar & Target Lock-On</div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 font-bold">
                  ENG
                </div>
                <div>
                  <div className="font-bold text-amber-400 text-sm">ENGINEERING</div>
                  <div className="text-slate-400">Station: Engineering Bay • Role: Reactor Stability & Conduit Repairs</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsRosterOpen(false)}
              className="mt-5 w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black py-2.5 rounded-xl transition-colors text-xs">
              RETURN TO COMMAND
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* 3. IN-GAME MENU / PAUSE OVERLAY */}
      {(gameState.status === 'PAUSED' || isGameMenuOpen) && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-lg flex flex-col items-center bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between w-full border-b border-slate-800 pb-2">
              <h2 className="text-2xl font-black text-cyan-400 tracking-wider flex items-center gap-2">
                <Pause size={22} className="text-amber-400" />
                TACTICAL PAUSE & MENU
              </h2>
              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'PLAYING'}));
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Resume button */}
            <button
              onClick={() => {
                setIsGameMenuOpen(false);
                setGameState((prev) => ({...prev, status: 'PLAYING'}));
              }}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 text-base">
              <Play size={20} className="fill-slate-950" />
              RESUME COMMAND [P / ESC]
            </button>

            {/* Subsystem Upgrade Points Manager in Pause Menu */}
            <div className="w-full bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  Subsystem Upgrades (20 Points Total)
                </span>
                <div
                  className={`px-2.5 py-0.5 rounded-full border text-xs font-bold flex items-center gap-1 ${
                    bonusPoints > 0
                      ? 'bg-amber-950 text-amber-300 border-amber-500 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                  <Sparkles size={12} className={bonusPoints > 0 ? 'text-amber-400' : 'text-slate-500'} />
                  <span>UNSPENT: {bonusPoints}</span>
                </div>
              </div>

              {/* Weapons */}
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-red-500/30 text-xs">
                <div>
                  <div className="font-bold text-red-400">WEAPONS (Lv {subsystemLevels.weapons}/5)</div>
                  <div className="text-[10px] text-slate-400">+{subsystemLevels.weapons * 20}% Damage to Phasers & Torpedoes</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => refundBonusPoint('weapons')}
                    disabled={subsystemLevels.weapons <= 0}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold flex items-center justify-center">
                    -
                  </button>
                  <span className="font-mono font-bold text-slate-200 w-4 text-center">{subsystemLevels.weapons}</span>
                  <button
                    onClick={() => allocateBonusPoint('weapons')}
                    disabled={bonusPoints <= 0 || subsystemLevels.weapons >= 5}
                    className="w-6 h-6 rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold flex items-center justify-center">
                    +
                  </button>
                </div>
              </div>

              {/* Shields */}
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-cyan-500/30 text-xs">
                <div>
                  <div className="font-bold text-cyan-400">SHIELDS (Lv {subsystemLevels.shields}/5)</div>
                  <div className="text-[10px] text-slate-400">+{subsystemLevels.shields * 40} Max Capacity & +{subsystemLevels.shields * 10}% Regen</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => refundBonusPoint('shields')}
                    disabled={subsystemLevels.shields <= 0}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold flex items-center justify-center">
                    -
                  </button>
                  <span className="font-mono font-bold text-slate-200 w-4 text-center">{subsystemLevels.shields}</span>
                  <button
                    onClick={() => allocateBonusPoint('shields')}
                    disabled={bonusPoints <= 0 || subsystemLevels.shields >= 5}
                    className="w-6 h-6 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold flex items-center justify-center">
                    +
                  </button>
                </div>
              </div>

              {/* Engines */}
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-amber-500/30 text-xs">
                <div>
                  <div className="font-bold text-amber-400">ENGINES (Lv {subsystemLevels.engines}/5)</div>
                  <div className="text-[10px] text-slate-400">+{subsystemLevels.engines * 8}% Dodge Chance vs Attacks & Hazards</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => refundBonusPoint('engines')}
                    disabled={subsystemLevels.engines <= 0}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold flex items-center justify-center">
                    -
                  </button>
                  <span className="font-mono font-bold text-slate-200 w-4 text-center">{subsystemLevels.engines}</span>
                  <button
                    onClick={() => allocateBonusPoint('engines')}
                    disabled={bonusPoints <= 0 || subsystemLevels.engines >= 5}
                    className="w-6 h-6 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold flex items-center justify-center">
                    +
                  </button>
                </div>
              </div>

              {/* Sensors */}
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-emerald-500/30 text-xs">
                <div>
                  <div className="font-bold text-emerald-400">SENSORS (Lv {subsystemLevels.sensors}/5)</div>
                  <div className="text-[10px] text-slate-400">+{subsystemLevels.sensors * 10}% Critical Hit Chance (2x Damage)</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => refundBonusPoint('sensors')}
                    disabled={subsystemLevels.sensors <= 0}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold flex items-center justify-center">
                    -
                  </button>
                  <span className="font-mono font-bold text-slate-200 w-4 text-center">{subsystemLevels.sensors}</span>
                  <button
                    onClick={() => allocateBonusPoint('sensors')}
                    disabled={bonusPoints <= 0 || subsystemLevels.sensors >= 5}
                    className="w-6 h-6 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold flex items-center justify-center">
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Audio Controls with Independent Sliders */}
            <div className="w-full bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                Bridge Audio Adjustments
              </span>

              {/* BGM Volume Slider */}
              <div className="flex flex-col gap-1 w-full bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <button
                    onClick={() => setIsMusicMuted((prev) => !prev)}
                    className="flex items-center gap-1.5 text-yellow-300 font-bold hover:text-yellow-200">
                    {isMusicMuted ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} />}
                    <span>BRIDGE BGM: {isMusicMuted ? 'MUTED' : `${Math.round(musicVolume * 100)}%`}</span>
                  </button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMusicMuted ? 0 : musicVolume}
                  onChange={(e) => {
                    setIsMusicMuted(false);
                    setMusicVolume(parseFloat(e.target.value));
                  }}
                  className="w-full accent-yellow-400 cursor-pointer h-2 bg-slate-800 rounded-lg mt-1"
                />
              </div>

              {/* SFX / Weapons Volume Slider */}
              <div className="flex flex-col gap-1 w-full bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <button
                    onClick={() => {
                      const muted = gameAudio.toggleMute();
                      setIsSfxMuted(muted);
                    }}
                    className="flex items-center gap-1.5 text-cyan-300 font-bold hover:text-cyan-200">
                    {isSfxMuted ? <VolumeX size={15} className="text-red-400" /> : <Zap size={15} />}
                    <span>WEAPONS & SFX: {isSfxMuted ? 'MUTED' : `${Math.round(sfxVolume * 100)}%`}</span>
                  </button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isSfxMuted ? 0 : sfxVolume}
                  onChange={(e) => {
                    setIsSfxMuted(false);
                    const val = parseFloat(e.target.value);
                    setSfxVolume(val);
                    gameAudio.setVolume(val);
                  }}
                  className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg mt-1"
                />
              </div>
            </div>

            <div className="w-full space-y-2 pt-1">
              {/* How to Play */}
              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-700 text-xs">
                <Info size={16} className="text-emerald-400" />
                HOW TO PLAY MANUAL
              </button>

              {/* Restart Level */}
              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  initGame();
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-700 text-xs">
                <RotateCw size={16} />
                REBOOT SECTOR SIMULATION
              </button>

              {/* Quit to Main Menu */}
              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full bg-red-950/80 hover:bg-red-900 text-red-300 font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-red-800/40 text-xs">
                <ArrowLeft size={16} />
                ABORT TO MAIN MENU
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 4. HOW TO PLAY MANUAL MODAL */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-lg flex flex-col bg-slate-900 border-2 border-cyan-500/60 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-xl font-black text-cyan-400 tracking-wider flex items-center gap-2">
                <Info size={20} />
                STARFLEET TACTICAL MANUAL
              </h3>
              <button
                onClick={() => setIsHowToPlayOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <h4 className="text-red-400 font-bold mb-1 flex items-center gap-1.5">
                  <Zap size={14} /> 1. POWER GRID ALLOCATION
                </h4>
                <p>
                  You possess 10 Reactor Units. Boost <b>Weapons (1)</b> for
                  faster phasers, <b>Shields (2)</b> for rapid shield regeneration,{' '}
                  <b>Engines (3)</b> for ship evasion, and <b>Sensors (4)</b> for
                  auto-aim lock-on assistance!
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <h4 className="text-cyan-400 font-bold mb-1 flex items-center gap-1.5">
                  <Crosshair size={14} /> 2. VIEWPORT TARGETING & SHIP COMBAT
                </h4>
                <p>
                  Aim your reticle with pointer/WASD. Fire rapid Phasers with{' '}
                  <b>Space / Click</b>, lock on for <b>Torpedoes (T)</b>, and deploy{' '}
                  <b>Deflector Shield Pulse (F)</b> to vaporize enemy projectiles!
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <h4 className="text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
                  <Wrench size={14} /> 3. DAMAGE CONTROL & CONDUITS
                </h4>
                <p>
                  Hull breaches trigger explosive console overloads on the bridge.
                  Deploy <b>Damage Control (C)</b> or collect Nanite canisters to
                  repair systems before catastrophic core meltdown!
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsHowToPlayOpen(false)}
              className="mt-6 w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black py-3 rounded-xl transition-colors">
              ACKNOWLEDGED
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* 5. GAME OVER OVERLAY */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="STARSHIP DESTROYED"
          description={`Hull integrity failed in Sector ${gameState.level}. Final Score: ${gameState.score}`}
          actionLabel="REBOOT SIMULATION"
          onAction={initGame}
          icon={<RotateCw size={24} />}
          tone="danger"
        />
      )}

      {/* 6. VICTORY OVERLAY */}
      {gameState.status === 'VICTORY' && (
        <Overlay
          title="SECTOR 25 SECURED - DOMINION DEFEATED"
          description={`Flawless Command, Captain! The Supreme Flagship Command Dreadnought has been neutralized and the galaxy is saved. Final Score: ${gameState.score}`}
          actionLabel="COMMAND AGAIN"
          onAction={initGame}
          icon={<Trophy size={24} />}
          tone="victory"
        />
      )}
    </div>
  );
}
