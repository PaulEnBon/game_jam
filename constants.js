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

// --- Physique joueur (saut / regard vertical) ---
const PLAYER_PITCH_SPEED  = 0.0022; // sensibilité verticale
const PLAYER_MAX_PITCH    = 0.78;   // ~45°
const PLAYER_JUMP_VELOCITY = 5.2;
const PLAYER_GRAVITY       = 14.5;

// Camera vertical projection helpers
const CAMERA_PITCH_PIXEL_RATIO = 0.40;
const CAMERA_JUMP_PIXEL_RATIO  = 0.22;

// --- Arme ---
const WEAPON_START_AMMO        = 12;
const WEAPON_MAX_AMMO          = 24;
const WEAPON_FIRE_COOLDOWN_MS  = 170;
const WEAPON_RANGE             = 10.0;
const WEAPON_AIM_TOLERANCE_PX  = 42;
const WEAPON_HUNTER_KILL_SCORE = 260;
const HUNTER_KILL_AMMO_REFUND  = 1;
const WEAPON_BASE_DAMAGE       = 1;

// Power-ups (Punch Machine)
const POWERUP_DAMAGE_MULTIPLIER     = 2;
const POWERUP_DAMAGE_DURATION_MS    = 14000;
const POWERUP_RAPID_DURATION_MS     = 12000;
const POWERUP_RAPID_COOLDOWN_FACTOR = 0.55;
const POWERUP_INSTAKILL_DURATION_MS = 9000;

// --- Sprint (overdrive Shift) ---
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

// --- Hunter AI : comportement zombie ---
const ZOMBIE_ATTACK_DISTANCE = 0.95;
const ZOMBIE_ANIM_SPEED_MIN = 0.7;
const ZOMBIE_ANIM_SPEED_MAX = 2.2;
const ZOMBIE_SIDE_TURN_THRESHOLD = 0.35;

// --- Mode vagues (COD Zombies) ---
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

// --- Punch Machine ---
const PUNCH_MACHINE_RADIUS          = 0.42;
const PUNCH_MACHINE_UNLOCK_WAVE     = 2;
const PUNCH_MACHINE_COST            = 1200;
const PUNCH_MACHINE_COOLDOWN_MS     = 14000;

// --- Drops de mobs ---
const MOB_DROP_RADIUS         = 0.24;
const MOB_DROP_LIFETIME_MS    = 22000;
const MOB_DROP_AMMO_GAIN      = 6;
const MOB_DROP_SCORE_GAIN     = 280;
const MOB_DROP_PULSE_CHANCE   = 0.2;
const MOB_DROP_EXTRA_CHANCE   = 0.38;
const MOB_DROP_CRATE_CHANCE   = 0.12;
const MOB_DROP_ROUNDS_GAIN    = 3;
const MOB_DROP_CRATE_BONUS_AMMO = 2;

// --- Récupération d'ammo par source ---
const ORB_SAFE_AMMO_RECOVERY     = 1;
const ORB_WARNING_AMMO_RECOVERY  = 2;
const WORLD_MODULE_AMMO_RECOVERY = 2;

// --- Modules de jeu : valeurs (AEGIS / EMP / CHRONO) ---
const MODULE_AEGIS_DURATION_MS      = 9000;
const MODULE_AEGIS_REPEL_RADIUS     = 3.4;
const MODULE_AEGIS_REPEL_FORCE      = 3.2;
const MODULE_EMP_STUN_RADIUS        = 5.2;
const MODULE_EMP_STUN_DURATION_MS   = 4200;
const MODULE_CHRONO_DURATION_MS       = 8000;
const MODULE_CHRONO_SPAWN_SLOW_FACTOR = 1.8;
const MODULE_CHRONO_HUNTER_TIME_SCALE = 0.55;

// --- Esquive / téléportation lave ---
const LAVA_AVOID_DISTANCE_TILES = 2.1;
const LAVA_AVOID_PUSH_FORCE     = 2.8;
const LAVA_CENTER_PULL_FORCE    = 0.9;
const HUNTER_LAVA_TELEPORT_MIN_DISTANCE = 6.5;
