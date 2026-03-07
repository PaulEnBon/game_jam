/*
 - logique interface dans GameManager
*/

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
