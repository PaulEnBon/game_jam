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

  updateChase(dt, player) {
    const now = millis();
    const dx = player.posX - this.posX;
    const dy = player.posY - this.posY;
    const dist = Math.hypot(dx, dy);

    if (dist > HUNTER_LOSE_RANGE) {
      this.state = "patrol";
      this.pickNewWaypoint();
      return;
    }

    if (!this.chargeActive && dist < HUNTER_DETECT_RANGE && now - this.lastChargeMs > HUNTER_CHARGE_COOLDOWN_MS) {
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

    let speed;
    let dirX;
    let dirY;
    if (this.chargeActive) {
      speed = this.hunterSpeed * HUNTER_CHARGE_MULTIPLIER;
      dirX = this.chargeDirX;
      dirY = this.chargeDirY;
    } else {
      speed = this.hunterSpeed;
      dirX = dx / dist;
      dirY = dy / dist;
    }

    this.moveWithCollision(dirX * speed * dt, dirY * speed * dt);
  }

  moveWithCollision(moveX, moveY) {
    const nextX = this.posX + moveX;
    const nextY = this.posY + moveY;
    if (!isWorldBlocked(nextX, this.posY, 0.2)) this.posX = nextX;
    if (!isWorldBlocked(this.posX, nextY, 0.2)) this.posY = nextY;
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
}
