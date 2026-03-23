

class GameManager {
  initDOM() {
    this.startOverlay = document.getElementById("start-overlay");
    this.gameOverOverlay = document.getElementById("game-over-overlay");
    this.finalScoreEl = document.getElementById("final-score");
    this.gameOverReasonEl = document.getElementById("game-over-reason");
    this.restartBtn = document.getElementById("restart-button");
    this.openSettingsBtn = document.getElementById("open-settings-button");
    this.settingsOverlay = document.getElementById("settings-overlay");
    this.closeSettingsBtn = document.getElementById("close-settings-button");
    this.resetControlsBtn = document.getElementById("reset-controls-button");
    this.settingsStatusEl = document.getElementById("settings-status");
    this.controlLegendEl = document.getElementById("control-legend");
    this.bindButtons = Array.from(document.querySelectorAll(".bind-button"));

    if (this.restartBtn) {
      this.restartBtn.addEventListener("click", () => this.startNewGame());
    }

    if (this.openSettingsBtn) {
      this.openSettingsBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.openSettingsMenu();
      });
    }

    if (this.closeSettingsBtn) {
      this.closeSettingsBtn.addEventListener("click", () => this.closeSettingsMenu());
    }

    if (this.resetControlsBtn) {
      this.resetControlsBtn.addEventListener("click", () => {
        resetControlBindings();
        this.refreshBindingButtons();
        this.renderControlLegend();
        this.setSettingsStatus("Touches reinitialisees.");
      });
    }

    if (this.settingsOverlay) {
      this.settingsOverlay.addEventListener("click", (event) => {
        if (event.target === this.settingsOverlay) {
          this.closeSettingsMenu();
        }
      });
    }

    for (const button of this.bindButtons) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.beginRebind(button.dataset.action, button);
      });
    }

    if (this.startOverlay) {
      this.startOverlay.addEventListener("click", () => {
        if (this.isSettingsVisible()) return;
        this.requestPointerLock();
        this.startNewGame();
      });
    }

    this.refreshBindingButtons();
    this.renderControlLegend();
  }

  isSettingsVisible() {
    return !!(this.settingsOverlay && this.settingsOverlay.classList.contains("visible"));
  }

  openSettingsMenu() {
    if (!this.settingsOverlay) return;
    this.cancelPendingRebind();
    this.refreshBindingButtons();
    this.setSettingsStatus("Clique sur une action puis appuie sur une touche.");
    this.settingsOverlay.classList.add("visible");
    this.settingsOverlay.setAttribute("aria-hidden", "false");
  }

  closeSettingsMenu() {
    if (!this.settingsOverlay) return;
    this.cancelPendingRebind();
    this.settingsOverlay.classList.remove("visible");
    this.settingsOverlay.setAttribute("aria-hidden", "true");
  }

  setSettingsStatus(message, isError = false) {
    if (!this.settingsStatusEl) return;
    this.settingsStatusEl.textContent = message;
    this.settingsStatusEl.style.color = isError ? "#ff9a9a" : "#a7b3d8";
  }

  refreshBindingButtons() {
    for (const button of this.bindButtons) {
      const action = button.dataset.action;
      button.classList.remove("listening");
      button.textContent = getDisplayKeyName(getControlBinding(action));
    }
  }

  beginRebind(action, button) {
    if (!action || !button) return;
    this.cancelPendingRebind();

    this.pendingRebindAction = action;
    this.pendingRebindButton = button;
    button.classList.add("listening");
    button.textContent = "Appuie...";
    this.setSettingsStatus("Appuie sur une touche (Echap pour annuler).");

    window.addEventListener("keydown", this.boundCaptureRebindKey, true);
  }

  captureRebindKey(event) {
    if (!this.pendingRebindAction) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.code === "Escape") {
      this.cancelPendingRebind();
      this.setSettingsStatus("Modification annulee.");
      this.refreshBindingButtons();
      return;
    }

    const result = setControlBinding(this.pendingRebindAction, event.code);
    this.cancelPendingRebind();
    this.refreshBindingButtons();
    this.renderControlLegend();
    this.setSettingsStatus(result.message, !result.ok);
  }

  cancelPendingRebind() {
    window.removeEventListener("keydown", this.boundCaptureRebindKey, true);

    if (this.pendingRebindButton) {
      this.pendingRebindButton.classList.remove("listening");
    }

    this.pendingRebindAction = null;
    this.pendingRebindButton = null;
  }

  renderControlLegend() {
    if (!this.controlLegendEl) return;
    this.controlLegendEl.textContent = getMovementLegendText();
  }

  drawMinimap() {
    const mmSize = 140;
    const mmX = 10;
    const mmY = SCREEN_HEIGHT - mmSize - 10;
    const tilePixels = mmSize / MAP_TILE_COUNT;

    push();
    fill(0, 0, 0, 160);
    noStroke();
    rect(mmX, mmY, mmSize, mmSize, 4);

    for (let row = 0; row < MAP_TILE_COUNT; row++) {
      for (let col = 0; col < MAP_TILE_COUNT; col++) {
        const t = worldTileMap[row][col];
        if (t === 0) continue;
        switch (t) {
          case 1: fill(130, 130, 130, 200); break;
          case 2: fill(134, 96, 67, 200); break;
          case 3: fill(76, 155, 60, 200); break;
          case 4: fill(90, 130, 90, 200); break;
          case 5: fill(220, 195, 100, 200); break;
          case 6: fill(180, 30, 30, 220); break;
          default: fill(100, 100, 100, 200);
        }
        rect(mmX + col * tilePixels, mmY + row * tilePixels, tilePixels + 0.5, tilePixels + 0.5);
      }
    }

    for (const orb of this.orbs) {
      let col;
      if (orb.isSafe()) col = color(80, 255, 120);
      else if (orb.isWarning()) col = color(255, 180, 40);
      else if (orb.isChasing()) col = color(255, 50, 50);
      else col = color(180, 70, 70);
      fill(col);
      const ox = mmX + orb.posX * tilePixels;
      const oy = mmY + orb.posY * tilePixels;
      circle(ox, oy, 3);
    }

    const px = mmX + this.player.posX * tilePixels;
    const py = mmY + this.player.posY * tilePixels;
    fill(100, 180, 255);
    circle(px, py, 5);

    stroke(100, 180, 255);
    strokeWeight(1.5);
    const arrowLen = 8;
    line(px, py, px + Math.cos(this.player.angle) * arrowLen, py + Math.sin(this.player.angle) * arrowLen);

    pop();
  }

  drawHUD() {
    push();
    textFont("Courier New");
    fill(230, 240, 255);
    noStroke();
    textSize(18);
    textAlign(LEFT, TOP);
    text("SCORE: " + Math.floor(this.score), 14, 14);
    text("TIME: " + this.survivalSeconds().toFixed(1) + "s", 14, 38);

    const safeCount = this.orbs.filter(o => o.isSafe() || o.isWarning()).length;
    const hunterCount = this.orbs.filter(o => o.isHunter()).length;

    textAlign(RIGHT, TOP);
    fill(92, 255, 145);
    text("ORBS: " + safeCount, SCREEN_WIDTH - 14, 14);
    fill(255, 80, 80);
    text("HUNTERS: " + hunterCount, SCREEN_WIDTH - 14, 38);

    if (this.corruptionLayer > 0) {
      textAlign(CENTER, TOP);
      fill(255, 50, 50, 160 + 90 * Math.sin(millis() * 0.005));
      textSize(14);
      text("CORRUPTION LAYER " + this.corruptionLayer, SCREEN_WIDTH / 2, 14);
    }
    pop();
  }

  drawCrosshair() {
    push();
    stroke(255, 255, 255, 140);
    strokeWeight(1.5);
    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2;
    line(cx - 8, cy, cx + 8, cy);
    line(cx, cy - 8, cx, cy + 8);
    pop();
  }

  triggerGameOver(reason) {
    if (this.gameState !== "playing") return;
    this.gameState = "game-over";
    this.finalScore = Math.floor(this.score);
    this.gameOverReason = reason;

    if (document.exitPointerLock) document.exitPointerLock();

    if (this.gameOverOverlay) {
      this.gameOverOverlay.classList.add("visible");
      this.gameOverOverlay.setAttribute("aria-hidden", "false");
    }
    if (this.finalScoreEl) this.finalScoreEl.textContent = String(this.finalScore);
    if (this.gameOverReasonEl) this.gameOverReasonEl.textContent = reason;
  }

  survivalSeconds() {
    return max(0, (millis() - this.gameStartMs) / 1000);
  }

  updateGame(dt) {
    this.player.update(dt);
    this.spawnOrbsIfNeeded();
    this.advanceCorruption();
    this.updateOrbs(dt);
    this.updateParticles(dt);
    this.handleCollisions();
    this.score += SURVIVAL_POINTS_PER_SECOND * dt;
  }

  spawnOrbsIfNeeded() {
    const now = millis();
    const elapsed = this.survivalSeconds();
    const interval = max(
      ORB_SPAWN_INTERVAL_MIN_MS,
      ORB_SPAWN_INTERVAL_INITIAL_MS - elapsed * ORB_SPAWN_ACCEL_MS_PER_SEC
    );

    while (now - this.lastSpawnMs >= interval) {
      this.spawnOrb();
      this.lastSpawnMs += interval;
    }
  }

  spawnOrb() {
    for (let attempt = 0; attempt < 50; attempt++) {
      const col = Math.floor(Math.random() * (MAP_TILE_COUNT - 4)) + 2;
      const row = Math.floor(Math.random() * (MAP_TILE_COUNT - 4)) + 2;
      if (worldTileMap[row][col] !== 0) continue;

      const wx = col + 0.5;
      const wy = row + 0.5;
      if (Math.hypot(wx - this.player.posX, wy - this.player.posY) < 3) continue;

      const mutDelay = random(MIN_MUTATION_DELAY_MS, MAX_MUTATION_DELAY_MS);
      const speed = ENEMY_BASE_SPEED + this.survivalSeconds() * ENEMY_SPEED_GROWTH;
      this.orbs.push(new Orb(wx, wy, mutDelay, speed));
      return;
    }
  }

  advanceCorruption() {
    const elapsed = this.survivalSeconds();
    if (elapsed < CORRUPTION_START_DELAY_SECONDS) return;

    const timeSinceLast = elapsed - this.lastCorruptionTime;
    if (this.lastCorruptionTime === 0) {
      this.lastCorruptionTime = elapsed;
      return;
    }

    if (timeSinceLast >= CORRUPTION_INTERVAL_SECONDS) {
      this.lastCorruptionTime = elapsed;
      this.corruptionLayer++;
      this.applyCorruptionLayer(this.corruptionLayer);
      this.addScreenShake(4, 300);
    }
  }

  applyCorruptionLayer(layer) {
    const lo = layer;
    const hi = MAP_TILE_COUNT - 1 - layer;
    if (lo >= hi) {
      this.triggerGameOver("The corruption consumed the entire arena.");
      return;
    }

    for (let col = lo; col <= hi; col++) {
      if (worldTileMap[lo][col] === 0) worldTileMap[lo][col] = 6;
      if (worldTileMap[hi][col] === 0) worldTileMap[hi][col] = 6;
    }
    for (let row = lo; row <= hi; row++) {
      if (worldTileMap[row][lo] === 0) worldTileMap[row][lo] = 6;
      if (worldTileMap[row][hi] === 0) worldTileMap[row][hi] = 6;
    }
  }

  updateOrbs(dt) {
    for (const orb of this.orbs) orb.update(dt, this.player);
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].isDead()) this.particles.splice(i, 1);
    }
  }

  handleCollisions() {
    const offsets = [
      { dx: -this.player.radius, dy: -this.player.radius },
      { dx: this.player.radius, dy: -this.player.radius },
      { dx: -this.player.radius, dy: this.player.radius },
      { dx: this.player.radius, dy: this.player.radius },
    ];

    for (const off of offsets) {
      const tc = Math.floor(this.player.posX + off.dx);
      const tr = Math.floor(this.player.posY + off.dy);
      if (tc >= 0 && tc < MAP_TILE_COUNT && tr >= 0 && tr < MAP_TILE_COUNT) {
        if (worldTileMap[tr][tc] === 6) {
          this.triggerGameOver("You touched the corruption wall!");
          return;
        }
      }
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      const dx = this.player.posX - orb.posX;
      const dy = this.player.posY - orb.posY;
      const distSq = dx * dx + dy * dy;
      const combinedR = this.player.radius + orb.radius;

      if (distSq <= combinedR * combinedR) {
        if (orb.isSafe()) {
          this.score += ORB_COLLECT_BONUS;
          this.spawnCollectParticles(orb.posX, orb.posY, [92, 255, 145]);
          this.orbs.splice(i, 1);
        } else if (orb.isWarning()) {
          this.score += ORB_COLLECT_BONUS * 2;
          this.spawnCollectParticles(orb.posX, orb.posY, [255, 200, 60]);
          this.orbs.splice(i, 1);
        } else {
          this.triggerGameOver("A mutated hunter caught you!");
          return;
        }
      }
    }
  }

  spawnCollectParticles(wx, wy, col) {
    for (let i = 0; i < 10; i++) {
      this.particles.push(new Particle(wx, wy, col));
    }
  }

 pushHudToast(text, colorArray = [220, 240, 255]) {
    this.hudToastText = text;
    this.hudToastColor = colorArray;
    this.hudToastUntilMs = millis() + HUD_TOAST_DURATION_MS;
  }

  recoverAmmo(amount, toastText = "", colorArray = [255, 220, 110]) {
    if (amount <= 0) return 0;

    const before = this.weaponAmmo;
    this.weaponAmmo = Math.min(WEAPON_MAX_AMMO, this.weaponAmmo + amount);
    const gained = this.weaponAmmo - before;

    if (gained > 0 && toastText) {
      this.pushHudToast(`${toastText} (+${gained})`, colorArray);
    }

    return gained;
  }

  addInventoryItem(itemKey, amount = 1) {
    if (!Object.prototype.hasOwnProperty.call(this.inventory, itemKey)) return 0;
    const before = this.inventory[itemKey];
    this.inventory[itemKey] = Math.min(INVENTORY_SLOT_MAX, this.inventory[itemKey] + amount);
    return this.inventory[itemKey] - before;
  }

  consumeInventoryItem(itemKey) {
    if (!Object.prototype.hasOwnProperty.call(this.inventory, itemKey)) return false;
    if (this.inventory[itemKey] <= 0) {
      this.pushHudToast("Slot vide", [255, 160, 160]);
      return false;
    }

    this.inventory[itemKey]--;

    if (itemKey === "ammoPack") {
      this.recoverAmmo(MOB_DROP_AMMO_GAIN);
      this.spawnCollectParticles(this.player.posX, this.player.posY, [255, 220, 110]);
      this.pushHudToast("Ammo pack utilisÃ©", [255, 225, 130]);
    } else if (itemKey === "scoreShard") {
      this.score += MOB_DROP_SCORE_GAIN;
      this.spawnCollectParticles(this.player.posX, this.player.posY, [255, 255, 150]);
      this.pushHudToast("Score shard utilisÃ©", [255, 255, 170]);
    } else if (itemKey === "pulseCore") {
      const fakeModule = { type: this.randomModuleType(), posX: this.player.posX, posY: this.player.posY };
      this.activateWorldModule(fakeModule);
      this.spawnCollectParticles(this.player.posX, this.player.posY, [220, 180, 255]);
      this.pushHudToast("Pulse core activÃ©", [220, 180, 255]);
    }

    return true;
  }

  updateSprintState(dt) {
    const shiftPressed = pressedKeyCodes.has("ShiftLeft") || pressedKeyCodes.has("ShiftRight");
    const moving =
      isControlPressed("forward") ||
      isControlPressed("backward") ||
      isControlPressed("left") ||
      isControlPressed("right");

    const canSprint = shiftPressed && moving && this.sprintEnergy > 0.2;

    if (canSprint) {
      this.sprintActive = true;
      this.player.moveSpeed = PLAYER_MOVE_SPEED * SPRINT_SPEED_MULTIPLIER;
      this.sprintEnergy = Math.max(0, this.sprintEnergy - SPRINT_DRAIN_PER_SECOND * dt);
      this.lastSprintUseMs = millis();

      if (this.sprintEnergy <= 0.2) {
        this.sprintActive = false;
        this.player.moveSpeed = PLAYER_MOVE_SPEED;
      }
      return;
    }

    this.sprintActive = false;
    this.player.moveSpeed = PLAYER_MOVE_SPEED;

    const now = millis();
    const regenFactor = now - this.lastSprintUseMs >= SPRINT_REGEN_DELAY_MS ? 1 : 0.35;
    this.sprintEnergy = Math.min(
      SPRINT_ENERGY_MAX,
      this.sprintEnergy + SPRINT_REGEN_PER_SECOND * regenFactor * dt
    );
  }

  updateKillStreakState() {
    if (this.killStreak <= 0) return;
    if (millis() <= this.killStreakUntilMs) return;
    this.killStreak = 0;
    this.killStreakUntilMs = 0;
  }

  isDamageBoostActive() {
    return millis() < this.powerDamageUntilMs;
  }

  isRapidFireActive() {
    return millis() < this.powerRapidUntilMs;
  }

  isInstakillActive() {
    return millis() < this.powerInstakillUntilMs;
  }

  currentWeaponDamage() {
    if (this.isInstakillActive()) return 999;
    if (this.isDamageBoostActive()) {
      return WEAPON_BASE_DAMAGE * POWERUP_DAMAGE_MULTIPLIER;
    }
    return WEAPON_BASE_DAMAGE;
  }

  currentFireCooldownMs() {
    if (this.isRapidFireActive()) {
      return WEAPON_FIRE_COOLDOWN_MS * POWERUP_RAPID_COOLDOWN_FACTOR;
    }
    return WEAPON_FIRE_COOLDOWN_MS;
  }

  currentKillStreakMultiplier() {
    if (this.killStreak <= 1) return 1;
    return Math.min(
      KILL_STREAK_MAX_MULTIPLIER,
      1 + (this.killStreak - 1) * KILL_STREAK_SCORE_STEP
    );
  }

  registerHunterKillStreak() {
    const now = millis();
    if (now <= this.killStreakUntilMs) {
      this.killStreak += 1;
    } else {
      this.killStreak = 1;
    }
    this.killStreakUntilMs = now + KILL_STREAK_WINDOW_MS;

    const multiplier = this.currentKillStreakMultiplier();
    const gainedScore = Math.floor(WEAPON_HUNTER_KILL_SCORE * multiplier);
    this.score += gainedScore;

    if (this.killStreak >= 2) {
      const multiplierText = multiplier.toFixed(2).replace(/\.00$/, "");
      this.pushHudToast(`STREAK x${multiplierText} (${this.killStreak})`, [255, 170, 120]);
    }

    if (this.killStreak % KILL_STREAK_AMMO_BONUS_EVERY === 0) {
      this.recoverAmmo(KILL_STREAK_AMMO_BONUS, "Bonus sÃ©rie", [255, 200, 130]);
    }
  }

  updateWaveSystem() {
    const now = millis();

    if (this.waveState === "preparing") {
      if (now >= this.nextWaveActionMs) {
        this.startNextWave();
      }
      return;
    }

    if (this.waveState !== "spawning" && this.waveState !== "in-progress") return;

    let aliveHunters = this.countAliveHunters();
    // Keep spawning deterministic: timed batches, hard alive-cap, and graceful retry on blocked spots.
    while (
      this.waveState === "spawning" &&
      this.waveEnemiesSpawned < this.waveEnemiesTotal &&
      aliveHunters < this.waveMaxSimultaneous &&
      now >= this.nextWaveActionMs
    ) {
      const spawned = this.spawnWaveHunter();
      if (!spawned) {
        this.nextWaveActionMs = now + 220;
        break;
      }

      this.waveEnemiesSpawned++;
      aliveHunters++;
      this.nextWaveActionMs += this.waveSpawnIntervalMs;
    }

    if (this.waveEnemiesSpawned >= this.waveEnemiesTotal) {
      this.waveState = "in-progress";
    }

    const aliveAfter = this.countAliveHunters();
    if (
      this.waveEnemiesSpawned >= this.waveEnemiesTotal &&
      this.waveEnemiesKilled >= this.waveEnemiesTotal &&
      aliveAfter === 0
    ) {
      this.completeCurrentWave();
    }
  }

  startNextWave() {
    this.waveNumber += 1;
    this.waveEnemiesTotal =
      WAVE_BASE_ENEMY_COUNT +
      (this.waveNumber - 1) * WAVE_ENEMY_GROWTH_LINEAR +
      Math.floor(Math.pow(this.waveNumber, 1.2));
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesKilled = 0;
    this.waveMaxSimultaneous = Math.min(
      WAVE_MAX_SIMULTANEOUS_CAP,
      WAVE_MAX_SIMULTANEOUS_BASE + Math.floor((this.waveNumber - 1) * WAVE_MAX_SIMULTANEOUS_GROWTH)
    );
    this.waveSpawnIntervalMs = Math.max(
      WAVE_SPAWN_INTERVAL_MIN_MS,
      WAVE_SPAWN_INTERVAL_BASE_MS - (this.waveNumber - 1) * WAVE_SPAWN_INTERVAL_DECAY_MS
    );

    this.waveState = "spawning";
    this.nextWaveActionMs = millis() + 500;
    this.pushHudToast(`VAGUE ${this.waveNumber} en approche`, [255, 145, 110]);
    this.addScreenShake(2.6, 180);
  }

  completeCurrentWave() {
    const rewardScore =
      WAVE_CLEAR_REWARD_SCORE + this.waveNumber * WAVE_CLEAR_REWARD_SCORE_PER_WAVE;
    this.score += rewardScore;

    const rewardAmmo = WAVE_CLEAR_REWARD_AMMO + Math.floor(this.waveNumber / 4);
    this.recoverAmmo(rewardAmmo, "Prime de vague", [255, 220, 120]);

    if (this.waveNumber % 3 === 0) {
      this.spawnWorldModule();
    }

    this.waveState = "preparing";
    this.nextWaveActionMs = millis() + WAVE_BREAK_DURATION_MS;
    this.pushHudToast(`Vague ${this.waveNumber} nettoyÃ©e`, [145, 230, 255]);
  }

  countAliveHunters() {
    let count = 0;
    for (const orb of this.orbs) {
      if (orb.isHunter()) count++;
    }
    return count;
  }

  waveHunterHealth() {
    return 1 + Math.floor(Math.max(0, this.waveNumber - 1) / WAVE_HEALTH_STEP_WAVES);
  }

  spawnWaveHunter() {
    const pos = this.findWaveSpawnSpot();
    if (!pos) return false;

    const speed = ENEMY_BASE_SPEED + this.waveNumber * WAVE_ENEMY_SPEED_PER_WAVE + random(0, 0.28);
    const health = this.waveHunterHealth();
    this.spawnHunterAt(pos.x, pos.y, speed, health);
    return true;
  }

  spawnHunterAt(wx, wy, speed, health) {
    const hunter = new Orb(wx, wy, MAX_MUTATION_DELAY_MS * 4, speed);
    hunter.state = "chase";
    hunter.radius = ENEMY_WORLD_RADIUS;
    hunter.birthMs = millis() - MAX_MUTATION_DELAY_MS;
    hunter.warningStartMs = 0;
    hunter.health = Math.max(1, Math.floor(health));
    hunter.maxHealth = hunter.health;
    hunter.spawnSource = "wave";
    hunter.noLoseAggro = true;
    this.orbs.push(hunter);
  }

  findWaveSpawnSpot() {
    const reachableMask = this.buildReachableTileMaskFromPlayer();
    let bestSpot = null;

    // Evaluate edge-lane candidates and keep the highest score for fair, non-overlapping spawns.
    for (let attempt = 0; attempt < 180; attempt++) {
      const lane = 2 + Math.floor(Math.random() * 3);
      const side = Math.floor(Math.random() * 4);
      let row = 0;
      let col = 0;

      if (side === 0) {
        row = lane;
        col = 2 + Math.floor(Math.random() * (MAP_TILE_COUNT - 4));
      } else if (side === 1) {
        row = MAP_TILE_COUNT - 1 - lane;
        col = 2 + Math.floor(Math.random() * (MAP_TILE_COUNT - 4));
      } else if (side === 2) {
        col = lane;
        row = 2 + Math.floor(Math.random() * (MAP_TILE_COUNT - 4));
      } else {
        col = MAP_TILE_COUNT - 1 - lane;
        row = 2 + Math.floor(Math.random() * (MAP_TILE_COUNT - 4));
      }

      if (!this.isWalkableTile(row, col)) continue;

      const tileIndex = row * MAP_TILE_COUNT + col;
      if (reachableMask[tileIndex] !== 1) continue;

      const openNeighbors = this.countOpenCardinalNeighbors(row, col);
      if (openNeighbors < 2) continue;

      const x = col + 0.5;
      const y = row + 0.5;
      const distToPlayer = Math.hypot(x - this.player.posX, y - this.player.posY);
      if (distToPlayer < 7.2) continue;
      if (this.orbs.some((orb) => Math.hypot(x - orb.posX, y - orb.posY) < 1.2)) continue;

      const score = distToPlayer + openNeighbors * 0.45 + Math.random() * 0.24;
      if (!bestSpot || score > bestSpot.score) {
        bestSpot = { x, y, score };
      }
    }

    if (bestSpot) {
      return { x: bestSpot.x, y: bestSpot.y };
    }

    return this.findFreeWorldSpot(6.8);
  }

  activatePunchMachine() {
    if (!this.punchMachine) return;

    const now = millis();
    if (this.waveNumber < PUNCH_MACHINE_UNLOCK_WAVE) {
      this.pushHudToast(`Punch Machine verrouillÃ©e (vague ${PUNCH_MACHINE_UNLOCK_WAVE})`, [255, 160, 160]);
      return;
    }

    if (this.score < PUNCH_MACHINE_COST) {
      this.pushHudToast(`Points insuffisants (${PUNCH_MACHINE_COST})`, [255, 165, 165]);
      return;
    }

    const cooldownLeft = PUNCH_MACHINE_COOLDOWN_MS - (now - this.punchMachine.lastUseMs);
    if (cooldownLeft > 0) {
      const seconds = (cooldownLeft / 1000).toFixed(1);
      this.pushHudToast(`Punch recharge: ${seconds}s`, [210, 180, 255]);
      return;
    }

    this.score -= PUNCH_MACHINE_COST;
    this.punchMachine.lastUseMs = now;
    this.applyRandomPunchPowerup();
    this.addScreenShake(3.5, 220);
    this.spawnCollectParticles(this.punchMachine.posX, this.punchMachine.posY, [235, 130, 255]);
  }

  applyRandomPunchPowerup() {
    const now = millis();
    const roll = Math.random();

    if (roll < 0.2) {
      this.recoverAmmo(WEAPON_MAX_AMMO, "PUNCH: MAX AMMO", [255, 220, 140]);
      return;
    }

    if (roll < 0.45) {
      this.powerDamageUntilMs = Math.max(this.powerDamageUntilMs, now) + POWERUP_DAMAGE_DURATION_MS;
      this.pushHudToast("PUNCH: DOUBLE DAMAGE", [255, 170, 120]);
      return;
    }

    if (roll < 0.7) {
      this.powerRapidUntilMs = Math.max(this.powerRapidUntilMs, now) + POWERUP_RAPID_DURATION_MS;
      this.pushHudToast("PUNCH: RAPID FIRE", [255, 240, 140]);
      return;
    }

    if (roll < 0.9) {
      this.powerInstakillUntilMs = Math.max(this.powerInstakillUntilMs, now) + POWERUP_INSTAKILL_DURATION_MS;
      this.pushHudToast("PUNCH: INSTAKILL", [255, 110, 110]);
      return;
    }

    this.activeAegisUntilMs = Math.max(this.activeAegisUntilMs, now) + 6000;
    this.sprintEnergy = SPRINT_ENERGY_MAX;
    this.recoverAmmo(4, "PUNCH: SHIELD CHARGE", [150, 225, 255]);
  }

  isOrbStunned(orb, nowMs) {
    if (!orb.isHunter()) return false;
    const until = this.orbStunUntilMap.get(orb) || 0;
    return until > nowMs;
  }

  countStunnedHunters() {
    const now = millis();
    let count = 0;
    for (const orb of this.orbs) {
      if (this.isOrbStunned(orb, now)) count++;
    }
    return count;
  }

  stunNearbyHunters(radius, durationMs) {
    const now = millis();
    let stunnedCount = 0;
    for (const orb of this.orbs) {
      if (!orb.isHunter()) continue;
      const dist = Math.hypot(orb.posX - this.player.posX, orb.posY - this.player.posY);
      if (dist <= radius) {
        this.orbStunUntilMap.set(orb, now + durationMs);
        stunnedCount++;
      }
    }
    return stunnedCount;
  }

  applyAegisRepelToOrb(orb, dt) {
    const dx = orb.posX - this.player.posX;
    const dy = orb.posY - this.player.posY;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.001 || dist > MODULE_AEGIS_REPEL_RADIUS) return;

    const falloff = 1 - dist / MODULE_AEGIS_REPEL_RADIUS;
    const push = MODULE_AEGIS_REPEL_FORCE * falloff * dt;
    const pushX = (dx / dist) * push;
    const pushY = (dy / dist) * push;

    const nextX = orb.posX + pushX;
    const nextY = orb.posY + pushY;
    if (!isWorldBlocked(nextX, orb.posY, 0.2)) orb.posX = nextX;
    if (!isWorldBlocked(orb.posX, nextY, 0.2)) orb.posY = nextY;
  }

  isPositionNearLava(x, y, range = 0.9) {
    const minCol = Math.max(0, Math.floor(x - range - 1));
    const maxCol = Math.min(MAP_TILE_COUNT - 1, Math.floor(x + range + 1));
    const minRow = Math.max(0, Math.floor(y - range - 1));
    const maxRow = Math.min(MAP_TILE_COUNT - 1, Math.floor(y + range + 1));

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (worldTileMap[row][col] !== 6) continue;
        const dx = x - (col + 0.5);
        const dy = y - (row + 0.5);
        if (Math.hypot(dx, dy) <= range) {
          return true;
        }
      }
    }
    return false;
  }

  isOrbTouchingLava(orb) {
    return this.isPositionNearLava(orb.posX, orb.posY, orb.radius + 0.12);
  }

  findHunterLavaTeleportSpot(orb, minDistanceFromPlayer) {
    for (let attempt = 0; attempt < 140; attempt++) {
      const col = Math.floor(Math.random() * (MAP_TILE_COUNT - 4)) + 2;
      const row = Math.floor(Math.random() * (MAP_TILE_COUNT - 4)) + 2;
      if (!this.isWalkableTile(row, col)) continue;

      const x = col + 0.5;
      const y = row + 0.5;

      if (Math.hypot(x - this.player.posX, y - this.player.posY) < minDistanceFromPlayer) continue;
      if (this.isPositionNearLava(x, y, 1.0)) continue;
      if (isWorldBlocked(x, y, 0.2)) continue;

      const tooCloseToOthers = this.orbs.some((other) => other !== orb && Math.hypot(x - other.posX, y - other.posY) < 1.05);
      if (tooCloseToOthers) continue;

      return { x, y };
    }
    return null;
  }

  applyLavaAvoidanceToOrb(orb, dt) {
    if (!orb.isHunter()) return;

    const avoidRange = LAVA_AVOID_DISTANCE_TILES;
    const minCol = Math.max(0, Math.floor(orb.posX - avoidRange - 1));
    const maxCol = Math.min(MAP_TILE_COUNT - 1, Math.floor(orb.posX + avoidRange + 1));
    const minRow = Math.max(0, Math.floor(orb.posY - avoidRange - 1));
    const maxRow = Math.min(MAP_TILE_COUNT - 1, Math.floor(orb.posY + avoidRange + 1));

    let repelX = 0;
    let repelY = 0;
    let closeToLava = false;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (worldTileMap[row][col] !== 6) continue;

        const lavaX = col + 0.5;
        const lavaY = row + 0.5;
        const dx = orb.posX - lavaX;
        const dy = orb.posY - lavaY;
        const dist = Math.hypot(dx, dy);
        if (dist <= 0.0001 || dist > avoidRange) continue;

        const falloff = 1 - dist / avoidRange;
        repelX += (dx / dist) * falloff;
        repelY += (dy / dist) * falloff;
        closeToLava = true;
      }
    }

    if (!closeToLava) return;

    const repelLen = Math.hypot(repelX, repelY);
    if (repelLen > 0.0001) {
      repelX /= repelLen;
      repelY /= repelLen;
    }

    const centerX = MAP_TILE_COUNT / 2 + 0.5;
    const centerY = MAP_TILE_COUNT / 2 + 0.5;
    const toCenterX = centerX - orb.posX;
    const toCenterY = centerY - orb.posY;
    const centerLen = Math.hypot(toCenterX, toCenterY);

    const centerDirX = centerLen > 0.0001 ? toCenterX / centerLen : 0;
    const centerDirY = centerLen > 0.0001 ? toCenterY / centerLen : 0;

    // Combine local lava repulsion with a center pull so hunters do not oscillate on borders.
    const moveX = (repelX * LAVA_AVOID_PUSH_FORCE + centerDirX * LAVA_CENTER_PULL_FORCE) * dt;
    const moveY = (repelY * LAVA_AVOID_PUSH_FORCE + centerDirY * LAVA_CENTER_PULL_FORCE) * dt;

    const nextX = orb.posX + moveX;
    const nextY = orb.posY + moveY;
    let moved = false;
    if (!isWorldBlocked(nextX, orb.posY, 0.2)) {
      orb.posX = nextX;
      moved = true;
    }
    if (!isWorldBlocked(orb.posX, nextY, 0.2)) {
      orb.posY = nextY;
      moved = true;
    }

    let unstuck = false;
    if (!moved && typeof orb.tryUnstuckHop === "function") {
      unstuck = orb.tryUnstuckHop();
    }

    if (!moved && !unstuck && this.isOrbTouchingLava(orb)) {
      // Last-resort safety: teleport only when movement + unstuck logic cannot escape lava contact.
      const teleportSpot = this.findHunterLavaTeleportSpot(orb, HUNTER_LAVA_TELEPORT_MIN_DISTANCE);
      if (teleportSpot) {
        orb.posX = teleportSpot.x;
        orb.posY = teleportSpot.y;
        if (typeof orb.pickNewWaypoint === "function") {
          orb.pickNewWaypoint();
        }
      }
    }
  }

  activateWorldModule(worldModule) {
    const now = millis();

    if (worldModule.type === "aegis") {
      this.activeAegisUntilMs = Math.max(this.activeAegisUntilMs, now) + MODULE_AEGIS_DURATION_MS;
      this.addScreenShake(2.5, 180);
      this.spawnCollectParticles(worldModule.posX, worldModule.posY, [110, 230, 255]);
    } else if (worldModule.type === "emp") {
      const stunned = this.stunNearbyHunters(MODULE_EMP_STUN_RADIUS, MODULE_EMP_STUN_DURATION_MS);
      this.addScreenShake(5, 240);
      this.spawnCollectParticles(worldModule.posX, worldModule.posY, [150, 230, 255]);
      if (stunned > 0) {
        this.score += stunned * 40;
      }
    } else if (worldModule.type === "chrono") {
      this.activeChronoUntilMs = Math.max(this.activeChronoUntilMs, now) + MODULE_CHRONO_DURATION_MS;
      this.addScreenShake(3.2, 200);
      this.spawnCollectParticles(worldModule.posX, worldModule.posY, [190, 140, 255]);
    }

    this.recoverAmmo(WORLD_MODULE_AMMO_RECOVERY, "Module recyclÃ© en munitions", [150, 230, 255]);
    this.score += WORLD_MODULE_ACTIVATE_BONUS;
  }

  handleModuleCollisions() {
    for (let i = this.worldModules.length - 1; i >= 0; i--) {
      const wm = this.worldModules[i];
      const dx = this.player.posX - wm.posX;
      const dy = this.player.posY - wm.posY;
      const distSq = dx * dx + dy * dy;
      const combinedR = this.player.radius + wm.radius;
      if (distSq <= combinedR * combinedR) {
        this.activateWorldModule(wm);
        this.worldModules.splice(i, 1);
      }
    }
  }

  tryFireWeapon() {
    const now = millis();
    const shotCooldown = this.currentFireCooldownMs();
    if (now - this.weaponLastShotMs < shotCooldown) return;

    this.weaponLastShotMs = now;

    if (this.weaponAmmo <= 0) {
      return;
    }

    this.weaponAmmo--;
    this.weaponFlashUntilMs = now + 70;
    this.addScreenShake(1.2, 70);

    const hit = this.findBestHunterTarget();
    if (!hit) return;

    this.applyHunterDamage(hit.orb, this.currentWeaponDamage());
  }

  findBestHunterTarget() {
    const fovScale = SCREEN_WIDTH / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
    const cosA = Math.cos(this.player.angle);
    const sinA = Math.sin(this.player.angle);

    let best = null;

    for (const orb of this.orbs) {
      if (!orb.isHunter()) continue;

      const relX = orb.posX - this.player.posX;
      const relY = orb.posY - this.player.posY;
      const transformX = -relX * sinA + relY * cosA;
      const transformY = relX * cosA + relY * sinA;

      if (transformY <= 0.15 || transformY > WEAPON_RANGE) continue;

      const screenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;
      const screenDelta = Math.abs(screenX - SCREEN_WIDTH / 2);
      if (screenDelta > WEAPON_AIM_TOLERANCE_PX) continue;

      if (!best || transformY < best.depth) {
        best = { orb, depth: transformY, screenDelta };
      }
    }

    return best;
  }

  applyHunterDamage(orb, damage) {
    if (!orb || !orb.isHunter()) return;

    if (this.isInstakillActive()) {
      this.killHunter(orb);
      return;
    }

    if (typeof orb.health !== "number" || orb.health <= 0) {
      orb.health = 1;
      orb.maxHealth = 1;
    }

    orb.health -= Math.max(1, damage);
    if (orb.health > 0) {
      this.addScreenShake(0.7, 60);
      return;
    }

    this.killHunter(orb);
  }

  killHunter(orb) {
    const index = this.orbs.indexOf(orb);
    if (index < 0) return;

    this.registerHunterKillStreak();
    if (orb.spawnSource === "wave") {
      this.waveEnemiesKilled += 1;
    }
    this.recoverAmmo(HUNTER_KILL_AMMO_REFUND);
    this.spawnCollectParticles(orb.posX, orb.posY, [255, 80, 80]);
    this.orbStunUntilMap.delete(orb);
    this.spawnMobDrop(orb.posX, orb.posY);
    this.orbs.splice(index, 1);
  }

  spawnMobDrop(wx, wy) {
    const rand = Math.random();
    let primaryType;
    if (rand < MOB_DROP_PULSE_CHANCE) primaryType = "pulse";
    else if (rand < 0.55) primaryType = "ammo";
    else if (rand < 0.85) primaryType = "score";
    else primaryType = "rounds";

    this.spawnSingleDrop(primaryType, wx, wy);

    if (Math.random() < MOB_DROP_EXTRA_CHANCE) {
      const angle = Math.random() * TWO_PI;
      const dist = 0.16 + Math.random() * 0.2;
      this.spawnSingleDrop("rounds", wx + Math.cos(angle) * dist, wy + Math.sin(angle) * dist);
    }

    if (Math.random() < MOB_DROP_CRATE_CHANCE) {
      const angle = Math.random() * TWO_PI;
      const dist = 0.24 + Math.random() * 0.22;
      this.spawnSingleDrop("crate", wx + Math.cos(angle) * dist, wy + Math.sin(angle) * dist);
    }
  }

  spawnSingleDrop(type, wx, wy) {
    this.drops.push({
      type,
      posX: constrain(wx, 1.2, MAP_TILE_COUNT - 1.2),
      posY: constrain(wy, 1.2, MAP_TILE_COUNT - 1.2),
      radius: MOB_DROP_RADIUS,
      spawnMs: millis(),
    });
  }

  updateDrops(dt) {
    const now = millis();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      if (now - this.drops[i].spawnMs > MOB_DROP_LIFETIME_MS) {
        this.drops.splice(i, 1);
      }
    }
  }

  handleDropCollisions() {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const dx = this.player.posX - drop.posX;
      const dy = this.player.posY - drop.posY;
      const distSq = dx * dx + dy * dy;
      const combinedR = this.player.radius + drop.radius;
      if (distSq > combinedR * combinedR) continue;

      if (drop.type === "ammo") {
        const added = this.addInventoryItem("ammoPack", 1);
        if (added > 0) {
          this.pushHudToast("+1 Ammo pack", [255, 220, 110]);
        } else {
          this.pushHudToast("Inventaire ammo plein", [255, 160, 160]);
        }
        this.spawnCollectParticles(drop.posX, drop.posY, [255, 215, 120]);
      } else if (drop.type === "score") {
        const added = this.addInventoryItem("scoreShard", 1);
        if (added > 0) {
          this.pushHudToast("+1 Score shard", [255, 255, 150]);
        } else {
          this.pushHudToast("Inventaire score plein", [255, 160, 160]);
        }
        this.spawnCollectParticles(drop.posX, drop.posY, [255, 255, 140]);
      } else if (drop.type === "pulse") {
        const added = this.addInventoryItem("pulseCore", 1);
        if (added > 0) {
          this.pushHudToast("+1 Pulse core", [220, 180, 255]);
        } else {
          this.pushHudToast("Inventaire pulse plein", [255, 160, 160]);
        }
        this.spawnCollectParticles(drop.posX, drop.posY, [220, 180, 255]);
      } else if (drop.type === "rounds") {
        const gained = this.recoverAmmo(MOB_DROP_ROUNDS_GAIN, "Munitions rÃ©cupÃ©rÃ©es", [255, 210, 130]);
        if (gained <= 0) {
          this.pushHudToast("Ammo dÃ©jÃ  max", [255, 170, 170]);
        }
        this.spawnCollectParticles(drop.posX, drop.posY, [255, 205, 130]);
      } else if (drop.type === "crate") {
        const ammoPackAdded = this.addInventoryItem("ammoPack", 1);
        const scoreShardAdded = this.addInventoryItem("scoreShard", 1);
        const directAmmo = this.recoverAmmo(MOB_DROP_CRATE_BONUS_AMMO);

        if (ammoPackAdded > 0 || scoreShardAdded > 0 || directAmmo > 0) {
          this.pushHudToast("Caisse tactique rÃ©cupÃ©rÃ©e", [170, 225, 255]);
        } else {
          this.pushHudToast("Caisse inutile (inventaire plein)", [255, 170, 170]);
        }
        this.spawnCollectParticles(drop.posX, drop.posY, [165, 225, 255]);
      }

      this.drops.splice(i, 1);
    }
  }

  updateOrbs(dt) {
    const now = millis();

    for (const orb of this.orbs) {
      const isStunned = this.isOrbStunned(orb, now);

      if (!isStunned) {
        const scaledDt = (this.isChronoActive() && orb.isHunter())
          ? dt * MODULE_CHRONO_HUNTER_TIME_SCALE
          : dt;

        orb.update(scaledDt, this.player);
      }

      if (orb.isHunter()) {
        this.applyLavaAvoidanceToOrb(orb, dt);
      }

      if (this.isAegisActive() && orb.isHunter()) {
        this.applyAegisRepelToOrb(orb, dt);
      }
    }

    for (const [orb, until] of this.orbStunUntilMap.entries()) {
      if (!this.orbs.includes(orb) || until <= now) {
        this.orbStunUntilMap.delete(orb);
      }
    }
  }

  handleCollisions() {
    const offsets = [
      { dx: -this.player.radius, dy: -this.player.radius },
      { dx:  this.player.radius, dy: -this.player.radius },
      { dx: -this.player.radius, dy:  this.player.radius },
      { dx:  this.player.radius, dy:  this.player.radius },
    ];
    for (const off of offsets) {
      const tc = Math.floor(this.player.posX + off.dx);
      const tr = Math.floor(this.player.posY + off.dy);
      if (tc >= 0 && tc < MAP_TILE_COUNT && tr >= 0 && tr < MAP_TILE_COUNT) {
        if (worldTileMap[tr][tc] === 6) {
          this.triggerGameOver("You touched the lava wall!");
          return;
        }
      }
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      const dx = this.player.posX - orb.posX;
      const dy = this.player.posY - orb.posY;
      const distSq = dx * dx + dy * dy;
      const combinedR = this.player.radius + orb.radius;

      if (distSq <= combinedR * combinedR) {
        if (orb.isSafe()) {
          this.score += ORB_COLLECT_BONUS;
          this.recoverAmmo(ORB_SAFE_AMMO_RECOVERY);
          this.spawnCollectParticles(orb.posX, orb.posY, [92, 255, 145]);
          this.orbStunUntilMap.delete(orb);
          this.orbs.splice(i, 1);
        } else if (orb.isWarning()) {
          this.score += ORB_COLLECT_BONUS * 2;
          this.recoverAmmo(ORB_WARNING_AMMO_RECOVERY, "Orb instable converti", [255, 210, 120]);
          this.spawnCollectParticles(orb.posX, orb.posY, [255, 200, 60]);
          this.orbStunUntilMap.delete(orb);
          this.orbs.splice(i, 1);
        } else {
          this.triggerGameOver("A mutated zombie caught you!");
          return;
        }
      }
    }
  }


// Rendering/post-process methods continue in the same manager class.
  addScreenShake(intensity, durationMs) {
    this.shakeIntensity = intensity;
    this.shakeDuration = durationMs;
    this.shakeStartMs = millis();
  }

  currentShakeOffset() {
    if (this.shakeIntensity === 0) return { x: 0, y: 0 };
    const elapsed = millis() - this.shakeStartMs;
    if (elapsed > this.shakeDuration) {
      this.shakeIntensity = 0;
      return { x: 0, y: 0 };
    }
    const factor = 1 - elapsed / this.shakeDuration;
    return {
      x: (Math.random() - 0.5) * 2 * this.shakeIntensity * factor,
      y: (Math.random() - 0.5) * 2 * this.shakeIntensity * factor,
    };
  }

  renderFrame() {
    this.drawSkyAndFloor();

    loadPixels();
    this.castAllRays();
    this.drawSpritesToBuffer();
    updatePixels();

    const shake = this.currentShakeOffset();
    push();
    translate(shake.x, shake.y);
    this.drawVignette();
    this.drawMinimap();
    this.drawHUD();
    this.drawCrosshair();
    pop();
  }

  drawSkyAndFloor() {
    const cyclePhase = (this.survivalSeconds() % 90) / 90;
    const nightFactor = (Math.sin(cyclePhase * TWO_PI - HALF_PI) + 1) / 2;

    const skyR = lerp(85, 12, nightFactor);
    const skyG = lerp(130, 14, nightFactor);
    const skyB = lerp(210, 45, nightFactor);

    const floorR = lerp(95, 28, nightFactor);
    const floorG = lerp(80, 22, nightFactor);
    const floorB = lerp(65, 16, nightFactor);

    noStroke();
    fill(skyR, skyG, skyB);
    rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT / 2);

    fill(floorR, floorG, floorB);
    rect(0, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
  }

  castAllRays() {
    const halfFOV = FIELD_OF_VIEW_RADIANS / 2;

    for (let col = 0; col < RAY_COUNT; col++) {
      const rayScreenFraction = (col / RAY_COUNT) * 2 - 1;
      const rayAngle = this.player.angle + Math.atan(rayScreenFraction * Math.tan(halfFOV));

      const rayDirX = Math.cos(rayAngle);
      const rayDirY = Math.sin(rayAngle);

      let mapX = Math.floor(this.player.posX);
      let mapY = Math.floor(this.player.posY);

      const deltaDistX = Math.abs(rayDirX) < 1e-10 ? 1e10 : Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(rayDirY) < 1e-10 ? 1e10 : Math.abs(1 / rayDirY);

      let stepX;
      let stepY;
      let sideDistX;
      let sideDistY;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (this.player.posX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - this.player.posX) * deltaDistX;
      }
      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (this.player.posY - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - this.player.posY) * deltaDistY;
      }

      let hitWall = false;
      let hitSide = 0;
      let tileType = 0;
      let stepsDone = 0;

      while (!hitWall && stepsDone < MAX_RAY_DISTANCE * 2) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          hitSide = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          hitSide = 1;
        }

        stepsDone++;

        if (mapX < 0 || mapX >= MAP_TILE_COUNT || mapY < 0 || mapY >= MAP_TILE_COUNT) {
          hitWall = true;
          tileType = 3;
          break;
        }

        if (worldTileMap[mapY][mapX] !== 0) {
          hitWall = true;
          tileType = worldTileMap[mapY][mapX];
        }
      }

      if (!hitWall) {
        this.zBuffer[col] = MAX_RAY_DISTANCE;
        continue;
      }

      let perpDist;
      if (hitSide === 0) {
        perpDist = (mapX - this.player.posX + (1 - stepX) / 2) / rayDirX;
      } else {
        perpDist = (mapY - this.player.posY + (1 - stepY) / 2) / rayDirY;
      }
      perpDist = Math.abs(perpDist);
      if (perpDist < 0.001) perpDist = 0.001;

      this.zBuffer[col] = perpDist;

      const wallStripHeight = (SCREEN_HEIGHT * WALL_HEIGHT_PROJECTION_FACTOR) / perpDist;
      const drawStart = Math.floor((SCREEN_HEIGHT - wallStripHeight) / 2);

      let wallHitFraction;
      if (hitSide === 0) wallHitFraction = this.player.posY + perpDist * rayDirY;
      else wallHitFraction = this.player.posX + perpDist * rayDirX;
      wallHitFraction -= Math.floor(wallHitFraction);

      const texX = Math.floor(wallHitFraction * TEXTURE_SIZE);
      const cachedTexPixels = texturePixelCache[tileType];
      if (cachedTexPixels) {
        this.drawTexturedColumn(col, drawStart, wallStripHeight, cachedTexPixels, texX, perpDist, hitSide);
      }
    }
  }

  drawTexturedColumn(screenCol, drawStart, stripHeight, texPixels, texX, distance, hitSide) {
    const rawFog = constrain(1 - (distance / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
    const fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);
    const sideBrightness = hitSide === 1 ? SIDE_SHADE_FACTOR : 1.0;
    const combinedShade = fogFactor * sideBrightness;

    const yStart = Math.max(0, Math.floor(drawStart));
    const yEnd = Math.min(SCREEN_HEIGHT, Math.floor(drawStart + stripHeight));
    const invStripHeight = TEXTURE_SIZE / stripHeight;
    const safeTexX = texX < 0 ? 0 : (texX >= TEXTURE_SIZE ? TEXTURE_SIZE - 1 : texX);

    for (let screenY = yStart; screenY < yEnd; screenY++) {
      const texY = Math.floor((screenY - drawStart) * invStripHeight);
      const safeTexY = texY < 0 ? 0 : (texY >= TEXTURE_SIZE ? TEXTURE_SIZE - 1 : texY);

      const srcIdx = 4 * (safeTexY * TEXTURE_SIZE + safeTexX);
      const dstIdx = 4 * (screenY * SCREEN_WIDTH + screenCol);
      pixels[dstIdx] = texPixels[srcIdx] * combinedShade;
      pixels[dstIdx + 1] = texPixels[srcIdx + 1] * combinedShade;
      pixels[dstIdx + 2] = texPixels[srcIdx + 2] * combinedShade;
    }
  }

  drawSpritesToBuffer() {
    const allSprites = [];

    for (const orb of this.orbs) {
      const dist = Math.hypot(orb.posX - this.player.posX, orb.posY - this.player.posY);
      let spriteType;
      if (orb.isSafe()) spriteType = "safe";
      else if (orb.isWarning()) spriteType = "warning";
      else if (orb.isChasing()) spriteType = "chase";
      else spriteType = "patrol";
      allSprites.push({ x: orb.posX, y: orb.posY, dist, type: spriteType, obj: orb });
    }

    for (const p of this.particles) {
      const dist = Math.hypot(p.posX - this.player.posX, p.posY - this.player.posY);
      allSprites.push({ x: p.posX, y: p.posY, dist, type: "particle", obj: p });
    }

    // Painter ordering (far to near) works with zBuffer checks for correct occlusion.
    allSprites.sort((a, b) => b.dist - a.dist);
    for (const sp of allSprites) {
      this.drawSingleSpriteToBuffer(sp);
    }
  }

  drawSingleSpriteToBuffer(spriteData) {
    const relX = spriteData.x - this.player.posX;
    const relY = spriteData.y - this.player.posY;

    const cosA = Math.cos(this.player.angle);
    const sinA = Math.sin(this.player.angle);
    const transformX = -relX * sinA + relY * cosA;
    const transformY = relX * cosA + relY * sinA;

    if (transformY <= 0.1) return;

    const fovScale = SCREEN_WIDTH / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
    const spriteScreenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;

    let worldSize = 0.6;
    if (spriteData.type === "particle") worldSize = 0.15;
    if (spriteData.type === "patrol" || spriteData.type === "chase") worldSize = 0.75;
    if (spriteData.type === "warning") worldSize = 0.65;
    const spriteScreenSize = Math.abs((worldSize / transformY) * fovScale);

    const drawStartX = Math.max(0, Math.floor(spriteScreenX - spriteScreenSize / 2));
    const drawEndX = Math.min(SCREEN_WIDTH, Math.floor(spriteScreenX + spriteScreenSize / 2));
    const drawStartY = Math.max(0, Math.floor(SCREEN_HEIGHT / 2 - spriteScreenSize / 2));
    const drawEndY = Math.min(SCREEN_HEIGHT, Math.floor(SCREEN_HEIGHT / 2 + spriteScreenSize / 2));

    const rawFog = constrain(1 - (spriteData.dist / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
    const fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);

    let baseR;
    let baseG;
    let baseB;
    let baseA = 255;
    if (spriteData.type === "safe") {
      const pulse = 0.7 + 0.3 * Math.sin(millis() * 0.006);
      baseR = 60 * pulse;
      baseG = 255 * pulse;
      baseB = 100 * pulse;
      const mp = spriteData.obj.mutationProgress();
      baseR = lerp(baseR, 255, mp * 0.5);
      baseG = lerp(baseG, 180, mp * 0.3);
    } else if (spriteData.type === "warning") {
      const wp = spriteData.obj.warningProgress();
      const flash = Math.sin(millis() * 0.025) > 0 ? 1 : 0.4;
      baseR = lerp(255, 255, wp) * flash;
      baseG = lerp(180, 40, wp) * flash;
      baseB = 30 * flash;
    } else if (spriteData.type === "patrol") {
      const pulse = 0.6 + 0.15 * Math.sin(millis() * 0.005);
      baseR = 200 * pulse;
      baseG = 60 * pulse;
      baseB = 60 * pulse;
    } else if (spriteData.type === "chase") {
      const pulse = 0.8 + 0.2 * Math.sin(millis() * 0.015);
      const isCharging = spriteData.obj.chargeActive;
      baseR = (isCharging ? 255 : 240) * pulse;
      baseG = (isCharging ? 100 : 40) * pulse;
      baseB = isCharging ? 30 : 40;
    } else if (spriteData.type === "particle") {
      const p = spriteData.obj;
      baseR = p.colorArray[0];
      baseG = p.colorArray[1];
      baseB = p.colorArray[2];
      baseA = p.opacity();
    }

    const finalR = baseR * fogFactor;
    const finalG = baseG * fogFactor;
    const finalB = baseB * fogFactor;
    const invSize = 1 / spriteScreenSize;
    const alphaFrac = baseA / 255;
    const invAlpha = 1 - alphaFrac;

    for (let sx = drawStartX; sx < drawEndX; sx++) {
      if (transformY >= this.zBuffer[sx]) continue;

      for (let sy = drawStartY; sy < drawEndY; sy++) {
        const fracX = (sx - drawStartX) * invSize - 0.5;
        const fracY = (sy - drawStartY) * invSize - 0.5;
        if (fracX * fracX + fracY * fracY > 0.2) continue;

        const dstIdx = 4 * (sy * SCREEN_WIDTH + sx);

        if (alphaFrac >= 0.98) {
          pixels[dstIdx] = finalR;
          pixels[dstIdx + 1] = finalG;
          pixels[dstIdx + 2] = finalB;
        } else {
          pixels[dstIdx] = finalR * alphaFrac + pixels[dstIdx] * invAlpha;
          pixels[dstIdx + 1] = finalG * alphaFrac + pixels[dstIdx + 1] * invAlpha;
          pixels[dstIdx + 2] = finalB * alphaFrac + pixels[dstIdx + 2] * invAlpha;
        }
      }
    }
  }
  drawVignette() {
    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2;
    const maxR = Math.hypot(cx, cy);

    noStroke();
    for (let ring = 3; ring >= 1; ring--) {
      const frac = ring / 3;
      const alpha = frac * frac * 40;
      fill(0, 0, 0, alpha);
      ellipse(cx, cy, maxR * 2 * (0.65 + frac * 0.35), maxR * 2 * (0.65 + frac * 0.35));
    }
  }

// --- In constructor() ---
//   this.zombieSpriteCache    = this.createZombieSpriteCache();
//   this.collectOrbSpriteCache = this.createCollectOrbSpriteCache();
//   this.motionBlurEnabled    = MOTION_BLUR_ENABLED;
//   this.motionBlurBuffer     = this.motionBlurEnabled ? this.createMotionBlurBuffer() : null;
//   this.motionBlurAmount     = 0;
//   this.motionBlurFrameCounter = 0;
//   this.prevPlayerPosX       = this.player.posX;
//   this.prevPlayerPosY       = this.player.posY;
//   this.prevPlayerAngle      = this.player.angle;

// --- Zombie sprite system ---

  createZombieSpriteCache() {
    const sheet = ZOMBIE_USE_EXTERNAL_SPRITESHEET ? this.getZombieSpriteSheetImage() : null;
    if (sheet) {
      const frameCount = Math.max(1, Math.floor(ZOMBIE_SPRITE_SHEET_FRAME_COUNT));
      const frameWidth = Math.max(1, Math.floor(sheet.width / frameCount));
      const frameHeight = Math.max(1, sheet.height);
      return {
        mode: "sheet",
        width: frameWidth,
        height: frameHeight,
        frameCount,
        fps: Math.max(1, ZOMBIE_SPRITE_SHEET_FPS),
        patrolFrontFrames:  this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "patrol"),
        patrolLeftFrames:   this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "patrol"),
        patrolRightFrames:  this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "patrol"),
        chaseFrontFrames:   this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "chase"),
        chaseLeftFrames:    this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "chase"),
        chaseRightFrames:   this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "chase"),
        attackFrontFrames:  this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "attack"),
        attackLeftFrames:   this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "attack"),
        attackRightFrames:  this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "attack"),
        chargeFrontFrames:  this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "charge"),
        chargeLeftFrames:   this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "charge"),
        chargeRightFrames:  this.buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, "charge"),
      };
    }

    const width = 40;
    const height = 58;
    const patrol = this.buildZombieSpriteVariant(width, height, "patrol");
    const chase   = this.buildZombieSpriteVariant(width, height, "chase");
    const attack  = this.buildZombieSpriteVariant(width, height, "attack");
    const charge  = this.buildZombieSpriteVariant(width, height, "charge");
    const frameCount = Math.max(1, Math.floor(ZOMBIE_SPRITE_SHEET_FRAME_COUNT));
    const skin = this.getZombieSkinImage();

    const build = (variant, dir) =>
      skin
        ? this.buildZombieSkinAnimatedFrames(width, height, frameCount, variant, dir)
        : this.buildZombiePseudoAnimationFrames(
            variant === "patrol" ? patrol : variant === "chase" ? chase : variant === "attack" ? attack : charge,
            width, height, frameCount, variant, dir
          );

    return {
      mode: "generated",
      width, height,
      fps: Math.max(1, ZOMBIE_SPRITE_SHEET_FPS),
      patrol, chase, attack, charge,
      patrolFrontFrames:  build("patrol",  0),
      patrolLeftFrames:   build("patrol", -1),
      patrolRightFrames:  build("patrol",  1),
      chaseFrontFrames:   build("chase",   0),
      chaseLeftFrames:    build("chase",  -1),
      chaseRightFrames:   build("chase",   1),
      attackFrontFrames:  build("attack",  0),
      attackLeftFrames:   build("attack", -1),
      attackRightFrames:  build("attack",  1),
      chargeFrontFrames:  build("charge",  0),
      chargeLeftFrames:   build("charge", -1),
      chargeRightFrames:  build("charge",  1),
    };
  }

  getZombieSpriteSheetImage() {
    if (typeof window === "undefined") return null;
    const sheet = window.PRELOADED_ZOMBIE_SPRITESHEET_IMAGE;
    if (!sheet || sheet.width <= 0 || sheet.height <= 0) return null;
    const frameCount = Math.max(1, Math.floor(ZOMBIE_SPRITE_SHEET_FRAME_COUNT));
    const frameWidth = Math.floor(sheet.width / frameCount);
    const looksLikeHorizontalStrip = sheet.width > sheet.height;
    const hasUsableFrameSize = frameWidth >= 8 && sheet.height >= 8;
    if (!looksLikeHorizontalStrip || !hasUsableFrameSize) return null;
    return sheet;
  }

  getZombieSkinImage() {
    if (typeof window === "undefined") return null;
    const skin = window.PRELOADED_ZOMBIE_SKIN_IMAGE;
    if (!skin || skin.width <= 0 || skin.height <= 0) return null;
    return skin;
  }

  hasOpaquePixels(pixelData) {
    for (let i = 3; i < pixelData.length; i += 4) {
      if (pixelData[i] > 0) return true;
    }
    return false;
  }

  buildZombieSpriteSheetVariantFrames(sheet, frameWidth, frameHeight, frameCount, variant) {
    try {
      sheet.loadPixels();
      if (!sheet.pixels || sheet.pixels.length === 0) return [];
      const frames = [];
      for (let frame = 0; frame < frameCount; frame++) {
        const data = new Uint8ClampedArray(frameWidth * frameHeight * 4);
        const frameStartX = frame * frameWidth;
        for (let y = 0; y < frameHeight; y++) {
          for (let x = 0; x < frameWidth; x++) {
            const srcX = constrain(frameStartX + x, 0, sheet.width - 1);
            const srcY = constrain(y, 0, sheet.height - 1);
            const srcIdx = 4 * (srcY * sheet.width + srcX);
            const dstIdx = 4 * (y * frameWidth + x);
            const alpha = sheet.pixels[srcIdx + 3];
            if (alpha < 10) { data[dstIdx + 3] = 0; continue; }
            const [r, g, b] = this.applyZombieVariantTint(
              sheet.pixels[srcIdx], sheet.pixels[srcIdx + 1], sheet.pixels[srcIdx + 2], variant, 1
            );
            data[dstIdx] = r; data[dstIdx + 1] = g; data[dstIdx + 2] = b; data[dstIdx + 3] = alpha;
          }
        }
        if (this.hasOpaquePixels(data)) frames.push(data);
      }
      return frames;
    } catch (err) { console.warn("Failed to build zombie spritesheet frames:", err); return []; }
  }

  buildZombieSkinAnimatedFrames(width, height, frameCount, variant, headYawDir = 0) {
    const skin = this.getZombieSkinImage();
    if (!skin) return [];
    try {
      skin.loadPixels();
      if (!skin.pixels || skin.pixels.length === 0) return [];
      const frames = [];
      const faceMap = this.getZombieMinecraftFaceMap();
      const useLegacyLeftLimbUV = skin.height < 64;
      const leftArmFaces = useLegacyLeftLimbUV ? faceMap.rightArm : faceMap.leftArm;
      const leftLegFaces = useLegacyLeftLimbUV ? faceMap.rightLeg : faceMap.leftLeg;

      for (let frame = 0; frame < frameCount; frame++) {
        const data = new Uint8ClampedArray(width * height * 4);
        const phase = (frame / frameCount) * TWO_PI;
        const stride = variant === "charge" ? 3 : (variant === "chase" ? 2 : (variant === "attack" ? 2 : 1));
        const armSwing = Math.round(Math.sin(phase) * stride);
        const legSwing = -armSwing;
        const bodyBob = Math.round(Math.abs(Math.sin(phase)) * (variant === "charge" ? 2 : 1));
        const attackLunge = variant === "attack" ? Math.max(0, Math.round(Math.sin(phase) * 2)) : 0;
        const headYawPx  = Math.round(headYawDir * ZOMBIE_HEAD_TURN_PIXELS);
        const torsoYawPx = Math.round(headYawDir * (ZOMBIE_HEAD_TURN_PIXELS * 0.5));
        const topSkew = 0.36;

        this.paintZombieCuboid(data, width, height, skin, faceMap.head,
          { x: 8 + attackLunge + headYawPx, y: 2 + bodyBob, width: 11, height: 11, depth: 3, topHeight: 3, topSkew },
          { front: 1, side: 0.78, top: 1.08 }, variant);
        this.paintZombieCuboid(data, width, height, skin, faceMap.body,
          { x: 8 + attackLunge + torsoYawPx, y: 14 + bodyBob, width: 10, height: 13, depth: 3, topHeight: 2, topSkew },
          { front: 0.95, side: 0.74, top: 1.02 }, variant);
        this.paintZombieCuboid(data, width, height, skin, faceMap.rightArm,
          { x: 19 + armSwing + attackLunge + torsoYawPx, y: 14 + bodyBob, width: 4, height: 13, depth: 2, topHeight: 2, topSkew: 0.3 },
          { front: 0.92, side: 0.68, top: 1.0 }, variant);
        this.paintZombieCuboid(data, width, height, skin, leftArmFaces,
          { x: 4 - armSwing + attackLunge + torsoYawPx, y: 14 + bodyBob, width: 4, height: 13, depth: 2, topHeight: 2, topSkew: 0.3 },
          { front: 0.92, side: 0.68, top: 1.0 }, variant);
        this.paintZombieCuboid(data, width, height, skin, faceMap.rightLeg,
          { x: 10 + legSwing, y: 25 + bodyBob, width: 4, height: 16, depth: 2, topHeight: 2, topSkew: 0.28 },
          { front: 0.9, side: 0.66, top: 0.98 }, variant);
        this.paintZombieCuboid(data, width, height, skin, leftLegFaces,
          { x: 6 - legSwing, y: 25 + bodyBob, width: 4, height: 16, depth: 2, topHeight: 2, topSkew: 0.28 },
          { front: 0.9, side: 0.66, top: 0.98 }, variant);

        if (this.hasOpaquePixels(data)) frames.push(data);
      }
      return frames;
    } catch (err) { console.warn("Failed to build zombie skin animated frames:", err); return []; }
  }

  copyZombieRegion(src, dst, width, height, x0, y0, x1, y1, offsetX, offsetY) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dstX = x + offsetX;
        const dstY = y + offsetY;
        if (dstX < 0 || dstX >= width || dstY < 0 || dstY >= height) continue;
        const srcIdx = 4 * (y * width + x);
        const alpha  = src[srcIdx + 3];
        if (alpha <= 0) continue;
        const dstIdx = 4 * (dstY * width + dstX);
        dst[dstIdx] = src[srcIdx]; dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2]; dst[dstIdx + 3] = alpha;
      }
    }
  }

  buildZombiePseudoAnimationFrames(baseTexture, width, height, frameCount, variant, headYawDir = 0) {
    if (!baseTexture || !this.hasOpaquePixels(baseTexture)) return [];
    const frames = [];
    for (let frame = 0; frame < frameCount; frame++) {
      const data = new Uint8ClampedArray(width * height * 4);
      const phase = (frame / frameCount) * TWO_PI;
      const stride = variant === "charge" ? 3 : (variant === "chase" ? 2 : (variant === "attack" ? 2 : 1));
      const armSwing = Math.round(Math.sin(phase) * stride);
      const legSwing = -armSwing;
      const bob      = Math.round(Math.abs(Math.sin(phase)) * (variant === "charge" ? 2 : 1));
      const torsoLean  = variant === "charge" ? 1 : 0;
      const headYawPx  = Math.round(headYawDir * ZOMBIE_HEAD_TURN_PIXELS);
      const legLiftL   = Math.max(0, Math.round(Math.sin(phase) * 2));
      const legLiftR   = Math.max(0, Math.round(-Math.sin(phase) * 2));
      const armLiftL   = Math.max(0, Math.round(-Math.sin(phase) * 1));
      const armLiftR   = Math.max(0, Math.round(Math.sin(phase) * 1));
      const attackLunge    = variant === "attack" ? Math.max(0, Math.round(Math.sin(phase) * 2)) : 0;
      const attackArmReachL = variant === "attack" ? Math.max(0, Math.round(Math.sin(phase) * 3)) : 0;
      const attackArmReachR = variant === "attack" ? Math.max(0, Math.round(-Math.sin(phase) * 3)) : 0;

      this.copyZombieRegion(baseTexture, data, width, height, 14, 4,  24, 14, torsoLean + attackLunge + headYawPx, bob);
      this.copyZombieRegion(baseTexture, data, width, height, 14, 15, 24, 30, torsoLean + attackLunge, bob);
      this.copyZombieRegion(baseTexture, data, width, height, 9,  17, 13, 30, -armSwing - attackArmReachL, bob - armLiftL);
      this.copyZombieRegion(baseTexture, data, width, height, 25, 17, 29, 30,  armSwing + attackArmReachR, bob - armLiftR);
      this.copyZombieRegion(baseTexture, data, width, height, 12, 31, 16, 49,  legSwing, bob - legLiftL);
      this.copyZombieRegion(baseTexture, data, width, height, 18, 31, 22, 49, -legSwing, bob - legLiftR);
      frames.push(data);
    }
    return frames;
  }

  buildZombieSkinSpriteVariant(width, height, variant) {
    const skin = this.getZombieSkinImage();
    if (!skin) return null;
    try {
      skin.loadPixels();
      if (!skin.pixels || skin.pixels.length === 0) return null;
      const data = new Uint8ClampedArray(width * height * 4);
      const faceMap = this.getZombieMinecraftFaceMap();
      const useLegacyLeftLimbUV = skin.height < 64;
      const leftArmFaces = useLegacyLeftLimbUV ? faceMap.rightArm : faceMap.leftArm;
      const leftLegFaces = useLegacyLeftLimbUV ? faceMap.rightLeg : faceMap.leftLeg;
      const topSkew = 0.36;

      this.paintZombieCuboid(data, width, height, skin, faceMap.head,
        { x: 8, y: 2, width: 11, height: 11, depth: 3, topHeight: 3, topSkew },
        { front: 1, side: 0.78, top: 1.08 }, variant);
      this.paintZombieCuboid(data, width, height, skin, faceMap.body,
        { x: 8, y: 14, width: 10, height: 13, depth: 3, topHeight: 2, topSkew },
        { front: 0.95, side: 0.74, top: 1.02 }, variant);
      this.paintZombieCuboid(data, width, height, skin, faceMap.rightArm,
        { x: 19, y: 14, width: 4, height: 13, depth: 2, topHeight: 2, topSkew: 0.3 },
        { front: 0.92, side: 0.68, top: 1.0 }, variant);
      this.paintZombieCuboid(data, width, height, skin, leftArmFaces,
        { x: 4, y: 14, width: 4, height: 13, depth: 2, topHeight: 2, topSkew: 0.3 },
        { front: 0.92, side: 0.68, top: 1.0 }, variant);
      this.paintZombieCuboid(data, width, height, skin, faceMap.rightLeg,
        { x: 10, y: 25, width: 4, height: 16, depth: 2, topHeight: 2, topSkew: 0.28 },
        { front: 0.9, side: 0.66, top: 0.98 }, variant);
      this.paintZombieCuboid(data, width, height, skin, leftLegFaces,
        { x: 6, y: 25, width: 4, height: 16, depth: 2, topHeight: 2, topSkew: 0.28 },
        { front: 0.9, side: 0.66, top: 0.98 }, variant);

      if (!this.hasOpaquePixels(data)) return null;
      return data;
    } catch (err) { console.warn("Failed to build zombie skin sprite variant:", err); return null; }
  }

  getZombieMinecraftFaceMap() {
    return {
      head:     { top: { x: 8,  y: 0,  w: 8, h: 8 },  front: { x: 8,  y: 8,  w: 8, h: 8 },  right: { x: 0,  y: 8,  w: 8, h: 8 },  left: { x: 16, y: 8,  w: 8, h: 8  } },
      body:     { top: { x: 20, y: 16, w: 8, h: 4 },  front: { x: 20, y: 20, w: 8, h: 12 }, right: { x: 16, y: 20, w: 4, h: 12 }, left: { x: 28, y: 20, w: 4, h: 12 } },
      rightArm: { top: { x: 44, y: 16, w: 4, h: 4 },  front: { x: 44, y: 20, w: 4, h: 12 }, right: { x: 40, y: 20, w: 4, h: 12 }, left: { x: 48, y: 20, w: 4, h: 12 } },
      leftArm:  { top: { x: 36, y: 48, w: 4, h: 4 },  front: { x: 36, y: 52, w: 4, h: 12 }, right: { x: 32, y: 52, w: 4, h: 12 }, left: { x: 40, y: 52, w: 4, h: 12 } },
      rightLeg: { top: { x: 4,  y: 16, w: 4, h: 4 },  front: { x: 4,  y: 20, w: 4, h: 12 }, right: { x: 0,  y: 20, w: 4, h: 12 }, left: { x: 8,  y: 20, w: 4, h: 12 } },
      leftLeg:  { top: { x: 20, y: 48, w: 4, h: 4 },  front: { x: 20, y: 52, w: 4, h: 12 }, right: { x: 16, y: 52, w: 4, h: 12 }, left: { x: 24, y: 52, w: 4, h: 12 } },
    };
  }

  writeSkinPixelToSprite(data, canvasW, canvasH, skin, skinX, skinY, spriteX, spriteY, shade, variant) {
    if (!skin || !skin.pixels || skin.pixels.length === 0) return;
    if (spriteX < 0 || spriteX >= canvasW || spriteY < 0 || spriteY >= canvasH) return;
    const clampedSkinX = constrain(Math.floor(skinX), 0, skin.width - 1);
    const clampedSkinY = constrain(Math.floor(skinY), 0, skin.height - 1);
    const srcIdx = 4 * (clampedSkinY * skin.width + clampedSkinX);
    const alpha = skin.pixels[srcIdx + 3];
    if (alpha < 12) return;
    const [r, g, b] = this.applyZombieVariantTint(
      skin.pixels[srcIdx], skin.pixels[srcIdx + 1], skin.pixels[srcIdx + 2], variant, shade
    );
    const dstIdx = 4 * (spriteY * canvasW + spriteX);
    data[dstIdx] = r; data[dstIdx + 1] = g; data[dstIdx + 2] = b; data[dstIdx + 3] = 255;
  }

  paintZombieFrontFace(data, canvasW, canvasH, skin, uv, dstX, dstY, dstW, dstH, shade, variant) {
    for (let ty = 0; ty < dstH; ty++) {
      const v = uv.y + (ty / Math.max(1, dstH)) * uv.h;
      for (let tx = 0; tx < dstW; tx++) {
        const u = uv.x + (tx / Math.max(1, dstW)) * uv.w;
        this.writeSkinPixelToSprite(data, canvasW, canvasH, skin, u, v, dstX + tx, dstY + ty, shade, variant);
      }
    }
  }

  paintZombieRightFace(data, canvasW, canvasH, skin, uv, dstX, dstY, dstH, depth, shade, variant) {
    for (let ty = 0; ty < dstH; ty++) {
      const v = uv.y + (ty / Math.max(1, dstH)) * uv.h;
      for (let tx = 0; tx < depth; tx++) {
        const u = uv.x + (tx / Math.max(1, depth)) * uv.w;
        const yShift = Math.floor((depth - tx - 1) * 0.55);
        this.writeSkinPixelToSprite(data, canvasW, canvasH, skin, u, v, dstX + tx, dstY + ty - yShift, shade, variant);
      }
    }
  }

  paintZombieLeftFace(data, canvasW, canvasH, skin, uv, dstX, dstY, dstH, depth, shade, variant) {
    for (let ty = 0; ty < dstH; ty++) {
      const v = uv.y + (ty / Math.max(1, dstH)) * uv.h;
      for (let tx = 0; tx < depth; tx++) {
        const u = uv.x + ((depth - tx - 1) / Math.max(1, depth)) * uv.w;
        const yShift = Math.floor(tx * 0.55);
        this.writeSkinPixelToSprite(data, canvasW, canvasH, skin, u, v, dstX - tx, dstY + ty - yShift, shade, variant);
      }
    }
  }

  paintZombieTopFace(data, canvasW, canvasH, skin, uv, dstX, dstY, dstW, topH, skew, shade, variant) {
    for (let ty = 0; ty < topH; ty++) {
      const v = uv.y + (ty / Math.max(1, topH)) * uv.h;
      for (let tx = 0; tx < dstW; tx++) {
        const u = uv.x + (tx / Math.max(1, dstW)) * uv.w;
        const xShift = Math.floor((topH - ty - 1) * skew);
        this.writeSkinPixelToSprite(data, canvasW, canvasH, skin, u, v, dstX + tx + xShift, dstY + ty, shade, variant);
      }
    }
  }

  paintZombieCuboid(data, canvasW, canvasH, skin, partFaces, layout, shades, variant) {
    const { x, y, width, height, depth, topHeight, topSkew } = layout;
    this.paintZombieTopFace(data, canvasW, canvasH, skin, partFaces.top, x, y - topHeight, width, topHeight, topSkew, shades.top, variant);
    this.paintZombieLeftFace(data, canvasW, canvasH, skin, partFaces.left, x - 1, y, height, depth, shades.side ?? shades.left ?? 0.7, variant);
    this.paintZombieFrontFace(data, canvasW, canvasH, skin, partFaces.front, x, y, width, height, shades.front, variant);
    this.paintZombieRightFace(data, canvasW, canvasH, skin, partFaces.right, x + width, y, height, depth, shades.side ?? shades.right ?? 0.7, variant);
  }

  applyZombieVariantTint(r, g, b, variant, shade) {
    let mul = shade;
    if (variant === "chase")  mul *= 1.04;
    if (variant === "attack") mul *= 1.08;
    if (variant === "charge") mul *= 1.10;

    let outR = r * mul;
    let outG = g * mul;
    let outB = b * mul;

    if      (variant === "chase")  { outR = lerp(outR, 170, 0.08); outG = lerp(outG, 60, 0.03); outB = lerp(outB, 70, 0.04); }
    else if (variant === "attack") { outR = lerp(outR, 230, 0.18); outG = lerp(outG, 45, 0.12); outB = lerp(outB, 45, 0.10); }
    else if (variant === "charge") { outR = lerp(outR, 255, 0.25); outG = lerp(outG, 70, 0.10); outB = lerp(outB, 50, 0.12); }

    return [constrain(outR, 0, 255), constrain(outG, 0, 255), constrain(outB, 0, 255)];
  }

  buildZombieSpriteVariant(width, height, variant) {
    const skinnedData = this.buildZombieSkinSpriteVariant(width, height, variant);
    if (skinnedData) return skinnedData;

    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = 4 * (y * width + x);
        const head     = x >= 14 && x <= 24 && y >= 4  && y <= 14;
        const body     = x >= 14 && x <= 24 && y >= 15 && y <= 30;
        const leftArm  = x >= 9  && x <= 13 && y >= 17 && y <= 30;
        const rightArm = x >= 25 && x <= 29 && y >= 17 && y <= 30;
        const leftLeg  = x >= 12 && x <= 16 && y >= 31 && y <= 49;
        const rightLeg = x >= 18 && x <= 22 && y >= 31 && y <= 49;

        if (!head && !body && !leftArm && !rightArm && !leftLeg && !rightLeg) { data[idx + 3] = 0; continue; }

        let base = [48, 34, 28];
        if (head) base = [92, 170, 92];
        else if (body || leftArm || rightArm) base = [64, 118, 162];

        const [tintedR, tintedG, tintedB] = this.applyZombieVariantTint(base[0], base[1], base[2], variant, 1);
        data[idx] = tintedR; data[idx + 1] = tintedG; data[idx + 2] = tintedB; data[idx + 3] = 255;
      }
    }

    const eyeColor = variant === "charge" ? [255, 80, 70] : [235, 70, 70];
    for (const [ex, ey] of [[16, 7], [17, 7], [21, 7], [22, 7]]) {
      if (ex < 0 || ex >= width || ey < 0 || ey >= height) continue;
      const eyeIdx = 4 * (ey * width + ex);
      data[eyeIdx] = eyeColor[0]; data[eyeIdx + 1] = eyeColor[1];
      data[eyeIdx + 2] = eyeColor[2]; data[eyeIdx + 3] = 255;
    }
    return data;
  }

// --- Collect orb sprite cache ---

  createCollectOrbSpriteCache() {
    const width = 20; const height = 20;
    return {
      width, height,
      safe:    this.buildCollectOrbSpriteVariant(width, height, "safe"),
      warning: this.buildCollectOrbSpriteVariant(width, height, "warning"),
    };
  }

  buildCollectOrbSpriteVariant(width, height, variant) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = (x / (width  - 1)) * 2 - 1;
        const ny = (y / (height - 1)) * 2 - 1;
        const r  = Math.hypot(nx, ny);
        const idx = 4 * (y * width + x);
        const angle = Math.atan2(ny, nx);
        const jagged = variant === "warning" ? Math.sin(angle * 8) * 0.08 : 0;
        const edge = 1 - (r + jagged);
        if (edge <= 0) { data[idx + 3] = 0; continue; }
        const core    = Math.max(0, 1 - r / 0.38);
        const ring    = Math.max(0, 1 - Math.abs(r - 0.62) / 0.12);
        const sparkle = variant === "warning"
          ? Math.max(0, Math.sin((nx - ny) * 18) * 0.25)
          : Math.max(0, Math.sin((nx + ny) * 14) * 0.2);
        const intensity = constrain(110 + edge * 95 + core * 50 + ring * 45 + sparkle * 30, 0, 255);
        const alpha     = constrain(edge * edge * 255 + ring * 35, 0, 255);
        data[idx] = intensity; data[idx + 1] = intensity; data[idx + 2] = intensity; data[idx + 3] = alpha;
      }
    }
    return data;
  }

// --- Motion blur ---

  createMotionBlurBuffer() {
    const width  = Math.max(96, Math.floor(SCREEN_WIDTH  * MOTION_BLUR_BUFFER_SCALE));
    const height = Math.max(54, Math.floor(SCREEN_HEIGHT * MOTION_BLUR_BUFFER_SCALE));
    const buffer = createGraphics(width, height);
    buffer.pixelDensity(1);
    return buffer;
  }

  syncMotionBlurReference() {
    this.prevPlayerPosX  = this.player.posX;
    this.prevPlayerPosY  = this.player.posY;
    this.prevPlayerAngle = this.player.angle;
  }

  drawMotionBlurOverlay() {
    if (!this.motionBlurEnabled) return;
    if (!this.motionBlurBuffer) return;
    if (this.motionBlurAmount <= MOTION_BLUR_MIN_TRIGGER) return;
    const alpha = MOTION_BLUR_MAX_ALPHA * this.motionBlurAmount;
    if (alpha <= 1) return;
    push();
    tint(255, alpha);
    image(this.motionBlurBuffer, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    noTint();
    pop();
  }

  captureMotionBlurFrame() {
    if (!this.motionBlurEnabled) return;
    if (!this.motionBlurBuffer) return;
    if (this.motionBlurAmount <= MOTION_BLUR_MIN_TRIGGER) return;
    this.motionBlurFrameCounter = (this.motionBlurFrameCounter + 1) % MOTION_BLUR_CAPTURE_STEP;
    if (this.motionBlurFrameCounter !== 0) return;
    if (!this.canvasEl || !document.body.contains(this.canvasEl)) {
      this.canvasEl = document.querySelector("canvas");
      if (!this.canvasEl) return;
    }
    try {
      const ctx = this.motionBlurBuffer.drawingContext;
      ctx.clearRect(0, 0, this.motionBlurBuffer.width, this.motionBlurBuffer.height);
      ctx.drawImage(this.canvasEl, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0, 0, this.motionBlurBuffer.width, this.motionBlurBuffer.height);
    } catch {
      this.motionBlurEnabled = false;
      this.motionBlurAmount  = 0;
      if (this.motionBlurBuffer) this.motionBlurBuffer.clear();
      this.motionBlurBuffer = null;
    }
  }

// --- Camera utility ---

  cameraScreenOffsetPx() {
    return this.player.cameraVerticalOffsetPx();
  }

// --- drawSkyAndFloor() â€” updated: horizon respects camera offset ---

  drawSkyAndFloor() {
    const cyclePhase  = (this.survivalSeconds() % 90) / 90;
    const nightFactor = (Math.sin(cyclePhase * TWO_PI - HALF_PI) + 1) / 2;

    const skyR = lerp(85, 12, nightFactor);
    const skyG = lerp(130, 14, nightFactor);
    const skyB = lerp(210, 45, nightFactor);

    const floorR = lerp(95, 28, nightFactor);
    const floorG = lerp(80, 22, nightFactor);
    const floorB = lerp(65, 16, nightFactor);

    const horizon = constrain(
      SCREEN_HEIGHT / 2 + this.cameraScreenOffsetPx(),
      0,
      SCREEN_HEIGHT
    );

    noStroke();
    fill(skyR, skyG, skyB); rect(0, 0, SCREEN_WIDTH, horizon);
    fill(floorR, floorG, floorB); rect(0, horizon, SCREEN_WIDTH, SCREEN_HEIGHT - horizon);
  }

// --- drawVignette() â€” unchanged ---

  drawVignette() {
    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2;
    const maxR = Math.hypot(cx, cy);
    noStroke();
    for (let ring = 3; ring >= 1; ring--) {
      const frac  = ring / 3;
      const alpha = frac * frac * 40;
      fill(0, 0, 0, alpha);
      ellipse(cx, cy, maxR * 2 * (0.65 + frac * 0.35), maxR * 2 * (0.65 + frac * 0.35));
    }
  }

// --- renderFrame() â€” main pipeline ---

  renderFrame() {
    /*
      PERFORMANCE-CRITICAL RENDER PIPELINE
      ====================================
      Steps :
        1. Draw sky & floor with two fast rect() calls.
        2. loadPixels()  â€” copy the canvas into the pixels[] typed array.
        3. castAllRays()  â€” write textured wall columns into pixels[].
        4. drawSpritesToBuffer() â€” write sprites into pixels[].
        5. updatePixels() â€” push the modified array back to the canvas. (1 call!)
        6. Draw lightweight overlays (vignette, minimap, HUD) with normal p5 shapes.
    */
    this.drawSkyAndFloor();

    loadPixels();                // step 2
    this.castAllRays();          // step 3
    this.drawSpritesToBuffer();  // step 4
    updatePixels();              // step 5

    this.drawMotionBlurOverlay();
    this.captureMotionBlurFrame();

    // Lightweight overlay draws
    const shake = this.currentShakeOffset();
    push();
    translate(shake.x, shake.y);
    this.drawVignette();
    this.drawMinimap();
    this.drawHUD();
    this.drawFirstPersonWeapon();
    this.drawCrosshair();
    pop();
  }

// --- castAllRays() â€” DDA raycasting ---

  castAllRays() {
    /*
      For each screen column we cast one ray using the DDA
      (Digital Differential Analyser) algorithm.  When we hit
      a wall we compute perpendicular distance for correct
      projection and sample the texture column.
    */
    const halfFOV = FIELD_OF_VIEW_RADIANS / 2;
    const cameraOffset = this.cameraScreenOffsetPx();

    for (let col = 0; col < RAY_COUNT; col++) {
      const rayScreenFraction = (col / RAY_COUNT) * 2 - 1;
      const rayAngle = this.player.angle + Math.atan(rayScreenFraction * Math.tan(halfFOV));

      const rayDirX = Math.cos(rayAngle);
      const rayDirY = Math.sin(rayAngle);

      // --- DDA setup ---
      let mapX = Math.floor(this.player.posX);
      let mapY = Math.floor(this.player.posY);

      const deltaDistX = Math.abs(rayDirX) < 1e-10 ? 1e10 : Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(rayDirY) < 1e-10 ? 1e10 : Math.abs(1 / rayDirY);

      let stepX, stepY;
      let sideDistX, sideDistY;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (this.player.posX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - this.player.posX) * deltaDistX;
      }
      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (this.player.posY - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - this.player.posY) * deltaDistY;
      }

      // --- DDA loop ---
      let hitWall = false;
      let hitSide = 0;
      let tileType = 0;
      let stepsDone = 0;

      while (!hitWall && stepsDone < MAX_RAY_DISTANCE * 2) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          hitSide = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          hitSide = 1;
        }

        stepsDone++;

        if (mapX < 0 || mapX >= MAP_TILE_COUNT || mapY < 0 || mapY >= MAP_TILE_COUNT) {
          hitWall = true;
          tileType = 3;
          break;
        }

        if (worldTileMap[mapY][mapX] !== 0) {
          hitWall = true;
          tileType = worldTileMap[mapY][mapX];
        }
      }

      if (!hitWall) {
        this.zBuffer[col] = MAX_RAY_DISTANCE;
        continue;
      }

      // --- Perpendicular distance (avoids fish-eye) ---
      let perpDist;
      if (hitSide === 0) {
        perpDist = (mapX - this.player.posX + (1 - stepX) / 2) / rayDirX;
      } else {
        perpDist = (mapY - this.player.posY + (1 - stepY) / 2) / rayDirY;
      }
      perpDist = Math.abs(perpDist);
      if (perpDist < 0.001) perpDist = 0.001;

      this.zBuffer[col] = perpDist;

      // --- Wall strip height ---
      const wallStripHeight = (SCREEN_HEIGHT * WALL_HEIGHT_PROJECTION_FACTOR) / perpDist;
      const drawStart = Math.floor((SCREEN_HEIGHT - wallStripHeight) / 2 + cameraOffset);

      // --- Texture mapping ---
      let wallHitFraction;
      if (hitSide === 0) {
        wallHitFraction = this.player.posY + perpDist * rayDirY;
      } else {
        wallHitFraction = this.player.posX + perpDist * rayDirX;
      }
      wallHitFraction -= Math.floor(wallHitFraction);

      const texX = Math.floor(wallHitFraction * TEXTURE_SIZE);

      // --- Draw the textured wall column ---
      const cachedTexPixels = texturePixelCache[tileType];
      if (cachedTexPixels) {
        this.drawTexturedColumn(col, drawStart, wallStripHeight, cachedTexPixels, texX, perpDist, hitSide);
      }
    }
  }

// â”€â”€â”€ drawTexturedColumn() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Draws one vertical textured wall column directly into the canvas pixels[] array.
   * @param {Uint8ClampedArray} texPixels â€” pre-cached RGBA pixel data of the block texture
   */
  drawTexturedColumn(screenCol, drawStart, stripHeight, texPixels, texX, distance, hitSide) {
    const rawFog = constrain(1 - (distance / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
    const fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);
    const sideBrightness = hitSide === 1 ? SIDE_SHADE_FACTOR : 1.0;
    const combinedShade = fogFactor * sideBrightness;

    const yStart = Math.max(0, Math.floor(drawStart));
    const yEnd   = Math.min(SCREEN_HEIGHT, Math.floor(drawStart + stripHeight));
    const invStripHeight = TEXTURE_SIZE / stripHeight;
    const safeTexX = texX < 0 ? 0 : (texX >= TEXTURE_SIZE ? TEXTURE_SIZE - 1 : texX);

    for (let screenY = yStart; screenY < yEnd; screenY++) {
      const texY = Math.floor((screenY - drawStart) * invStripHeight);
      const safeTexY = texY < 0 ? 0 : (texY >= TEXTURE_SIZE ? TEXTURE_SIZE - 1 : texY);

      const srcIdx = 4 * (safeTexY * TEXTURE_SIZE + safeTexX);
      const dstIdx = 4 * (screenY * SCREEN_WIDTH + screenCol);
      pixels[dstIdx]     = texPixels[srcIdx]     * combinedShade;
      pixels[dstIdx + 1] = texPixels[srcIdx + 1] * combinedShade;
      pixels[dstIdx + 2] = texPixels[srcIdx + 2] * combinedShade;
    }
  }

// --- drawSpritesToBuffer() â€” build list and sort back-to-front ---

  drawSpritesToBuffer() {
    const allSprites = [];

    for (const orb of this.orbs) {
      const dist = Math.hypot(orb.posX - this.player.posX, orb.posY - this.player.posY);
      let spriteType;
      if (orb.isSafe())         spriteType = "safe";
      else if (orb.isWarning()) spriteType = "warning";
      else if (orb.isChasing()) spriteType = "chase";
      else                      spriteType = "patrol";
      allSprites.push({ x: orb.posX, y: orb.posY, dist, type: spriteType, obj: orb });
    }

    for (const p of this.particles) {
      const dist = Math.hypot(p.posX - this.player.posX, p.posY - this.player.posY);
      allSprites.push({ x: p.posX, y: p.posY, dist, type: "particle", obj: p });
    }

    for (const wm of this.worldModules) {
      const dist = Math.hypot(wm.posX - this.player.posX, wm.posY - this.player.posY);
      allSprites.push({ x: wm.posX, y: wm.posY, dist, type: "world-module", obj: wm });
    }

    for (const drop of this.drops) {
      const dist = Math.hypot(drop.posX - this.player.posX, drop.posY - this.player.posY);
      allSprites.push({ x: drop.posX, y: drop.posY, dist, type: "drop", obj: drop });
    }

    for (const beacon of this.missionBeacons) {
      if (beacon.activated) continue;
      const dist = Math.hypot(beacon.posX - this.player.posX, beacon.posY - this.player.posY);
      allSprites.push({ x: beacon.posX, y: beacon.posY, dist, type: "mission-beacon", obj: beacon });
    }

    if (this.extractionPortal) {
      const dist = Math.hypot(this.extractionPortal.posX - this.player.posX, this.extractionPortal.posY - this.player.posY);
      allSprites.push({
        x: this.extractionPortal.posX,
        y: this.extractionPortal.posY,
        dist,
        type: "extraction-portal",
        obj: this.extractionPortal,
      });
    }

    if (this.punchMachine) {
      const dist = Math.hypot(this.punchMachine.posX - this.player.posX, this.punchMachine.posY - this.player.posY);
      allSprites.push({
        x: this.punchMachine.posX,
        y: this.punchMachine.posY,
        dist,
        type: "punch-machine",
        obj: this.punchMachine,
      });
    }

    // Sort back-to-front
    allSprites.sort((a, b) => b.dist - a.dist);

    for (const sp of allSprites) {
      this.drawSingleSpriteToBuffer(sp);
    }
  }

// --- drawSingleSpriteToBuffer() â€” per-pixel sprite rendering ---

  /**
   * Draws a single sprite directly into the pixels[] buffer.
   * Billboard projection with z-buffer occlusion.
   */
  drawSingleSpriteToBuffer(spriteData) {
    const relX = spriteData.x - this.player.posX;
    const relY = spriteData.y - this.player.posY;

    const cosA = Math.cos(this.player.angle);
    const sinA = Math.sin(this.player.angle);
    const transformX = -relX * sinA + relY * cosA;
    const transformY =  relX * cosA + relY * sinA;

    if (transformY <= 0.1) return;

    const fovScale = SCREEN_WIDTH / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
    const spriteScreenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;
    const isZombieHumanoid = spriteData.type === "patrol" || spriteData.type === "chase";
    const isCollectOrb = spriteData.type === "safe" || spriteData.type === "warning";
    const isMissionBeacon = spriteData.type === "mission-beacon";
    const isExtractionPortal = spriteData.type === "extraction-portal";
    const isPunchMachine = spriteData.type === "punch-machine";

    let worldSize = 0.6;
    if (spriteData.type === "particle") worldSize = 0.15;
    if (isZombieHumanoid) worldSize = 0.92;
    if (spriteData.type === "warning") worldSize = 0.65;
    if (spriteData.type === "world-module") worldSize = 0.68;
    if (isMissionBeacon) worldSize = 0.78;
    if (isExtractionPortal) worldSize = 1.06;
    if (isPunchMachine) worldSize = 0.92;
    if (spriteData.type === "drop") {
      if (spriteData.obj.type === "crate") worldSize = 0.5;
      else if (spriteData.obj.type === "rounds") worldSize = 0.46;
      else worldSize = 0.42;
    }
    const spriteBaseSize = Math.abs((worldSize / transformY) * fovScale);
    let spriteScreenW = spriteBaseSize;
    let spriteScreenH = spriteBaseSize;
    if (isZombieHumanoid) {
      const zombieAspect = this.zombieSpriteCache.height / Math.max(1, this.zombieSpriteCache.width);
      spriteScreenW = Math.min(spriteBaseSize, SCREEN_HEIGHT * 0.4);
      spriteScreenH = Math.min(spriteScreenW * zombieAspect, SCREEN_HEIGHT * 0.62);
    }

    const drawStartX = Math.max(0, Math.floor(spriteScreenX - spriteScreenW / 2));
    const drawEndX   = Math.min(SCREEN_WIDTH, Math.floor(spriteScreenX + spriteScreenW / 2));
    const cameraOffset = this.cameraScreenOffsetPx();
    let drawStartY = Math.max(0, Math.floor(SCREEN_HEIGHT / 2 - spriteScreenH / 2 + cameraOffset));
    let drawEndY   = Math.min(SCREEN_HEIGHT, Math.floor(SCREEN_HEIGHT / 2 + spriteScreenH / 2 + cameraOffset));

    if (isZombieHumanoid) {
      const bobPx = Math.sin(millis() * 0.01 + spriteData.obj.posX * 0.8 + spriteData.obj.posY * 0.6)
        * Math.max(1, Math.min(4, spriteScreenH * 0.04));
      const bobOffset = Math.floor(bobPx);
      drawStartY = Math.max(0, drawStartY + bobOffset);
      drawEndY = Math.min(SCREEN_HEIGHT, drawEndY + bobOffset);
    }

    if (drawStartX >= drawEndX || drawStartY >= drawEndY) return;

    const rawFog = constrain(1 - (spriteData.dist / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
    const fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);

    let baseR = 0;
    let baseG = 0;
    let baseB = 0;
    let baseA = 255;
    if (!isZombieHumanoid) {
      if (spriteData.type === "safe") {
        const pulse = 0.7 + 0.3 * Math.sin(millis() * 0.006);
        baseR = 60 * pulse;
        baseG = 255 * pulse;
        baseB = 100 * pulse;
        const mp = spriteData.obj.mutationProgress();
        baseR = lerp(baseR, 255, mp * 0.5);
        baseG = lerp(baseG, 180, mp * 0.3);
      } else if (spriteData.type === "warning") {
        const wp = spriteData.obj.warningProgress();
        const flash = Math.sin(millis() * 0.025) > 0 ? 1 : 0.4;
        baseR = lerp(255, 255, wp) * flash;
        baseG = lerp(180, 40, wp) * flash;
        baseB = 30 * flash;
      } else if (spriteData.type === "world-module") {
        const wm = spriteData.obj;
        const pulse = 0.72 + 0.28 * Math.sin(millis() * 0.008 + wm.posX * 0.8 + wm.posY * 0.5);
        if (wm.type === "aegis") {
          baseR = 85 * pulse;
          baseG = 225 * pulse;
          baseB = 255;
        } else if (wm.type === "emp") {
          baseR = 180 * pulse;
          baseG = 235 * pulse;
          baseB = 255 * pulse;
        } else if (wm.type === "chrono") {
          baseR = 200 * pulse;
          baseG = 120 * pulse;
          baseB = 255;
        }
      } else if (spriteData.type === "drop") {
        const drop = spriteData.obj;
        const pulse = 0.75 + 0.25 * Math.sin(millis() * 0.015 + drop.posX * 1.8);
        if (drop.type === "ammo") {
          baseR = 255;
          baseG = 210 * pulse;
          baseB = 100 * pulse;
        } else if (drop.type === "score") {
          baseR = 255 * pulse;
          baseG = 255;
          baseB = 140 * pulse;
        } else if (drop.type === "pulse") {
          baseR = 220 * pulse;
          baseG = 170 * pulse;
          baseB = 255;
        } else if (drop.type === "rounds") {
          baseR = 255;
          baseG = 165 * pulse;
          baseB = 92 * pulse;
        } else {
          baseR = 170 * pulse;
          baseG = 220 * pulse;
          baseB = 255;
        }
      } else if (isMissionBeacon) {
        const beaconPulse = 0.72 + 0.28 * Math.sin(millis() * 0.01 + spriteData.obj.pulseOffset);
        baseR = 120 * beaconPulse;
        baseG = 250 * beaconPulse;
        baseB = 220;
      } else if (isExtractionPortal) {
        const portalPulse = 0.65 + 0.35 * Math.sin(millis() * 0.014);
        baseR = 90 * portalPulse;
        baseG = 255;
        baseB = 165 * portalPulse;
      } else if (isPunchMachine) {
        const now = millis();
        const sinceUse = now - spriteData.obj.lastUseMs;
        const cooldownFrac = constrain(sinceUse / PUNCH_MACHINE_COOLDOWN_MS, 0, 1);
        const pulse = 0.72 + 0.28 * Math.sin(now * 0.014);
        baseR = lerp(255, 175, cooldownFrac) * pulse;
        baseG = lerp(90, 210, cooldownFrac) * pulse;
        baseB = 255;
      } else if (spriteData.type === "particle") {
        const p = spriteData.obj;
        baseR = p.colorArray[0];
        baseG = p.colorArray[1];
        baseB = p.colorArray[2];
        baseA = p.opacity();
      }
    }

    const finalR = baseR * fogFactor;
    const finalG = baseG * fogFactor;
    const finalB = baseB * fogFactor;
    const invSize = 1 / Math.max(spriteScreenW, spriteScreenH);
    const alphaFrac = baseA / 255;
    const invAlpha = 1 - alphaFrac;

    const zombieTex = isZombieHumanoid ? this.resolveZombieTextureForSprite(spriteData) : null;
    const zombieTexW = this.zombieSpriteCache.width;
    const zombieTexH = this.zombieSpriteCache.height;
    const zombieSpriteW = Math.max(1, drawEndX - drawStartX);
    const zombieSpriteH = Math.max(1, drawEndY - drawStartY);
    const zombieStepX = isZombieHumanoid ? zombieTexW / zombieSpriteW : 0;
    const zombieStepY = isZombieHumanoid ? zombieTexH / zombieSpriteH : 0;

    const orbTex = isCollectOrb
      ? (spriteData.type === "warning" ? this.collectOrbSpriteCache.warning : this.collectOrbSpriteCache.safe)
      : null;
    const orbTexW = this.collectOrbSpriteCache.width;
    const orbTexH = this.collectOrbSpriteCache.height;
    const orbSpriteW = Math.max(1, drawEndX - drawStartX);
    const orbSpriteH = Math.max(1, drawEndY - drawStartY);
    const orbStepX = isCollectOrb ? orbTexW / orbSpriteW : 0;
    const orbStepY = isCollectOrb ? orbTexH / orbSpriteH : 0;

    for (let sx = drawStartX; sx < drawEndX; sx++) {
      if (transformY > this.zBuffer[sx] + 0.035) continue;

      let zombieTx = 0;
      if (isZombieHumanoid) {
        zombieTx = Math.min(zombieTexW - 1, Math.floor((sx - drawStartX) * zombieStepX));
      }

      let orbTx = 0;
      if (isCollectOrb) {
        orbTx = Math.min(orbTexW - 1, Math.floor((sx - drawStartX) * orbStepX));
      }

      for (let sy = drawStartY; sy < drawEndY; sy++) {
        const fracX = (sx - drawStartX) * invSize - 0.5;
        const fracY = (sy - drawStartY) * invSize - 0.5;
        const dstIdx = 4 * (sy * SCREEN_WIDTH + sx);

        if (isZombieHumanoid) {
          const zombieTy = Math.min(zombieTexH - 1, Math.floor((sy - drawStartY) * zombieStepY));
          const srcIdx = 4 * (zombieTy * zombieTexW + zombieTx);
          const zAlpha = zombieTex[srcIdx + 3] / 255;
          if (zAlpha <= 0.001) continue;
          const invZAlpha = 1 - zAlpha;
          pixels[dstIdx]     = zombieTex[srcIdx]     * fogFactor * zAlpha + pixels[dstIdx]     * invZAlpha;
          pixels[dstIdx + 1] = zombieTex[srcIdx + 1] * fogFactor * zAlpha + pixels[dstIdx + 1] * invZAlpha;
          pixels[dstIdx + 2] = zombieTex[srcIdx + 2] * fogFactor * zAlpha + pixels[dstIdx + 2] * invZAlpha;
          continue;
        }

        if (isCollectOrb) {
          const orbTy = Math.min(orbTexH - 1, Math.floor((sy - drawStartY) * orbStepY));
          const srcIdx = 4 * (orbTy * orbTexW + orbTx);
          const oAlpha = orbTex[srcIdx + 3] / 255;
          if (oAlpha <= 0.001) continue;
          const invOAlpha = 1 - oAlpha;
          const orbR = (orbTex[srcIdx]     / 255) * finalR;
          const orbG = (orbTex[srcIdx + 1] / 255) * finalG;
          const orbB = (orbTex[srcIdx + 2] / 255) * finalB;
          pixels[dstIdx]     = orbR * oAlpha + pixels[dstIdx]     * invOAlpha;
          pixels[dstIdx + 1] = orbG * oAlpha + pixels[dstIdx + 1] * invOAlpha;
          pixels[dstIdx + 2] = orbB * oAlpha + pixels[dstIdx + 2] * invOAlpha;
          continue;
        }

        if (isMissionBeacon) {
          const diamond = Math.abs(fracX) * 0.9 + Math.abs(fracY);
          if (diamond > 0.62) continue;
        } else if (isExtractionPortal) {
          const radial = fracX * fracX + fracY * fracY;
          if (radial > 0.24 || radial < 0.09) continue;
        } else if (isPunchMachine) {
          const body  = Math.abs(fracX) <= 0.36 && fracY > -0.5 && fracY < 0.55;
          const crown = Math.abs(fracX) <= 0.22 && fracY >= -0.62 && fracY <= -0.5;
          if (!body && !crown) continue;
        }

        if (!isMissionBeacon && !isExtractionPortal && !isPunchMachine && fracX * fracX + fracY * fracY > 0.2) continue;

        if (alphaFrac >= 0.98) {
          pixels[dstIdx]     = finalR;
          pixels[dstIdx + 1] = finalG;
          pixels[dstIdx + 2] = finalB;
        } else {
          pixels[dstIdx]     = finalR * alphaFrac + pixels[dstIdx]     * invAlpha;
          pixels[dstIdx + 1] = finalG * alphaFrac + pixels[dstIdx + 1] * invAlpha;
          pixels[dstIdx + 2] = finalB * alphaFrac + pixels[dstIdx + 2] * invAlpha;
        }
      }
    }
  }

// --- resolveZombie* â€” animation helpers ---

  resolveZombieTextureForSprite(spriteData) {
    const variant   = this.resolveZombieAnimationVariant(spriteData);
    const direction = this.resolveZombieDirectionForSprite(spriteData);
    const cacheKey  = `${variant}${direction}Frames`;

    if (this.zombieSpriteCache.mode === "sheet" || this.zombieSpriteCache.mode === "generated") {
      const frameList = this.zombieSpriteCache[cacheKey];
      if (frameList && frameList.length > 0) {
        const speedFactor   = this.resolveZombieAnimationSpeedFactor(spriteData, variant);
        const effectiveFps  = this.zombieSpriteCache.fps * speedFactor;
        const frameDurationMs = 1000 / Math.max(1, effectiveFps);
        const frameIndex    = Math.floor(millis() / frameDurationMs) % frameList.length;
        return frameList[frameIndex];
      }
    }

    return variant === "charge"
      ? this.zombieSpriteCache.charge
      : (variant === "attack"
        ? (this.zombieSpriteCache.attack || this.zombieSpriteCache.chase)
        : (variant === "chase" ? this.zombieSpriteCache.chase : this.zombieSpriteCache.patrol));
  }

  resolveZombieAnimationVariant(spriteData) {
    if (spriteData.type !== "chase") return "patrol";
    if (spriteData.obj.chargeActive) return "charge";
    if (spriteData.dist < ZOMBIE_ATTACK_DISTANCE) return "attack";
    return "chase";
  }

  resolveZombieDirectionForSprite(spriteData) {
    const orb = spriteData.obj;
    if (!orb || typeof orb.moveDirX !== "number" || typeof orb.moveDirY !== "number") return "Front";

    const camRightX = -Math.sin(this.player.angle);
    const camRightY =  Math.cos(this.player.angle);
    const side = orb.moveDirX * camRightX + orb.moveDirY * camRightY;

    if (side >  ZOMBIE_SIDE_TURN_THRESHOLD) return "Right";
    if (side < -ZOMBIE_SIDE_TURN_THRESHOLD) return "Left";
    return "Front";
  }

  resolveZombieAnimationSpeedFactor(spriteData, variant) {
    const orb = spriteData.obj;
    if (!orb || typeof orb.hunterSpeed !== "number") return 1;

    let currentSpeed = orb.hunterSpeed;
    if (variant === "patrol") currentSpeed *= HUNTER_PATROL_SPEED_RATIO;
    if (variant === "charge") currentSpeed *= HUNTER_CHARGE_MULTIPLIER;
    if (variant === "attack") currentSpeed *= 1.15;

    const base   = Math.max(0.0001, ENEMY_BASE_SPEED * HUNTER_PATROL_SPEED_RATIO);
    const factor = currentSpeed / base;
    return constrain(factor, ZOMBIE_ANIM_SPEED_MIN, ZOMBIE_ANIM_SPEED_MAX);
  }
constructor() {
    this.gameState = "waiting";
    this.player = new Player(MAP_TILE_COUNT / 2 + 0.5, MAP_TILE_COUNT / 2 + 0.5);
    this.orbs = [];
    this.particles = [];
    this.worldModules = [];
    this.drops = [];
    this.missionBeacons = [];
    this.extractionPortal = null;
    this.punchMachine = null;

    this.inventory = {
      ammoPack: 0,
      scoreShard: 0,
      pulseCore: 0,
    };
    this.selectedHotbarSlot = 1;

    this.hudToastText = "";
    this.hudToastColor = [220, 240, 255];
    this.hudToastUntilMs = 0;

    this.score = 0;
    this.finalScore = 0;
    this.gameOverReason = "";
    this.gameWon = false;

    this.killStreak = 0;
    this.killStreakUntilMs = 0;

    this.waveNumber = 0;
    this.waveState = "preparing";
    this.waveEnemiesTotal = 0;
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesKilled = 0;
    this.waveMaxSimultaneous = 0;
    this.waveSpawnIntervalMs = 0;
    this.nextWaveActionMs = 0;

    this.sprintEnergy = SPRINT_ENERGY_MAX;
    this.sprintActive = false;
    this.lastSprintUseMs = 0;

    this.powerDamageUntilMs = 0;
    this.powerRapidUntilMs = 0;
    this.powerInstakillUntilMs = 0;
    this.punchMachineInteractLatch = false;

    this.beaconsActivated = 0;
    this.weaponAmmo = WEAPON_START_AMMO;
    this.weaponLastShotMs = 0;
    this.weaponFlashUntilMs = 0;

    this.lastModuleSpawnMs = 0;
    this.activeAegisUntilMs = 0;
    this.activeChronoUntilMs = 0;
    this.orbStunUntilMap = new Map();

    this.gameStartMs = 0;
    this.lastSpawnMs = 0;
    this.lastCorruptionTime = 0;
    this.corruptionLayer = 0;
    this.pendingCorruptionTiles = [];

    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeStartMs = 0;

    this.startOverlay = null;
    this.gameOverOverlay = null;
    this.gameOverTitleEl = null;
    this.finalScoreEl = null;
    this.gameOverReasonEl = null;
    this.restartBtn = null;
    this.pauseOverlay = null;
    this.resumeBtn = null;
    this.pauseSettingsBtn = null;
    this.pauseRestartBtn = null;
    this.startBtn = null;
    this.openSettingsBtn = null;
    this.settingsOverlay = null;
    this.closeSettingsBtn = null;
    this.resetControlsBtn = null;
    this.settingsStatusEl = null;
    this.sensitivityInput = null;
    this.sensitivityValueEl = null;
    this.controlLegendEl = null;
    this.bindButtons = [];

    this.pendingRebindAction = null;
    this.pendingRebindButton = null;
    this.boundCaptureRebindKey = (event) => this.captureRebindKey(event);
    this.canvasEl = null;

    this.zBuffer = new Float32Array(SCREEN_WIDTH);
    this.zombieSpriteCache = this.createZombieSpriteCache();
    this.collectOrbSpriteCache = this.createCollectOrbSpriteCache();
    this.motionBlurEnabled = MOTION_BLUR_ENABLED;
    this.motionBlurBuffer = this.motionBlurEnabled ? this.createMotionBlurBuffer() : null;
    this.motionBlurAmount = 0;
    this.motionBlurFrameCounter = 0;
    this.prevPlayerPosX = this.player.posX;
    this.prevPlayerPosY = this.player.posY;
    this.prevPlayerAngle = this.player.angle;
  }

  requestPointerLock() {
    const cvs = document.querySelector("canvas");
    if (cvs && cvs.requestPointerLock) cvs.requestPointerLock();
  }

  showPauseOverlay() {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.classList.add("visible");
    this.pauseOverlay.setAttribute("aria-hidden", "false");
  }

  hidePauseOverlay() {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.classList.remove("visible");
    this.pauseOverlay.setAttribute("aria-hidden", "true");
  }

  pauseGame() {
    if (this.gameState !== "playing") return;
    this.gameState = "paused";
    this.sprintActive = false;
    this.player.moveSpeed = PLAYER_MOVE_SPEED;
    if (document.exitPointerLock) document.exitPointerLock();
    this.showPauseOverlay();
  }

  resumeGame() {
    if (this.gameState !== "paused") return;
    this.closeSettingsMenu();
    this.hidePauseOverlay();
    this.gameState = "playing";
    this.requestPointerLock();
  }

  handleEscapeKey() {
    if (this.pendingRebindAction) {
      this.cancelPendingRebind();
      this.refreshBindingButtons();
      this.setSettingsStatus("Modification annulÃ©e.");
      return;
    }

    if (this.isSettingsVisible()) {
      this.closeSettingsMenu();
      return;
    }

    if (this.gameState === "playing") {
      this.pauseGame();
      return;
    }

    if (this.gameState === "paused") {
      this.resumeGame();
    }
  }

  handlePrimaryAction() {
    if (this.gameState === "waiting") {
      this.requestPointerLock();
      this.startNewGame();
      return;
    }

    if (this.gameState !== "playing") return;
    if (this.isSettingsVisible()) return;

    if (!this.isPointerLocked()) {
      this.requestPointerLock();
      return;
    }

    this.tryFireWeapon();
  }

  handleStartInput() {
    if (this.gameState !== "waiting") return false;
    if (this.isSettingsVisible()) return false;
    this.requestPointerLock();
    this.startNewGame();
    return true;
  }

  handleHotbarInput(rawKey, rawKeyCode = null) {
    if (this.gameState !== "playing") return false;
    if (this.isSettingsVisible()) return false;

    let slot = 0;
    if (rawKey === "1" || rawKeyCode === 49 || rawKeyCode === 97) slot = 1;
    else if (rawKey === "2" || rawKeyCode === 50 || rawKeyCode === 98) slot = 2;
    else if (rawKey === "3" || rawKeyCode === 51 || rawKeyCode === 99) slot = 3;

    if (slot === 0) return false;

    this.selectedHotbarSlot = slot;

    if (slot === 1) {
      this.consumeInventoryItem("ammoPack");
      return true;
    }
    if (slot === 2) {
      this.consumeInventoryItem("scoreShard");
      return true;
    }
    if (slot === 3) {
      this.consumeInventoryItem("pulseCore");
      return true;
    }
    return false;
  }

  handleMouseWheelSlot(deltaY) {
    if (this.gameState !== "playing") return false;
    if (this.isSettingsVisible()) return false;
    if (typeof deltaY !== "number" || deltaY === 0) return false;

    const dir = deltaY > 0 ? 1 : -1;
    this.selectedHotbarSlot = ((this.selectedHotbarSlot - 1 + dir + 3) % 3) + 1;

    if (this.selectedHotbarSlot === 1) {
      this.pushHudToast("Slot actif: Ammo", [255, 220, 110]);
    } else if (this.selectedHotbarSlot === 2) {
      this.pushHudToast("Slot actif: Score", [255, 255, 150]);
    } else {
      this.pushHudToast("Slot actif: Pulse", [220, 180, 255]);
    }

    return true;
  }

  onViewportResize() {
    this.zBuffer = new Float32Array(SCREEN_WIDTH);
    this.motionBlurBuffer = this.motionBlurEnabled ? this.createMotionBlurBuffer() : null;
    this.motionBlurAmount = 0;
    this.motionBlurFrameCounter = 0;
    this.syncMotionBlurReference();
  }

  startNewGame() {
    this.closeSettingsMenu();
    this.hidePauseOverlay();
    generateWorldMap();

    const now = millis();

    this.gameState = "playing";
    this.player.resetToSpawn();
    this.player.moveSpeed = PLAYER_MOVE_SPEED;
    this.orbs = [];
    this.particles = [];
    this.worldModules = [];
    this.drops = [];
    this.inventory.ammoPack = 0;
    this.inventory.scoreShard = 0;
    this.inventory.pulseCore = 0;
    this.selectedHotbarSlot = 1;
    this.hudToastText = "";
    this.hudToastUntilMs = 0;
    this.score = 0;
    this.finalScore = 0;
    this.gameOverReason = "";
    this.gameWon = false;
    this.killStreak = 0;
    this.killStreakUntilMs = 0;
    this.waveNumber = 0;
    this.waveState = "preparing";
    this.waveEnemiesTotal = 0;
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesKilled = 0;
    this.waveMaxSimultaneous = 0;
    this.waveSpawnIntervalMs = 0;
    this.nextWaveActionMs = now + WAVE_START_DELAY_MS;
    this.sprintEnergy = SPRINT_ENERGY_MAX;
    this.sprintActive = false;
    this.lastSprintUseMs = 0;
    this.powerDamageUntilMs = 0;
    this.powerRapidUntilMs = 0;
    this.powerInstakillUntilMs = 0;
    this.punchMachineInteractLatch = false;
    this.beaconsActivated = 0;
    this.missionBeacons = [];
    this.extractionPortal = null;
    this.punchMachine = null;
    this.weaponAmmo = WEAPON_START_AMMO;
    this.weaponLastShotMs = 0;
    this.weaponFlashUntilMs = 0;
    this.corruptionLayer = 0;
    this.pendingCorruptionTiles = [];
    this.lastCorruptionTime = 0;
    this.gameStartMs = now;
    this.lastSpawnMs = now;
    this.lastModuleSpawnMs = now;
    this.activeAegisUntilMs = 0;
    this.activeChronoUntilMs = 0;
    this.orbStunUntilMap.clear();
    this.shakeIntensity = 0;
    this.motionBlurAmount = 0;
    this.motionBlurFrameCounter = 0;
    this.syncMotionBlurReference();
    if (this.motionBlurBuffer) this.motionBlurBuffer.clear();

    this.spawnInitialWorldModules();
    this.spawnMissionBeacons();
    this.spawnPunchMachine();
    if (this.missionBeacons.length === 0) {
      this.spawnExtractionPortal();
    }

    if (this.startOverlay) this.startOverlay.style.display = "none";
    if (this.gameOverOverlay) {
      this.gameOverOverlay.classList.remove("visible");
      this.gameOverOverlay.classList.remove("victory");
      this.gameOverOverlay.setAttribute("aria-hidden", "true");
    }
    if (this.gameOverTitleEl) this.gameOverTitleEl.textContent = "GAME OVER";

    this.requestPointerLock();
  }

  triggerGameOver(reason) {
    this.triggerEndState(reason, false, "GAME OVER");
  }

  triggerVictory(reason = "Extraction completed. You escaped alive.") {
    this.triggerEndState(reason, true, "MISSION COMPLETE");
  }

  triggerEndState(reason, isVictory, titleText) {
    if (this.gameState !== "playing") return;
    this.gameState = "game-over";
    this.finalScore = Math.floor(this.score);
    this.gameOverReason = reason;
    this.gameWon = isVictory;
    this.player.moveSpeed = PLAYER_MOVE_SPEED;
    this.sprintActive = false;

    this.hidePauseOverlay();
    this.closeSettingsMenu();

    if (document.exitPointerLock) document.exitPointerLock();

    if (this.gameOverOverlay) {
      this.gameOverOverlay.classList.add("visible");
      this.gameOverOverlay.classList.toggle("victory", isVictory);
      this.gameOverOverlay.setAttribute("aria-hidden", "false");
    }
    if (this.gameOverTitleEl) this.gameOverTitleEl.textContent = titleText;
    if (this.finalScoreEl) this.finalScoreEl.textContent = String(this.finalScore);
    if (this.gameOverReasonEl) this.gameOverReasonEl.textContent = reason;
  }

  survivalSeconds() {
    return max(0, (millis() - this.gameStartMs) / 1000);
  }

  runFrame() {
    const dt = min(deltaTime / 1000, 0.05);

    if (this.gameState === "playing") {
      this.updateGame(dt);
    }

    this.updateMotionBlurState(dt);
    this.renderFrame();
  }

  updateGame(dt) {
    this.updateSprintState(dt);
    this.player.update(dt);
    this.updateWaveSystem();
    this.updatePunchMachineInteraction();
    this.advanceCorruption();
    this.applyPendingCorruptionStep();
    this.updateWorldModules(dt);
    this.updateDrops(dt);
    this.updateOrbs(dt);
    this.updateParticles(dt);
    this.handleCollisions();
    if (this.gameState !== "playing") return;
    this.handleModuleCollisions();
    if (this.gameState !== "playing") return;
    this.handleDropCollisions();
    if (this.gameState !== "playing") return;
    this.handleMissionCollisions();
    if (this.gameState !== "playing") return;
    this.updateKillStreakState();
    this.score += SURVIVAL_POINTS_PER_SECOND * dt;
  }

  spawnPunchMachine() {
    const fallback = {
      x: MAP_TILE_COUNT / 2 + 2.5,
      y: MAP_TILE_COUNT / 2 + 0.5,
    };
    const pos = this.findFreeWorldSpot(2.6) || fallback;

    this.punchMachine = {
      posX: constrain(pos.x, 1.5, MAP_TILE_COUNT - 1.5),
      posY: constrain(pos.y, 1.5, MAP_TILE_COUNT - 1.5),
      radius: PUNCH_MACHINE_RADIUS,
      lastUseMs: -PUNCH_MACHINE_COOLDOWN_MS,
    };
  }

  updatePunchMachineInteraction() {
    if (!this.punchMachine) return;

    const interactPressed = pressedKeyCodes.has("KeyF");
    if (!interactPressed) {
      this.punchMachineInteractLatch = false;
      return;
    }

    if (this.punchMachineInteractLatch) return;
    this.punchMachineInteractLatch = true;

    const dist = Math.hypot(
      this.player.posX - this.punchMachine.posX,
      this.player.posY - this.punchMachine.posY
    );
    const interactRange = this.player.radius + this.punchMachine.radius + 0.34;
    if (dist > interactRange) return;

    this.activatePunchMachine();
  }

  spawnInitialWorldModules() {
    const bootstrapTypes = ["aegis", "emp", "chrono"];
    for (const type of bootstrapTypes) {
      this.spawnWorldModule(type);
    }
    for (let i = bootstrapTypes.length; i < WORLD_MODULE_START_COUNT; i++) {
      this.spawnWorldModule();
    }
  }

  spawnMissionBeacons() {
    this.missionBeacons = [];
    this.beaconsActivated = 0;
    this.extractionPortal = null;

    const minSpacing = 4.5;
    let attempts = 0;
    while (this.missionBeacons.length < MISSION_BEACON_COUNT && attempts < 240) {
      attempts++;
      const pos = this.findFreeWorldSpot(4.8);
      if (!pos) continue;
      const tooClose = this.missionBeacons.some(
        (beacon) => Math.hypot(pos.x - beacon.posX, pos.y - beacon.posY) < minSpacing
      );
      if (tooClose) continue;

      this.missionBeacons.push({
        posX: pos.x,
        posY: pos.y,
        radius: MISSION_BEACON_RADIUS,
        activated: false,
        pulseOffset: Math.random() * TWO_PI,
      });
    }

    while (this.missionBeacons.length < MISSION_BEACON_COUNT) {
      const pos = this.findFreeWorldSpot(2.6);
      if (!pos) break;
      this.missionBeacons.push({
        posX: pos.x,
        posY: pos.y,
        radius: MISSION_BEACON_RADIUS,
        activated: false,
        pulseOffset: Math.random() * TWO_PI,
      });
    }
  }

  spawnExtractionPortal() {
    if (this.extractionPortal) return;
    const pos = this.findFreeWorldSpot(5.4) || this.findFreeWorldSpot(3);
    if (!pos) return;

    this.extractionPortal = {
      posX: pos.x,
      posY: pos.y,
      radius: EXTRACTION_PORTAL_RADIUS,
      spawnMs: millis(),
    };

    this.pushHudToast("Extraction prÃªte: rejoins la faille !", [150, 255, 200]);
    this.addScreenShake(3.5, 280);
    this.spawnCollectParticles(pos.x, pos.y, [130, 255, 200]);
  }

  getNearestUnactivatedBeacon() {
    let best = null;
    for (const beacon of this.missionBeacons) {
      if (beacon.activated) continue;
      const dist = Math.hypot(beacon.posX - this.player.posX, beacon.posY - this.player.posY);
      if (!best || dist < best.dist) {
        best = { beacon, dist };
      }
    }
    return best;
  }

  getCurrentObjectiveTarget() {
    const nearestBeacon = this.getNearestUnactivatedBeacon();
    if (nearestBeacon) {
      return {
        x: nearestBeacon.beacon.posX,
        y: nearestBeacon.beacon.posY,
        dist: nearestBeacon.dist,
        label: "BALISE",
      };
    }

    if (this.extractionPortal) {
      return {
        x: this.extractionPortal.posX,
        y: this.extractionPortal.posY,
        dist: Math.hypot(
          this.extractionPortal.posX - this.player.posX,
          this.extractionPortal.posY - this.player.posY
        ),
        label: "EXTRACT",
      };
    }

    return null;
  }

  updateWorldModules(dt) {
    const now = millis();

    for (let i = this.worldModules.length - 1; i >= 0; i--) {
      const wm = this.worldModules[i];
      if (now - wm.spawnMs > WORLD_MODULE_LIFETIME_MS) {
        this.worldModules.splice(i, 1);
      }
    }

    while (now - this.lastModuleSpawnMs >= WORLD_MODULE_SPAWN_INTERVAL_MS) {
      this.lastModuleSpawnMs += WORLD_MODULE_SPAWN_INTERVAL_MS;
      if (this.worldModules.length < WORLD_MODULE_MAX_COUNT) {
        this.spawnWorldModule();
      }
    }
  }

  spawnWorldModule(forcedType = null) {
    const pos = this.findFreeWorldSpot(2.8);
    if (!pos) return false;

    const type = forcedType || this.randomModuleType();
    this.worldModules.push({
      type,
      posX: pos.x,
      posY: pos.y,
      radius: WORLD_MODULE_RADIUS,
      spawnMs: millis(),
    });
    return true;
  }

  randomModuleType() {
    const types = ["aegis", "emp", "chrono"];
    return types[Math.floor(Math.random() * types.length)];
  }

  isWalkableTile(row, col) {
    if (row <= 0 || row >= MAP_TILE_COUNT - 1 || col <= 0 || col >= MAP_TILE_COUNT - 1) {
      return false;
    }
    return worldTileMap[row][col] === 0;
  }

  countOpenCardinalNeighbors(row, col) {
    let count = 0;
    if (this.isWalkableTile(row - 1, col)) count++;
    if (this.isWalkableTile(row + 1, col)) count++;
    if (this.isWalkableTile(row, col - 1)) count++;
    if (this.isWalkableTile(row, col + 1)) count++;
    return count;
  }

  buildReachableTileMaskFromPlayer() {
    const tileTotal = MAP_TILE_COUNT * MAP_TILE_COUNT;
    const mask = new Uint8Array(tileTotal);

    const startCol = Math.floor(this.player.posX);
    const startRow = Math.floor(this.player.posY);
    if (!this.isWalkableTile(startRow, startCol)) {
      return mask;
    }

    const queue = [{ row: startRow, col: startCol }];
    mask[startRow * MAP_TILE_COUNT + startCol] = 1;

    for (let head = 0; head < queue.length; head++) {
      const tile = queue[head];

      const neighbors = [
        { row: tile.row - 1, col: tile.col },
        { row: tile.row + 1, col: tile.col },
        { row: tile.row, col: tile.col - 1 },
        { row: tile.row, col: tile.col + 1 },
      ];

      for (const next of neighbors) {
        if (!this.isWalkableTile(next.row, next.col)) continue;

        const idx = next.row * MAP_TILE_COUNT + next.col;
        if (mask[idx] === 1) continue;

        mask[idx] = 1;
        queue.push(next);
      }
    }

    return mask;
  }

  findFreeWorldSpot(minDistanceFromPlayer = 2.8) {
    for (let attempt = 0; attempt < 90; attempt++) {
      const col = Math.floor(Math.random() * (MAP_TILE_COUNT - 4)) + 2;
      const row = Math.floor(Math.random() * (MAP_TILE_COUNT - 4)) + 2;
      if (!this.isWalkableTile(row, col)) continue;

      const x = col + 0.5;
      const y = row + 0.5;

      if (Math.hypot(x - this.player.posX, y - this.player.posY) < minDistanceFromPlayer) continue;
      if (this.orbs.some((orb) => Math.hypot(x - orb.posX, y - orb.posY) < 1.2)) continue;
      if (this.worldModules.some((wm) => Math.hypot(x - wm.posX, y - wm.posY) < 1.4)) continue;
      if (this.missionBeacons.some((beacon) => !beacon.activated && Math.hypot(x - beacon.posX, y - beacon.posY) < 1.5)) continue;
      if (this.extractionPortal && Math.hypot(x - this.extractionPortal.posX, y - this.extractionPortal.posY) < 1.8) continue;
      if (this.punchMachine && Math.hypot(x - this.punchMachine.posX, y - this.punchMachine.posY) < 1.7) continue;

      return { x, y };
    }
    return null;
  }

  isAegisActive() {
    return millis() < this.activeAegisUntilMs;
  }

  isChronoActive() {
    return millis() < this.activeChronoUntilMs;
  }

  advanceCorruption() {
    if (this.isChronoActive()) return;

    const elapsed = this.survivalSeconds();
    if (elapsed < CORRUPTION_START_DELAY_SECONDS) return;

    const timeSinceLast = elapsed - this.lastCorruptionTime;
    if (this.lastCorruptionTime === 0) {
      this.lastCorruptionTime = elapsed;
      return;
    }

    if (timeSinceLast >= CORRUPTION_INTERVAL_SECONDS) {
      this.lastCorruptionTime = elapsed;
      this.corruptionLayer++;
      this.applyCorruptionLayer(this.corruptionLayer);
      this.addScreenShake(4, 300);
    }
  }

  applyCorruptionLayer(layer) {
    const lo = layer;
    const hi = MAP_TILE_COUNT - 1 - layer;
    if (lo >= hi) {
      this.triggerGameOver("The corruption consumed the entire arena.");
      return;
    }

    const queued = [];
    const seen = new Set();
    const enqueue = (row, col) => {
      const key = `${row}:${col}`;
      if (seen.has(key)) return;
      seen.add(key);
      queued.push({ row, col });
    };

    for (let col = lo; col <= hi; col++) {
      enqueue(lo, col);
      enqueue(hi, col);
    }
    for (let row = lo; row <= hi; row++) {
      enqueue(row, lo);
      enqueue(row, hi);
    }

    for (let i = queued.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = queued[i];
      queued[i] = queued[j];
      queued[j] = tmp;
    }

    this.pendingCorruptionTiles.push(...queued);
  }

  applyPendingCorruptionStep() {
    if (this.pendingCorruptionTiles.length === 0) return;

    const count = Math.min(CORRUPTION_TILES_PER_FRAME, this.pendingCorruptionTiles.length);
    for (let i = 0; i < count; i++) {
      const tile = this.pendingCorruptionTiles.pop();
      if (!tile) break;

      const row = tile.row;
      const col = tile.col;
      if (row <= 0 || row >= MAP_TILE_COUNT - 1 || col <= 0 || col >= MAP_TILE_COUNT - 1) continue;
      if (worldTileMap[row][col] === 0) {
        worldTileMap[row][col] = 6;
      }
    }
  }

  handleMissionCollisions() {
    for (const beacon of this.missionBeacons) {
      if (beacon.activated) continue;

      const dx = this.player.posX - beacon.posX;
      const dy = this.player.posY - beacon.posY;
      const distSq = dx * dx + dy * dy;
      const combinedR = this.player.radius + beacon.radius;
      if (distSq > combinedR * combinedR) continue;

      beacon.activated = true;
      this.beaconsActivated += 1;
      this.score += MISSION_BEACON_SCORE_BONUS;
      this.recoverAmmo(MISSION_BEACON_AMMO_RECOVERY, "Balise synchronisÃ©e", [120, 245, 210]);
      this.spawnCollectParticles(beacon.posX, beacon.posY, [120, 245, 210]);
      this.addScreenShake(2.4, 180);

      const totalBeacons = this.missionBeacons.length;
      if (this.beaconsActivated < totalBeacons) {
        this.pushHudToast(`Balise ${this.beaconsActivated}/${totalBeacons} activÃ©e`, [135, 250, 220]);
      } else {
        this.score += EXTRACTION_PORTAL_SCORE_BONUS;
        this.spawnExtractionPortal();
      }
    }

    if (!this.extractionPortal) return;

    const dx = this.player.posX - this.extractionPortal.posX;
    const dy = this.player.posY - this.extractionPortal.posY;
    const distSq = dx * dx + dy * dy;
    const combinedR = this.player.radius + this.extractionPortal.radius;
    if (distSq <= combinedR * combinedR) {
      this.triggerVictory("Toutes les balises sont sÃ©curisÃ©es. Extraction rÃ©ussie.");
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].isDead()) this.particles.splice(i, 1);
    }
  }

  spawnCollectParticles(wx, wy, col) {
    for (let i = 0; i < 10; i++) {
      this.particles.push(new Particle(wx, wy, col));
    }
  }

  addScreenShake(intensity, durationMs) {
    this.shakeIntensity = intensity;
    this.shakeDuration = durationMs;
    this.shakeStartMs = millis();
  }

  currentShakeOffset() {
    if (this.shakeIntensity === 0) return { x: 0, y: 0 };
    const elapsed = millis() - this.shakeStartMs;
    if (elapsed > this.shakeDuration) { this.shakeIntensity = 0; return { x: 0, y: 0 }; }
    const factor = 1 - elapsed / this.shakeDuration;
    return {
      x: (Math.random() - 0.5) * 2 * this.shakeIntensity * factor,
      y: (Math.random() - 0.5) * 2 * this.shakeIntensity * factor,
    };
  }

  cameraScreenOffsetPx() {
    return this.player.cameraVerticalOffsetPx();
  }

  updateMotionBlurState(dt) {
    if (!this.motionBlurEnabled) return;

    if (this.gameState !== "playing") {
      this.motionBlurAmount = lerp(this.motionBlurAmount, 0, 0.15);
      this.syncMotionBlurReference();
      return;
    }

    const safeDt = Math.max(dt, 0.0001);
    const dx = this.player.posX - this.prevPlayerPosX;
    const dy = this.player.posY - this.prevPlayerPosY;
    const moveSpeed = Math.hypot(dx, dy) / safeDt;

    const rawAngle = this.player.angle - this.prevPlayerAngle;
    const wrappedAngle = Math.atan2(Math.sin(rawAngle), Math.cos(rawAngle));
    const turnSpeed = Math.abs(wrappedAngle) / safeDt;

    const target = constrain(
      moveSpeed * MOTION_BLUR_MOVE_FACTOR + turnSpeed * MOTION_BLUR_TURN_FACTOR,
      0,
      1
    );

    this.motionBlurAmount = lerp(this.motionBlurAmount, target, MOTION_BLUR_SMOOTHING);
    this.syncMotionBlurReference();
  }
}


window.PRELOADED_ZOMBIE_SKIN_IMAGE = null;
window.PRELOADED_ZOMBIE_SPRITESHEET_IMAGE = null;

function preloadZombieSkinTexture() {
  const zombieSpriteSheetPath =
    (typeof window !== "undefined" && typeof window.EMBEDDED_ZOMBIE_WALK_DATA_URI === "string")
      ? window.EMBEDDED_ZOMBIE_WALK_DATA_URI
      : ZOMBIE_SPRITESHEET_PATH;

  const zombieSkinPath =
    (typeof window !== "undefined" && typeof window.EMBEDDED_ZOMBIE_SKIN_DATA_URI === "string")
      ? window.EMBEDDED_ZOMBIE_SKIN_DATA_URI
      : "assets/textures/zombie.png";

  window.PRELOADED_ZOMBIE_SPRITESHEET_IMAGE = loadImage(
    zombieSpriteSheetPath,
    undefined,
    () => { window.PRELOADED_ZOMBIE_SPRITESHEET_IMAGE = null; }
  );

  window.PRELOADED_ZOMBIE_SKIN_IMAGE = loadImage(
    zombieSkinPath,
    undefined,
    () => {
      window.PRELOADED_ZOMBIE_SKIN_IMAGE = null;
      console.warn("Zombie skin texture failed to load:", zombieSkinPath);
    }
  );
}
