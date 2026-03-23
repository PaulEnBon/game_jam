/*
  ============================================================
  GAME MANAGER CLASS
  ============================================================
  Central state machine that orchestrates :
    - Game lifecycle  (waiting → playing → game-over)
    - Orb spawning & corruption wave
    - Collision handling
    - Full render pipeline (sky, raycasting, sprites, overlays)
*/

class GameManager {
  constructor() {
    this.gameState = "waiting";  // "waiting" | "playing" | "game-over"
    this.player = new Player(MAP_TILE_COUNT / 2 + 0.5, MAP_TILE_COUNT / 2 + 0.5);
    this.orbs = [];
    this.particles = [];

    this.score = 0;
    this.finalScore = 0;
    this.gameOverReason = "";

    this.gameStartMs = 0;
    this.lastSpawnMs = 0;
    this.lastCorruptionTime = 0;
    this.corruptionLayer = 0;         // how many layers of border corruption

    // Screen shake
    this.shakeIntensity = 0;         // current shake in pixels
    this.shakeDuration = 0;
    this.shakeStartMs = 0;

    // DOM references (cached once)
    this.startOverlay     = null;
    this.gameOverOverlay  = null;
    this.finalScoreEl     = null;
    this.gameOverReasonEl = null;
    this.restartBtn       = null;
    this.openSettingsBtn  = null;
    this.settingsOverlay  = null;
    this.closeSettingsBtn = null;
    this.resetControlsBtn = null;
    this.settingsStatusEl = null;
    this.controlLegendEl  = null;
    this.bindButtons      = [];

    this.pendingRebindAction = null;
    this.pendingRebindButton = null;
    this.boundCaptureRebindKey = (event) => this.captureRebindKey(event);

    // z-buffer for sprite rendering (one entry per screen column)
    this.zBuffer = new Float32Array(SCREEN_WIDTH);
  }

  // ----------------------------------------------------------
  //  DOM wiring
  // ----------------------------------------------------------
  initDOM() {
    this.startOverlay     = document.getElementById("start-overlay");
    this.gameOverOverlay  = document.getElementById("game-over-overlay");
    this.finalScoreEl     = document.getElementById("final-score");
    this.gameOverReasonEl = document.getElementById("game-over-reason");
    this.restartBtn       = document.getElementById("restart-button");
    this.openSettingsBtn  = document.getElementById("open-settings-button");
    this.settingsOverlay  = document.getElementById("settings-overlay");
    this.closeSettingsBtn = document.getElementById("close-settings-button");
    this.resetControlsBtn = document.getElementById("reset-controls-button");
    this.settingsStatusEl = document.getElementById("settings-status");
    this.controlLegendEl  = document.getElementById("control-legend");
    this.bindButtons      = Array.from(document.querySelectorAll(".bind-button"));

    // Restart button
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
        this.setSettingsStatus("Touches réinitialisées.");
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

    // Click on start overlay → start
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

  requestPointerLock() {
    const cvs = document.querySelector("canvas");
    if (cvs && cvs.requestPointerLock) cvs.requestPointerLock();
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
    this.setSettingsStatus("Appuie sur une touche (Échap pour annuler).");

    window.addEventListener("keydown", this.boundCaptureRebindKey, true);
  }

  captureRebindKey(event) {
    if (!this.pendingRebindAction) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.code === "Escape") {
      this.cancelPendingRebind();
      this.setSettingsStatus("Modification annulée.");
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

  onViewportResize() {
    this.zBuffer = new Float32Array(SCREEN_WIDTH);
  }

  // ----------------------------------------------------------
  //  Game lifecycle
  // ----------------------------------------------------------
  startNewGame() {
    this.closeSettingsMenu();
    generateWorldMap();

    this.gameState = "playing";
    this.player.resetToSpawn();
    this.orbs = [];
    this.particles = [];
    this.score = 0;
    this.finalScore = 0;
    this.gameOverReason = "";
    this.corruptionLayer = 0;
    this.lastCorruptionTime = 0;
    this.gameStartMs = millis();
    this.lastSpawnMs = millis();
    this.shakeIntensity = 0;

    // Spawn a few starting orbs
    for (let i = 0; i < 5; i++) this.spawnOrb();

    // Hide overlays
    if (this.startOverlay) this.startOverlay.style.display = "none";
    if (this.gameOverOverlay) {
      this.gameOverOverlay.classList.remove("visible");
      this.gameOverOverlay.setAttribute("aria-hidden", "true");
    }

    this.requestPointerLock();
  }

  triggerGameOver(reason) {
    if (this.gameState !== "playing") return;
    this.gameState = "game-over";
    this.finalScore = Math.floor(this.score);
    this.gameOverReason = reason;

    // Release pointer lock
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

  // ----------------------------------------------------------
  //  Main frame
  // ----------------------------------------------------------
  runFrame() {
    const dt = min(deltaTime / 1000, 0.05);

    if (this.gameState === "playing") {
      this.updateGame(dt);
    }

    this.renderFrame();
  }

  // ----------------------------------------------------------
  //  UPDATE
  // ----------------------------------------------------------
  updateGame(dt) {
    this.player.update(dt);
    this.spawnOrbsIfNeeded();
    this.advanceCorruption();
    this.updateOrbs(dt);
    this.updateParticles(dt);
    this.handleCollisions();
    this.score += SURVIVAL_POINTS_PER_SECOND * dt;
  }

  // --- Orb spawning ---
  spawnOrbsIfNeeded() {
    const now = millis();
    const elapsed = this.survivalSeconds();
    const interval = max(ORB_SPAWN_INTERVAL_MIN_MS, ORB_SPAWN_INTERVAL_INITIAL_MS - elapsed * ORB_SPAWN_ACCEL_MS_PER_SEC);
    while (now - this.lastSpawnMs >= interval) {
      this.spawnOrb();
      this.lastSpawnMs += interval;
    }
  }

  spawnOrb() {
    // Find a random empty tile that isn't the player's tile
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

  // --- Corruption (arena shrink) ---
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

  /**
   * Fills a ring of tiles at distance `layer` from the border with corruption (type 6).
   * Layer 1 = the row/col just inside existing border, etc.
   */
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

  // --- Entity updates ---
  updateOrbs(dt) {
    for (const orb of this.orbs) orb.update(dt, this.player);
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].isDead()) this.particles.splice(i, 1);
    }
  }

  // --- Collisions ---
  handleCollisions() {
    // Player vs corruption / wall overlap check
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
          this.triggerGameOver("You touched the corruption wall!");
          return;
        }
      }
    }

    // Player vs orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      const dx = this.player.posX - orb.posX;
      const dy = this.player.posY - orb.posY;
      const distSq = dx * dx + dy * dy;
      const combinedR = this.player.radius + orb.radius;

      if (distSq <= combinedR * combinedR) {
        if (orb.isSafe()) {
          // Normal collect
          this.score += ORB_COLLECT_BONUS;
          this.spawnCollectParticles(orb.posX, orb.posY, [92, 255, 145]);
          this.orbs.splice(i, 1);
        } else if (orb.isWarning()) {
          // Risky grab during warning phase — double bonus!
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

  // --- Screen shake helper ---
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

  // ----------------------------------------------------------
  //  RENDER
  // ----------------------------------------------------------
  renderFrame() {
    /*
      PERFORMANCE-CRITICAL RENDER PIPELINE
      ====================================
      Steps :
        1. Draw sky & floor with two fast rect() calls.
        2. loadPixels()  — copy the canvas into the pixels[] typed array.
        3. castAllRays()  — write textured wall columns into pixels[].
        4. drawSpritesToBuffer() — write sprites into pixels[].
        5. updatePixels() — push the modified array back to the canvas. (1 call!)
        6. Draw lightweight overlays (vignette, minimap, HUD) with normal p5 shapes.
    */
    this.drawSkyAndFloor();

    loadPixels();                // step 2
    this.castAllRays();          // step 3
    this.drawSpritesToBuffer();  // step 4
    updatePixels();              // step 5

    // Lightweight overlay draws
    const shake = this.currentShakeOffset();
    push();
    translate(shake.x, shake.y);
    this.drawVignette();
    this.drawMinimap();
    this.drawHUD();
    this.drawCrosshair();
    pop();
  }

  // --- Sky & Floor ---
  drawSkyAndFloor() {
    /*
      Day / Night cycle:
      Smoothly interpolate sky colour from daytime blue to midnight dark-blue.
      A full cycle takes ~90 seconds.
    */
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

  // --- Raycasting core (DDA algorithm) ---
  castAllRays() {
    /*
      For each screen column we cast one ray using the DDA
      (Digital Differential Analyser) algorithm.  When we hit
      a wall we compute perpendicular distance for correct
      projection and sample the texture column.
    */
    const halfFOV = FIELD_OF_VIEW_RADIANS / 2;

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
      const drawStart = Math.floor((SCREEN_HEIGHT - wallStripHeight) / 2);

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

  /**
   * Draws one vertical textured wall column directly into the canvas pixels[] array.
   * @param {Uint8ClampedArray} texPixels — pre-cached RGBA pixel data of the block texture
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

  // --- Sprite rendering into pixel buffer (orbs, enemies, particles) ---
  drawSpritesToBuffer() {
    const allSprites = [];

    for (const orb of this.orbs) {
      const dist = Math.hypot(orb.posX - this.player.posX, orb.posY - this.player.posY);
      // Determine sprite visual type from orb state
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

    // Sort back-to-front
    allSprites.sort((a, b) => b.dist - a.dist);

    for (const sp of allSprites) {
      this.drawSingleSpriteToBuffer(sp);
    }
  }

  /**
   * Draws a single sprite directly into the pixels[] buffer.
   * Billboard projection with z-buffer occlusion.
   */
  drawSingleSpriteToBuffer(spriteData) {
    const relX = spriteData.x - this.player.posX;
    const relY = spriteData.y - this.player.posY;

    // Camera-space transform aligned with raycaster forward vector:
    // forward = (cos(angle), sin(angle))
    // right   = (-sin(angle), cos(angle))
    const cosA = Math.cos(this.player.angle);
    const sinA = Math.sin(this.player.angle);
    const transformX = -relX * sinA + relY * cosA; // horizontal offset (right axis)
    const transformY =  relX * cosA + relY * sinA; // depth (forward axis)

    if (transformY <= 0.1) return;

    const fovScale = SCREEN_WIDTH / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
    const spriteScreenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;

    let worldSize = 0.6;
    if (spriteData.type === "particle") worldSize = 0.15;
    if (spriteData.type === "patrol" || spriteData.type === "chase") worldSize = 0.75;
    if (spriteData.type === "warning") worldSize = 0.65;  // slightly bigger during warning
    const spriteScreenSize = Math.abs((worldSize / transformY) * fovScale);

    const drawStartX = Math.max(0, Math.floor(spriteScreenX - spriteScreenSize / 2));
    const drawEndX   = Math.min(SCREEN_WIDTH, Math.floor(spriteScreenX + spriteScreenSize / 2));
    const drawStartY = Math.max(0, Math.floor(SCREEN_HEIGHT / 2 - spriteScreenSize / 2));
    const drawEndY   = Math.min(SCREEN_HEIGHT, Math.floor(SCREEN_HEIGHT / 2 + spriteScreenSize / 2));

    const rawFog = constrain(1 - (spriteData.dist / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
    const fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);

    let baseR, baseG, baseB, baseA = 255;
    if (spriteData.type === "safe") {
      // Gentle green pulse
      const pulse = 0.7 + 0.3 * Math.sin(millis() * 0.006);
      baseR = 60 * pulse;
      baseG = 255 * pulse;
      baseB = 100 * pulse;
      const mp = spriteData.obj.mutationProgress();
      // Slowly tint toward orange as mutation approaches
      baseR = lerp(baseR, 255, mp * 0.5);
      baseG = lerp(baseG, 180, mp * 0.3);
    } else if (spriteData.type === "warning") {
      // Fast flashing orange → red — unmistakable danger signal
      const wp = spriteData.obj.warningProgress();
      const flash = Math.sin(millis() * 0.025) > 0 ? 1 : 0.4;
      baseR = lerp(255, 255, wp) * flash;
      baseG = lerp(180, 40, wp) * flash;
      baseB = 30 * flash;
    } else if (spriteData.type === "patrol") {
      // Dim red — wandering, not yet aggressive
      const pulse = 0.6 + 0.15 * Math.sin(millis() * 0.005);
      baseR = 200 * pulse;
      baseG = 60 * pulse;
      baseB = 60 * pulse;
    } else if (spriteData.type === "chase") {
      // Bright pulsing red — actively chasing
      const pulse = 0.8 + 0.2 * Math.sin(millis() * 0.015);
      // Extra flash during charge attack
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
    const invAlpha  = 1 - alphaFrac;

    for (let sx = drawStartX; sx < drawEndX; sx++) {
      if (transformY >= this.zBuffer[sx]) continue;

      for (let sy = drawStartY; sy < drawEndY; sy++) {
        const fracX = (sx - drawStartX) * invSize - 0.5;
        const fracY = (sy - drawStartY) * invSize - 0.5;
        if (fracX * fracX + fracY * fracY > 0.2) continue;

        const dstIdx = 4 * (sy * SCREEN_WIDTH + sx);

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

  // --- Vignette overlay (torch light) ---
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

  // --- Minimap ---
  drawMinimap() {
    const mmSize = 140;
    const mmX = 10;
    const mmY = SCREEN_HEIGHT - mmSize - 10;
    const tilePixels = mmSize / MAP_TILE_COUNT;

    push();
    fill(0, 0, 0, 160);
    noStroke();
    rect(mmX, mmY, mmSize, mmSize, 4);

    // Tiles
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

    // Orbs / enemies (colour reflects state)
    for (const orb of this.orbs) {
      let col;
      if (orb.isSafe())          col = color(80, 255, 120);
      else if (orb.isWarning())  col = color(255, 180, 40);    // orange flash
      else if (orb.isChasing())  col = color(255, 50, 50);     // bright red
      else                       col = color(180, 70, 70);     // dim red patrol
      fill(col);
      const ox = mmX + orb.posX * tilePixels;
      const oy = mmY + orb.posY * tilePixels;
      circle(ox, oy, 3);
    }

    // Player
    const px = mmX + this.player.posX * tilePixels;
    const py = mmY + this.player.posY * tilePixels;
    fill(100, 180, 255);
    circle(px, py, 5);

    // Direction arrow
    stroke(100, 180, 255);
    strokeWeight(1.5);
    const arrowLen = 8;
    line(px, py, px + Math.cos(this.player.angle) * arrowLen, py + Math.sin(this.player.angle) * arrowLen);

    pop();
  }

  // --- HUD ---
  drawHUD() {
    push();
    textFont("Courier New");
    fill(230, 240, 255);
    noStroke();
    textSize(18);
    textAlign(LEFT, TOP);
    text("SCORE: " + Math.floor(this.score), 14, 14);
    text("TIME: " + this.survivalSeconds().toFixed(1) + "s", 14, 38);

    const safeCount    = this.orbs.filter(o => o.isSafe() || o.isWarning()).length;
    const hunterCount   = this.orbs.filter(o => o.isHunter()).length;

    textAlign(RIGHT, TOP);
    fill(92, 255, 145);
    text("ORBS: " + safeCount, SCREEN_WIDTH - 14, 14);
    fill(255, 80, 80);
    text("HUNTERS: " + hunterCount, SCREEN_WIDTH - 14, 38);

    // Corruption warning
    if (this.corruptionLayer > 0) {
      textAlign(CENTER, TOP);
      fill(255, 50, 50, 160 + 90 * Math.sin(millis() * 0.005));
      textSize(14);
      text("⚠ CORRUPTION LAYER " + this.corruptionLayer, SCREEN_WIDTH / 2, 14);
    }
    pop();
  }

  // --- Crosshair ---
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
