

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
      this.pushHudToast("Ammo pack utilisé", [255, 225, 130]);
    } else if (itemKey === "scoreShard") {
      this.score += MOB_DROP_SCORE_GAIN;
      this.spawnCollectParticles(this.player.posX, this.player.posY, [255, 255, 150]);
      this.pushHudToast("Score shard utilisé", [255, 255, 170]);
    } else if (itemKey === "pulseCore") {
      const fakeModule = { type: this.randomModuleType(), posX: this.player.posX, posY: this.player.posY };
      this.activateWorldModule(fakeModule);
      this.spawnCollectParticles(this.player.posX, this.player.posY, [220, 180, 255]);
      this.pushHudToast("Pulse core activé", [220, 180, 255]);
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
      this.recoverAmmo(KILL_STREAK_AMMO_BONUS, "Bonus série", [255, 200, 130]);
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
    this.pushHudToast(`Vague ${this.waveNumber} nettoyée`, [145, 230, 255]);
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
      this.pushHudToast(`Punch Machine verrouillée (vague ${PUNCH_MACHINE_UNLOCK_WAVE})`, [255, 160, 160]);
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

    this.recoverAmmo(WORLD_MODULE_AMMO_RECOVERY, "Module recyclé en munitions", [150, 230, 255]);
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
        const gained = this.recoverAmmo(MOB_DROP_ROUNDS_GAIN, "Munitions récupérées", [255, 210, 130]);
        if (gained <= 0) {
          this.pushHudToast("Ammo déjà max", [255, 170, 170]);
        }
        this.spawnCollectParticles(drop.posX, drop.posY, [255, 205, 130]);
      } else if (drop.type === "crate") {
        const ammoPackAdded = this.addInventoryItem("ammoPack", 1);
        const scoreShardAdded = this.addInventoryItem("scoreShard", 1);
        const directAmmo = this.recoverAmmo(MOB_DROP_CRATE_BONUS_AMMO);

        if (ammoPackAdded > 0 || scoreShardAdded > 0 || directAmmo > 0) {
          this.pushHudToast("Caisse tactique récupérée", [170, 225, 255]);
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
}
