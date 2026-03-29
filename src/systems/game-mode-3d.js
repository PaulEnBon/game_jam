/**
 * Game3DMode: 3D WEBGL Minecraft-style Renderer
 * 
 * Handles all 3D rendering including:
 * - WEBGL graphics context management
 * - First-person camera setup with pitch/yaw
 * - Block rendering (map tiles)
 * - Zombie voxel models
 * - First-person weapon and arm
 * - Floor rendering
 * - Frustum culling for performance
 */

class Game3DMode extends GameModeBase {
    /**
     * Draw all active bullet tracers in 3D
     * - Always draws a thin tracer (default)
     * - Draws a thick tracer if tracer3DEnabled is true
     */
    drawBulletTracers3D(g) {
      const now = millis();
      for (const tracer of this.gameManager.bulletTracers) {
        const age = now - tracer.createdMs;
        if (age > tracer.durationMs) continue;
        const alpha = Math.max(0, 255 * (1 - age / tracer.durationMs));
        const playerJump = this.player.z || 0;
        const yCanon = -0.85 - playerJump;
        // Always draw a thin tracer
        g.push();
        g.stroke(255, 255, 255, alpha * 0.7);
        g.strokeWeight(0.2);
        g.line(tracer.x0, yCanon, tracer.y0, tracer.x1, yCanon, tracer.y1);
        g.pop();
        // Draw thick tracer only if enabled
        if (this.gameManager.tracer3DEnabled || this.gameManager.drasticTracer) {
          g.push();
          g.stroke(255, 255, 255, alpha);
          const weight = this.gameManager.drasticTracer ? 12.0 : 1.5;
          g.strokeWeight(weight);
          g.line(tracer.x0, yCanon, tracer.y0, tracer.x1, yCanon, tracer.y1);
          g.pop();
        }
      }
    }
  constructor(gameManager) {
    super(gameManager);
    
    // Reference to game state
    this.gameManager = gameManager;
    this.player = gameManager.player;
    this.scene3D = gameManager.scene3D;
    
    // 3D-specific graphics context (lazy-created)
    this.webglGraphics = gameManager.webglGraphics;
    
    // Floor texture management
    this.floorTexture = gameManager.floorTexture;
    
    // 3D zombie models (separate from 2D sprite rendering)
    this.zombieModels = new Map();  // Map of orb ID → Zombie3DModel instance

    // Tampon pour le texte 3D (Prix)
    this.labelGraphics = null;
    this.lastPriceDrawn = -1;
    this.texturesLoadingInitiated = false;
    this.blockTextures = null;

    // Textures pour les orbes
    this.orbTextureSafe = null;
    this.orbTextureWarning = null;

    // Textures spécifiques pour les butins (optimisation lag)
    this.dropTextureAmmo = null;
    this.dropTextureBomb = null;
    this.dropTexturePulse = null;
    this.dropTextureCrate = null;
    this.initialized = false;
  }

  /**
   * Initialise les ressources graphiques une seule fois
   */
  initResources() {
    if (this.initialized) return;
    
    const createOrbTex = (c1, c2) => {
      let pg = createGraphics(64, 64);
      pg.background(0, 0);
      for(let r = 32; r > 0; r -= 2) {
        let alpha = map(r, 0, 32, 255, 0);
        pg.noStroke();
        pg.fill(c1[0], c1[1], c1[2], alpha * 0.6);
        pg.circle(32, 32, r * 2);
      }
      pg.fill(255, 255, 255, 200);
      pg.circle(32, 32, 12);
      return pg;
    };

    this.orbTextureSafe = createOrbTex([60, 255, 100]);
    this.orbTextureWarning = createOrbTex([255, 180, 30]);
    this.dropTextureAmmo = createOrbTex([255, 220, 110]);
    this.dropTextureBomb = createOrbTex([255, 150, 150]);
    this.dropTexturePulse = createOrbTex([220, 180, 255]);
    this.dropTextureCrate = createOrbTex([170, 225, 255]);
    
    if (!this.labelGraphics) {
      this.labelGraphics = createGraphics(128, 64);
    }

    this.initialized = true;
  }

  /**
   * Main 3D render pipeline
   * Renders to WEBGL buffer, converts to image, displays with overlays
   */
  render() {
    this.initResources();

    try {
      // Create WEBGL buffer on first use
      if (!this.webglGraphics) {
        this.webglGraphics = createGraphics(SCREEN_WIDTH, SCREEN_HEIGHT, WEBGL);
        // Résout la pixelisation : On utilise la densité réelle mais bridée à 2
        this.webglGraphics.pixelDensity(min(window.displayDensity(), 2));
        this.gameManager.webglGraphics = this.webglGraphics;
      }
      // Render to WEBGL buffer
      this.renderTo3DBuffer();
      // Display WEBGL buffer as image to main canvas
      image(this.webglGraphics, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      // Add overlays for 3D mode
      const shake = this.gameManager.currentShakeOffset();
      push();
      translate(shake.x, shake.y);
      this.drawMinimap();
      this.drawProximityAlert();
      this.drawHUD();
      this.drawCrosshair();
      pop();
    } catch (e) {
      console.error("3D Render Error:", e);
    }
  }

  drawBombTrajectory3D(g) {
    if (!this.gameManager.isBombAiming) return;
    const speed = 6.0;
    const maxDuration = 1.5;
    const steps = 15;

    g.push();
    g.noStroke();
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * maxDuration;
      const dist = speed * t;
      const wx = this.player.posX + Math.cos(this.player.angle) * dist;
      const wy = this.player.posY + Math.sin(this.player.angle) * dist;
      if (isWorldBlocked(wx, wy, 0.2)) break;
      
      const playerJump = this.player.heightOffset || 0;
      g.fill(255, 100, 100, 150 - (i * 8));
      g.push();
      g.translate(wx, -0.85 - playerJump, wy);
      g.sphere(0.05);
      g.pop();
    }
    g.pop();
  }

  drawPulseEffect3D(g) {
    if (!this.gameManager.pulseEffectActive) return;
    const t = (millis() - this.gameManager.pulseEffectStart) / 420;
    if (t > 1) {
      this.gameManager.pulseEffectActive = false;
      return;
    }
    const r = 10 * t;
    g.push();
    g.noFill();
    g.stroke(100, 220, 255, 180 * (1 - t));
    g.strokeWeight(0.1);
    const playerJump = this.player.heightOffset || 0;
    g.translate(this.gameManager.player.posX, -0.85 - playerJump, this.gameManager.player.posY);
    g.sphere(r, 24, 16);
    g.pop();
  }

  drawBombs3D(g) {
    const bombs = this.gameManager.bombs || [];
    const playerJump = this.player.heightOffset || 0;
    for (const bomb of bombs) {
      if (!bomb.exploded) {
        g.push();
        g.fill(40, 40, 45);
        g.stroke(255, 100, 100);
        g.strokeWeight(0.01);
        g.translate(bomb.x, -0.85 - playerJump, bomb.y);
        g.sphere(0.15, 8, 4); // Réduction détail
        g.pop();
      } else {
        const elapsed = millis() - bomb.explosionTime;
        const progress = elapsed / 800;
        if (progress > 1) continue;
        const r = bomb.explosionRadius * Math.sin(progress * Math.PI);
        g.push();
        g.noStroke();
        g.fill(255, 150, 50, 150 * (1 - progress));
        g.translate(bomb.x, -0.85 - playerJump, bomb.y);
        g.sphere(r, 12, 8); // Réduction détail
        g.pop();
      }
    }
  }
  renderTo3DBuffer() {
    const g = this.webglGraphics;
    
    // Black background skybox
    g.background(0, 0, 0);
    
    // Disable stroke for all 3D objects
    g.noStroke();
    
    // Éclairage augmenté pour que les zombies soient bien visibles
    g.ambientLight(30); // Luminosité ambiante réduite
    g.directionalLight(60, 60, 60, 0.5, 1, -0.5); // Lumière directionnelle réduite

    // Setup camera: first-person from player position with pitch support
    // In p5.js WEBGL: Y+ points DOWN (not up like standard OpenGL)
    const playerJump = this.player.heightOffset || 0;
    const camY = -1.3 - playerJump;
    const lookAheadDist = 10;
    const lookX = this.player.posX + cos(this.player.angle) * lookAheadDist;
    const lookZ = this.player.posY + sin(this.player.angle) * lookAheadDist;
    
    // Apply pitch (vertical look angle)
    const lookY = camY - sin(this.player.pitch) * lookAheadDist;
    
    g.perspective(45, SCREEN_WIDTH / SCREEN_HEIGHT, 0.1, 1000);
    g.camera(
      this.player.posX, camY, this.player.posY,
      lookX, lookY, lookZ,
      0, 1, 0
    );
    
    // Draw first-person arm and weapon
    this.drawArmAndWeapon3D(g);
    // Rendu des effets (bombes, pulse)
    this.drawBombTrajectory3D(g);
    this.drawPulseEffect3D(g);
    this.drawBombs3D(g);
    // Always draw thin tracer, thick if enabled
    this.drawBulletTracers3D(g);
    // Nettoyage des tracers expirés
    const now2 = millis();
    this.gameManager.bulletTracers = this.gameManager.bulletTracers.filter(t => now2 - t.createdMs < t.durationMs);
    
    // Ensure floor texture exists
    this.ensureFloorTextureCreated();
    
    // Draw floor - grid of colored blocks with checkerboard
    g.push();
    // OPTIMISATION : Un seul grand plan au lieu d'une boucle
    const d = 6;
    const fog = this.getFogFactor(d/2);
    g.noStroke();
    g.translate(this.player.posX, -0.5, this.player.posY);
    g.rotateX(Math.PI / 2);
    g.fill(118 * fog, 140 * fog, 78 * fog);
    g.plane(d * 2.5, d * 2.5);
    g.pop();
    
    // Draw all map tiles
    this.drawMapBlocks3D(g);

    // Rendu de la Punch Machine en 3D
    this.drawPunchMachine3D(g);
    
    // Sync zombie 3D models with orbs
    this.drawUpcomingSpawns3D(g, playerJump); // Draw upcoming spawns
    this.syncZombieModels();
    
    // Draw zombies with culling
    const renderDist = 30; // Increased render distance for enemies
    let zombieCount = 0;
    for (let orb of this.gameManager.orbs) {
      if (orb.isHunter()) {
        zombieCount++;
        const distToZombie = Math.hypot(orb.posX - this.player.posX, orb.posY - this.player.posY);
        
        if (distToZombie > renderDist) continue;
        
        const fog = this.getFogFactor(distToZombie);
        const healthFrac = orb.health / orb.maxHealth;

        g.push();
        g.translate(orb.posX, -0.5, orb.posY); // Pieds sur le sol (Y=-0.5)
        g.rotateY(orb.bodyAngle || 0);
        
        // Appliquer le fog et l'effet blessé
        const zombieColor = this.getZombieColorWithDamageAndFog(orb, fog);
        g.ambientMaterial(zombieColor[0], zombieColor[1], zombieColor[2]);
        g.fill(zombieColor[0], zombieColor[1], zombieColor[2]);
        
        // Get or create zombie model for this orb
        const model = this.getZombieModel(orb);
        if (model) {
          model.render(g);
        }
        
        g.pop();

        // Health bar 3D
        g.push();
        g.translate(orb.posX, -1.6, orb.posY);
        g.rotateY(-this.player.angle - Math.PI / 2);
        this.drawZombieHealthBar3D(g, orb, fog);
        g.pop();
      } else {
        // Collectible orbs in 3D
        const distToOrb = Math.hypot(orb.posX - this.player.posX, orb.posY - this.player.posY);
        if (distToOrb > 18) continue; 
        
        g.push();
        // Hauteur ajustée à -0.8 pour une meilleure visibilité (plus proche du sol)
        g.translate(orb.posX, -0.8 + Math.sin(millis() * 0.005) * 0.1, orb.posY);
        // Billboarding : Faire face au joueur
        g.rotateY(-this.player.angle - Math.PI / 2);
        
        const fog = this.getFogFactor(distToOrb);

        // Orbes réellement rondes (Sphères)
        g.specularMaterial(255 * fog); // Reflet uniquement sur l'orbe
        g.shininess(100);        // Reflet petit et net (plus réaliste)
        g.fill(orb.isSafe() ? [60 * fog, 255 * fog, 100 * fog] : [255 * fog, 180 * fog, 30 * fog]);
        g.sphere(0.5, 8, 6);   // Réduction détail
        g.pop();
      }
    }

    // --- RENDU DES ORBES DE BUTIN (DROPS) ---
    for (let drop of this.gameManager.drops) {
      const dist = Math.hypot(drop.posX - this.player.posX, drop.posY - this.player.posY);
      if (dist > 15) continue;

      const fog = this.getFogFactor(dist);

      g.push();
      // Hauteur flottante et billboarding
      g.translate(drop.posX, -0.8 - playerJump + Math.sin(millis() * 0.008) * 0.05, drop.posY);
      g.rotateY(-this.player.angle - Math.PI / 2);
      // Texture optimisée selon le type de butin
      let tex = this.dropTextureAmmo;
      if (drop.type === "score") tex = this.dropTextureBomb;
      else if (drop.type === "pulse") tex = this.dropTexturePulse;
      else if (drop.type === "crate") tex = this.dropTextureCrate;

      g.specularMaterial(255);
      g.shininess(100); // Reflet petit et net
      g.texture(tex);
      g.sphere(0.45, 8, 6); // Réduction détail
      g.pop();
    }
  }

  /**
   * Dessine la Punch Machine en 3D avec son prix
   */
  drawPunchMachine3D(g) {
    const pm = this.gameManager.punchMachine;
    if (!pm) return;

    // Mise à jour de la texture du prix
    const price = this.gameManager.punchMachinePrice;
    if (this.lastPriceDrawn !== price) {
      if (!this.labelGraphics) {
        this.labelGraphics = createGraphics(128, 64);
      }
      this.labelGraphics.clear(); // Transparent par défaut
      this.labelGraphics.fill(255, 215, 0); // Texte Or
      this.labelGraphics.textAlign(CENTER, CENTER);
      this.labelGraphics.textSize(28);
      this.labelGraphics.textStyle(BOLD);
      this.labelGraphics.text(price + " G", 64, 32);
      this.lastPriceDrawn = price;
      this.gameManager.webglGraphics.texture(this.labelGraphics); // Pré-charge la texture
    }

    g.push();
    g.translate(pm.posX, -1.0, pm.posY);
    
    // Structure de la machine
    g.fill(100, 40, 180);
    g.box(0.7, 1.0, 0.7);
    
    // Écran/Néon supérieur
    g.translate(0, -0.6, 0);
    const pulse = 0.7 + 0.3 * Math.sin(millis() * 0.01);
    g.fill(200 * pulse, 50, 255);
    g.box(0.5, 0.15, 0.5);

    // Affichage du prix (Billboard)
    g.translate(0, -0.4, 0);
    g.rotateY(-this.player.angle - Math.PI / 2);
    
    g.push();
    g.texture(this.labelGraphics);
    g.plane(0.6, 0.3);
    g.pop();
    g.pop();
  }

  /**
   * Sync zombie 3D models with active orbs
   * Creates/removes models as zombies spawn/die
   */
  syncZombieModels() {
    const activeOrbIds = new Set();
    
    for (let orb of this.gameManager.orbs) {
      if (orb.isHunter()) {
        activeOrbIds.add(orb.id);
        
        // Create model if it doesn't exist
        if (!this.zombieModels.has(orb.id)) {
          const model = new Zombie3DModel();
          this.zombieModels.set(orb.id, model);
        }
        
        // Update the model
        const model = this.zombieModels.get(orb.id);
        if (model) {
          model.update(16);  // ~16ms per frame
        }
      }
    }
    
    // Remove models for dead zombies
    for (let [orbId, model] of this.zombieModels) {
      if (!activeOrbIds.has(orbId)) {
        this.zombieModels.delete(orbId);
      }
    }
  }

  /**
   * Get or create a 3D model for a zombie orb
   */
  getZombieModel(orb) {
    return this.zombieModels.get(orb.id);
  }

  /**
   * Ensure floor texture exists (lazy loading)
   * Creates or loads from localStorage
   */
  ensureFloorTextureCreated() {
    if (this.floorTexture) {
      return;  // Already created
    }
    
    // Delegate to gameManager (already has this method)
    this.gameManager.ensureFloorTextureCreated();
    this.floorTexture = this.gameManager.floorTexture;
  }

  /**
   * Draw first-person arm and weapon in 3D
   * Positioned relative to camera direction (both pitch and yaw)
   * Improved: Better proportions and more detailed pistol
   */
  drawArmAndWeapon3D(g) {
    g.push();

    // Position arm at player location (adjusting for eye height and jump)
    const playerJump = this.player.z || 0;
    g.translate(this.player.posX, -1.1 - playerJump, this.player.posY);
    
    // Rotate with player angle
    g.rotateY(-this.player.angle);
    
    // Rotate with camera pitch
    g.rotateX(-this.player.pitch);
    
    // Rotate arm 90 degrees to the right
    g.rotateY(-Math.PI / 2);
    
    // Offset to the right side and pull back
    g.translate(0.8, 0.25, -0.9);
    
    // Color variations based on selected slot
    let pistolBodyColor = [60, 60, 65]; // Couleur de base plus sombre
    g.ambientMaterial(60, 60, 65); // Bras et armes mats
    let isPistol = true;


    const wLevel = this.gameManager.weaponLevel;
    let weaponScale = 1.0;

    if (wLevel >= 10) {
      pistolBodyColor = [150, 120, 30]; // Doré plus sombre
      weaponScale = 1.8; // Très massif
    } else if (wLevel >= 5) {
      pistolBodyColor = [20, 20, 25]; // Noir profond tactique plus sombre
      weaponScale = 1.4; // Plus gros
    }

    if (this.gameManager.selectedHotbarSlot === 2) {
      // Bomb - Red theme
      pistolBodyColor = [100, 20, 20]; // Rouge plus sombre
      isPistol = false;
    } else if (this.gameManager.selectedHotbarSlot === 3) {
      // Pulse - Purple theme
      pistolBodyColor = [60, 20, 100]; // Violet plus sombre
      isPistol = false;
    }

    // ===== DRAW ARM =====
    g.noStroke();

    // Upper arm
    g.fill(120, 80, 50); // Peau plus sombre
    g.push();
    g.translate(0, -0.1, 0.3);
    g.box(0.2, 0.2, 0.7); // Simplifié
    g.pop();

    // Forearm
    g.push();
    g.translate(0, -0.05, -0.25);
    g.box(0.18, 0.18, 0.6); // Simplifié
    g.pop();

    // Hand holding gun
    g.fill(120, 90, 60); // Main plus sombre
    g.push();
    g.translate(0.05, 0.08, -0.95);
    g.box(0.2, 0.2, 0.2); // Simplifié
    g.pop();
    
    // ===== DRAW PISTOL (SIMPLE) =====
    if (!isPistol) {
      // Dessine un objet 3D à la place du pistolet
      g.push();
      g.translate(-0.1, -0.1, -0.9); // Ajusté
      if (this.gameManager.selectedHotbarSlot === 2) {
        // Bomb
        g.fill(40, 40, 45);
        g.box(0.25); // Simplifié
        g.fill(pistolBodyColor);
        g.translate(0, -0.2, 0);
        g.box(0.05, 0.1, 0.05); // mèche, simplifié
      } else {
        // Pulse Core
        g.fill(pistolBodyColor);
        g.box(0.25); // Simplifié
      }
      g.pop();
      g.pop(); // Ferme le translate initial
      return;
    }

    // Barrel principal - long cylindre
    g.fill(pistolBodyColor);
    g.push(); // Pistolet
    g.translate(-0.1, -0.15 , -1.1); // Ajusté
    g.box(0.12 * weaponScale, 0.4 * weaponScale, 1.0); // Simplifié
    g.pop();

    // Grip - simple rectangle
    g.fill(30, 20, 15); // Grip plus sombre
    g.push();
    g.translate(-0.06, 0.12, -0.6); // Ajusté
    g.box(0.15, 0.35, 0.25); // Simplifié
    g.pop();

    // Trigger guard - petit contour
    g.fill(pistolBodyColor[0] - 10, pistolBodyColor[1] - 10, pistolBodyColor[2] - 10); // Ajusté
    g.push();
    g.translate(-0.06, -0.11, -0.65); // Ajusté
    g.box(0.07, 0.35, 0.25); // Simplifié
    g.pop();

    g.pop();
  }
  
  /**
   * Draw a sharp box (cube) with specified dimensions
   * Helper for 3D primitive rendering
   */
  drawSharpBox(g, w, h, d) {
    g.box(w, h, d);
  }

  /**
   * Draw all map tiles as 3D blocks
   * Uses aggressive culling to render only nearby blocks
   */
  drawMapBlocks3D(g) {
    // Ultra aggressive culling for maximum performance
    const renderDist = 16;  // Increased for better visibility
    const minX = Math.max(0, Math.floor(this.player.posX - renderDist));
    const maxX = Math.min(MAP_TILE_COUNT, Math.ceil(this.player.posX + renderDist));
    const minY = Math.max(0, Math.floor(this.player.posY - renderDist));
    const maxY = Math.min(MAP_TILE_COUNT, Math.ceil(this.player.posY + renderDist));
    
    const nightFactor = 0.4;  // Réduit la luminosité des blocs
    const rdSq = renderDist * renderDist;

    for (let mapY = minY; mapY < maxY; mapY++) {
      const row = worldTileMap[mapY];
      for (let mapX = minX; mapX < maxX; mapX++) {
        const tileId = row[mapX];
        
        if (tileId === 0) continue;  // Empty tile
        
        const dx = mapX + 0.5 - this.player.posX;
        const dy = mapY + 0.5 - this.player.posY;
        const dSq = dx * dx + dy * dy;
        if (dSq > rdSq) continue;

        const fog = this.getFogFactor(Math.sqrt(dSq));
        g.push();
        g.translate(mapX + 0.5, -1.0, mapY + 0.5);
        this.drawMinecraftBlock(g, tileId, nightFactor * fog);
        g.pop();
      }
    }
  }

  /**
   * Calcule le brouillard identique à la 2D pour masquer la limite de rendu
   */
  calculateFogFactor(dist) {
    if (typeof FOG_3D_ENABLED !== 'undefined' && FOG_3D_ENABLED) {
      const distFromFogStart = Math.max(0, dist - (typeof FOG_3D_START_DISTANCE !== 'undefined' ? FOG_3D_START_DISTANCE : 1.5)); // Fog starts closer
      const density = typeof FOG_3D_DENSITY !== 'undefined' ? FOG_3D_DENSITY : 0.4; // Denser fog
      const factor = Math.exp(-density * distFromFogStart * distFromFogStart);
      return Math.max(0, Math.min(1, factor));
    }
    const rawFog = constrain(1 - (dist / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
    return Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);
  }

  /**
   * Draw a single minecraft-style block (voxel)
   * Color depends on tile type: stone, grass, wood, etc.
   */
  /**
   * Calcule le facteur de brouillard selon la distance (Centralisé)
   */
  getFogFactor(dist) {
    if (typeof FOG_3D_ENABLED !== 'undefined' && FOG_3D_ENABLED) {
      const distFromFogStart = Math.max(0, dist - (typeof FOG_3D_START_DISTANCE !== 'undefined' ? FOG_3D_START_DISTANCE : 1.5)); // Fog starts closer
      const density = typeof FOG_3D_DENSITY !== 'undefined' ? FOG_3D_DENSITY : 0.4; // Denser fog
      const factor = Math.exp(-density * distFromFogStart * distFromFogStart);
      return Math.max(0, Math.min(1, factor));
    }
    const maxDist = typeof MAX_RAY_DISTANCE !== 'undefined' ? MAX_RAY_DISTANCE : 20;
    const rawFog = constrain(1 - (dist / maxDist) * (typeof FOG_DENSITY !== 'undefined' ? FOG_DENSITY : 1), 0, 1);
    return Math.max(rawFog, (typeof AMBIENT_LIGHT_MINIMUM !== 'undefined' ? AMBIENT_LIGHT_MINIMUM : 0.1));
  }

  drawMinecraftBlock(g, tileId, nightFactor) {
    // Couleurs harmonisées avec le mode 2D en cas d'absence de fichier
    const cols = { 
      1: [130, 130, 130], // Stone
      2: [76, 155, 60],   // Grass
      3: [134, 96, 67],   // Dirt
      4: [90, 130, 90],   // Wood
      5: [220, 195, 100], // Plank
      6: [220, 30, 30]    // Lava
    };
    const c = cols[tileId] || [100, 100, 100];
    g.fill(c[0] * nightFactor, c[1] * nightFactor, c[2] * nightFactor);
    g.noStroke();

    if (tileId === 6) {
      // LAVA OPTIMIZATION: Use a flat plane instead of a full box
      // Offset slightly to Y=-0.49 to avoid Z-fighting with the floor
      g.translate(0, 0.49, 0);
      g.rotateX(Math.PI / 2);
      g.plane(1.0, 1.0);
    } else {
      g.box(1.0);  // Standard 1x1x1 block for walls
    }
  }

  /**
   * Calcule la couleur du zombie en fonction de ses dégâts et du brouillard
   */
  getZombieColorWithDamageAndFog(orb, fogFactor) {
    const healthFrac = orb.health / orb.maxHealth;
    // Plus le zombie est blessé, plus il devient rouge/sombre
    const zR = lerp(255, 100, healthFrac) * fogFactor;
    const zG = lerp(50, 140, healthFrac) * fogFactor;
    const zB = lerp(50, 80, healthFrac) * fogFactor;
    return [zR, zG, zB];
  }

  /**
   * Dessine la barre de vie visuelle au-dessus du zombie
   */
  drawZombieHealthBar3D(g, orb, fogFactor) {
    const healthFrac = orb.health / orb.maxHealth;
    g.noStroke();
    
    // Fond rouge (santé manquante)
    g.push();
    g.fill(255 * fogFactor, 0, 0); 
    g.box(0.5, 0.05, 0.02);
    g.pop();

    // Barre verte (santé actuelle)
    g.push();
    g.translate((healthFrac - 1) * 0.25, 0, 0.01);
    g.fill(0, 255 * fogFactor, 0);
    g.box(0.5 * healthFrac, 0.05, 0.02);
    g.pop();
  }

  /**
   * Affiche les indicateurs orange avant le spawn des zombies
   */
  drawUpcomingSpawns3D(g, playerJump) {
    const now = millis();
    for (const spawn of this.gameManager.upcomingSpawns) {
      const timeUntilSpawn = spawn.actualSpawnTime - now;
      const alpha = map(timeUntilSpawn, 0, this.gameManager.SPAWN_INDICATOR_DURATION_MS, 0, 255);
      if (alpha <= 0) continue;
      g.push();
      g.translate(spawn.x, -0.8 - playerJump + Math.sin(now * 0.005) * 0.1, spawn.y);
      g.rotateY(-this.player.angle - Math.PI / 2);
      g.noStroke();
      g.fill(255, 165, 0, alpha);
      g.sphere(0.3, 12, 12);
      g.pop();
    }
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
   * Return 3D mode status for logging
   */
  getStatus() {
    return {
      mode: "3D WEBGL",
      description: "Minecraft-style voxel blocks with 3D camera and textured zombie models",
    };
  }
}

window.Game3DMode = Game3DMode;
