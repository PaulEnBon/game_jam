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
const MAP_TILE_COUNT  = 24;          // 24 × 24 tiles
const TILE_SIZE       = 1;           // each tile = 1 world-unit
const MAP_SIZE        = MAP_TILE_COUNT * TILE_SIZE;

// --- Textures ---
const TEXTURE_SIZE = 32;             // 32 × 32 pixel textures (blocky look)

// --- Raycaster ---
const FIELD_OF_VIEW_RADIANS       = Math.PI / 3;   // 60° horizontal FOV
let RAY_COUNT                     = SCREEN_WIDTH;   // one ray per screen column
const MAX_RAY_DISTANCE            = 30;
const WALL_HEIGHT_PROJECTION_FACTOR = 1.0;

function updateViewportSize() {
  SCREEN_WIDTH = window.innerWidth;
  SCREEN_HEIGHT = window.innerHeight;
  RAY_COUNT = SCREEN_WIDTH;
}

// --- Lighting / Fog (tweak these to adjust brightness) ---
const FOG_DENSITY                 = 0.55;  // 0 = no fog, 1 = pitch-black at max dist
const AMBIENT_LIGHT_MINIMUM       = 0.22;  // even the farthest walls keep 22 % brightness
const SIDE_SHADE_FACTOR           = 0.85;  // Y-side walls slightly darker (was 0.75)

// --- Player ---
const PLAYER_MOVE_SPEED   = 3.6;    // tiles per second
const PLAYER_ROTATE_SPEED = 0.003;  // radians per mouse-pixel
const PLAYER_RADIUS       = 0.25;   // collision cylinder radius

// --- Orbs / Enemies ---
const ORB_WORLD_RADIUS     = 0.3;
const ENEMY_WORLD_RADIUS   = 0.35;
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

// --- Spawn ---
const ORB_SPAWN_INTERVAL_INITIAL_MS = 2800;
const ORB_SPAWN_INTERVAL_MIN_MS     = 900;
const ORB_SPAWN_ACCEL_MS_PER_SEC    = 28;

// --- Corruption (shrinking arena) ---
const CORRUPTION_START_DELAY_SECONDS = 12;
const CORRUPTION_INTERVAL_SECONDS    = 6;

// --- Score ---
const SURVIVAL_POINTS_PER_SECOND = 30;
const ORB_COLLECT_BONUS          = 500;

// --- World Modules (innovative interactives) ---
const WORLD_MODULE_RADIUS           = 0.34;
const WORLD_MODULE_LIFETIME_MS      = 36000;
const WORLD_MODULE_START_COUNT      = 3;
const WORLD_MODULE_MAX_COUNT        = 5;
const WORLD_MODULE_SPAWN_INTERVAL_MS = 14000;
const WORLD_MODULE_ACTIVATE_BONUS   = 320;

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
