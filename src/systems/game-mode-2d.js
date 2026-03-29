/**
 * Game2DMode: 2D Raycasting Renderer
 * 
 * Handles all 2D rendering including:
 * - Software raycasting (DDA algorithm)
 * - Texture mapping for walls
 * - Sprite billboarding (enemies, collectibles, effects)
 * - HUD overlay (minimap, ammo, health)
 * - First-person weapon view
 * - Motion blur and vignette effects
 */

class Game2DMode extends GameModeBase {
    /**
     * Draw all active bullet tracers (white lines, fade out)
     */
    drawBulletTracers() {
      // Utilise la même projection que pour les sprites (billboard)
      const now = millis();
      const fovScale = SCREEN_WIDTH / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
      const px = this.player.posX;
      const py = this.player.posY;
      const pa = this.player.angle;
      const cameraOffset = this.gameManager.cameraScreenOffsetPx();
      for (const tracer of this.gameManager.bulletTracers){
        const age = now - tracer.createdMs;
        if (age > tracer.durationMs) continue;
        const alpha = Math.max(0, 255 * (1 - age / tracer.durationMs));
        // Project world (x, y) to screen (like sprites)
        function project(x, y) {
          const relX = x - px;
          const relY = y - py;
          const transformX = -relX * Math.sin(pa) + relY * Math.cos(pa);
          const transformY = relX * Math.cos(pa) + relY * Math.sin(pa);
          if (transformY <= 0.01) return null; // Derrière la caméra
          const screenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;
          const screenY = SCREEN_HEIGHT / 2 + cameraOffset;
          return { x: screenX, y: screenY };
        }
        const p0 = project(tracer.x0, tracer.y0);
        const p1 = project(tracer.x1, tracer.y1);
        if (!p0 || !p1) continue;
        push();
        stroke(255, 255, 255, alpha);
        strokeWeight(4);
        const weight = this.gameManager.drasticTracer ? 45 : 4;
        strokeWeight(weight);
        line(p0.x, p0.y, p1.x, p1.y);
        pop();
      }
    }
  constructor(gameManager) {
    super(gameManager);
    
    // Reference to game state
    this.player = gameManager.player;
    // NOTE: Don't cache orbs/particles/drops - use gameManager reference for dynamic updates
    this.gameManager = gameManager;
    
    // 2D-specific rendering buffers
    this.zBuffer = gameManager.zBuffer;
    this.rayDirXBuffer = gameManager.rayDirXBuffer;
    this.rayDirYBuffer = gameManager.rayDirYBuffer;
    // Sprite caches
    this.zombieSpriteCache = gameManager.zombieSpriteCache;
    this.collectOrbSpriteCache = gameManager.collectOrbSpriteCache;
    // Game state references
    this.weaponFlashUntilMs = gameManager.weaponFlashUntilMs;
  }

  /**
   * Main 2D render pipeline
   * Executes: Sky/Floor → Raycasting → Sprite rendering → Overlays
   */
  render() {
    // Step 1: Draw sky and floor background
    this.drawSkyAndFloor();
    // Step 2: Prepare pixel buffer
    loadPixels();
    // Step 3: Cast all rays and draw textured walls
    this.castAllRays();
    // Step 4: Draw all sprites (enemies, collectibles, effects)
    this.drawSpritesToBuffer();
    // Step 5: Commit pixels to canvas
    updatePixels();
    // Step 6: Post-processing effects
    this.gameManager.drawMotionBlurOverlay();
    this.gameManager.captureMotionBlurFrame();
    // Step 7: Draw screen-space overlays with shake
    const shake = this.gameManager.currentShakeOffset();
    push();
    translate(shake.x, shake.y);
    this.drawVignette();
    this.drawMinimap();
    // --- Bullet tracers (draw under HUD/weapon) ---
    this.drawBulletTracers();
    this.drawBombTrajectory2D();
    this.drawBombs2D();
    this.drawHUD();
    this.drawPulseEffect2D();
    // this.gameManager.drawActiveInventoryUI(window); // Function does not exist, removed to prevent error
    this.drawFirstPersonWeapon();
    this.drawCrosshair();
    pop();
  }

  drawBombTrajectory2D() {
    if (!this.gameManager.isBombAiming) return;
    
    const fovScale = SCREEN_WIDTH / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
    const cameraOffset = this.gameManager.cameraScreenOffsetPx();
    
    // Paramètres identiques à la classe Bomb
    const speed = 6.0; 
    const maxDuration = 1.5; // 1500ms
    const steps = 10;
    
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * maxDuration;
      const dist = speed * t;
      const wx = this.player.posX + Math.cos(this.player.angle) * dist;
      const wy = this.player.posY + Math.sin(this.player.angle) * dist;
      
      if (isWorldBlocked(wx, wy, 0.2)) break;
      
      const relX = wx - this.player.posX;
      const relY = wy - this.player.posY;
      const transformX = -relX * Math.sin(this.player.angle) + relY * Math.cos(this.player.angle);
      const transformY = relX * Math.cos(this.player.angle) + relY * Math.sin(this.player.angle);
      
      if (transformY <= 0.1) continue;
      const sx = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;
      const sy = SCREEN_HEIGHT / 2 + cameraOffset;
      
      fill(255, 100, 100, 150 - (i * 10));
      noStroke();
      circle(sx, sy, Math.max(2, 10 / transformY));
    }
  }

  drawPulseEffect2D() {
    if (!this.gameManager.pulseEffectActive) return;
    const elapsed = millis() - this.gameManager.pulseEffectStart;
    const t = elapsed / 500;
    if (t > 1) {
      this.gameManager.pulseEffectActive = false;
      return;
    }

    push();
    noFill();
    stroke(100, 200, 255, 200 * (1 - t));
    strokeWeight(15 * (1 - t));
    const r = SCREEN_WIDTH * t;
    ellipse(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + this.gameManager.cameraScreenOffsetPx(), r, r * 0.6);
    pop();
  }

  drawBombs2D() {
    const bombs = this.gameManager.bombs || [];
    const fovScale = SCREEN_WIDTH / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
    const px = this.player.posX;
    const py = this.player.posY;
    const pa = this.player.angle;
    const cameraOffset = this.gameManager.cameraScreenOffsetPx();

    const project = (x, y) => {
      const relX = x - px;
      const relY = y - py;
      const transformX = -relX * Math.sin(pa) + relY * Math.cos(pa);
      const transformY = relX * Math.cos(pa) + relY * Math.sin(pa);
      if (transformY <= 0.1) return null;
      const screenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;
      const screenY = SCREEN_HEIGHT / 2 + cameraOffset;
      return { x: screenX, y: screenY, transformY };
    };

    for (const bomb of bombs) {
      const p = project(bomb.x, bomb.y);
      if (!p) continue;

      if (!bomb.exploded) {
        const size = (0.3 / p.transformY) * fovScale;
        fill(40, 40, 45);
        stroke(255, 100, 100);
        strokeWeight(1);
        ellipse(p.x, p.y, size, size);
      } else {
        const elapsed = millis() - bomb.explosionTime;
        const progress = elapsed / 800;
        const radius = bomb.explosionRadius * Math.sin(progress * Math.PI);
        const screenRadius = (radius / p.transformY) * fovScale;
        noFill();
        stroke(255, 150, 50, 200 * (1 - progress));
        strokeWeight(4);
        ellipse(p.x, p.y, screenRadius * 2, screenRadius * 2);
      }
    }
  }
  /**
   * Draw sky and floor background with exponential fog gradient
   * Horror mode: black sky + white floor with gradient darkening
   */
  drawSkyAndFloor() {
    const horizon = constrain(
      SCREEN_HEIGHT / 2 + this.gameManager.cameraScreenOffsetPx(),
      0,
      SCREEN_HEIGHT
    );

    const ctx = drawingContext;
    
    // Black sky
    fill(0, 0, 0);
    rect(0, 0, SCREEN_WIDTH, horizon);
    
    // White floor
    fill(255, 255, 255);
    rect(0, horizon, SCREEN_WIDTH, SCREEN_HEIGHT - horizon);
    
    // Overlay fog gradient on floor only
    const floorGradient = ctx.createLinearGradient(
      0, horizon,           // start at horizon (black)
      0, SCREEN_HEIGHT      // end at bottom (white/visible)
    );
    
    // Fog stops (black at far, transparent at near)
    floorGradient.addColorStop(0.0, 'rgba(0, 0, 0, 1.0)');      // Black at horizon (far, foggy)
    floorGradient.addColorStop(0.2, 'rgba(0, 0, 0, 0.7)');      // Very dark
    floorGradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.4)');      // Medium fog
    floorGradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.15)');     // Light fog
    floorGradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.02)');     // Almost transparent
    floorGradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');      // Transparent at bottom
    
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, horizon, SCREEN_WIDTH, SCREEN_HEIGHT - horizon);
  }

  /**
   * Main raycasting loop using DDA (Digital Differential Analyser) algorithm
   * Casts one ray per screen column and renders textured wall columns
   */
  castAllRays() {
    const halfFOV = FIELD_OF_VIEW_RADIANS / 2;
    const cameraOffset = this.gameManager.cameraScreenOffsetPx();
    const rayToScreenRatio = SCREEN_WIDTH / RAY_COUNT;  // Scale rays to fill entire screen width
    const mapWidth = this.gameManager.mapWidth;
    const mapHeight = this.gameManager.mapHeight;

    for (let col = 0; col < RAY_COUNT; col++) {
      const rayScreenFraction = (col / RAY_COUNT) * 2 - 1;
      const rayAngle = this.player.angle + Math.atan(rayScreenFraction * Math.tan(halfFOV));

      const rayDirX = Math.cos(rayAngle);
      const rayDirY = Math.sin(rayAngle);
      this.rayDirXBuffer[col] = rayDirX;
      this.rayDirYBuffer[col] = rayDirY;

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

        if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
          hitWall = true;
          tileType = 3;
          break;
        }

        // Don't collide with type 0 (empty) or type 12 (floor/terrain)
        const tile = worldTileMap[mapY][mapX];
        if (tile !== 0 && tile !== 12) {
          hitWall = true;
          tileType = tile;
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

      // --- Draw the textured wall column (stretched to fill screen width) ---
      const cachedTexPixels = texturePixelCache[tileType];
      if (cachedTexPixels) {
        const screenColStart = Math.floor(col * rayToScreenRatio);
        const screenColEnd = Math.floor((col + 1) * rayToScreenRatio);
        // Draw this ray's result across all mapped screen columns
        for (let screenCol = screenColStart; screenCol < screenColEnd && screenCol < SCREEN_WIDTH; screenCol++) {
          this.drawTexturedColumn(screenCol, drawStart, wallStripHeight, cachedTexPixels, texX, perpDist, hitSide);
        }
      }
    }
  }

  /**
   * Renders one vertical textured wall column directly into the pixels[] array
   * Applies fog, lighting, and side shading
   */
  drawTexturedColumn(screenCol, drawStart, stripHeight, texPixels, texX, distance, hitSide) {
    // Apply exponential fog shader
    let fogFactor;
    if (FOG_3D_ENABLED) {
      const distFromFogStart = Math.max(0, distance - FOG_3D_START_DISTANCE);
      fogFactor = Math.exp(-FOG_3D_DENSITY * distFromFogStart * distFromFogStart);
      fogFactor = Math.max(0, Math.min(1, fogFactor));
    } else {
      const rawFog = constrain(1 - (distance / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
      fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);
    }

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

  /**
   * Render all sprites (orbs, particles, modules, drops, portals, machines)
   * Sorts back-to-front and renders using billboard projection and Z-buffer
   */
  drawSpritesToBuffer() {
    const allSprites = [];
    const MAX_SPRITE_DIST = MAX_RAY_DISTANCE + 2;
    const playerX = this.player.posX;
    const playerY = this.player.posY;

    // Collect all visible sprites
    for (const orb of this.gameManager.orbs) {
      const dx = orb.posX - playerX;
      const dy = orb.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > MAX_SPRITE_DIST * MAX_SPRITE_DIST) continue;
      
      const dist = Math.sqrt(distSq);
      let spriteType;
      if (orb.isSafe()) spriteType = "safe";
      else if (orb.isWarning()) spriteType = "warning";
      else if (orb.isChasing()) spriteType = "chase";
      else spriteType = "patrol";
      allSprites.push({ x: orb.posX, y: orb.posY, dist, type: spriteType, obj: orb });
    }

    for (const p of this.gameManager.particles) {
      const dx = p.posX - playerX;
      const dy = p.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > MAX_SPRITE_DIST * MAX_SPRITE_DIST) continue;
      const dist = Math.sqrt(distSq);
      allSprites.push({ x: p.posX, y: p.posY, dist, type: "particle", obj: p });
    }

    for (const wm of this.gameManager.worldModules) {
      const dx = wm.posX - playerX;
      const dy = wm.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > MAX_SPRITE_DIST * MAX_SPRITE_DIST) continue;
      const dist = Math.sqrt(distSq);
      allSprites.push({ x: wm.posX, y: wm.posY, dist, type: "world-module", obj: wm });
    }

    for (const drop of this.gameManager.drops){
      const dx = drop.posX - playerX;
      const dy = drop.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > MAX_SPRITE_DIST * MAX_SPRITE_DIST) continue;
      const dist = Math.sqrt(distSq);
      allSprites.push({ x: drop.posX, y: drop.posY, dist, type: "drop", obj: drop });
    }

    if (this.gameManager.punchMachine) {
      const dx = this.gameManager.punchMachine.posX - playerX;
      const dy = this.gameManager.punchMachine.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq <= MAX_SPRITE_DIST * MAX_SPRITE_DIST) {
        const dist = Math.sqrt(distSq);
        allSprites.push({
          x: this.gameManager.punchMachine.posX,
          y: this.gameManager.punchMachine.posY,
          dist,
          type: "punch-machine",
          obj: this.gameManager.punchMachine,
        });
      }
    }

    // Sort back-to-front and render
    if (allSprites.length > 0) {
      allSprites.sort((a, b) => b.dist - a.dist);
      const now = millis();
      for (const sp of allSprites) {
        this.drawSingleSpriteToBuffer(sp, now);
      }
    }
  }

  /**
   * Draw one sprite with billboard projection and Z-buffer occlusion
   * Delegates to proper rendering method based on sprite type
   * NOTE: This is the core workhorse - ~1500 lines of logic
   * For brevity in this separation, zombie/sprite rendering methods are delegated to gameManager
   */
  drawSingleSpriteToBuffer(spriteData, now) {
    // Delegate complex sprite rendering to gameManager (already has all the methods)
    this.gameManager.drawSingleSpriteToBuffer(spriteData, now);
  }

  /**
   * Draw first-person weapon (pistol with arm)
   * Includes firing animation, bob, recoil
   */
  drawFirstPersonWeapon() {
    const moving =
      isControlPressed("forward") ||
      isControlPressed("backward") ||
      isControlPressed("left") ||
      isControlPressed("right");

    const t = millis() * VIEWMODEL_BOB_SPEED;
    const bobX = moving ? Math.sin(t) * VIEWMODEL_BOB_X : 0;
    const bobY = moving ? Math.abs(Math.cos(t * 1.2)) * VIEWMODEL_BOB_Y : 0;

    const recoilFrac = constrain((this.gameManager.weaponFlashUntilMs - millis()) / 70, 0, 1);

    const s = VIEWMODEL_SCALE * Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 680;

    const gripCenterX = SCREEN_WIDTH * 0.72 + bobX + 20;
    const gripCenterY = SCREEN_HEIGHT * 0.62 + bobY;
    const barrelLength = 140 * s;
    const barrelAngle = -Math.PI / 2;
    const muzzleX = gripCenterX + Math.cos(barrelAngle) * barrelLength;
    const muzzleY = gripCenterY + Math.sin(barrelAngle) * barrelLength - recoilFrac * VIEWMODEL_RECOIL_PX;

    // Color variations based on selected slot
    let barrelColor = [110, 110, 115];
    let slideColor = [90, 90, 95];
    let isPistol = true;
    
    if (this.gameManager.selectedHotbarSlot === 2) {
      // Bomb - Red theme
      barrelColor = [255, 100, 100];
      isPistol = false;
    } else if (this.gameManager.selectedHotbarSlot === 3) {
      // Pulse - Purple theme
      barrelColor = [180, 100, 255];
      slideColor = [130, 50, 200];
      isPistol = false;
    }

    // --- ARM ---
    push();
    stroke(0);
    strokeWeight(2);

    const armWidth = 40 * s;
    // Position arm from right edge of screen (was: SCREEN_WIDTH + 40, which was off-screen)
    const armX1 = SCREEN_WIDTH - 20;
    const armY1_top = SCREEN_HEIGHT - armWidth;
    const armY1_bot = SCREEN_HEIGHT + armWidth;
    const armX2 = gripCenterX + 30 * s;
    const armY2_top = gripCenterY + 100 * s - armWidth;
    const armY2_bot = gripCenterY + 100 * s + armWidth;

    const armY1_mid = (armY1_top + armY1_bot) / 2;
    const armY2_mid = (armY2_top + armY2_bot) / 2;

    fill(210, 174, 144);
    quad(armX1, armY1_top, armX2, armY2_top, armX2, armY2_mid, armX1, armY1_mid);

    fill(120, 90, 60);
    quad(armX1, armY1_mid, armX2, armY2_mid, armX2, armY2_bot, armX1, armY1_bot);

    pop();

    // --- WEAPON ---
    push();
    noStroke();

    if (!isPistol) {
      // Dessine un objet (Bombe ou Pulse) à la place du pistolet
      const objSize = 50 * s;
      const objX = gripCenterX;
      const objY = gripCenterY - 15 * s - recoilFrac * VIEWMODEL_RECOIL_PX;
      
      if (this.gameManager.selectedHotbarSlot === 2) {
        // Bombe : Sphère sombre avec une mèche
        fill(40, 40, 45);
        ellipse(objX, objY, objSize, objSize);
        fill(255, 100, 100); 
        ellipse(objX - 5*s, objY - 5*s, objSize * 0.4, objSize * 0.4);
        stroke(150, 100, 50);
        strokeWeight(3 * s);
        line(objX, objY - objSize/2, objX + 10 * s, objY - objSize/2 - 15 * s);
      } else {
        // Pulse Core : Noyau énergétique brillant
        fill(barrelColor);
        rectMode(CENTER);
        rect(objX, objY, objSize * 0.8, objSize * 0.8, 8 * s);
        fill(255, 255, 255, 150 + 100 * Math.sin(millis() * 0.01));
        ellipse(objX, objY, objSize * 0.5, objSize * 0.5);
      }
      pop();
      return; // On arrête ici pour ne pas dessiner le pistolet
    }

    const barrelRadius = 10 * s;
    const muzzleRadius = 12 * s;
    
    // Barrel
    fill(barrelColor);
    quad(
      gripCenterX - barrelRadius, gripCenterY,
      muzzleX - barrelRadius, muzzleY,
      muzzleX - barrelRadius * 0.8, muzzleY - 3 * s,
      gripCenterX - barrelRadius * 0.8, gripCenterY - 3 * s
    );

    fill(barrelColor[0] + 50, barrelColor[1] + 50, barrelColor[2] + 50);
    quad(
      gripCenterX + barrelRadius, gripCenterY,
      muzzleX + barrelRadius, muzzleY,
      muzzleX + barrelRadius * 0.8, muzzleY - 3 * s,
      gripCenterX + barrelRadius * 0.8, gripCenterY - 3 * s
    );

    fill(barrelColor[0] + 30, barrelColor[1] + 30, barrelColor[2] + 30);
    quad(
      gripCenterX - barrelRadius * 0.8, gripCenterY - 3 * s,
      gripCenterX + barrelRadius * 0.8, gripCenterY - 3 * s,
      muzzleX + barrelRadius * 0.8, muzzleY - 3 * s,
      muzzleX - barrelRadius * 0.8, muzzleY - 3 * s
    );

    // Slide
    const slideWidth = 22 * s;
    fill(slideColor);
    quad(
      gripCenterX - slideWidth, gripCenterY - 3 * s,
      muzzleX - slideWidth, muzzleY - 3 * s,
      muzzleX + slideWidth, muzzleY + 3 * s,
      gripCenterX + slideWidth, gripCenterY + 3 * s
    );

    fill(slideColor[0] - 20, slideColor[1] - 20, slideColor[2] - 20);
    quad(
      gripCenterX - slideWidth, gripCenterY - 3 * s,
      gripCenterX - slideWidth * 1.1, gripCenterY,
      muzzleX - slideWidth * 1.1, muzzleY,
      muzzleX - slideWidth, muzzleY - 3 * s
    );

    fill(slideColor[0] + 50, slideColor[1] + 50, slideColor[2] + 50);
    quad(
      gripCenterX + slideWidth, gripCenterY + 8 * s,
      gripCenterX + slideWidth * 1.1, gripCenterY + 16 * s,
      muzzleX + slideWidth * 1.1, muzzleY + 16 * s,
      muzzleX + slideWidth, muzzleY + 8 * s
    );

    // Muzzle
    fill(50, 50, 55);
    ellipse(muzzleX, muzzleY, muzzleRadius * 2.2, muzzleRadius * 1.8);
    fill(30, 30, 35);
    ellipse(muzzleX, muzzleY, muzzleRadius * 1.4, muzzleRadius * 1.0);
    
    if (millis() < this.gameManager.weaponFlashUntilMs) {
      fill(255, 180, 80, 200);
      ellipse(muzzleX, muzzleY, muzzleRadius * 3.2, muzzleRadius * 2.5);
      fill(255, 230, 150, 220);
      ellipse(muzzleX, muzzleY, muzzleRadius * 2.0, muzzleRadius * 1.5);
    }

    // Grip
    const gripWidth = 20 * s;
    const gripLength = 70 * s;
    
    fill(85, 50, 30);
    quad(
      gripCenterX - gripWidth, gripCenterY,
      gripCenterX + gripWidth, gripCenterY,
      gripCenterX + gripWidth * 0.8, gripCenterY + gripLength,
      gripCenterX - gripWidth * 0.8, gripCenterY + gripLength
    );

    fill(120, 70, 40);
    quad(
      gripCenterX - gripWidth, gripCenterY,
      gripCenterX - gripWidth * 0.9, gripCenterY + 10 * s,
      gripCenterX - gripWidth * 0.8, gripCenterY + gripLength,
      gripCenterX - gripWidth * 0.8, gripCenterY + gripLength - 10 * s
    );

    fill(60, 35, 20);
    quad(
      gripCenterX + gripWidth, gripCenterY,
      gripCenterX + gripWidth * 0.9, gripCenterY + 10 * s,
      gripCenterX + gripWidth * 0.8, gripCenterY + gripLength,
      gripCenterX + gripWidth * 0.8, gripCenterY + gripLength - 10 * s
    );

    stroke(40, 25, 15);
    strokeWeight(1);
    line(gripCenterX - 8 * s, gripCenterY + 15 * s, gripCenterX - 8 * s, gripCenterY + gripLength - 15 * s);
    line(gripCenterX + 8 * s, gripCenterY + 15 * s, gripCenterX + 8 * s, gripCenterY + gripLength - 15 * s);
    noStroke();

    // Trigger guard
    const guardOffsetY = 15 * s;
    
    fill(75, 75, 80);
    quad(
      gripCenterX - gripWidth * 0.6, gripCenterY + guardOffsetY,
      gripCenterX - gripWidth * 0.8, gripCenterY + guardOffsetY + 25 * s,
      gripCenterX + gripWidth * 0.8, gripCenterY + guardOffsetY + 25 * s,
      gripCenterX + gripWidth * 0.6, gripCenterY + guardOffsetY
    );

    fill(130, 130, 135);
    quad(
      gripCenterX - gripWidth * 0.5, gripCenterY + guardOffsetY + 3 * s,
      gripCenterX - gripWidth * 0.7, gripCenterY + guardOffsetY + 22 * s,
      gripCenterX + gripWidth * 0.7, gripCenterY + guardOffsetY + 22 * s,
      gripCenterX + gripWidth * 0.5, gripCenterY + guardOffsetY + 3 * s
    );

    // Trigger
    fill(100, 100, 105);
    quad(
      gripCenterX - 5 * s, gripCenterY + guardOffsetY + 8 * s,
      gripCenterX - 6 * s, gripCenterY + guardOffsetY + 16 * s,
      gripCenterX + 6 * s, gripCenterY + guardOffsetY + 16 * s,
      gripCenterX + 5 * s, gripCenterY + guardOffsetY + 8 * s
    );

    // Sights
    fill(70, 70, 75);
    quad(
      gripCenterX - 6 * s, gripCenterY - slideWidth - 5 * s,
      gripCenterX + 6 * s, gripCenterY - slideWidth - 5 * s,
      muzzleX + 5 * s, muzzleY - slideWidth - 5 * s,
      muzzleX - 5 * s, muzzleY - slideWidth - 5 * s
    );

    fill(85, 85, 90);
    quad(
      gripCenterX - 7 * s, gripCenterY - slideWidth - 8 * s,
      gripCenterX + 7 * s, gripCenterY - slideWidth - 8 * s,
      gripCenterX + 6 * s, gripCenterY - slideWidth,
      gripCenterX - 6 * s, gripCenterY - slideWidth
    );

    pop();
  }

  /**
   * Draw crosshair (center of screen)
   * Changes color/brightness when firing
   */
  drawCrosshair() {
    push();
    const firing = millis() < this.gameManager.weaponFlashUntilMs;
    if (firing) {
      stroke(255, 220, 120, 220);
      strokeWeight(2.2);
    } else {
      stroke(255, 255, 255, 140);
      strokeWeight(1.5);
    }
    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2;
    line(cx - 8, cy, cx + 8, cy);
    line(cx, cy - 8, cx, cy + 8);
    pop();
  }

  /**
   * Return 2D mode status for logging
   */
  getStatus() {
    return {
      mode: "2D Raycaster",
      description: "Software raycasting with billboard spriting",
    };
  }
}

// Ensure Game2DMode is available globally
window.Game2DMode = Game2DMode;
