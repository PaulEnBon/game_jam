/*
  ============================================================
  ORB CLASS  (safe -> warning -> patrol / chase zombie)
  ============================================================
  Lifecycle :
    1. SAFE     — green, gently bobs in place. Collectible for bonus.
    2. WARNING  — orange/flashing, shakes. Clear 2-second alert.
    3. PATROL   — red zombie wanders between random waypoints.
    4. CHASE    — red zombie locks onto player within detection range,
                  occasionally charges at higher speed.

  The clear state transitions make enemy behaviour readable :
  players see the warning flash, then can observe zombies
  patrolling before they aggro.
*/

class Orb {
  /**
   * @param {number} worldX - tile-space X
   * @param {number} worldY - tile-space Y
   * @param {number} mutationDelayMs - time before warning phase begins
  * @param {number} hunterSpeed - base speed when it becomes a zombie
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
    this.lastUnstuckMs = 0;

    // Motion vector cache (used by renderer for directional head turn)
    this.prevPosX = worldX;
    this.prevPosY = worldY;
    this.moveDirX = 0;
    this.moveDirY = 1;

    // Chase steering helpers
    this.strafeSeed = Math.random() * Math.PI * 2;
    this.repathIntervalMs = 260;
    this.lastRepathMs = 0;
    this.nextPathX = null;
    this.nextPathY = null;
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
    const beforeX = this.posX;
    const beforeY = this.posY;
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

    const movedX = this.posX - beforeX;
    const movedY = this.posY - beforeY;
    const movedLen = Math.hypot(movedX, movedY);
    if (movedLen > 0.0001) {
      this.moveDirX = movedX / movedLen;
      this.moveDirY = movedY / movedLen;
    }
    this.prevPosX = this.posX;
    this.prevPosY = this.posY;
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
    const moved = this.moveWithCollision(dirX * speed * dt, dirY * speed * dt);
    if (!moved) {
      this.pickNewWaypoint();
    }
  }

  // --- CHASE : pursue player, occasionally charge ---
  updateChase(dt, player) {
    const now = millis();
    const dx = player.posX - this.posX;
    const dy = player.posY - this.posY;
    const dist = Math.hypot(dx, dy);

    // If player escapes far enough, drop back to patrol
    if (!this.noLoseAggro && dist > HUNTER_LOSE_RANGE) {
      this.state = "patrol";
      this.pickNewWaypoint();
      return;
    }

    // --- Charge attack logic ---
    // Start a new charge if off cooldown and close enough
    if (
      !this.chargeActive &&
      dist > 0.001 &&
      dist < HUNTER_DETECT_RANGE &&
      now - this.lastChargeMs > HUNTER_CHARGE_COOLDOWN_MS
    ) {
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
      // Normal chase : pursue player but avoid fully straight tunnel-vision.
      speed = this.hunterSpeed;

      let targetX = player.posX;
      let targetY = player.posY;
      const hasLOS = this.hasLineOfSightTo(player.posX, player.posY);

      if (hasLOS) {
        // Small lateral offset makes approach less "always eye contact".
        const invDist = 1 / Math.max(0.001, dist);
        const perpX = -dy * invDist;
        const perpY = dx * invDist;
        const strafe = Math.sin(now * 0.003 + this.strafeSeed) * 0.42;
        targetX += perpX * strafe;
        targetY += perpY * strafe;
        this.nextPathX = null;
        this.nextPathY = null;
      } else {
        if (
          this.nextPathX === null ||
          this.nextPathY === null ||
          now - this.lastRepathMs >= this.repathIntervalMs ||
          Math.hypot(this.nextPathX - this.posX, this.nextPathY - this.posY) < 0.25
        ) {
          const step = this.findPathNextStepTo(player.posX, player.posY);
          this.lastRepathMs = now;
          if (step) {
            this.nextPathX = step.x;
            this.nextPathY = step.y;
          }
        }

        if (this.nextPathX !== null && this.nextPathY !== null) {
          targetX = this.nextPathX;
          targetY = this.nextPathY;
        }
      }

      const tx = targetX - this.posX;
      const ty = targetY - this.posY;
      const tDist = Math.hypot(tx, ty);
      if (tDist <= 0.0001) return;
      dirX = tx / tDist;
      dirY = ty / tDist;
    }

    const moved = this.moveWithCollision(dirX * speed * dt, dirY * speed * dt);
    if (!moved && !this.chargeActive) {
      this.tryUnstuckHop();
    }
  }

  hasLineOfSightTo(targetX, targetY) {
    const dx = targetX - this.posX;
    const dy = targetY - this.posY;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return true;

    const stepSize = 0.2;
    const steps = Math.max(1, Math.floor(dist / stepSize));
    const invSteps = 1 / steps;

    for (let i = 1; i < steps; i++) {
      const t = i * invSteps;
      const x = this.posX + dx * t;
      const y = this.posY + dy * t;
      if (isWorldBlocked(x, y, 0.12)) {
        return false;
      }
    }
    return true;
  }

  findPathNextStepTo(targetX, targetY) {
    const startCol = Math.floor(this.posX);
    const startRow = Math.floor(this.posY);
    const goalCol = Math.floor(targetX);
    const goalRow = Math.floor(targetY);

    if (
      startCol < 0 || startCol >= MAP_TILE_COUNT ||
      startRow < 0 || startRow >= MAP_TILE_COUNT ||
      goalCol < 0 || goalCol >= MAP_TILE_COUNT ||
      goalRow < 0 || goalRow >= MAP_TILE_COUNT
    ) {
      return null;
    }

    const startIdx = startRow * MAP_TILE_COUNT + startCol;
    const goalIdx = goalRow * MAP_TILE_COUNT + goalCol;
    if (startIdx === goalIdx) {
      return { x: goalCol + 0.5, y: goalRow + 0.5 };
    }

    const total = MAP_TILE_COUNT * MAP_TILE_COUNT;
    const parent = new Int32Array(total);
    const visited = new Uint8Array(total);
    for (let i = 0; i < total; i++) parent[i] = -1;

    const queue = new Int32Array(total);
    let qHead = 0;
    let qTail = 0;

    queue[qTail++] = startIdx;
    visited[startIdx] = 1;

    const offsets = [
      { dc: 1, dr: 0 },
      { dc: -1, dr: 0 },
      { dc: 0, dr: 1 },
      { dc: 0, dr: -1 },
    ];

    let found = false;
    while (qHead < qTail) {
      const idx = queue[qHead++];
      if (idx === goalIdx) {
        found = true;
        break;
      }

      const row = Math.floor(idx / MAP_TILE_COUNT);
      const col = idx - row * MAP_TILE_COUNT;

      for (const off of offsets) {
        const nc = col + off.dc;
        const nr = row + off.dr;
        if (nc < 0 || nc >= MAP_TILE_COUNT || nr < 0 || nr >= MAP_TILE_COUNT) continue;
        if (worldTileMap[nr][nc] !== 0) continue;

        const nIdx = nr * MAP_TILE_COUNT + nc;
        if (visited[nIdx]) continue;

        visited[nIdx] = 1;
        parent[nIdx] = idx;
        queue[qTail++] = nIdx;
      }
    }

    if (!found) return null;

    let stepIdx = goalIdx;
    while (parent[stepIdx] !== -1 && parent[stepIdx] !== startIdx) {
      stepIdx = parent[stepIdx];
    }

    if (parent[stepIdx] === -1) return null;

    const stepRow = Math.floor(stepIdx / MAP_TILE_COUNT);
    const stepCol = stepIdx - stepRow * MAP_TILE_COUNT;
    return { x: stepCol + 0.5, y: stepRow + 0.5 };
  }

  // --- Collision-aware movement (wall slide) ---
  moveWithCollision(moveX, moveY) {
    let moved = false;

    const nextX = this.posX + moveX;
    const nextY = this.posY + moveY;
    if (!isWorldBlocked(nextX, this.posY, 0.2)) {
      this.posX = nextX;
      moved = true;
    }
    if (!isWorldBlocked(this.posX, nextY, 0.2)) {
      this.posY = nextY;
      moved = true;
    }

    if (moved) return true;

    const intentLength = Math.hypot(moveX, moveY);
    if (intentLength <= 0.0001) return false;

    const dirX = moveX / intentLength;
    const dirY = moveY / intentLength;
    const sideX = -dirY;
    const sideY = dirX;
    const sideStep = 0.18;

    const leftX = this.posX + sideX * sideStep;
    const leftY = this.posY + sideY * sideStep;
    if (!isWorldBlocked(leftX, leftY, 0.2)) {
      this.posX = leftX;
      this.posY = leftY;
      return true;
    }

    const rightX = this.posX - sideX * sideStep;
    const rightY = this.posY - sideY * sideStep;
    if (!isWorldBlocked(rightX, rightY, 0.2)) {
      this.posX = rightX;
      this.posY = rightY;
      return true;
    }

    return false;
  }

  tryUnstuckHop() {
    const now = millis();
    if (now - this.lastUnstuckMs < 850) return false;
    this.lastUnstuckMs = now;

    const offsets = [
      { dx: 0.34, dy: 0 },
      { dx: -0.34, dy: 0 },
      { dx: 0, dy: 0.34 },
      { dx: 0, dy: -0.34 },
      { dx: 0.24, dy: 0.24 },
      { dx: -0.24, dy: 0.24 },
      { dx: 0.24, dy: -0.24 },
      { dx: -0.24, dy: -0.24 },
    ];

    for (let i = offsets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = offsets[i];
      offsets[i] = offsets[j];
      offsets[j] = tmp;
    }

    for (const off of offsets) {
      const nx = this.posX + off.dx;
      const ny = this.posY + off.dy;
      if (isWorldBlocked(nx, ny, 0.2)) continue;
      this.posX = nx;
      this.posY = ny;
      return true;
    }

    return false;
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
