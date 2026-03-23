/*
  ============================================================
  ORB CLASS  (safe → warning → patrol / chase hunter)
  ============================================================
  Lifecycle :
    1. SAFE     — green, gently bobs in place. Collectible for bonus.
    2. WARNING  — orange/flashing, shakes. Clear 2-second alert.
    3. PATROL   — red hunter wanders between random waypoints.
    4. CHASE    — red hunter locks onto player within detection range,
                  occasionally charges at higher speed.

  The clear state transitions make enemy behaviour readable :
  players see the warning flash, then can observe hunters
  patrolling before they aggro.
*/

class Orb {
  /**
   * @param {number} worldX - tile-space X
   * @param {number} worldY - tile-space Y
   * @param {number} mutationDelayMs - time before warning phase begins
   * @param {number} hunterSpeed - base speed when it becomes a hunter
   */
  constructor(worldX, worldY, mutationDelayMs, hunterSpeed) {
    // Position (may include visual bob offset for rendering)
    this.posX = worldX;
    this.posY = worldY;
    this.baseX = worldX;           // original spawn X (for bob)
    this.baseY = worldY;           // original spawn Y (for bob)

    // State machine : "safe" → "warning" → "patrol" | "chase"
    this.state = "safe";
    this.birthMs = millis();
    this.mutationDelayMs = mutationDelayMs;
    this.warningStartMs = 0;       // set when entering warning
    this.hunterSpeed = hunterSpeed;
    this.radius = ORB_WORLD_RADIUS;

    // Patrol waypoint
    this.waypointX = worldX;
    this.waypointY = worldY;

    // Charge attack
    this.chargeActive = false;
    this.chargeStartMs = 0;
    this.lastChargeMs = 0;         // cooldown tracker
    this.chargeDirX = 0;
    this.chargeDirY = 0;
  }

  // --- State queries ---
  isSafe()    { return this.state === "safe"; }
  isWarning() { return this.state === "warning"; }
  isHunter()  { return this.state === "patrol" || this.state === "chase"; }
  isChasing() { return this.state === "chase"; }

  /** Progress 0→1 of how close to the warning phase. */
  mutationProgress() {
    return constrain((millis() - this.birthMs) / this.mutationDelayMs, 0, 1);
  }

  /** Progress 0→1 through the warning phase (used for flash intensity). */
  warningProgress() {
    if (!this.warningStartMs) return 0;
    return constrain((millis() - this.warningStartMs) / WARNING_DURATION_MS, 0, 1);
  }

  // ----------------------------------------------------------
  //  UPDATE  (called every frame by GameManager)
  // ----------------------------------------------------------
  update(deltaSeconds, targetPlayer) {
    const now = millis();

    // ---- State transitions ----
    if (this.state === "safe" && now - this.birthMs >= this.mutationDelayMs) {
      this.state = "warning";
      this.warningStartMs = now;
    }
    if (this.state === "warning" && now - this.warningStartMs >= WARNING_DURATION_MS) {
      this.state = "patrol";
      this.radius = ENEMY_WORLD_RADIUS;
      this.pickNewWaypoint();
    }

    // ---- Per-state behaviour ----
    switch (this.state) {
      case "safe":    this.updateSafe(deltaSeconds); break;
      case "warning": this.updateWarning(deltaSeconds); break;
      case "patrol":  this.updatePatrol(deltaSeconds, targetPlayer); break;
      case "chase":   this.updateChase(deltaSeconds, targetPlayer); break;
    }
  }

  // --- SAFE : gentle bob ---
  updateSafe(dt) {
    // Keep a stable world anchor for readability.
    this.posX = this.baseX;
    this.posY = this.baseY;
  }

  // --- WARNING : shake in place ---
  updateWarning(dt) {
    // Keep warning orbs fixed in world space too; visual warning comes
    // from colour flashing/size in renderer instead of positional jitter.
    this.posX = this.baseX;
    this.posY = this.baseY;
  }

  // --- PATROL : wander between random waypoints ---
  updatePatrol(dt, player) {
    // Check if player entered detection range → switch to chase
    const distToPlayer = Math.hypot(player.posX - this.posX, player.posY - this.posY);
    if (distToPlayer < HUNTER_DETECT_RANGE) {
      this.state = "chase";
      this.lastChargeMs = millis();  // reset charge cooldown on aggro
      return;
    }

    // Move toward current waypoint
    const dx = this.waypointX - this.posX;
    const dy = this.waypointY - this.posY;
    const distWP = Math.hypot(dx, dy);

    if (distWP < HUNTER_WAYPOINT_REACH) {
      this.pickNewWaypoint();
      return;
    }

    const speed = this.hunterSpeed * HUNTER_PATROL_SPEED_RATIO;
    const dirX = dx / distWP;
    const dirY = dy / distWP;
    this.moveWithCollision(dirX * speed * dt, dirY * speed * dt);
  }

  // --- CHASE : pursue player, occasionally charge ---
  updateChase(dt, player) {
    const now = millis();
    const dx = player.posX - this.posX;
    const dy = player.posY - this.posY;
    const dist = Math.hypot(dx, dy);

    // If player escapes far enough, drop back to patrol
    if (dist > HUNTER_LOSE_RANGE) {
      this.state = "patrol";
      this.pickNewWaypoint();
      return;
    }

    // --- Charge attack logic ---
    // Start a new charge if off cooldown and close enough
    if (!this.chargeActive && dist < HUNTER_DETECT_RANGE && now - this.lastChargeMs > HUNTER_CHARGE_COOLDOWN_MS) {
      this.chargeActive = true;
      this.chargeStartMs = now;
      // Lock in direction at charge start
      this.chargeDirX = dx / dist;
      this.chargeDirY = dy / dist;
    }

    // End charge after duration
    if (this.chargeActive && now - this.chargeStartMs > HUNTER_CHARGE_DURATION_MS) {
      this.chargeActive = false;
      this.lastChargeMs = now;
    }

    if (dist < 0.01) return;

    let speed, dirX, dirY;
    if (this.chargeActive) {
      // During charge : locked direction, high speed
      speed = this.hunterSpeed * HUNTER_CHARGE_MULTIPLIER;
      dirX = this.chargeDirX;
      dirY = this.chargeDirY;
    } else {
      // Normal chase : follow player
      speed = this.hunterSpeed;
      dirX = dx / dist;
      dirY = dy / dist;
    }

    this.moveWithCollision(dirX * speed * dt, dirY * speed * dt);
  }

  // --- Collision-aware movement (wall slide) ---
  moveWithCollision(moveX, moveY) {
    const nextX = this.posX + moveX;
    const nextY = this.posY + moveY;
    if (!isWorldBlocked(nextX, this.posY, 0.2)) this.posX = nextX;
    if (!isWorldBlocked(this.posX, nextY, 0.2)) this.posY = nextY;
  }

  // --- Pick a random walkable waypoint ---
  pickNewWaypoint() {
    for (let attempt = 0; attempt < 30; attempt++) {
      const col = Math.floor(Math.random() * (MAP_TILE_COUNT - 4)) + 2;
      const row = Math.floor(Math.random() * (MAP_TILE_COUNT - 4)) + 2;
      if (worldTileMap[row][col] === 0) {
        this.waypointX = col + 0.5;
        this.waypointY = row + 0.5;
        return;
      }
    }
  }
}
