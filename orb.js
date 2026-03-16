class Orb {
  constructor(worldX, worldY, mutationDelayMs, hunterSpeed) {
    this.posX = worldX;
    this.posY = worldY;
    this.baseX = worldX;
    this.baseY = worldY;

    this.state = "safe";
    this.birthMs = millis();
    this.mutationDelayMs = mutationDelayMs;
    this.warningStartMs = 0;
    this.hunterSpeed = hunterSpeed;
    this.radius = ORB_WORLD_RADIUS;

    this.waypointX = worldX;
    this.waypointY = worldY;

    this.chargeActive = false;
    this.chargeStartMs = 0;
    this.lastChargeMs = 0;
    this.chargeDirX = 0;
    this.chargeDirY = 0;

    this.noLoseAggro = false;
    this.strafeSeed = Math.random() * Math.PI * 2;
    this.nextPathX = null;
    this.nextPathY = null;
    this.lastRepathMs = 0;
    this.repathIntervalMs = 320;
    this.lastUnstuckMs = 0;
  }

  isSafe() { return this.state === "safe"; }
  isWarning() { return this.state === "warning"; }
  isHunter() { return this.state === "patrol" || this.state === "chase"; }
  isChasing() { return this.state === "chase"; }

  mutationProgress() {
    return constrain((millis() - this.birthMs) / this.mutationDelayMs, 0, 1);
  }

  warningProgress() {
    if (!this.warningStartMs) return 0;
    return constrain((millis() - this.warningStartMs) / WARNING_DURATION_MS, 0, 1);
  }

  update(deltaSeconds, targetPlayer) {
    const now = millis();

    if (this.state === "safe" && now - this.birthMs >= this.mutationDelayMs) {
      this.state = "warning";
      this.warningStartMs = now;
    }
    if (this.state === "warning" && now - this.warningStartMs >= WARNING_DURATION_MS) {
      this.state = "patrol";
      this.radius = ENEMY_WORLD_RADIUS;
      this.pickNewWaypoint();
    }

    switch (this.state) {
      case "safe": this.updateSafe(deltaSeconds); break;
      case "warning": this.updateWarning(deltaSeconds); break;
      case "patrol": this.updatePatrol(deltaSeconds, targetPlayer); break;
      case "chase": this.updateChase(deltaSeconds, targetPlayer); break;
    }
  }

  updateSafe(dt) {
    this.posX = this.baseX;
    this.posY = this.baseY;
  }

  updateWarning(dt) {
    this.posX = this.baseX;
    this.posY = this.baseY;
  }

  updatePatrol(dt, player) {
    const distToPlayer = Math.hypot(player.posX - this.posX, player.posY - this.posY);
    if (distToPlayer < HUNTER_DETECT_RANGE) {
      this.state = "chase";
      this.lastChargeMs = millis();
      return;
    }

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

 updateChase(dt, player) {
    const now = millis();
    const dx = player.posX - this.posX;
    const dy = player.posY - this.posY;
    const dist = Math.hypot(dx, dy);

    // If the player gets far enough, return to patrol (unless noLoseAggro is enabled)
    if (!this.noLoseAggro && dist > HUNTER_LOSE_RANGE) {
      this.state = "patrol";
      this.pickNewWaypoint();
      return;
    }

    // --- Charge ---
    if (
      !this.chargeActive &&
      dist > 0.001 &&
      dist < HUNTER_DETECT_RANGE &&
      now - this.lastChargeMs > HUNTER_CHARGE_COOLDOWN_MS
    ) {
      this.chargeActive = true;
      this.chargeStartMs = now;
      this.chargeDirX = dx / dist;
      this.chargeDirY = dy / dist;
    }

    if (this.chargeActive && now - this.chargeStartMs > HUNTER_CHARGE_DURATION_MS) {
      this.chargeActive = false;
      this.lastChargeMs = now;
    }

    if (dist < 0.01) return;

    let speed, dirX, dirY;
    if (this.chargeActive) {
      speed = this.hunterSpeed * HUNTER_CHARGE_MULTIPLIER;
      dirX  = this.chargeDirX;
      dirY  = this.chargeDirY;
    } else {
      speed = this.hunterSpeed;

      let targetX = player.posX;
      let targetY = player.posY;
      const hasLOS = this.hasLineOfSightTo(player.posX, player.posY);

      if (hasLOS) {
        // Small lateral offset to avoid tunnel-style kiting.
        const invDist = 1 / Math.max(0.001, dist);
        const perpX = -dy * invDist;
        const perpY =  dx * invDist;
        const strafe = Math.sin(now * 0.003 + this.strafeSeed) * 0.42;
        targetX += perpX * strafe;
        targetY += perpY * strafe;
        this.nextPathX = null;
        this.nextPathY = null;
      } else {
        // BFS pathfinding when line-of-sight is blocked
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

// --- New method: hasLineOfSightTo() ---
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

// --- New method: findPathNextStepTo() — BFS pathfinding ---
  findPathNextStepTo(targetX, targetY) {
    const startCol = Math.floor(this.posX);
    const startRow = Math.floor(this.posY);
    const goalCol  = Math.floor(targetX);
    const goalRow  = Math.floor(targetY);

    if (
      startCol < 0 || startCol >= MAP_TILE_COUNT ||
      startRow < 0 || startRow >= MAP_TILE_COUNT ||
      goalCol  < 0 || goalCol  >= MAP_TILE_COUNT ||
      goalRow  < 0 || goalRow  >= MAP_TILE_COUNT
    ) {
      return null;
    }

    const startIdx = startRow * MAP_TILE_COUNT + startCol;
    const goalIdx  = goalRow  * MAP_TILE_COUNT + goalCol;
    if (startIdx === goalIdx) {
      return { x: goalCol + 0.5, y: goalRow + 0.5 };
    }

    const total   = MAP_TILE_COUNT * MAP_TILE_COUNT;
    const parent  = new Int32Array(total);
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
      if (idx === goalIdx) { found = true; break; }

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
        parent[nIdx]  = idx;
        queue[qTail++] = nIdx;
      }
    }

    if (!found) return null;

    // Backtrack path to the first step from start
    let stepIdx = goalIdx;
    while (parent[stepIdx] !== -1 && parent[stepIdx] !== startIdx) {
      stepIdx = parent[stepIdx];
    }
    if (parent[stepIdx] === -1) return null;

    const stepRow = Math.floor(stepIdx / MAP_TILE_COUNT);
    const stepCol = stepIdx - stepRow * MAP_TILE_COUNT;
    return { x: stepCol + 0.5, y: stepRow + 0.5 };
  }

// --- New method: moveWithCollision() — wall slide ---
  moveWithCollision(moveX, moveY) {
    let moved = false;

    const nextX = this.posX + moveX;
    const nextY = this.posY + moveY;
    if (!isWorldBlocked(nextX, this.posY, 0.2)) { this.posX = nextX; moved = true; }
    if (!isWorldBlocked(this.posX, nextY, 0.2)) { this.posY = nextY; moved = true; }

    if (moved) return true;

    // Side-step when blocked head-on
    const intentLength = Math.hypot(moveX, moveY);
    if (intentLength <= 0.0001) return false;

    const dirX  = moveX / intentLength;
    const dirY  = moveY / intentLength;
    const sideX = -dirY;
    const sideY =  dirX;
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

// --- New method: tryUnstuckHop() — recovery when stuck ---
  tryUnstuckHop() {
    const now = millis();
    if (now - this.lastUnstuckMs < 850) return false;
    this.lastUnstuckMs = now;

    const offsets = [
      { dx: 0.34, dy: 0 }, { dx: -0.34, dy: 0 },
      { dx: 0, dy: 0.34 }, { dx: 0, dy: -0.34 },
      { dx: 0.24, dy: 0.24 }, { dx: -0.24, dy: 0.24 },
      { dx: 0.24, dy: -0.24 }, { dx: -0.24, dy: -0.24 },
    ];

    // Random shuffle (Fisher-Yates)
    for (let i = offsets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = offsets[i]; offsets[i] = offsets[j]; offsets[j] = tmp;
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
}
