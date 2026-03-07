// --- Player ---
const PLAYER_MOVE_SPEED = 3.6;    // tiles per second
const PLAYER_ROTATE_SPEED = 0.003;  // radians per mouse-pixel
const PLAYER_RADIUS = 0.25;   // collision cylinder radius

// --- Orbs / Enemies ---
const ORB_WORLD_RADIUS = 0.3;
const ENEMY_WORLD_RADIUS = 0.35;
const MIN_MUTATION_DELAY_MS = 4500;
const MAX_MUTATION_DELAY_MS = 7000;
const ENEMY_BASE_SPEED = 1.6;
const ENEMY_SPEED_GROWTH = 0.08;  // per second survived

// --- Hunter AI behaviour ---
const WARNING_DURATION_MS = 2000;   // 2 s flashing before full mutation
const HUNTER_DETECT_RANGE = 6.0;    // tiles - switches from patrol to chase
const HUNTER_LOSE_RANGE = 9.0;    // tiles - switches from chase back to patrol
const HUNTER_PATROL_SPEED_RATIO = 0.45;   // patrol speed = base speed * this
const HUNTER_WAYPOINT_REACH = 0.5;    // waypoint threshold
const HUNTER_CHARGE_MULTIPLIER = 1.6;    // speed boost when charging
const HUNTER_CHARGE_DURATION_MS = 800;    // ms of the charge dash
const HUNTER_CHARGE_COOLDOWN_MS = 3000;   // ms between charges

// --- Spawn ---
const ORB_SPAWN_INTERVAL_INITIAL_MS = 2800;
const ORB_SPAWN_INTERVAL_MIN_MS = 900;
const ORB_SPAWN_ACCEL_MS_PER_SEC = 28;

// --- Corruption (shrinking arena) ---
const CORRUPTION_START_DELAY_SECONDS = 12;
const CORRUPTION_INTERVAL_SECONDS = 6;

// --- Score ---
const SURVIVAL_POINTS_PER_SECOND = 30;
const ORB_COLLECT_BONUS = 500;
