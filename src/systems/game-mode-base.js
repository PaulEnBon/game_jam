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
    // Bottom-left HUD position
    const mapSize = 110;
    const mapX = 10;
    const mapY = SCREEN_HEIGHT - mapSize - 10;

    push();
    fill(20, 20, 30, 200);
    stroke(100, 150, 200, 180);
    strokeWeight(2);
    rect(mapX, mapY, mapSize, mapSize);

    // Scale and offset for world-to-minimap transform
    const scale = mapSize / MAP_TILE_COUNT;

    // Draw world tiles (corrupted in red, walkable in dark green)
    for (let row = 0; row < MAP_TILE_COUNT; row++) {
      for (let col = 0; col < MAP_TILE_COUNT; col++) {
        const tileType = worldTileMap[row][col];
        const px = mapX + col * scale;
        const py = mapY + row * scale;

        if (tileType === 0) {
          fill(30, 80, 30, 128);  // Walkable
        } else if (tileType === 6) {
          fill(180, 30, 30, 160);  // Corruption
        } else {
          fill(60, 60, 80, 120);  // Walls/obstacles
        }
        noStroke();
        rect(px, py, scale + 0.5, scale + 0.5);
      }
    }

    // Draw player (blue dot) and rotation direction
    const playerMapX = mapX + this.gameManager.player.posX * scale;
    const playerMapY = mapY + this.gameManager.player.posY * scale;

    fill(100, 180, 255);
    circle(playerMapX, playerMapY, 5);

    const dirX = Math.cos(this.gameManager.player.angle) * 8;
    const dirY = Math.sin(this.gameManager.player.angle) * 8;
    stroke(100, 180, 255);
    strokeWeight(1.5);
    line(playerMapX, playerMapY, playerMapX + dirX, playerMapY + dirY);

    // Draw orbs (enemies) in yellow/red
    for (const orb of this.gameManager.orbs) {
      const orbMapX = mapX + orb.posX * scale;
      const orbMapY = mapY + orb.posY * scale;
      fill(orb.isSafe() ? [255, 220, 60] : [255, 80, 80]);
      noStroke();
      circle(orbMapX, orbMapY, 3);
    }

    // Draw objective (nearest beacon or extraction portal)
    const objective = this.gameManager.getCurrentObjectiveTarget();
    if (objective) {
      const objX = mapX + objective.x * scale;
      const objY = mapY + objective.y * scale;
      noFill();
      stroke(150, 230, 255);
      strokeWeight(1.5);
      circle(objX, objY, 6);
    }

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
