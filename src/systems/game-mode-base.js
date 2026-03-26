/*
  ============================================================
  GAME MODE BASE CLASS
  ============================================================
  Abstract class for 2D and 3D render pipeline separation.
  Contains common render drawing methods shared by both modes.
*/

class GameModeBase {
  constructor(gameManager) {
    this.gameManager = gameManager;
  }

  /**
   * Called when mode is activated
   */
  onActivate() {}

  /**
   * Called when mode is deactivated
   */
  onDeactivate() {}

  /**
   * Main render pipeline - must be implemented by subclass
   */
  render() {
    throw new Error("render() must be implemented by subclass");
  }

  /**
   * Get render mode status
   */
  getStatus() {
    return {
      mode: "unknown",
      description: "Base mode class (should not be used directly)"
    };
  }

  // =========== COMMON OVERLAY DRAWING ===========
  // These are shared between 2D and 3D modes

  drawVignette() {
    push();
    noFill();
    stroke(0, 0, 0, 100);
    strokeWeight(80);
    rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    pop();
  }

  drawMinimap() {
    // Taille réduite - prend jusqu'à 40% de l'écran
    const mmSize = Math.floor(Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.40);
    const mmX = SCREEN_WIDTH - mmSize - 14;
    const mmY = 10;  // En haut à droite
    const mapWidth = this.gameManager.mapWidth;
    const mapHeight = this.gameManager.mapHeight;
    const tilePixels = mmSize / mapWidth;

    push();
    fill(0, 0, 0, 220);
    stroke(80, 80, 80, 255);
    strokeWeight(3);
    rect(mmX, mmY, mmSize, mmSize, 6);

    // Tiles - avec contour pour mieux les voir
    for (let row = 0; row < mapHeight; row++) {
      for (let col = 0; col < mapWidth; col++) {
        const t = worldTileMap[row][col];
        if (t === 0) continue;
        switch (t) {
          case 1: fill(130, 130, 130, 230); break;
          case 2: fill(134, 96, 67, 230); break;
          case 3: fill(76, 155, 60, 230); break;
          case 4: fill(90, 130, 90, 230); break;
          case 5: fill(220, 195, 100, 230); break;
          case 6: fill(220, 30, 30, 240); break;
          case 7: fill(150, 108, 74, 230); break;
          case 8: fill(90, 205, 235, 240); break;
          case 9: fill(150, 82, 72, 240); break;
          case 10: fill(255, 155, 215, 240); break;
          case 11: fill(150, 210, 255, 240); break;
          case 12: fill(100, 100, 120, 220); break;
          default: fill(100, 100, 100, 230);
        }
        stroke(40, 40, 40, 100);  // Petit contour sombre pour séparation
        strokeWeight(0.5);
        rect(mmX + col * tilePixels, mmY + row * tilePixels, tilePixels, tilePixels);
      }
    }

    // Orbs / enemies (colour reflects state)
    noStroke();
    for (const orb of this.gameManager.orbs) {
      let col;
      if (orb.isSafe())          col = color(80, 255, 120);
      else if (orb.isWarning())  col = color(255, 180, 40);
      else if (orb.isChasing())  col = color(255, 50, 50);
      else                       col = color(180, 70, 70);
      fill(col);
      const ox = mmX + orb.posX * tilePixels;
      const oy = mmY + orb.posY * tilePixels;
      circle(ox, oy, 10);
    }

    // World modules
    noStroke();
    for (const wm of this.gameManager.worldModules) {
      if (wm.type === "aegis") fill(90, 230, 255);
      else if (wm.type === "emp") fill(170, 240, 255);
      else fill(200, 130, 255);
      const mx = mmX + wm.posX * tilePixels;
      const my = mmY + wm.posY * tilePixels;
      rect(mx - 4, my - 4, 8, 8, 1);
    }

    // Drops
    noStroke();
    for (const drop of this.gameManager.drops) {
      if (drop.type === "ammo") fill(255, 220, 110);
      else if (drop.type === "score") fill(255, 255, 140);
      else if (drop.type === "pulse") fill(220, 170, 255);
      else if (drop.type === "rounds") fill(255, 175, 105);
      else fill(170, 225, 255);
      const dx = mmX + drop.posX * tilePixels;
      const dy = mmY + drop.posY * tilePixels;
      circle(dx, dy, 6);
    }

    // Punch Machine
    noStroke();
    if (this.gameManager.punchMachine) {
      const mx = mmX + this.gameManager.punchMachine.posX * tilePixels;
      const my = mmY + this.gameManager.punchMachine.posY * tilePixels;
      fill(235, 120, 255);
      rect(mx - 4, my - 4, 8, 8, 1);
    }

    // Player
    noStroke();
    const px = mmX + this.gameManager.player.posX * tilePixels;
    const py = mmY + this.gameManager.player.posY * tilePixels;
    fill(100, 180, 255);
    circle(px, py, 10);

    // Direction arrow
    stroke(100, 180, 255);
    strokeWeight(2);
    const arrowLen = 15;
    line(px, py, px + Math.cos(this.gameManager.player.angle) * arrowLen, py + Math.sin(this.gameManager.player.angle) * arrowLen);

    pop();
  }

  drawHUD() {
    push();
    fill(255);
    textSize(13);
    textFont("Courier New");

    // Top-left HUD (wave, score, etc)
    const hudX = 12;
    const hudY = 18;
    const lineHeight = 16;

    textAlign(LEFT);

    // Wave info
    const waveText = `WAVE ${this.gameManager.waveNumber} | Enemies: ${this.gameManager.waveEnemiesKilled}/${this.gameManager.waveEnemiesTotal}`;
    text(waveText, hudX, hudY);

    // Score
    const scoreText = `SCORE: ${Math.floor(this.gameManager.score)}`;
    text(scoreText, hudX, hudY + lineHeight);

    // Sprint energy bar
    const sprintBarY = hudY + lineHeight * 2.2;
    const sprintBarWidth = 120;
    const sprintBarHeight = 10;
    fill(80, 80, 80);
    rect(hudX, sprintBarY, sprintBarWidth, sprintBarHeight);
    fill(100, 200, 255);
    rect(hudX, sprintBarY, (this.gameManager.sprintEnergy / SPRINT_ENERGY_MAX) * sprintBarWidth, sprintBarHeight);
    fill(255);
    text("SPRINT", hudX, sprintBarY - 4);

    // Powerup timers
    const powerupY = sprintBarY + 24;
    if (this.gameManager.isDamageBoostActive()) {
      const timeLeft = Math.ceil((this.gameManager.powerDamageUntilMs - millis()) / 1000);
      fill(255, 170, 120);
      text(`DAMAGE ${timeLeft}s`, hudX, powerupY);
    } else if (this.gameManager.isRapidFireActive()) {
      const timeLeft = Math.ceil((this.gameManager.powerRapidUntilMs - millis()) / 1000);
      fill(255, 240, 140);
      text(`RAPID ${timeLeft}s`, hudX, powerupY);
    } else if (this.gameManager.isInstakillActive()) {
      const timeLeft = Math.ceil((this.gameManager.powerInstakillUntilMs - millis()) / 1000);
      fill(255, 110, 110);
      text(`INSTAKILL ${timeLeft}s`, hudX, powerupY);
    }

    // Active shield (Aegis)
    if (this.gameManager.isAegisActive()) {
      const timeLeft = Math.ceil((this.gameManager.activeAegisUntilMs - millis()) / 1000);
      fill(110, 230, 255);
      text(`SHIELD ${timeLeft}s`, hudX, powerupY + 16);
    }

    // Time dilation (Chrono)
    if (this.gameManager.isChronoActive()) {
      const timeLeft = Math.ceil((this.gameManager.activeChronoUntilMs - millis()) / 1000);
      fill(190, 140, 255);
      text(`SLOW TIME ${timeLeft}s`, hudX, powerupY + (this.gameManager.isAegisActive() ? 32 : 16));
    }

    // ===== CENTER-BOTTOM HUD: AMMO AND INVENTORY =====
    const centerX = SCREEN_WIDTH / 2;
    const bottomY = SCREEN_HEIGHT - 80;
    
    // Weapon ammo (center)
    textAlign(CENTER);
    textSize(16);
    fill(255, 220, 110);
    const ammoText = `AMMO: ${this.gameManager.weaponAmmo}/${WEAPON_MAX_AMMO}`;
    text(ammoText, centerX, bottomY);

    // Inventory slots row (centered below ammo)
    textSize(13);
    fill(255);
    const slotSpacing = 140;
    
    // Slot 1: Ammo Packs
    const slot1X = centerX - slotSpacing;
    this.drawHUDSlot(slot1X, bottomY + 20, "1", `AMMO x${this.gameManager.inventory.ammoPack}`, 1);

    // Slot 2: Score Shards  
    const slot2X = centerX - slotSpacing / 2;
    this.drawHUDSlot(slot2X, bottomY + 20, "2", `SCORE x${this.gameManager.inventory.scoreShard}`, 2);

    // Slot 3: Pulse Cores
    const slot3X = centerX + slotSpacing / 2;
    this.drawHUDSlot(slot3X, bottomY + 20, "3", `PULSE x${this.gameManager.inventory.pulseCore}`, 3);

    // Survival time (top-right)
    const survivalSeconds = Math.floor(this.gameManager.survivalSeconds());
    const minutes = Math.floor(survivalSeconds / 60);
    const seconds = survivalSeconds % 60;
    const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
    textAlign(RIGHT);
    textSize(13);
    fill(255);
    text(timeStr, SCREEN_WIDTH - 12, hudY);

    // Toast notification
    if (this.gameManager.hudToastText && millis() < this.gameManager.hudToastUntilMs) {
      const toastX = SCREEN_WIDTH / 2;
      const toastY = SCREEN_HEIGHT - 120;
      fill(...this.gameManager.hudToastColor, 200);
      textAlign(CENTER);
      textSize(14);
      text(this.gameManager.hudToastText, toastX, toastY);
    }

    pop();
  }

  drawHUDSlot(x, y, slotNumber, label, slotId) {
    push();
    const isSelected = this.gameManager.selectedHotbarSlot === slotId;
    
    if (isSelected) {
      fill(200, 255, 200);
      stroke(100, 255, 100);
    } else {
      fill(150, 150, 150);
      stroke(100, 100, 100);
    }
    
    strokeWeight(1);
    rect(x, y, 22, 20);
    
    fill(isSelected ? [50, 50, 50] : [30, 30, 30]);
    textAlign(CENTER);
    textSize(10);
    text(slotNumber, x + 11, y + 14);
    
    fill(255);
    textAlign(LEFT);
    textSize(10);
    text(label, x + 28, y + 14);
    
    pop();
  }

  drawCrosshair() {
    push();
    stroke(100, 200, 100, 150);
    strokeWeight(1.2);
    
    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2;
    const size = 8;
    
    line(cx - size, cy, cx + size, cy);
    line(cx, cy - size, cx, cy + size);
    
    // Small central dot
    fill(100, 200, 100, 180);
    noStroke();
    circle(cx, cy, 2);
    
    pop();
  }

  drawControlLegend() {
    if (!this.gameManager.controlLegendEl) return;
    this.gameManager.controlLegendEl.textContent = getMovementLegendText();
  }
}
