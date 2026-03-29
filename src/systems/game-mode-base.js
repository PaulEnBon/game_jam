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

  // Écran d'entre-vague
  drawInterWaveScreen() { // This method is called by GameManager.renderFrame()
    // On ne nettoie plus le background ici car mode.render() vient de dessiner le monde
    fill(0, 0, 0, 180); // Overlay un peu plus sombre
    rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(42);
    text("PREPARE FOR THE NEXT LEVEL", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);

    textSize(20);
    fill(255, 215, 0);
    text(`Or actuel : ${this.gameManager.gold}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 100);

    textSize(16);
    fill(180, 220, 255);
    text("Préparez-vous !", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 150);

    this.drawHUD(); // Affiche le HUD même pendant l'entre-vague
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

  drawProximityAlert() {
    let minDist = 999;
    for (const orb of this.gameManager.orbs) {
      if (!orb.isHunter()) continue;
      const d = Math.hypot(orb.posX - this.gameManager.player.posX, orb.posY - this.gameManager.player.posY);
      if (d < minDist) minDist = d;
    }

    if (minDist > 8) return;

    push();
    noFill();
    // Intensité basée sur la distance (plus proche = plus opaque)
    const alpha = minDist < 4 ? 120 : map(minDist, 4, 8, 120, 0);
    
    if (minDist < 4) {
      stroke(255, 0, 0, alpha); // Rouge
    } else {
      stroke(255, 140, 0, alpha); // Orange
    }
    
    strokeWeight(40);
    rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    pop();
  }

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

    // Upcoming spawns (orange dots)
    noStroke();
    const upcoming = this.gameManager.upcomingSpawns;
    if (upcoming && Array.isArray(upcoming)) {
      for (let i = 0; i < upcoming.length; i++) {
        const spawn = upcoming[i];
        const timeUntilSpawn = spawn.actualSpawnTime - millis();
        const alpha = map(timeUntilSpawn, 0, this.gameManager.SPAWN_INDICATOR_DURATION_MS, 0, 255);
        if (alpha <= 0) continue;

        fill(255, 165, 0, alpha); // Orange, fading out
        circle(mmX + spawn.x * tilePixels, mmY + spawn.y * tilePixels, 8);
      }
    }

    noStroke();
    if (this.gameManager.punchMachine) {
      const mx = mmX + this.gameManager.punchMachine.posX * tilePixels;
      const my = mmY + this.gameManager.punchMachine.posY * tilePixels;
      fill(235, 120, 255);
      rect(mx - 4, my - 4, 8, 8, 1);
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

    // Gold
    fill(255, 215, 0);
    text(`GOLDS: ${this.gameManager.gold}`, hudX, hudY + lineHeight * 2);

    // Sprint energy bar
    const sprintBarY = hudY + lineHeight * 3.2;
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
    
    // Weapon ammo (center) - Magazine / Inventory
    textAlign(CENTER);
    textSize(16);
    const now = millis();
    const isReloading = now < this.gameManager.weaponReloadingUntilMs;
    fill(isReloading ? 255 : 255, isReloading ? 165 : 220, isReloading ? 100 : 110);
    const maxMag = this.gameManager.getMaxMagazineSize();
    const maxInv = this.gameManager.getMaxInventoryAmmo();
    const ammoText = `MAG: ${this.gameManager.weaponMagazineAmmo}/${maxMag}  |  ${this.gameManager.weaponInventoryAmmo}/${maxInv}`;
    text(ammoText, centerX, bottomY);
    
    // Reload indicator
    if (isReloading) {
      textSize(12);
      fill(200, 200, 50);
      const reloadProgress = 1 - ((this.gameManager.weaponReloadingUntilMs - now) / WEAPON_RELOAD_DURATION_MS);
      text(`RECHARGEMENT EN COURS... ${(reloadProgress * 100).toFixed(0)}%`, centerX, bottomY - 20);
    }

    // Inventory slots row (centered below ammo)
    textSize(13);
    fill(255);
    const slotSpacing = 140;
    
    // Slot 1: Pistol
    const slot1X = centerX - slotSpacing;
    this.drawHUDSlot(slot1X, bottomY + 10, "1", "PISTOL", 1);

    // Slot 2: Bombs
    const slot2X = centerX - slotSpacing / 2;
    this.drawHUDSlot(slot2X, bottomY + 10, "2", `BOMB x${this.gameManager.inventory.bomb}`, 2);

    // Slot 3: Pulse Cores
    const slot3X = centerX + slotSpacing / 2;
    this.drawHUDSlot(slot3X, bottomY + 10, "3", `PULSE x${this.gameManager.inventory.pulseCore}`, 3);

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

    // --- Affichage du prix de la Punch Machine (Hint) ---
    if (this.gameManager.punchMachine) {
      const dist = Math.hypot(this.gameManager.player.posX - this.gameManager.punchMachine.posX, this.gameManager.player.posY - this.gameManager.punchMachine.posY);
      if (dist < 3.5) {
        const price = this.gameManager.punchMachinePrice;
        fill(225, 185, 255);
        textAlign(CENTER);
        textSize(18);
        text(`[Q] AMELIORER L'ARME : ${price} G`, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 160);
      }
    }

    // --- Stats de l'arme en bas à droite ---
    textAlign(RIGHT);
    fill(255);
    textSize(16);
    const currentDmg = Math.floor(this.gameManager.currentWeaponDamage());
    text(`ARME NIV. ${this.gameManager.weaponLevel}`, SCREEN_WIDTH - 20, SCREEN_HEIGHT - 45);
    fill(255, 200, 100);
    text(`DEGATS: ${currentDmg}`, SCREEN_WIDTH - 20, SCREEN_HEIGHT - 25);

    pop();

    // Affichage du timer d'entre-vague si actif
    if (this.gameManager.gameState === "inter-wave") {
      const timeRemaining = Math.max(0, (this.gameManager.interWaveUntilMs - millis()) / 1000);
      textAlign(CENTER);
      textSize(24);
      fill(255, 255, 100);
      text(`Prochaine vague dans : ${timeRemaining.toFixed(1)}s`, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 200);
    }

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
    rect(x, y, 35, 30);
    
    fill(isSelected ? [50, 50, 50] : [30, 30, 30]);
    textAlign(CENTER);
    textSize(14);
    text(slotNumber, x + 17, y + 20);
    
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
