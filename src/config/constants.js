/*
  ============================================================
  BETRAYAL BOX — GLOBAL CONSTANTS
  ============================================================
  All tuning knobs for the game engine, player, enemies,
  scoring and arena corruption are centralised here.
*/

// --- Canvas ---
let SCREEN_WIDTH  = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;

// --- Map (tile grid) ---
const MAP_TILE_COUNT  = 56;          // 56 × 56 tiles (expanded arena)
const TILE_SIZE       = 1;           // each tile = 1 world-unit
const MAP_SIZE        = MAP_TILE_COUNT * TILE_SIZE;

// --- Textures ---
const TEXTURE_SIZE = 32;             // 32 × 32 pixel textures (blocky look)

// --- Raycaster ---
const FIELD_OF_VIEW_RADIANS       = Math.PI / 3;   // 60° horizontal FOV
let RAY_COUNT                     = Math.min(SCREEN_WIDTH, 640);   // max 640 rays for perf, less on small screens
const MAX_RAY_DISTANCE            = 78;
const WALL_HEIGHT_PROJECTION_FACTOR = 1.0;

function updateViewportSize() {
  SCREEN_WIDTH = window.innerWidth;
  SCREEN_HEIGHT = window.innerHeight;
  RAY_COUNT = Math.min(SCREEN_WIDTH, 640);  // capped at 640 rays max
}

// --- Lighting / Fog (tweak these to adjust brightness) ---
const FOG_DENSITY                 = 0.55;  // 0 = no fog, 1 = pitch-black at max dist
const AMBIENT_LIGHT_MINIMUM       = 0.22;  // even the farthest walls keep 22 % brightness
const SIDE_SHADE_FACTOR           = 0.85;  // Y-side walls slightly darker (was 0.75)

// --- Horror Fog / Visibility System ---
const FOG_DISTANCE_START          = 8;     // Distance where fog begins (in tiles)
const FOG_DISTANCE_END            = 10;    // Distance where fog becomes complete black
const FOG_COLOR_RGB              = [0, 0, 0];  // Pure black fog (horror style)

// --- 3D Fog Shader Parameters (for WEBGL 3D mode) ---
const FOG_3D_START_DISTANCE       = 8.0;   // Brouillard commence à 8 blocs du joueur
const FOG_3D_DENSITY              = 0.25;  // Densité exponentielle (0.1-0.4, plus élevé = plus rapide)
const FOG_3D_ENABLED              = true;  // Active/désactive le shader de brouillard 3D

// --- Motion blur ---
const MOTION_BLUR_ENABLED       = true;
const MOTION_BLUR_BUFFER_SCALE  = 0.34;
const MOTION_BLUR_MAX_ALPHA     = 74;
const MOTION_BLUR_MOVE_FACTOR   = 0.08;
const MOTION_BLUR_TURN_FACTOR   = 0.23;
const MOTION_BLUR_SMOOTHING     = 0.22;
const MOTION_BLUR_MIN_TRIGGER   = 0.04;
const MOTION_BLUR_CAPTURE_STEP  = 2;

// --- Player ---
const PLAYER_MOVE_SPEED   = 3.6;    // tiles per second
const PLAYER_ROTATE_SPEED = 0.003;  // radians per mouse-pixel
const PLAYER_PITCH_SPEED  = 0.0022; // vertical look sensitivity
const PLAYER_MAX_PITCH    = 1.2;    // ~69° (increased to look down more)
const PLAYER_RADIUS       = 0.25;   // collision cylinder radius
const PLAYER_JUMP_VELOCITY = 5.2;
const PLAYER_GRAVITY       = 14.5;

// Camera vertical projection helpers
const CAMERA_PITCH_PIXEL_RATIO = 0.50; // multiplied by screen height (increased for better downward view)
const CAMERA_JUMP_PIXEL_RATIO  = 0.22; // multiplied by screen height

// --- Weapon ---
const WEAPON_START_AMMO        = 12;
const WEAPON_MAX_AMMO          = 24;
const WEAPON_FIRE_COOLDOWN_MS  = 170;
const WEAPON_RANGE             = 10.0;
const WEAPON_AIM_TOLERANCE_PX  = 42;
const WEAPON_HUNTER_KILL_SCORE = 260;
const HUNTER_KILL_AMMO_REFUND  = 1;
const WEAPON_BASE_DAMAGE       = 1;

// Weapon power-ups (Punch Machine)
const POWERUP_DAMAGE_MULTIPLIER     = 2;
const POWERUP_DAMAGE_DURATION_MS    = 14000;
const POWERUP_RAPID_DURATION_MS     = 12000;
const POWERUP_RAPID_COOLDOWN_FACTOR = 0.55;
const POWERUP_INSTAKILL_DURATION_MS = 9000;

// --- Sprint (shift overdrive) ---
const SPRINT_SPEED_MULTIPLIER   = 1.65;
const SPRINT_ENERGY_MAX         = 100;
const SPRINT_DRAIN_PER_SECOND   = 46;
const SPRINT_REGEN_PER_SECOND   = 30;
const SPRINT_REGEN_DELAY_MS     = 650;

// --- Kill streak ---
const KILL_STREAK_WINDOW_MS       = 5200;
const KILL_STREAK_SCORE_STEP      = 0.22;
const KILL_STREAK_MAX_MULTIPLIER  = 2.4;
const KILL_STREAK_AMMO_BONUS_EVERY = 4;
const KILL_STREAK_AMMO_BONUS       = 1;

// --- First-person weapon viewmodel ---
const VIEWMODEL_SCALE       = 1.0;
const VIEWMODEL_BOB_SPEED   = 0.012;
const VIEWMODEL_BOB_X       = 10;
const VIEWMODEL_BOB_Y       = 7;
const VIEWMODEL_RECOIL_PX   = 18;

// --- Orbs / Enemies ---
const ORB_WORLD_RADIUS     = 0.3;
const ENEMY_WORLD_RADIUS   = 0.60;  // Covers arms at ±0.24 + width 0.08 + animation margin
const MIN_MUTATION_DELAY_MS = 4500;
const MAX_MUTATION_DELAY_MS = 7000;
const ENEMY_BASE_SPEED      = 1.6;
const ENEMY_SPEED_GROWTH    = 0.08;  // per second survived

// --- Hunter AI behaviour ---
const WARNING_DURATION_MS       = 2000;   // 2 s flashing before full mutation
const HUNTER_DETECT_RANGE       = 6.0;    // tiles — switches from patrol to chase
const HUNTER_LOSE_RANGE         = 9.0;    // tiles — switches from chase back to patrol
const HUNTER_PATROL_SPEED_RATIO = 0.45;   // patrol speed = base speed × this
const HUNTER_WAYPOINT_REACH     = 0.5;    // how close to waypoint before picking a new one
const HUNTER_CHARGE_MULTIPLIER  = 1.6;    // speed boost when charging
const HUNTER_CHARGE_DURATION_MS = 800;    // ms of the charge dash
const HUNTER_CHARGE_COOLDOWN_MS = 3000;   // ms between charges

// --- Zombie sprite sheet animation ---
const ZOMBIE_SPRITE_SHEET_FRAME_COUNT = 6;
const ZOMBIE_SPRITE_SHEET_FPS = 10;
const ZOMBIE_ATTACK_DISTANCE = 0.95;
const ZOMBIE_ANIM_SPEED_MIN = 0.7;
const ZOMBIE_ANIM_SPEED_MAX = 2.2;
const ZOMBIE_SIDE_TURN_THRESHOLD = 0.35;
const ZOMBIE_HEAD_TURN_PIXELS = 2;

// --- Wave mode (COD-like zombies) ---
const WAVE_START_DELAY_MS           = 2600;
const WAVE_BREAK_DURATION_MS        = 8200;
const WAVE_BASE_ENEMY_COUNT         = 6;
const WAVE_ENEMY_GROWTH_LINEAR      = 3;
const WAVE_MAX_SIMULTANEOUS_BASE    = 4;
const WAVE_MAX_SIMULTANEOUS_GROWTH  = 1;
const WAVE_MAX_SIMULTANEOUS_CAP     = 22;
const WAVE_SPAWN_INTERVAL_BASE_MS   = 1100;
const WAVE_SPAWN_INTERVAL_MIN_MS    = 260;
const WAVE_SPAWN_INTERVAL_DECAY_MS  = 65;
const WAVE_ENEMY_SPEED_PER_WAVE     = 0.11;
const WAVE_HEALTH_STEP_WAVES        = 3;
const WAVE_CLEAR_REWARD_SCORE       = 220;
const WAVE_CLEAR_REWARD_SCORE_PER_WAVE = 110;
const WAVE_CLEAR_REWARD_AMMO        = 2;

// --- Punch Machine (power-ups) ---
const PUNCH_MACHINE_RADIUS          = 0.42;
const PUNCH_MACHINE_UNLOCK_WAVE     = 2;
const PUNCH_MACHINE_COST            = 1200;
const PUNCH_MACHINE_COOLDOWN_MS     = 14000;

// --- Spawn ---
const ORB_SPAWN_INTERVAL_INITIAL_MS = 2800;
const ORB_SPAWN_INTERVAL_MIN_MS     = 900;
const ORB_SPAWN_ACCEL_MS_PER_SEC    = 28;

// --- Corruption (shrinking arena) ---
const CORRUPTION_START_DELAY_SECONDS = 12;
const CORRUPTION_INTERVAL_SECONDS    = 6;
const CORRUPTION_TILES_PER_FRAME     = 22;

// --- Score ---
const SURVIVAL_POINTS_PER_SECOND = 30;
const ORB_COLLECT_BONUS          = 500;
const ORB_SAFE_AMMO_RECOVERY     = 1;
const ORB_WARNING_AMMO_RECOVERY  = 2;

// --- Mission objective ---
const MISSION_BEACON_COUNT          = 4;
const MISSION_BEACON_RADIUS         = 0.32;
const MISSION_BEACON_SCORE_BONUS    = 420;
const MISSION_BEACON_AMMO_RECOVERY  = 2;
const EXTRACTION_PORTAL_RADIUS      = 0.58;
const EXTRACTION_PORTAL_SCORE_BONUS = 1800;

// --- Mob drops ---
const MOB_DROP_RADIUS         = 0.24;
const MOB_DROP_LIFETIME_MS    = 22000;
const MOB_DROP_AMMO_GAIN      = 6;
const MOB_DROP_SCORE_GAIN     = 280;
const MOB_DROP_PULSE_CHANCE   = 0.2;
const MOB_DROP_EXTRA_CHANCE   = 0.38;
const MOB_DROP_CRATE_CHANCE   = 0.12;
const MOB_DROP_ROUNDS_GAIN    = 3;
const MOB_DROP_CRATE_BONUS_AMMO = 2;

// --- Inventory / HUD ---
const INVENTORY_SLOT_MAX       = 9;
const HUD_TOAST_DURATION_MS    = 1800;

// --- World Modules (innovative interactives) ---
const WORLD_MODULE_RADIUS           = 0.34;
const WORLD_MODULE_LIFETIME_MS      = 36000;
const WORLD_MODULE_START_COUNT      = 3;
const WORLD_MODULE_MAX_COUNT        = 5;
const WORLD_MODULE_SPAWN_INTERVAL_MS = 14000;
const WORLD_MODULE_ACTIVATE_BONUS   = 320;
const WORLD_MODULE_AMMO_RECOVERY    = 2;

// AEGIS module — temporary hunter repulsion around the player
const MODULE_AEGIS_DURATION_MS      = 9000;
const MODULE_AEGIS_REPEL_RADIUS     = 3.4;
const MODULE_AEGIS_REPEL_FORCE      = 3.2;

// EMP module — stuns nearby hunters
const MODULE_EMP_STUN_RADIUS        = 5.2;
const MODULE_EMP_STUN_DURATION_MS   = 4200;

// CHRONO module — slows world pressure for a short time
const MODULE_CHRONO_DURATION_MS       = 8000;
const MODULE_CHRONO_SPAWN_SLOW_FACTOR = 1.8;
const MODULE_CHRONO_HUNTER_TIME_SCALE = 0.55;

// --- Hunter lava avoidance ---
const LAVA_AVOID_DISTANCE_TILES = 1.0;  // Reduced from 2.1 for performance
const LAVA_AVOID_PUSH_FORCE     = 2.8;
const LAVA_CENTER_PULL_FORCE    = 0.9;
const HUNTER_LAVA_TELEPORT_MIN_DISTANCE = 6.5;
