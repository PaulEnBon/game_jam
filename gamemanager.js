

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
}

class GameManager {
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
}
