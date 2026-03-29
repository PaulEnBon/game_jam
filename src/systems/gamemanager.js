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

class Bomb {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 6.0; // Vitesse de lancer
    this.timer = 1500; // Explose après 1.5s
    this.exploded = false;
    this.explosionRadius = 5;
    this.explosionTime = 0;
    this.done = false;
  }

  update(dtMs) {
    if (this.exploded) {
      if (millis() - this.explosionTime > 800) {
        this.done = true;
      }
      return;
    }

    this.timer -= dtMs;
    
    const nextX = this.x + Math.cos(this.angle) * this.speed * (dtMs / 1000);
    const nextY = this.y + Math.sin(this.angle) * this.speed * (dtMs / 1000);
    
    if (!isWorldBlocked(nextX, nextY, 0.2)) {
      this.x = nextX;
      this.y = nextY;
    } else {
      this.timer = 0; // Explose si elle touche un mur
    }

    if (this.timer <= 0) {
      this.exploded = true;
      this.explosionTime = millis();
    }
  }

  isDone() { return this.done; }
}
window.Bomb = Bomb;

window.PRELOADED_ZOMBIE_SKIN_IMAGE = null;
window.PRELOADED_ZOMBIE_SKIN_PIXELS = null;

function preloadZombieSkinTexture() {
  // Load Zombie texture from embedded base64 data or external file
  // En mode fichier (file://), ou si Zombie.png n'existe pas, utilise les données embedded
  
  const isLocalFile = window.location.protocol === 'file:';
  
  try {
    // First, try to load from external file (if on localhost server)
    if (!isLocalFile && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      console.log("ℹ️  Attempting to load Zombie.png from server...");
      window.PRELOADED_ZOMBIE_SKIN_IMAGE = loadImage(
        'Zombie.png',
        () => {
          // Une fois chargée, extrais tous les pixels en mémoire pour accès rapide
          const img = window.PRELOADED_ZOMBIE_SKIN_IMAGE;
          img.loadPixels();
          window.PRELOADED_ZOMBIE_SKIN_PIXELS = new Uint8Array(img.pixels);
          img.updatePixels();
          console.log("✓ Zombie PNG chargé depuis serveur (64×64) - texture prête pour 3D");
        },
        (err) => {
          console.warn("⚠️  Zombie.png non trouvé sur serveur, utilisation fallback embedded:", err);
          loadZombieTextureFromEmbedded();
        }
      );
    } else {
      if (isLocalFile) console.log("ℹ️  Running via file:// protocol - loading embedded zombie texture");
      loadZombieTextureFromEmbedded();
    }
  } catch (err) {
    console.warn("⚠️  Zombie texture loading error:", err);
    loadZombieTextureFromEmbedded();
  }
}

function loadZombieTextureFromEmbedded() {
  // Charge la texture depuis les données embedded base64
  if (!window.EMBEDDED_ZOMBIE_SKIN_DATA_URI || typeof window.EMBEDDED_ZOMBIE_SKIN_DATA_URI !== 'string' || window.EMBEDDED_ZOMBIE_SKIN_DATA_URI.trim() === "") {
    console.warn("❌ Embedded zombie texture data not available");
    window.PRELOADED_ZOMBIE_SKIN_IMAGE = null;
    return;
  }
  
  try {
    // Use p5.js loadImage with the data URI
    window.PRELOADED_ZOMBIE_SKIN_IMAGE = loadImage(
      window.EMBEDDED_ZOMBIE_SKIN_DATA_URI,
      () => {
        // Image loaded successfully
        const img = window.PRELOADED_ZOMBIE_SKIN_IMAGE;
        if (img && img.width > 0) {
          img.loadPixels();
          window.PRELOADED_ZOMBIE_SKIN_PIXELS = new Uint8Array(img.pixels);
          img.updatePixels();
          console.log("✓ Zombie texture chargé depuis embedded base64 (64×64) - texture prête pour 3D");
        }
      },
      (err) => {
        console.error("❌ Failed to load embedded zombie texture:", err);
        window.PRELOADED_ZOMBIE_SKIN_IMAGE = null;
      }
    );
  } catch (err) {
    console.error("❌ Error loading embedded zombie texture:", err);
    window.PRELOADED_ZOMBIE_SKIN_IMAGE = null;
  }
}

/**
 * Draws a sharp cubic block in 3D WEBGL mode
 * Uses box() with minimal detail for crisp edges
 */
function drawSharpBox(g, w = 1, h = 1, d = 1, color = null) {
  const ctx = g || globalThis;
  
  if (color) ctx.fill(color);
  
  // box(width, height, depth, detailX, detailY)
  // detailX and detailY control tessellation - 1 = no extra faces
  ctx.box(w, h, d, 1, 1);
}

// Minecraft-style block - single solid cube
function drawMinecraftBlock(g, blockType, nightFactor = 0) {
  g.noStroke();
  
  // Colors per block type
  const colorMap = {
    1: { main: [128, 128, 128] },      // Stone
    2: { main: [139, 90, 43] },         // Dirt
    3: { main: [107, 142, 35] },        // Grass (green)
    4: { main: [100, 100, 100] },       // Mossy cobble
    5: { main: [255, 255, 150] },       // Glowstone
    6: { main: [255, 140, 0] },         // Lava
    7: { main: [139, 69, 19] },         // Plank
    8: { main: [34, 139, 34] },         // Leaves
    9: { main: [16, 16, 16] },          // Obsidian
    10: { main: [210, 180, 140] },      // Tan plank
    11: { main: [20, 20, 20] }          // Dark obsidian
  };
  
  const colors = colorMap[blockType] || colorMap[2];
  const lightMult = 1.0 - (nightFactor * 0.3);
  
  const r = colors.main[0] * lightMult;
  const c = colors.main[1] * lightMult;
  const b = colors.main[2] * lightMult;
  
  g.fill(r, c, b);
  g.box(1, 1, 1, 1, 1);  // Single 1×1×1 cube
}

class GameManager {
  constructor() {
    // Bindings
    // Inventory initialization
    this.inventory = {
      ammoPack: 0,
      bomb: 0,
      pulseCore: 0
    };
    this.punchMachinePrice = 2000; // Prix de départ plus accessible
    this.isBombAiming = false;
    this.gold = 0;
    this.weaponLevel = 1;
    this.SPAWN_INDICATOR_DURATION_MS = 1500; // Durée de l'alerte orange avant le spawn
    this.INTER_WAVE_DURATION_MS = 5000;      // Temps de pause entre deux vagues
    this.boundCaptureRebindKey = (event) => this.captureRebindKey(event);
    this.canvasEl = null;

    // z-buffer for sprite rendering (one entry per screen column)
    this.zBuffer = new Float32Array(RAY_COUNT);
    this.rayDirXBuffer = new Float32Array(RAY_COUNT);
    this.rayDirYBuffer = new Float32Array(RAY_COUNT);
    this.zombieSpriteCache = this.createZombieSpriteCache();
    this.collectOrbSpriteCache = this.createCollectOrbSpriteCache();

    // Initialize player before any code that uses it
    // Default spawn coordinates (center of map, can be changed as needed)
    this.player = new Player(12.5, 12.5);

    // Always initialize orbs and particles as empty arrays
    this.orbs = [];
    this.particles = [];
    this.worldModules = [];
    this.upcomingSpawns = []; // Initialize to prevent "not iterable" error
    this.drops = [];
    this.bulletTracers = [];

    this.bombs = [];
    this.orbStunUntilMap = new Map();

    // --- Correction: map size sync ---
    this.mapWidth = typeof MAP_TILE_COUNT !== 'undefined' ? MAP_TILE_COUNT : 40;
    this.mapHeight = typeof MAP_TILE_COUNT !== 'undefined' ? MAP_TILE_COUNT : 40;

    // 3D Scene Manager (NEW)
    this.scene3D = new Zombie3DSceneManager();
    this.scene3D.init(window.PRELOADED_ZOMBIE_SKIN_IMAGE);
    // Détecter le protocole: 3D sur localhost, 2D sur fichier
    const isLocalhost = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    this.use3DMode = false;  // Désactivé par défaut (activé au startNewGame selon protocole)
    this.isLocalhostServer = isLocalhost;  // Pour endGame/restart
    this.webglGraphics = null;  // p5.Renderer for WEBGL mode
    // Initialize rendering mode classes
    this.gameMode2D = new Game2DMode(this);
    this.gameMode3D = new Game3DMode(this);
    this.drasticTracer = false;
    this.motionBlurEnabled = MOTION_BLUR_ENABLED;
    this.motionBlurBuffer = this.motionBlurEnabled ? this.createMotionBlurBuffer() : null;
    this.motionBlurAmount = 0;
    this.motionBlurFrameCounter = 0;
    this.prevPlayerPosX = this.player.posX;
    this.prevPlayerPosY = this.player.posY;
    this.prevPlayerAngle = this.player.angle;
  }

  // Update all bombs: move, check explosion, clean up
  updateBombs(dt) {
    if (!this.bombs) return;
    for (const bomb of this.bombs) {
      if (typeof bomb.update === 'function') {
        const wasExploded = bomb.exploded;
        bomb.update(dt * 1000); 
        
        // Gestion des dégâts lors de l'explosion
        if (bomb.exploded && !wasExploded) {
          this.addScreenShake(6, 300);
          for (let i = this.orbs.length - 1; i >= 0; i--) {
            const orb = this.orbs[i];
            if (orb.isHunter()) {
              const d = Math.hypot(orb.posX - bomb.x, orb.posY - bomb.y);
              if (d < bomb.explosionRadius) {
                this.killHunter(orb);
              }
            }
          }
        }
      }
    }
    // Remove bombs that are done
    this.bombs = this.bombs.filter(bomb => !(typeof bomb.isDone === 'function' && bomb.isDone()));
  }

  // Activation du pulse : repousse toutes les unités à moins de 10 blocs
  activatePulse() {
    const radius = 10;
    this.pulseEffectActive = true;
    this.pulseEffectStart = millis();

    for (const orb of this.orbs) {
      if (!orb.isHunter()) continue;
      const dx = orb.posX - this.player.posX;
      const dy = orb.posY - this.player.posY;
      const dist = Math.hypot(dx, dy);
      
      if (dist < radius) {
        const pushForce = 5 * (1 - dist / radius);
        const angle = Math.atan2(dy, dx);
        const nextX = orb.posX + Math.cos(angle) * pushForce;
        const nextY = orb.posY + Math.sin(angle) * pushForce;
        
        if (!isWorldBlocked(nextX, nextY, orb.radius)) {
          orb.posX = nextX;
          orb.posY = nextY;
        }
      }
    }
    this.addScreenShake(4, 200);
  }
  
  // Load or create a floor texture
  initFloorTexture() {
    // Texture will be created on first use (lazy loading)
    // when p5.js context is fully available
    this.floorTextureNeedsInit = true;
    
    // Try to load saved texture from localStorage first
    // Force clear old textures to regenerate
    localStorage.removeItem('floor_texture_base64');
    this.loadFloorTextureFromStorage();
  }
  
  // Load floor texture from localStorage (persistent across sessions)
  loadFloorTextureFromStorage() {
    try {
      const savedTextureData = localStorage.getItem('floor_texture_base64');
      if (savedTextureData) {
        const img = new Image();
        img.onload = () => {
          // Only use saved texture if it's the correct small size (32x32)
          if (img.width === 32 && img.height === 32) {
            this.setFloorTextureFromImage(img);
            console.log('✅ Floor texture loaded from saved data');
          } else {
            // Old texture detected, regenerate new one
            console.log('⚠️ Old texture format detected, regenerating...');
            localStorage.removeItem('floor_texture_base64');
            this.floorTextureNeedsInit = true;
          }
        };
        img.onerror = () => {
          console.warn('Saved floor texture corrupted, will create default');
          localStorage.removeItem('floor_texture_base64');
          this.floorTextureNeedsInit = true;
        };
        img.src = savedTextureData;
      }
    } catch (e) {
      console.warn('Could not load saved floor texture:', e);
    }
  }
  
  // Save floor texture to localStorage for next session
  saveFloorTextureToStorage() {
    if (!this.floorTexture) return;
    
    try {
      let canvasToSave = null;
      
      // Handle p5.Image
      if (this.floorTexture.canvas) {
        canvasToSave = this.floorTexture.canvas;
      } 
      // Handle native canvas
      else if (this.floorTexture instanceof HTMLCanvasElement) {
        canvasToSave = this.floorTexture;
      }
      
      if (canvasToSave) {
        const dataUrl = canvasToSave.toDataURL('image/png');
        localStorage.setItem('floor_texture_base64', dataUrl);
        console.log('✅ Floor texture saved for next session');
      } else {
        console.warn('⚠️ Could not save texture (unsupported format)');
      }
    } catch (e) {
      console.warn('Could not save floor texture:', e);
    }
  }
  
  // Create floor texture if not already created
  ensureFloorTextureCreated() {
    if (this.floorTexture) {
      return;  // Already created
    }
    
    try {
      console.log('Creating floor texture...');
      // Create a small repeating texture the size of one tile block
      // This will repeat across the entire floor
      const textureSize = 32;  // Size of one block
      
      // Create canvas for texture
      const canvas = document.createElement('canvas');
      canvas.width = textureSize;
      canvas.height = textureSize;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get canvas context');
        return;
      }
      
      // Draw checkerboard pattern: green and tan
      const halfSize = textureSize / 2;
      
      // Top-left: green
      ctx.fillStyle = 'rgb(118, 140, 78)';
      ctx.fillRect(0, 0, halfSize, halfSize);
      
      // Top-right: tan
      ctx.fillStyle = 'rgb(140, 115, 78)';
      ctx.fillRect(halfSize, 0, halfSize, halfSize);
      
      // Bottom-left: tan
      ctx.fillStyle = 'rgb(140, 115, 78)';
      ctx.fillRect(0, halfSize, halfSize, halfSize);
      
      // Bottom-right: green
      ctx.fillStyle = 'rgb(118, 140, 78)';
      ctx.fillRect(halfSize, halfSize, halfSize, halfSize);
      
      // Convert canvas to p5.Image
      let img = createImage(textureSize, textureSize);
      img.canvas.getContext('2d').drawImage(canvas, 0, 0);
      
      this.floorTexture = img;
      console.log('✅ Block-sized floor texture created (32x32)');
      console.log('Texture object:', this.floorTexture);
    } catch (e) {
      console.error('❌ Could not create floor texture:', e);
    }
  }
  
  // Public method to set floor texture from external image
  setFloorTextureFromImage(imgElement) {
    if (!imgElement) {
      console.error('❌ No image element provided');
      return;
    }
    
    console.log('🔄 Setting floor texture from image...');
    
    try {
      // Check if image has valid dimensions
      if (!imgElement.width || !imgElement.height) {
        console.error('❌ Image has invalid dimensions:', imgElement.width, imgElement.height);
        return;
      }
      
      console.log(`📐 Image dimensions: ${imgElement.width}x${imgElement.height}`);
      
      // Create a p5.Image from the loaded image element
      let p5img = createImage(imgElement.width, imgElement.height);
      p5img.canvas.getContext('2d').drawImage(imgElement, 0, 0);
      
      // Store as p5.Image for WEBGL compatibility
      this.floorTexture = p5img;
      console.log('✅ Floor texture set from image');
      
      // Auto-save to localStorage for next session
      this.saveFloorTextureToStorage();
      console.log('✅ Floor texture set and saved for next session');
      
    } catch (e) {
      console.error('❌ Error setting floor texture:', e);
      console.error('Stack:', e.stack);
    }
  }
  
  // Public method to set floor texture from data URL
  setFloorTextureFromURL(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.setFloorTextureFromImage(img);
    };
    img.src = dataUrl;
  }

  // ----------------------------------------------------------
  //  DOM wiring
  // ----------------------------------------------------------
  initDOM() {
    this.startOverlay     = document.getElementById("start-overlay");
    this.gameOverOverlay  = document.getElementById("game-over-overlay");
    this.gameOverTitleEl  = document.getElementById("game-over-title");
    this.finalScoreEl     = document.getElementById("final-score");
    this.gameOverReasonEl = document.getElementById("game-over-reason");
    this.restartBtn       = document.getElementById("restart-button");
    this.pauseOverlay     = document.getElementById("pause-overlay");
    this.resumeBtn        = document.getElementById("resume-button");
    this.pauseSettingsBtn = document.getElementById("pause-settings-button");
    this.pauseRestartBtn  = document.getElementById("pause-restart-button");
    this.startBtn         = document.getElementById("start-button");
    this.openSettingsBtn  = document.getElementById("open-settings-button");
    this.settingsOverlay  = document.getElementById("settings-overlay");
    this.closeSettingsBtn = document.getElementById("close-settings-button");
    this.resetControlsBtn = document.getElementById("reset-controls-button");
    this.settingsStatusEl = document.getElementById("settings-status");
    this.sensitivityInput = document.getElementById("sensitivity-input");
    this.sensitivityValueEl = document.getElementById("sensitivity-value");
    this.volumeInput = document.getElementById("volume-input");
    this.volumeValueEl = document.getElementById("volume-value");
    this.controlLegendEl  = document.getElementById("control-legend");
    this.bindButtons      = Array.from(document.querySelectorAll(".bind-button"));
    this.canvasEl         = document.querySelector("canvas");

    // Restart button
    if (this.restartBtn) {
      this.restartBtn.addEventListener("click", () => this.startNewGame());
    }

    if (this.resumeBtn) {
      this.resumeBtn.addEventListener("click", () => this.resumeGame());
    }

    if (this.pauseSettingsBtn) {
      this.pauseSettingsBtn.addEventListener("click", () => this.openSettingsMenu());
    }

    if (this.pauseRestartBtn) {
      this.pauseRestartBtn.addEventListener("click", () => this.startNewGame());
    }

    if (this.startBtn) {
      this.startBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.requestPointerLock();
        this.startNewGame();
      });
    }

    if (this.openSettingsBtn) {
      this.openSettingsBtn.addEventListener("click", (event) => {
        event.preventDefault();
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
        resetLookSensitivity();
        this.refreshBindingButtons();
        this.refreshSensitivityControl();
        this.renderControlLegend();
        this.setSettingsStatus("Touches et sensibilite reinitialisees.");
      });
    }

    if (this.sensitivityInput) {
      this.sensitivityInput.addEventListener("input", () => {
        this.handleSensitivityInput(this.sensitivityInput.value);
      });
    }

    if (this.volumeInput) {
      this.volumeInput.addEventListener("input", () => {
        this.handleVolumeInput(this.volumeInput.value);
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
      this.startOverlay.addEventListener("click", (event) => {
        const clickedButton = event.target.closest("button");
        if (clickedButton) return;
        if (this.isSettingsVisible()) return;
        this.requestPointerLock();
        this.startNewGame();
      });
    }

    this.refreshBindingButtons();
    this.refreshSensitivityControl();
    this.renderControlLegend();
  }

  requestPointerLock() {
    const cvs = document.querySelector("canvas");
    if (cvs && cvs.requestPointerLock) cvs.requestPointerLock();
  }

  isPointerLocked() {
    const cvs = document.querySelector("canvas");
    return !!(cvs && document.pointerLockElement === cvs);
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
    // TODO: Pause music
    // Uncomment when music system is ready
    // this.pauseMusic();
    this.showPauseOverlay();
  }

  resumeGame() {
    if (this.gameState !== "paused") return;
    this.closeSettingsMenu();
    this.hidePauseOverlay();
    this.gameState = "playing";
    // TODO: Resume music
    // Uncomment when music system is ready
    // this.resumeMusic();
    this.requestPointerLock();
  }

  handleEscapeKey() {
    if (this.pendingRebindAction) {
      this.cancelPendingRebind();
      this.refreshBindingButtons();
      this.setSettingsStatus("Modification annulée.");
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

  // Toggle pause with 'P' key
  togglePause() {
    if (this.gameState === "playing") {
      this.pauseGame();
    } else if (this.gameState === "paused") {
      this.resumeGame();
    }
  }

  // Set player sensitivity (0.3 to 2.0, default 1.0)
  setSensitivity(value) {
    const sensitivity = constrain(value, SETTINGS_SENSITIVITY_MIN, SETTINGS_SENSITIVITY_MAX);
    this.playerSensitivity = sensitivity;
    if (this.player) {
      this.player.rotateSensitivity = PLAYER_ROTATE_SPEED * sensitivity;
      this.player.pitchSensitivity = PLAYER_PITCH_SPEED * sensitivity;
    }
    localStorage.setItem("betrayalbox_sensitivity", sensitivity.toString());
  }

  // Get current sensitivity
  getSensitivity() {
    return this.playerSensitivity;
  }

  // Set master volume (0.0 to 1.0)
  setVolume(value) {
    const volume = constrain(value, SETTINGS_VOLUME_MIN, SETTINGS_VOLUME_MAX);
    this.masterVolume = volume;
    // Apply volume to all sound effects if they exist
    if (window.audioContext) {
      window.audioContext.masterGain?.gain?.setValueAtTime(volume, window.audioContext.currentTime);
    }
    localStorage.setItem("betrayalbox_volume", volume.toString());
  }

  // Get current volume
  getVolume() {
    return this.masterVolume;
  }

  // Load saved settings from localStorage
  loadSavedSettings() {
    const savedSensitivity = localStorage.getItem("betrayalbox_sensitivity");
    if (savedSensitivity) {
      this.setSensitivity(parseFloat(savedSensitivity));
    }
    const savedVolume = localStorage.getItem("betrayalbox_volume");
    if (savedVolume) {
      this.setVolume(parseFloat(savedVolume));
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

    // Gestion des actions selon l'item sélectionné
    if (this.selectedHotbarSlot === 2) {
      // Slot 2: Bombe (Clic Gauche pour lancer, Clic Droit pour viser)
      if (mouseButton === LEFT) {
        if (this.inventory.bomb > 0) this.throwBomb();
        else this.pushHudToast("Plus de bombes !", [255, 100, 100]);
      } else if (mouseButton === RIGHT) {
        this.isBombAiming = true;
      }
    } else if (mouseButton === LEFT) {
      if (this.selectedHotbarSlot === 1) {
        this.tryFireWeapon();
      } else if (this.selectedHotbarSlot === 3) {
        if (this.inventory.pulseCore > 0) {
          this.activatePulse();
          this.inventory.pulseCore--;
          this.pushHudToast("Pulse activé !", [220, 180, 255]);
        } else {
          this.pushHudToast("Plus de Pulse !", [220, 180, 255]);
        }
      }
    }
  }

  throwBomb() {
    this.isBombAiming = false;
    if (this.inventory.bomb > 0) {
      if (typeof window.Bomb === 'function') {
        const bomb = new window.Bomb(this.player.posX, this.player.posY, this.player.angle);
        this.bombs.push(bomb);
        this.inventory.bomb--;
        this.pushHudToast("Bombe lancée !", [255, 150, 150]);
      }
    }
  }

  handlePrimaryRelease() {
    if (this.gameState !== "playing") return;
    
    // Relâcher le clic droit annule la visée de la bombe
    if (this.selectedHotbarSlot === 2 && mouseButton === RIGHT) {
      this.isBombAiming = false;
    }
  }

  handleStartInput() {
    if (this.gameState !== "waiting") return false;
    if (this.isSettingsVisible()) return false;
    this.requestPointerLock();
    this.startNewGame();
    return true;
  }

  getSelectedActiveItem() {
    if (this.selectedHotbarSlot === 1) return { type: 'pistol' };
    if (this.selectedHotbarSlot === 2) return { type: 'bomb' };
    if (this.selectedHotbarSlot === 3) return { type: 'pulse' };
    return null;
  }

  handleHotbarInput(rawKey, rawKeyCode = null) {
    if (this.gameState !== "playing") return false;
    if (this.isSettingsVisible()) return false;

    // Toggle 3D mode with 'O' key
    if (rawKey === "o" || rawKey === "O" || rawKeyCode === 79) {
      this.toggle3DMode();
      return true;
    }

    // Toggle drastic tracer mode with 'T' key
    if (rawKey === "t" || rawKey === "T" || rawKeyCode === 84) {
      this.drasticTracer = !this.drasticTracer;
      this.pushHudToast(this.drasticTracer ? "TRAINÉE DRASTIQUE: ON" : "TRAINÉE DRASTIQUE: OFF", [255, 255, 100]);
      return true;
    }

    let slot = 0;
    if (rawKey === "1" || rawKeyCode === 49 || rawKeyCode === 97) slot = 1;
    else if (rawKey === "2" || rawKeyCode === 50 || rawKeyCode === 98) slot = 2;
    else if (rawKey === "3" || rawKeyCode === 51 || rawKeyCode === 99) slot = 3;

    if (slot === 0) return false;

    this.selectedHotbarSlot = slot;

    return false;
  }

  handleMouseWheelSlot(deltaY) {
    if (this.gameState !== "playing") return false;
    if (this.isSettingsVisible()) return false;
    if (typeof deltaY !== "number" || deltaY === 0) return false;

    const dir = deltaY > 0 ? 1 : -1;
    this.selectedHotbarSlot = ((this.selectedHotbarSlot - 1 + dir + 3) % 3) + 1;

    if (this.selectedHotbarSlot === 1) {
      this.pushHudToast("Slot actif: Pistol", [200, 200, 200]);
    } else if (this.selectedHotbarSlot === 2) {
      this.pushHudToast("Slot actif: Bomb", [255, 100, 100]);
    } else {
      this.pushHudToast("Slot actif: Pulse", [220, 180, 255]);
    }

    return true;
  }

  pushHudToast(text, colorArray = [220, 240, 255]) {
    this.hudToastText = text;
    this.hudToastColor = colorArray;
    this.hudToastUntilMs = millis() + HUD_TOAST_DURATION_MS;
  }

  recoverAmmo(amount, toastText = "", colorArray = [255, 220, 110]) {
    if (amount <= 0) return 0;

    const before = this.weaponInventoryAmmo;
    // Ajout à l'inventaire avec limite dynamique
    const maxInv = this.getMaxInventoryAmmo();
    this.weaponInventoryAmmo = Math.min(maxInv, this.weaponInventoryAmmo + amount);
    const gained = this.weaponInventoryAmmo - before;

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
    } else if (itemKey === "pulseCore") {
      const fakeModule = { type: this.randomModuleType(), posX: this.player.posX, posY: this.player.posY };
      this.activateWorldModule(fakeModule);
      this.spawnCollectParticles(this.player.posX, this.player.posY, [220, 180, 255]);
      this.pushHudToast("Pulse core activé", [220, 180, 255]);
    }

    return true;
  }

  isSettingsVisible() {
    return !!(this.settingsOverlay && this.settingsOverlay.classList.contains("visible"));
  }

  openSettingsMenu() {
    if (!this.settingsOverlay) return;
    this.cancelPendingRebind();
    this.refreshBindingButtons();
    this.refreshSensitivityControl();
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

  refreshSensitivityControl() {
    const value = getLookSensitivity();
    if (this.sensitivityInput) {
      this.sensitivityInput.value = value.toFixed(2);
    }
    if (this.sensitivityValueEl) {
      this.sensitivityValueEl.textContent = value.toFixed(2) + "x";
    }
  }

  handleSensitivityInput(rawValue) {
    const newValue = setLookSensitivity(rawValue);
    if (this.sensitivityValueEl) {
      this.sensitivityValueEl.textContent = newValue.toFixed(2) + "x";
    }
  }

  handleVolumeInput(rawValue) {
    const newValue = parseFloat(rawValue);
    this.setVolume(newValue);
    if (this.volumeValueEl) {
      this.volumeValueEl.textContent = Math.round(newValue * 100) + "%";
    }
  }

  onViewportResize() {
    this.zBuffer = new Float32Array(RAY_COUNT);
    this.rayDirXBuffer = new Float32Array(RAY_COUNT);
    this.rayDirYBuffer = new Float32Array(RAY_COUNT);
    this.motionBlurBuffer = this.motionBlurEnabled ? this.createMotionBlurBuffer() : null;
    this.motionBlurAmount = 0;
    this.motionBlurFrameCounter = 0;
    this.syncMotionBlurReference();
  }

  // ----------------------------------------------------------
  //  Game lifecycle
  // ----------------------------------------------------------
  startNewGame() {
    this.closeSettingsMenu();
    this.hidePauseOverlay();
    
    this.gold = 0; // Réinitialisation stricte de l'or
    this.weaponLevel = 1; // Reset du niveau de l'arme
    this.punchMachinePrice = 2000; // Reset du prix de la machine
    // Load saved settings (sensitivity, volume)
    this.loadSavedSettings();
    
    generateWorldMap();

    const now = millis();

    this.gameState = "playing";
    // Activer 3D si sur localhost, sinon rester en 2D
    this.use3DMode = this.isLocalhostServer;
    console.log("🎮 Game started - 3D Mode:", this.use3DMode, "isLocalhostServer:", this.isLocalhostServer);
    // TODO: Start gameplay music (works for both 2D and 3D modes)
    // Uncomment when music system is ready
    // this.playMusic('gameplay'); // or 'gameplay-2d', 'gameplay-3d' depending on this.use3DMode
    this.player.resetToSpawn();
    this.player.moveSpeed = PLAYER_MOVE_SPEED;
    this.orbs = [];
    this.particles = [];
    this.worldModules = [];
    this.drops = [];
    this.inventory.ammoPack = 0;
    this.inventory.bomb = 0;
    this.inventory.pulseCore = 0;
    this.selectedHotbarSlot = 1;
    this.pulseEffectActive = false;
    this.pulseEffectStart = 0;
    this.hudToastText = "";
    this.hudToastUntilMs = 0;
    this.score = 0;
    this.finalScore = 0;
    this.gameOverReason = "";
    this.gameWon = false;
    this.killStreak = 0;
    this.killStreakUntilMs = 0;
    this.interWaveUntilMs = 0;
    this.waveNumber = 1;
    this.waveState = "preparing";
    this.waveEnemiesTotal = 0;

    // Paramètres de corruption ralentis
    this.CORRUPTION_TILES_PER_FRAME_LOCAL = 1; 
    this.CORRUPTION_FRAME_DELAY = 12; // Un bloc toutes les 12 frames (~5 blocs par seconde)
    this.corruptionFrameCounter = 0;
    this.CORRUPTION_INTERVAL_SECONDS_LOCAL = 35; // Une nouvelle couche toutes les 35 secondes
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesKilled = 0;
    this.waveKillsRequired = 0;  // Kills needed to complete the wave
    this.waveMaxSimultaneous = 0;
    this.upcomingSpawns = [];
    this.waveSpawnIntervalMs = 0;
    this.nextWaveActionMs = now + WAVE_START_DELAY_MS;
    this.sprintEnergy = SPRINT_ENERGY_MAX;
    this.sprintActive = false;
    this.lastSprintUseMs = 0;
    this.powerDamageUntilMs = 0;
    this.powerRapidUntilMs = 0;
    this.powerInstakillUntilMs = 0;
    this.punchMachineInteractLatch = false;
    this.punchMachine = null;
    this.weaponMagazineAmmo = WEAPON_START_MAGAZINE;
    this.weaponInventoryAmmo = WEAPON_START_INVENTORY;
    this.weaponLastShotMs = 0;
    this.weaponFlashUntilMs = 0;
    this.weaponReloadingUntilMs = 0;
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
    this.spawnPunchMachine();

    // Hide overlays
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
    this.use3DMode = false;  // Désactiver le mode 3D à la mort
    this.finalScore = Math.floor(this.score);
    this.gameOverReason = reason;
    this.gameWon = isVictory;
    this.player.moveSpeed = PLAYER_MOVE_SPEED;
    this.sprintActive = false;

    this.hidePauseOverlay();
    this.closeSettingsMenu();

    // TODO: Stop gameplay music and play end-game music
    // Uncomment when music system is ready
    // if (isVictory) {
    //   this.playMusic('victory');
    // } else {
    //   this.playMusic('game-over');
    // }

    // Release pointer lock
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

  /**
   * Toggle between 2D raycast and 3D WEBGL rendering
   * Useful for testing and comparison
   */
  toggle3DMode() {
    if (!this.scene3D.textureLoaded) {
      console.warn("⚠️  3D mode unavailable: texture not loaded");
      return false;
    }
    this.use3DMode = !this.use3DMode;
    this.scene3D.updateZombies(this.orbs);
    const status = this.scene3D.getStatus();
    console.log(`🎮 Switched to ${status.mode} mode`);
    return true;
  }

  /**
   * Toggle the 3D bullet tracer visibility
   */
  toggleTracer3D() {
    this.tracer3DEnabled = !this.tracer3DEnabled;
    this.pushHudToast(
      this.tracer3DEnabled ? "Trainée 3D: ON" : "Trainée 3D: OFF",
      this.tracer3DEnabled ? [180,255,180] : [255,180,180]
    );
  }

  /**
   * Get current render mode status
   */
  getRenderModeStatus() {
    return this.scene3D.getStatus();
  }

  // ----------------------------------------------------------
  //  Main frame
  // ----------------------------------------------------------
  runFrame() {
    const dt = min(deltaTime / 1000, 0.05);

    // La simulation continue en mode jeu, entre-vague ou préparation
    if (this.gameState === "playing" || this.gameState === "inter-wave" || this.gameState === "preparing") {
      this.updateGame(dt);
    }

    this.updateMotionBlurState(dt);

    this.renderFrame();
  }

  // ----------------------------------------------------------
  //  UPDATE
  // ----------------------------------------------------------
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
    this.updateKillStreakState();
    this.score += SURVIVAL_POINTS_PER_SECOND * dt;
    // Bombes
    this.updateBombs(dt);
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
    // Base 20, +20 par niveau d'amélioration. 
    let damage = 20 + (this.weaponLevel - 1) * 20;
    if (this.isDamageBoostActive()) {
      damage *= POWERUP_DAMAGE_MULTIPLIER;
    }
    return damage;
  }

  getMaxMagazineSize() {
    // Chargeur de base 12, +3 balles par niveau d'amélioration
    const baseCap = typeof WEAPON_MAGAZINE_SIZE !== 'undefined' ? WEAPON_MAGAZINE_SIZE : 12;
    return baseCap + (this.weaponLevel - 1) * 3;
  }

  getMaxInventoryAmmo() {
    // Capacité d'inventaire de base (ex: 36), +12 balles par niveau d'amélioration
    const baseInv = typeof WEAPON_INVENTORY_AMMO_MAX !== 'undefined' ? WEAPON_INVENTORY_AMMO_MAX : 36;
    return baseInv + (this.weaponLevel - 1) * 12;
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

  // --- Wave mode (COD-like zombies) ---
  updateWaveSystem() {
    const now = millis();

    // Si le jeu est en état "inter-wave", le système de vagues est en pause.
    // La transition vers la prochaine vague est gérée par renderFrame()
    if (this.gameState === "inter-wave") {
      return;
    }

    if (this.waveState === "preparing") { // Cet état est atteint après le délai d'inter-vague
      if (now >= this.nextWaveActionMs) { // Attendre le petit délai de préparation
        console.log(`🚀 Transitioning from preparing → spawning for Wave ${this.waveNumber}`);
        this.startNextWave(); // Lance la vague
      }
      // Clear upcoming spawns if we transition out of preparing (e.g., game over)
      if (this.gameState !== "preparing") {
        this.upcomingSpawns = [];
      }
      return;
    }

    if (this.waveState !== "spawning" && this.waveState !== "in-progress") return;

    // Process upcoming spawns
    for (let i = this.upcomingSpawns.length - 1; i >= 0; i--) {
      const spawn = this.upcomingSpawns[i];
      if (now >= spawn.actualSpawnTime) {
        this.spawnHunterAt(spawn.x, spawn.y, spawn.speed, spawn.health);
        this.upcomingSpawns.splice(i, 1);
      }
    }

    // Schedule new spawns if conditions met
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

    // On vérifie la fin de vague si tous les ennemis prévus sont apparus et éliminés
    if (
      this.waveEnemiesSpawned >= this.waveEnemiesTotal &&
      this.waveEnemiesKilled >= this.waveKillsRequired &&
      this.upcomingSpawns.length === 0
    ) { 
      this.completeCurrentWave();
    }
  }

  startNextWave() {
    if (this.waveNumber === 0) this.waveNumber = 1; 
    
    // Update map size based on wave difficulty
    // this.updateMapSizeForWave(); // Déjà mis à jour dans completeCurrentWave
    
    // RESET corruption (lava) at each wave start
    this.corruptionLayer = 0;
    this.pendingCorruptionTiles = [];
    this.lastCorruptionTime = 0;
    
    // NETTOYAGE DE LA LAVE DU NIVEAU PRÉCÉDENT
    if (typeof worldTileMap !== 'undefined') {
      for (let r = 0; r < worldTileMap.length; r++) {
        for (let c = 0; c < worldTileMap[r].length; c++) {
          if (worldTileMap[r][c] === 6) worldTileMap[r][c] = 0;
        }
      }
    }
    
    // Croissance limitée : +5 zombies toutes les 3 vagues (~1.66 par vague)
    let baseCount = 5; 
    this.waveEnemiesTotal =
      baseCount + Math.floor((this.waveNumber - 1) * 1.66);
    
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesKilled = 0;
    
    // Reset upcoming spawns for the new wave
    this.upcomingSpawns = [];

    // Calculate kills required to end the wave
    this.waveKillsRequired = this.waveEnemiesTotal;
    
    this.waveMaxSimultaneous = Math.min(
      WAVE_MAX_SIMULTANEOUS_CAP,
      WAVE_MAX_SIMULTANEOUS_BASE + Math.floor(Math.max(0, this.waveNumber - 1) * WAVE_MAX_SIMULTANEOUS_GROWTH) // Base + 1 per wave

    );
    this.waveSpawnIntervalMs = Math.max(
      WAVE_SPAWN_INTERVAL_MIN_MS,
      WAVE_SPAWN_INTERVAL_BASE_MS - Math.max(0, this.waveNumber - 2) * WAVE_SPAWN_INTERVAL_DECAY_MS
    );

    this.waveState = "spawning";
    this.gameState = "playing"; // On repasse en mode jeu pour réactiver le tir

    // Augmenter la vitesse de spawn toutes les 4 vagues après la vague 4
    if (this.waveNumber > 4 && (this.waveNumber - 4) % 4 === 0) {
      this.waveSpawnIntervalMs += 200; // Ajoute 200ms à l'intervalle
      this.pushHudToast(`Spawn ralentis ! (+200ms)`, [255, 200, 100]);
    }
    this.nextWaveActionMs = millis() + 500;
    this.pushHudToast(`VAGUE ${this.waveNumber} - Tuez ${this.waveKillsRequired} zombies`, [255, 145, 110]);
    this.addScreenShake(2.6, 180);
  }
  
  updateMapSizeForWave() {
    // Scale map size: progressively increase by 2 tiles per wave
    // Wave 1: 40x40 (initial), Wave 2: 42x42, Wave 3: 44x44, ... (infinite)
    let newMapSize = 40 + (this.waveNumber - 1) * 1;
    
    // Skip on wave 1 - map already generated at game start
    if (this.waveNumber === 1) return;
    
    // Only regenerate if size actually changed
    if (MAP_TILE_COUNT === newMapSize) return;
    
    MAP_TILE_COUNT = newMapSize;
    MAP_SIZE = MAP_TILE_COUNT * TILE_SIZE;
    this.mapWidth = newMapSize;   // Update instance variables
    this.mapHeight = newMapSize;  // to match MAP_TILE_COUNT
    
    // Regenerate the world map with new size
    generateWorldMap();
    console.log(`🗺️ updateMapSizeForWave: MAP_TILE_COUNT=${MAP_TILE_COUNT}, this.mapWidth=${this.mapWidth}, this.mapHeight=${this.mapHeight}`);
    
    // Clear collectible orbs (safe/warning) to respawn them in new map
    // Keep wave hunters (patrol/chase) for continuity
    this.orbs = this.orbs.filter(orb => orb.state === "patrol" || orb.state === "chase");
    
    // Regenerate world modules in the new map size
    this.worldModules = [];
    this.spawnInitialWorldModules();
    
    // Recenter player at actual middle of new map (not constant MAP_TILE_COUNT!)
    const centerPos = this.mapWidth / 2 + 0.5;
    this.player.posX = centerPos;
    this.player.posY = centerPos;
    console.log(`🗺️ Map resized: ${newMapSize}×${newMapSize}, player recentered at (${centerPos}, ${centerPos})`);
    
    this.pushHudToast(`Carte: ${newMapSize}×${newMapSize} tuiles`, [180, 220, 255]);
  }
  
  calculateKillsRequiredForWave() {
    if (this.waveNumber === 1) return DIFFICULTY_WAVE_1_KILLS;
    if (this.waveNumber === 2) return DIFFICULTY_WAVE_2_KILLS;
    if (this.waveNumber === 3) return DIFFICULTY_WAVE_3_KILLS;
    // From wave 4 onwards: exponential growth
    return Math.floor(DIFFICULTY_WAVE_3_KILLS * Math.pow(DIFFICULTY_SCALE_KILLS, this.waveNumber - 3));
  }

  /**
   * Returns a difficulty multiplier based on the current wave number.
   */
  getWaveDifficultyMultiplier() {
    return 1.0 + (this.waveNumber - 1) * 0.05;
  }

  completeCurrentWave() {
    // Transition to inter-wave screen
    this.gameState = "inter-wave";
    this.interWaveUntilMs = millis() + 2000; // Délai de 2 secondes demandé

    // Calculate rewards (moved here to be given immediately upon wave completion)
    const baseRewardScore = WAVE_CLEAR_REWARD_SCORE + this.waveNumber * WAVE_CLEAR_REWARD_SCORE_PER_WAVE;
    const difficultyMultiplier = this.getWaveDifficultyMultiplier();
    const rewardScore = Math.floor(baseRewardScore * difficultyMultiplier);
    this.score += rewardScore; // Give score immediately

    const rewardAmmo = WAVE_CLEAR_REWARD_AMMO + Math.floor(this.waveNumber / 3);
    this.recoverAmmo(rewardAmmo, "Prime de vague", [255, 220, 120]); // Give ammo immediately

    this.pushHudToast(`Vague ${this.waveNumber} complétée! ${rewardScore} points`, [145, 230, 255]);

    if (this.waveNumber % 3 === 0) {
      this.spawnWorldModule();
    }
    
    // Passage technique au niveau suivant (pendant que l'écran s'affiche)
    this.waveNumber += 1;
    this.updateMapSizeForWave();

    this.waveState = "completed"; // Marque la vague comme terminée, en attente de la prochaine
    this.addScreenShake(2.0, 140);
  }

  countAliveHunters() {
    let count = 0;
    for (const orb of this.orbs) {
      if (orb.isHunter()) count++;
    }
    return count;
  }

  waveHunterHealth() {
    // Base 10. Progression de +10 par vague.
    // V1: 10, V5: 50, V10: 100.
    // Combiné aux dégâts (20), cela donne 1 shot au début, 3 shots V5, etc.
    return 10 + (this.waveNumber - 1) * 10;
  }

  spawnWaveHunter() {
    // Limit the number of orbs on the map
    const maxOrbs = this.maxOrbsOnMap || 50;
    if (this.orbs.length >= maxOrbs) {
      return false; // Cannot spawn more if limit reached
    }

    const pos = this.findWaveSpawnSpot();
    if (!pos) return false;

    const speed = ENEMY_BASE_SPEED + this.waveNumber * WAVE_ENEMY_SPEED_PER_WAVE + random(0, 0.28);
    const health = this.waveHunterHealth();

    // Ajout à la liste des spawns à venir pour afficher l'indicateur orange
    this.upcomingSpawns.push({
      x: pos.x,
      y: pos.y,
      speed: speed,
      health: health,
      actualSpawnTime: millis() + this.SPAWN_INDICATOR_DURATION_MS
    });

    return true;
  }

  spawnHunterAt(wx, wy, speed, health) {
    const hunter = new Orb(wx, wy, MAX_MUTATION_DELAY_MS * 4, speed);
    hunter.state = "chase";
    hunter.radius = ENEMY_WORLD_RADIUS;
    hunter.birthMs = millis() - MAX_MUTATION_DELAY_MS;
    hunter.warningStartMs = 0;
    hunter.health = Math.max(1, Math.floor(health)); // Ensure at least 1 HP
    hunter.maxHealth = hunter.health;
    hunter.spawnSource = "wave";
    hunter.noLoseAggro = true; // Zombies always chase once spawned
    this.orbs.push(hunter);
  }

  findWaveSpawnSpot() {
    // Pure random spawn anywhere on map, with 10.0 tile minimum distance from player
    const MIN_DISTANCE_FROM_PLAYER = 10.0;
    const MAX_ATTEMPTS = 200;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Pick random tile anywhere in the map
      const col = Math.floor(Math.random() * (this.mapWidth - 2)) + 1;
      const row = Math.floor(Math.random() * (this.mapHeight - 2)) + 1;

      // Must be walkable
      if (!this.isWalkableTile(row, col)) continue;

      // Must have at least 2 open neighbors (not in a tight corner)
      const openNeighbors = this.countOpenCardinalNeighbors(row, col);
      if (openNeighbors < 2) continue;

      const x = col + 0.5;
      const y = row + 0.5;

      // Must be at least 5 tiles away from player
      const distToPlayer = Math.hypot(x - this.player.posX, y - this.player.posY);
      if (distToPlayer < MIN_DISTANCE_FROM_PLAYER) continue;

      // Can't spawn on other orbs
      if (this.orbs.some((orb) => Math.hypot(x - orb.posX, y - orb.posY) < 1.2)) continue;

      // Found valid spot!
      return { x, y };
    }

    // Fallback if no spot found
    return this.findFreeWorldSpot(5.0);
  }

  // --- Punch Machine ---
  spawnPunchMachine() {
    const dist = 2.0; // Apparaît à 2 blocs devant le joueur
    this.punchMachine = {
      posX: constrain(this.player.posX + Math.cos(this.player.angle) * dist, 1.5, MAP_TILE_COUNT - 1.5),
      posY: constrain(this.player.posY + Math.sin(this.player.angle) * dist, 1.5, MAP_TILE_COUNT - 1.5),
      radius: PUNCH_MACHINE_RADIUS,
      lastUseMs: -PUNCH_MACHINE_COOLDOWN_MS,
    };
  }

  updatePunchMachineInteraction() {
    if (!this.punchMachine) return;

    // Utilise uniquement KeyA pour l'interaction
    const interactPressed = pressedKeyCodes.has("KeyQ");
    if (!interactPressed) {
      this.punchMachineInteractLatch = false;
      return; // Only check for 'A' key
    }

    if (this.punchMachineInteractLatch) return;
    this.punchMachineInteractLatch = true;

    const dist = Math.hypot(
      this.player.posX - this.punchMachine.posX,
      this.player.posY - this.punchMachine.posY
    );
    
    // On utilise une portée cohérente avec l'affichage (2.2 unités)
    if (dist > 2.2) {
      return;
    }

    this.activatePunchMachine();
  }

  activatePunchMachine() {
    if (!this.punchMachine) return;

    const now = millis();
    if (this.waveNumber < PUNCH_MACHINE_UNLOCK_WAVE) {
      this.pushHudToast(`ACCES REFUSE : VAGUE ${PUNCH_MACHINE_UNLOCK_WAVE} REQUISE`, [255, 100, 100]);
      return;
    }

    if (this.gold < this.punchMachinePrice) {
      this.pushHudToast(`OR INSUFFISANT ! (${this.punchMachinePrice} G)`, [255, 100, 100]);
      return;
    }

    const cooldownLeft = PUNCH_MACHINE_COOLDOWN_MS - (now - this.punchMachine.lastUseMs);
    if (cooldownLeft > 0) {
      const seconds = (cooldownLeft / 1000).toFixed(1);
      this.pushHudToast(`Punch recharge: ${seconds}s`, [210, 180, 255]);
      return;
    }

    this.gold -= this.punchMachinePrice;
    this.punchMachine.lastUseMs = now;
    
    // Amélioration effective
    this.weaponLevel++;
    // Augmentation du prix pour la prochaine fois
    this.punchMachinePrice += 2500;
    
    // RECHARGE AUTOMATIQUE lors de l'amélioration (standard Zombie)
    this.weaponMagazineAmmo = this.getMaxMagazineSize();
    this.weaponInventoryAmmo = this.getMaxInventoryAmmo();
    
    this.pushHudToast(`ARME AMÉLIORÉE (NIV. ${this.weaponLevel}) + MUNITIONS MAX !`, [100, 255, 100]);
    this.addScreenShake(3.5, 220);
    this.spawnCollectParticles(this.punchMachine.posX, this.punchMachine.posY, [235, 130, 255]);
  }

  applyRandomPunchPowerup() {
    const now = millis();
    const roll = Math.random();

    if (roll < 0.2) {
      this.recoverAmmo(this.getMaxInventoryAmmo(), "PUNCH: MAX AMMO", [255, 220, 140]);
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

  // --- World modules (innovative interactives) ---
  spawnInitialWorldModules() {
    const bootstrapTypes = ["aegis", "emp", "chrono"];
    for (const type of bootstrapTypes) {
      this.spawnWorldModule(type);
    }
    for (let i = bootstrapTypes.length; i < WORLD_MODULE_START_COUNT; i++) {
      this.spawnWorldModule();
    }
  }



  getCurrentObjectiveTarget() {
    return null;  // No objectives in wave mode
  }

  updateWorldModules(dt) {
    const now = millis();

    // Remove expired modules
    for (let i = this.worldModules.length - 1; i >= 0; i--) {
      const wm = this.worldModules[i];
      if (now - wm.spawnMs > WORLD_MODULE_LIFETIME_MS) {
        this.worldModules.splice(i, 1);
      }
    }

    // Periodic spawn
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
    // Convertir en entiers si possible
    row = Math.floor(Number(row));
    col = Math.floor(Number(col));
    if (
      isNaN(row) || isNaN(col) ||
      row <= 0 || row >= this.mapHeight - 1 ||
      col <= 0 || col >= this.mapWidth - 1
    ) {
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
    const tileTotal = this.mapWidth * this.mapHeight;
    const mask = new Uint8Array(tileTotal);

    const startCol = Math.floor(this.player.posX);
    const startRow = Math.floor(this.player.posY);
    if (!this.isWalkableTile(startRow, startCol)) {
      return mask;
    }

    const queue = [{ row: startRow, col: startCol }];
    mask[startRow * this.mapWidth + startCol] = 1;

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

        const idx = next.row * this.mapWidth + next.col;
        if (mask[idx] === 1) continue;

        mask[idx] = 1;
        queue.push(next);
      }
    }

    return mask;
  }

  findFreeWorldSpot(minDistanceFromPlayer = 2.8) {
    for (let attempt = 0; attempt < 90; attempt++) {
      const col = Math.floor(Math.random() * (this.mapWidth - 4)) + 2;
      const row = Math.floor(Math.random() * (this.mapHeight - 4)) + 2;
      if (!this.isWalkableTile(row, col)) continue;

      const x = col + 0.5;
      const y = row + 0.5;

      if (Math.hypot(x - this.player.posX, y - this.player.posY) < minDistanceFromPlayer) continue;
      if (this.orbs.some((orb) => Math.hypot(x - orb.posX, y - orb.posY) < 1.2)) continue;
      if (this.worldModules.some((wm) => Math.hypot(x - wm.posX, y - wm.posY) < 1.4)) continue;
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

    // Scan for nearby lava tiles (much smaller radius now)
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

  // --- Weapon combat ---
  tryFireWeapon() {
    const now = millis();
    
    // Block firing while reloading
    if (now < this.weaponReloadingUntilMs) return;
    
    const shotCooldown = this.currentFireCooldownMs();
    if (now - this.weaponLastShotMs < shotCooldown) return;

    this.weaponLastShotMs = now;

    // No ammo in magazine
    if (this.weaponMagazineAmmo <= 0) {
      this.pushHudToast("RECHARGER!", [255, 100, 100]);
      return;
    }

    this.weaponMagazineAmmo--;
    this.weaponFlashUntilMs = now + 70;
    this.addScreenShake(1.2, 70);

    // --- Bullet tracer logic ---
    // Calculate shot direction (player angle)
    const angle = this.player.angle;
    const muzzleDist = 0.7; // Distance from player center to muzzle
    const x0 = this.player.posX + Math.cos(angle) * muzzleDist;
    const y0 = this.player.posY + Math.sin(angle) * muzzleDist;
    let x1 = x0 + Math.cos(angle) * 12.0; // Max tracer length (far)
    let y1 = y0 + Math.sin(angle) * 12.0;

    const hit = this.findBestHunterTarget();
    if (hit && hit.orb) {
      // If hit, set tracer end to zombie position
      x1 = hit.orb.posX;
      y1 = hit.orb.posY;
    }

    // Add tracer (visible for 120ms)
    this.bulletTracers.push({ x0, y0, x1, y1, createdMs: now, durationMs: 620 });

    if (hit && hit.orb) {
      this.applyHunterDamage(hit.orb, this.currentWeaponDamage());
    }
  }

  reloadWeapon() {
    const now = millis();
    
    // Already reloading
    if (now < this.weaponReloadingUntilMs) return;
    
    const maxMag = this.getMaxMagazineSize();
    // Magazine already full
    if (this.weaponMagazineAmmo >= maxMag) {
      this.pushHudToast("Chargeur plein", [150, 150, 150]);
      return;
    }
    
    // No ammo in inventory
    if (this.weaponInventoryAmmo <= 0) {
      this.pushHudToast("Pas de balles!", [255, 100, 100]);
      return;
    }
    
    // Utilisation de la capacité dynamique
    const bulletsNeeded = maxMag - this.weaponMagazineAmmo;
    const bulletsTaken = Math.min(bulletsNeeded, this.weaponInventoryAmmo);
    
    // Take from inventory and add to magazine
    this.weaponInventoryAmmo -= bulletsTaken;
    this.weaponMagazineAmmo += bulletsTaken;
    
    // Start reload animation (1 second)
    this.weaponReloadingUntilMs = now + WEAPON_RELOAD_DURATION_MS;
    
    console.log(`🔫 Reloading: +${bulletsTaken} bullets (${this.weaponMagazineAmmo}/${maxMag})`);
    this.pushHudToast(`Rechargement +${bulletsTaken}`, [100, 200, 255]);
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

      // Allow shooting at any distance forward (transformY > 0)
      if (transformY <= 0) continue;

      // Calculate zombie sprite dimensions on screen
      const worldSize = 0.92; // Zombie world size
      const spriteBaseSize = Math.abs((worldSize / transformY) * fovScale);
      const zombieAspect = this.zombieSpriteCache.height / Math.max(1, this.zombieSpriteCache.width);
      const spriteScreenW = Math.min(spriteBaseSize, SCREEN_HEIGHT * 0.4);
      const spriteScreenH = Math.min(spriteScreenW * zombieAspect, SCREEN_HEIGHT * 0.62);

      // Screen position of zombie center
      const screenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;
      const cameraOffset = this.cameraScreenOffsetPx();
      const screenY = SCREEN_HEIGHT / 2 + cameraOffset;

      // Calculate hitbox bounds
      const hitboxLeft = screenX - spriteScreenW / 2;
      const hitboxRight = screenX + spriteScreenW / 2;
      const hitboxTop = screenY - spriteScreenH / 2;
      const hitboxBottom = screenY + spriteScreenH / 2;

      // Check if cursor is within zombie hitbox
      const centerScreenX = SCREEN_WIDTH / 2;
      const centerScreenY = SCREEN_HEIGHT / 2;
      
      if (centerScreenX >= hitboxLeft && centerScreenX <= hitboxRight &&
          centerScreenY >= hitboxTop && centerScreenY <= hitboxBottom) {
        
        // Pick closest zombie by depth
        if (!best || transformY < best.depth) {
          best = { orb, depth: transformY };
        }
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
      // Particules de sang lors de l'impact
      for (let i = 0; i < 4; i++) {
        this.particles.push(new Particle(orb.posX, orb.posY, [255, 50, 50]));
      }
      this.addScreenShake(0.7, 60);
      return;
    }

    this.killHunter(orb);
  }

  killHunter(orb) {
    const index = this.orbs.indexOf(orb);
    if (index < 0) return;

    this.registerHunterKillStreak();
    const multiplier = this.currentKillStreakMultiplier();
    
    if (orb.spawnSource === "wave") {
      this.waveEnemiesKilled += 1;
    }
    this.gold += Math.floor(150 * multiplier); // L'or est maintenant multiplié par le combo
    this.recoverAmmo(HUNTER_KILL_AMMO_REFUND);
    this.spawnCollectParticles(orb.posX, orb.posY, [255, 80, 80]);
    this.orbStunUntilMap.delete(orb);
    this.spawnMobDrop(orb.posX, orb.posY);
    this.orbs.splice(index, 1);
  }

  // --- Mob drops ---
  spawnMobDrop(wx, wy) {
    const rand = Math.random();
    let primaryType;
    if (rand < MOB_DROP_PULSE_CHANCE) primaryType = "pulse";
    else if (rand < 0.55) primaryType = "ammo";
    else if (rand < 0.85) primaryType = "score";
    else primaryType = "rounds";

    this.spawnSingleDrop(primaryType, wx, wy);

    // Extra loot around the corpse to make kills consistently rewarding.
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
        // Récupération directe des munitions pour le pistolet
        this.recoverAmmo(MOB_DROP_ROUNDS_GAIN, "Munitions (+10)", [255, 220, 110]);
        this.spawnCollectParticles(drop.posX, drop.posY, [255, 215, 120]);
      } else if (drop.type === "score") {
        const added = this.addInventoryItem("bomb", 1);
        if (added > 0) {
          this.pushHudToast("+1 Bomb", [255, 150, 150]);
        } else {
          this.pushHudToast("Inventaire bombes plein", [255, 160, 160]);
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
        const bombAdded = this.addInventoryItem("bomb", 1);
        const directAmmo = this.recoverAmmo(MOB_DROP_CRATE_BONUS_AMMO);

        if (ammoPackAdded > 0 || bombAdded > 0 || directAmmo > 0) {
          if (bombAdded > 0 || directAmmo > 0) {
            this.pushHudToast("Caisse tactique récupérée", [170, 225, 255]);
          } else {
            this.pushHudToast("Caisse inutile (inventaire plein)", [255, 170, 170]);
          }
          this.spawnCollectParticles(drop.posX, drop.posY, [165, 225, 255]);
        }
      }

      this.drops.splice(i, 1);
    }
  }



  // --- Corruption (arena shrink) ---
  advanceCorruption() {
    if (this.isChronoActive()) return;

    const elapsed = this.survivalSeconds();
    
    // Calculate corruption start delay based on wave difficulty
    let corruptionStartDelay = CORRUPTION_START_DELAY_SECONDS;
    if (this.waveNumber === 1) {
      corruptionStartDelay = 5; // La lave commence après seulement 5s en vague 1
    }
    
    if (elapsed < corruptionStartDelay) return;

    const timeSinceLast = elapsed - this.lastCorruptionTime;
    if (this.lastCorruptionTime === 0) {
      this.lastCorruptionTime = elapsed;
      return;
    }

    // Calculate corruption interval based on wave (slower for early waves)
    let corruptionInterval = this.CORRUPTION_INTERVAL_SECONDS_LOCAL;
    if (this.waveNumber === 1) {
      corruptionInterval = this.CORRUPTION_INTERVAL_SECONDS_LOCAL * 1.5; // Slower for wave 1
    } else if (this.waveNumber === 2) {
      corruptionInterval = this.CORRUPTION_INTERVAL_SECONDS_LOCAL * 1.2; // Slightly slower for wave 2
    } else if (this.waveNumber === 3) {
      corruptionInterval = this.CORRUPTION_INTERVAL_SECONDS_LOCAL * 1.1; // Slightly slower for wave 3
    }
    // From wave 4+: use normal speed

    if (timeSinceLast >= corruptionInterval) {
      this.lastCorruptionTime = elapsed;
      this.corruptionLayer++;
      this.applyCorruptionLayer(this.corruptionLayer);
      this.addScreenShake(4, 300);
    }
  }

  /**
   * Queues a ring of tiles for progressive corruption conversion.
   * Layer 1 = the row/col just inside existing border, etc.
   */
  applyCorruptionLayer(layer) {
    const lo = layer;
    const hi = MAP_TILE_COUNT - 1 - layer;
    if (lo >= hi) {
      this.triggerGameOver("The corruption consumed the entire arena.");
      return;
    }

    const queued = [];
    // Tracé séquentiel du contour : Haut -> Droite -> Bas -> Gauche
    for (let col = lo; col <= hi; col++) queued.push({ row: lo, col }); // Top
    for (let row = lo + 1; row <= hi; row++) queued.push({ row, col: hi }); // Right
    for (let col = hi - 1; col >= lo; col--) queued.push({ row: hi, col }); // Bottom
    for (let row = hi - 1; row >= lo + 1; row--) queued.push({ row, col: lo }); // Left

    // On inverse car on utilise pop() (LIFO), ainsi le tracé commence bien par le premier élément ajouté
    this.pendingCorruptionTiles.push(...queued.reverse());
  }

  applyPendingCorruptionStep() {
    if (this.pendingCorruptionTiles.length === 0) return;

    this.corruptionFrameCounter++;
    if (this.corruptionFrameCounter < this.CORRUPTION_FRAME_DELAY) return;
    this.corruptionFrameCounter = 0;

    const count = Math.min(this.CORRUPTION_TILES_PER_FRAME_LOCAL, this.pendingCorruptionTiles.length);
    for (let i = 0; i < count; i++) {
      const tile = this.pendingCorruptionTiles.pop();
      if (!tile) break;

      const row = tile.row;
      const col = tile.col;
        const currentRow = worldTileMap[row];
        if (currentRow[col] === 0) {
          currentRow[col] = 6;
        }
      }
    }
  }

  // --- Entity updates ---
  updateOrbs(dt) {
    const now = millis();

    for (const orb of this.orbs) {
      const isStunned = this.isOrbStunned(orb, now);

      if (!isStunned) {
        let scaledDt = (this.isChronoActive() && orb.isHunter())
          ? dt * MODULE_CHRONO_HUNTER_TIME_SCALE
          : dt;

        // Ralentissement proportionnel à la santé pour les zombies
        if (orb.isHunter()) {
          const healthFactor = 0.4 + (orb.health / orb.maxHealth) * 0.6; // Min 40% de vitesse
          scaledDt *= healthFactor;
        }

        orb.update(scaledDt, this.player, this.use3DMode);
        
        // Progression de l'animation de spawn
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

    // Synchronize 3D scene (NEW)
    if (this.use3DMode && this.scene3D) {
      this.scene3D.updateZombies(this.orbs, deltaTime || 16);
    }
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
          this.triggerGameOver("You touched the lava wall!");
          return;
        }
      }
    }

    // Collision joueur vs Punch Machine
    if (this.punchMachine) {
      const dx = this.player.posX - this.punchMachine.posX;
      const dy = this.player.posY - this.punchMachine.posY;
      const dist = Math.hypot(dx, dy);
      const minDistance = this.player.radius + this.punchMachine.radius;
      if (dist < minDistance) {
        const overlap = minDistance - dist;
        this.player.posX += (dx / dist) * overlap;
        this.player.posY += (dy / dist) * overlap;
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
          this.gold += 50;
          this.recoverAmmo(ORB_SAFE_AMMO_RECOVERY);
          this.spawnCollectParticles(orb.posX, orb.posY, [92, 255, 145]);
          this.orbStunUntilMap.delete(orb);
          this.orbs.splice(i, 1);
        } else if (orb.isWarning()) {
          // Risky grab during warning phase — double bonus!
          this.score += ORB_COLLECT_BONUS * 2;
          this.gold += 120;
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

  cameraScreenOffsetPx() {
    return this.player.cameraVerticalOffsetPx();
  }

  createMotionBlurBuffer() {
    const width = Math.max(96, Math.floor(SCREEN_WIDTH * MOTION_BLUR_BUFFER_SCALE));
    const height = Math.max(54, Math.floor(SCREEN_HEIGHT * MOTION_BLUR_BUFFER_SCALE));
    const buffer = createGraphics(width, height);
    buffer.pixelDensity(1);
    return buffer;
  }

  syncMotionBlurReference() {
    this.prevPlayerPosX = this.player.posX;
    this.prevPlayerPosY = this.player.posY;
    this.prevPlayerAngle = this.player.angle;
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
      ctx.drawImage(
        this.canvasEl,
        0,
        0,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        0,
        0,
        this.motionBlurBuffer.width,
        this.motionBlurBuffer.height
      );
    } catch {
      this.motionBlurEnabled = false;
      this.motionBlurAmount = 0;
      if (this.motionBlurBuffer) this.motionBlurBuffer.clear();
      this.motionBlurBuffer = null;
    }
  }

  // ----------------------------------------------------------
  //  RENDER
  // ----------------------------------------------------------
  renderFrame() {
    /*
      DISPATCHER: Delegates to active rendering mode
      Mode separation allows independent testing/debugging
    */
    if (this.gameState === "inter-wave") {
      if (millis() >= this.interWaveUntilMs) {
        this.startNextWave(); // Lance directement la prochaine vague après le délai
      }
      const mode = this.use3DMode ? this.gameMode3D : this.gameMode2D;
      mode.render(); // On rend le monde en arrière-plan pour que la caméra s'actualise
      mode.drawInterWaveScreen();
      return;
    }

    const mode = this.use3DMode ? this.gameMode3D : this.gameMode2D;
    if (this.use3DMode) {
      // 3D mode: Direct render to WEBGL
      try {
        mode.render();
      } catch (e) {
        console.error("3D render failed, falling back to 2D:", e);
        this.use3DMode = false;
        this.gameMode2D.render();
      }
    } else {
      // 2D mode: Software raycasting
      this.gameMode2D.render();
      
      // 2D-specific overlays
      this.drawMotionBlurOverlay();
      this.captureMotionBlurFrame();
    }
  }

  // --- 3D WEBGL Rendering ---
  renderTo3DBuffer() {
    // Render using WEBGL graphics buffer
    const g = this.webglGraphics;
    
    // HORROR MODE: Black background 
    g.background(0, 0, 0);  // Pure black skybox for horror
    // Skip expensive lighting for performance - use simple flat colors
    // g.lights();
    // g.ambientLight(60, 60, 60);
    // g.directionalLight(100, 100, 100, 0.5, 1, 0.5);
    
    // Setup camera: first-person from player position with pitch support
    const camY = -1.1;  // Eye height (slightly raised, NEGATIVE because Y+ is downward)
    const lookAheadDist = 10;
    const lookX = this.player.posX + cos(this.player.angle) * lookAheadDist;
    const lookZ = this.player.posY + sin(this.player.angle) * lookAheadDist;
    
    // Apply pitch (vertical look angle, already in radians) to the look-at point
    // Negative pitch = look down, positive pitch = look up
    const lookY = camY - sin(this.player.pitch) * lookAheadDist;
    
    g.perspective(45, SCREEN_WIDTH / SCREEN_HEIGHT, 0.1, 1000);
    g.camera(
      this.player.posX, camY, this.player.posY,
      lookX, lookY, lookZ,
      0, 1, 0
    );
    
    // Draw first-person arm and weapon
    this.drawArmAndWeapon3D(g);
    
    // Draw floor - positioned at the same height as blocks
    // Ensure texture exists
    this.ensureFloorTextureCreated();
    
    g.push();
    g.noStroke();

    // OPTIMISATION CRITIQUE : Un seul plan pour le sol au lieu de milliers de box()
    const d = 15;
    g.translate(this.player.posX, -0.5, this.player.posY);
    g.rotateX(Math.PI / 2);
    g.fill(118, 140, 78);
    g.plane(d * 3, d * 3);
    g.pop();
    
    // Draw all map tiles
    this.drawMapBlocks3D(g);
    
    // Draw zombies - with culling to avoid rendering off-screen zombies
    g.noStroke();  // Ensure no stroke for performance
    g.fill(90, 150, 70);  // Zombie green
    const renderDist = 15;  // Reduced from 25 - only render very close zombies
    
    for (let orb of this.orbs) {
      if (orb.isHunter()) {
        // Culling: skip zombies too far away
        const distToZombie = Math.hypot(orb.posX - this.player.posX, orb.posY - this.player.posY);
        if (distToZombie > renderDist) continue;
        
        g.push();
        g.translate(orb.posX, -1.0, orb.posY);
        g.rotateY(orb.bodyAngle || 0);
        this.drawZombieVoxel3D(orb);
        g.pop();
      }
    }
  }

  /**
   * Draw first-person arm and weapon in 3D
   * Positioned relative to camera direction (both pitch and yaw)
   * Improved: Better proportions and more detailed pistol
   */
  drawArmAndWeapon3D(g) {
    g.push();
    
    // Position arm at player location
    g.translate(
      this.player.posX,
      -1.1,
      this.player.posY
    );
    
    // Rotate with player angle (horizontal turn) FIRST
    g.rotateY(-this.player.angle);  // Negative to match camera rotation
    
    // Rotate with camera pitch (vertical look) SECOND
    g.rotateX(-this.player.pitch);  // Negative because pitch is inverted
    
    // Rotate arm 90 degrees to the right (initial orientation)
    g.rotateY(-Math.PI / 2);
    
    // Offset to the right side and pull back (applied AFTER rotations in local space)
    g.translate(0.8, 0.25, -0.9);
    
    // ===== DRAW ARM =====
    g.noStroke();
    
    // Upper arm (shoulder to elbow) - skin color
    g.fill(200, 140, 90);
    g.push();
    g.translate(0, -0.1, 0.3);
    drawSharpBox(g, 0.22, 0.22, 0.8);
    g.pop();
    
    // Sleeve upper arm - fabric
    g.fill(180, 100, 60);
    g.push();
    g.translate(0.12, -0.1, 0.3);
    drawSharpBox(g, 0.1, 0.25, 0.8);
    g.pop();
    
    // Forearm (elbow to wrist) - skin color
    g.fill(200, 140, 90);
    g.push();
    g.translate(0, -0.05, -0.25);
    drawSharpBox(g, 0.2, 0.2, 0.65);
    g.pop();
    
    // Sleeve forearm - fabric
    g.fill(180, 100, 60);
    g.push();
    g.translate(0.1, -0.05, -0.25);
    drawSharpBox(g, 0.08, 0.22, 0.65);
    g.pop();
    
    // Wrist
    g.fill(200, 140, 90);
    g.push();
    g.translate(0, 0.05, -0.75);
    drawSharpBox(g, 0.18, 0.18, 0.15);
    g.pop();
    
    // Hand holding gun
    g.fill(200, 150, 100);
    g.push();
    g.translate(0.05, 0.08, -0.95);
    drawSharpBox(g, 0.25, 0.22, 0.25);
    g.pop();
    
    // ===== DRAW PISTOL =====
    
    // Barrel (main body)
    g.fill(55, 55, 65);
    g.push();
    g.translate(0, -0.08, -1.1);
    drawSharpBox(g, 0.08, 0.12, 0.95);
    g.pop();
    
    // Slide (on top of barrel) - slightly brighter metal
    g.fill(80, 80, 95);
    g.push();
    g.translate(0, -0.13, -1.1);
    drawSharpBox(g, 0.07, 0.06, 0.92);
    g.pop();
    
    // Hammer (rear of slide)
    g.fill(70, 70, 85);
    g.push();
    g.translate(0.05, -0.15, -0.35);
    drawSharpBox(g, 0.06, 0.08, 0.08);
    g.pop();
    
    // Grip (main handle)
    g.fill(60, 35, 20);
    g.push();
    g.translate(-0.14, 0.02, -0.75);
    drawSharpBox(g, 0.12, 0.38, 0.3);
    g.pop();
    
    // Grip panel (wood/grip texture area)
    g.fill(80, 50, 30);
    g.push();
    g.translate(-0.2, 0.02, -0.75);
    drawSharpBox(g, 0.04, 0.35, 0.28);
    g.pop();
    
    // Trigger guard
    g.fill(65, 65, 75);
    g.push();
    g.translate(0.02, -0.01, -0.8);
    drawSharpBox(g, 0.08, 0.12, 0.12);
    g.pop();
    
    // Trigger
    g.fill(50, 50, 60);
    g.push();
    g.translate(0, 0, -0.8);
    drawSharpBox(g, 0.03, 0.08, 0.08);
    g.pop();
    
    // Frame (lower receiver)
    g.fill(45, 45, 55);
    g.push();
    g.translate(-0.08, 0.04, -0.8);
    drawSharpBox(g, 0.1, 0.08, 0.35);
    g.pop();
    
    // Front sight
    g.fill(65, 65, 75);
    g.push();
    g.translate(0, -0.18, -1.4);
    drawSharpBox(g, 0.03, 0.12, 0.04);
    g.pop();
    
    // Rear sight
    g.fill(65, 65, 75);
    g.push();
    g.translate(0, -0.18, -0.45);
    drawSharpBox(g, 0.03, 0.1, 0.04);
    g.pop();
    
    // Muzzle (front of barrel)
    g.fill(40, 40, 50);
    g.push();
    g.translate(0, -0.08, -1.55);
    drawSharpBox(g, 0.09, 0.13, 0.12);
    g.pop();
    
    // Muzzle threads detail
    g.fill(50, 50, 60);
    g.push();
    g.translate(0, -0.08, -1.62);
    drawSharpBox(g, 0.075, 0.115, 0.08);
    g.pop();
    
    g.pop();
  }

  drawMapBlocks3D(g) {
    // Iterate over visible map tiles only (frustum culling)
    // ULTRA aggressive culling for maximum performance
    const renderDist = 16;  // Slightly increased for better visibility
    const minX = Math.max(0, Math.floor(this.player.posX - renderDist));
    const maxX = Math.min(MAP_TILE_COUNT, Math.ceil(this.player.posX + renderDist));
    const minY = Math.max(0, Math.floor(this.player.posY - renderDist));
    const maxY = Math.min(MAP_TILE_COUNT, Math.ceil(this.player.posY + renderDist));
    
    const nightFactor = 1;  // Full day (0 = night, 1 = day) for consistent 3D rendering
    
    for (let mapY = minY; mapY < maxY; mapY++) {
      for (let mapX = minX; mapX < maxX; mapX++) {
        const tileId = worldTileMap[mapY][mapX];
        
        if (tileId === 0) continue;  // Empty tile
        
        g.push();
        // Y+ is downward in WEBGL, so blocks start at Y=0 and go down
        g.translate(mapX + 0.5, -1.0, mapY + 0.5);
        drawMinecraftBlock(g, tileId, nightFactor);
        g.pop();
      }
    }
  }

  /**
   * Draw a single zombie voxel model in 3D - ULTRA SIMPLIFIED
   * Single color, minimal geometry for max performance
   */
  drawZombieVoxel3D(orb) {
    const g = this.webglGraphics;
    
    // One unified zombie body - no separate parts for speed!
    // Overall height ~1.5 units
    g.fill(80, 150, 60);  // Zombie green
    
    const spawnScale = orb.spawnAnim !== undefined ? orb.spawnAnim : 1.0;
    g.scale(spawnScale);
    const verticalOffset = (1.0 - spawnScale) * 0.5;
    
    // Simple capsule-like body
    g.push();
    g.translate(0, verticalOffset, 0);
    drawSharpBox(g, 0.4, 1.0, 0.25);  // Main body
    g.pop();
    
    // Head on top
    g.push();
    g.translate(0, -0.6, 0);
    drawSharpBox(g, 0.35, 0.35, 0.35);  // Head
    g.pop();
  }

  /**
   * Draw a textured box with proper Minecraft skin UV mapping
   * Standard Minecraft skin layout (64×64)
   */
  drawTexturedBox(g, w, h, d, partType = 'body') {
    // Minecraft skin texture coordinates (in pixels) for 64×64 texture
    const skinW = 64, skinH = 64;
    
    // Standard Minecraft skin layout for all parts
    // Reference: https://minecraft.fandom.com/wiki/Skin#Layout
    const uvMaps = {
      head: {
        // Head uses 8×8 area, top-left at (8, 8)
        front: { x: 8, y: 8, w: 8, h: 8 },      // Face front
        back: { x: 24, y: 8, w: 8, h: 8 },      // Back of head
        top: { x: 8, y: 0, w: 8, h: 8 },        // Top
        bottom: { x: 16, y: 0, w: 8, h: 8 },    // Bottom
        right: { x: 16, y: 8, w: 8, h: 8 },     // Right side
        left: { x: 0, y: 8, w: 8, h: 8 }        // Left side (corrected)
      },
      body: {
        // Body uses 8×12 area, top-left at (20, 20)
        front: { x: 20, y: 20, w: 8, h: 12 },   // Front
        back: { x: 32, y: 20, w: 8, h: 12 },    // Back
        top: { x: 20, y: 16, w: 8, h: 4 },      // Top (thin)
        bottom: { x: 28, y: 16, w: 8, h: 4 },   // Bottom (thin)
        right: { x: 28, y: 20, w: 4, h: 12 },   // Right side
        left: { x: 16, y: 20, w: 4, h: 12 }     // Left side
      },
      arm: {
        // Right arm uses 4×12 area at (44, 20)
        front: { x: 44, y: 20, w: 4, h: 12 },   // Front
        back: { x: 52, y: 20, w: 4, h: 12 },    // Back (extended)
        top: { x: 44, y: 16, w: 4, h: 4 },      // Top
        bottom: { x: 48, y: 16, w: 4, h: 4 },   // Bottom
        right: { x: 48, y: 20, w: 4, h: 12 },   // Right
        left: { x: 40, y: 20, w: 4, h: 12 }     // Left
      },
      leg: {
        // Left leg uses 4×12 area at (4, 20)
        front: { x: 4, y: 20, w: 4, h: 12 },    // Front
        back: { x: 12, y: 20, w: 4, h: 12 },    // Back (extended)
        top: { x: 4, y: 16, w: 4, h: 4 },       // Top
        bottom: { x: 8, y: 16, w: 4, h: 4 },    // Bottom
        right: { x: 8, y: 20, w: 4, h: 12 },    // Right
        left: { x: 0, y: 20, w: 4, h: 12 }      // Left
      }
    };
    
    const uv = uvMaps[partType] || uvMaps.body;
    
    // Helper to convert pixel coords to normalized UV (0..1)
    const normalize = (coord) => ({
      u1: coord.x / skinW,
      v1: coord.y / skinH,
      u2: (coord.x + coord.w) / skinW,
      v2: (coord.y + coord.h) / skinH
    });
    
    const front = normalize(uv.front);
    const back = normalize(uv.back);
    const top = normalize(uv.top);
    const bottom = normalize(uv.bottom);
    const right = normalize(uv.right);
    const left = normalize(uv.left);
    
    // Front face (facing +Z)
    g.beginShape();
    g.vertex(-w / 2, -h / 2, d / 2, front.u1, front.v1);
    g.vertex(w / 2, -h / 2, d / 2, front.u2, front.v1);
    g.vertex(w / 2, h / 2, d / 2, front.u2, front.v2);
    g.vertex(-w / 2, h / 2, d / 2, front.u1, front.v2);
    g.endShape(CLOSE);
    
    // Back face (facing -Z)
    g.beginShape();
    g.vertex(-w / 2, -h / 2, -d / 2, back.u2, back.v1);
    g.vertex(-w / 2, h / 2, -d / 2, back.u2, back.v2);
    g.vertex(w / 2, h / 2, -d / 2, back.u1, back.v2);
    g.vertex(w / 2, -h / 2, -d / 2, back.u1, back.v1);
    g.endShape(CLOSE);
    
    // Top face (facing +Y)
    g.beginShape();
    g.vertex(-w / 2, -h / 2, -d / 2, top.u1, top.v2);
    g.vertex(w / 2, -h / 2, -d / 2, top.u2, top.v2);
    g.vertex(w / 2, -h / 2, d / 2, top.u2, top.v1);
    g.vertex(-w / 2, -h / 2, d / 2, top.u1, top.v1);
    g.endShape(CLOSE);
    
    // Bottom face (facing -Y)
    g.beginShape();
    g.vertex(-w / 2, h / 2, -d / 2, bottom.u1, bottom.v1);
    g.vertex(-w / 2, h / 2, d / 2, bottom.u1, bottom.v2);
    g.vertex(w / 2, h / 2, d / 2, bottom.u2, bottom.v2);
    g.vertex(w / 2, h / 2, -d / 2, bottom.u2, bottom.v1);
    g.endShape(CLOSE);
    
    // Right face (facing +X)
    g.beginShape();
    g.vertex(w / 2, -h / 2, -d / 2, right.u1, right.v1);
    g.vertex(w / 2, -h / 2, d / 2, right.u2, right.v1);
    g.vertex(w / 2, h / 2, d / 2, right.u2, right.v2);
    g.vertex(w / 2, h / 2, -d / 2, right.u1, right.v2);
    g.endShape(CLOSE);
    
    // Left face (facing -X)
    g.beginShape();
    g.vertex(-w / 2, -h / 2, -d / 2, left.u2, left.v1);
    g.vertex(-w / 2, h / 2, -d / 2, left.u2, left.v2);
    g.vertex(-w / 2, h / 2, d / 2, left.u1, left.v2);
    g.vertex(-w / 2, -h / 2, d / 2, left.u1, left.v1);
    g.endShape(CLOSE);
  }

  // --- Sky & Floor ---
  drawSkyAndFloor() {
    /*
      HORROR MODE: Black sky + floor with exponential fog gradient
      Sol sans texture - juste gradient de brouillard
    */
    const horizon = constrain(
      SCREEN_HEIGHT / 2 + this.cameraScreenOffsetPx(),
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

  // --- Raycasting core (DDA algorithm) ---
  castAllRays() {
    // Delegate to active game mode - this is a stub for backwards compatibility
    // The real raycasting happens in Game2DMode.castAllRays()
    if (this.gameMode2D) {
      return this.gameMode2D.castAllRays();
    }
    // Fallback to minimal implementation if mode not ready
    const halfFOV = FIELD_OF_VIEW_RADIANS / 2;

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

  /**
   * Draws one vertical textured wall column directly into the canvas pixels[] array.
   * @param {Uint8ClampedArray} texPixels — pre-cached RGBA pixel data of the block texture
   */
  drawTexturedColumn(screenCol, drawStart, stripHeight, texPixels, texX, distance, hitSide) {
    // Apply exponential fog shader (same as 3D mode)
    // Fog begins at FOG_3D_START_DISTANCE and darkens exponentially to black
    let fogFactor;
    if (FOG_3D_ENABLED) {
      // Exponential fog: exp(-density * (distance - startDist)^2)
      const distFromFogStart = Math.max(0, distance - (typeof FOG_3D_START_DISTANCE !== 'undefined' ? FOG_3D_START_DISTANCE : 1.5)); // Fog starts closer
      fogFactor = Math.exp(-(typeof FOG_3D_DENSITY !== 'undefined' ? FOG_3D_DENSITY : 0.4) * distFromFogStart * distFromFogStart); // Denser fog
      fogFactor = Math.max(0, Math.min(1, fogFactor)); // Clamp to [0, 1]
    } else {
      // Fallback to linear fog if shader disabled
      const rawFog = constrain(1 - (distance / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
      fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);
    }

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

  /**
   * Apply exponential fog to the floor plane
   * Uses raycasting distances (zBuffer) to create a spherical fog effect around player
   * Fog factor is calculated based on distance from player to point on floor
   */
  applyFloorFog() {
    if (!FOG_3D_ENABLED) return;

    const horizon = Math.floor(SCREEN_HEIGHT / 2 + this.cameraScreenOffsetPx());

    // For each column (corresponding to a ray direction)
    for (let screenX = 0; screenX < SCREEN_WIDTH; screenX++) {
      // Get the base distance from the ray (distance to wall/block if it exists)
      const rayDistance = this.zBuffer[screenX] || MAX_RAY_DISTANCE;

      // For each pixel in the floor area (below horizon)
      for (let screenY = horizon; screenY < SCREEN_HEIGHT; screenY++) {
        // Calculate perspective-based distance
        const relativeY = screenY - horizon;
        const maxScreenY = SCREEN_HEIGHT - horizon;
        const perspectiveRatio = 1 - (relativeY / maxScreenY);  // 1 at horizon, 0 at bottom
        
        // Approximate world distance for this floor pixel
        // Uses ray distance scaled by perspective ratio
        // Closer to horizon = shorter distance (more visible)
        // Further down = longer distance (more fog)
        const approximateDistance = FOG_3D_START_DISTANCE + perspectiveRatio * rayDistance;

        // Calculate exponential fog factor
        const distFromFogStart = Math.max(0, approximateDistance - (typeof FOG_3D_START_DISTANCE !== 'undefined' ? FOG_3D_START_DISTANCE : 1.5)); // Fog starts closer
        const fogFactor = Math.exp(-(typeof FOG_3D_DENSITY !== 'undefined' ? FOG_3D_DENSITY : 0.4) * distFromFogStart * distFromFogStart); // Denser fog
        const clampedFogFactor = Math.max(0, Math.min(1, fogFactor));

        // Apply fog to this pixel
        const dstIdx = 4 * (screenY * SCREEN_WIDTH + screenX);
        
        // Only apply if pixel is part of the white floor
        const r = pixels[dstIdx];
        const g = pixels[dstIdx + 1];
        const b = pixels[dstIdx + 2];
        
        if (r > 50 && g > 50 && b > 50) {
          // Darken RGB channels by fog factor
          pixels[dstIdx]     *= clampedFogFactor;      // R
          pixels[dstIdx + 1] *= clampedFogFactor;      // G
          pixels[dstIdx + 2] *= clampedFogFactor;      // B
        }
      }
    }
  }

  // --- Sprite rendering into pixel buffer (orbs, enemies, particles) ---
  drawSpritesToBuffer() {
    const allSprites = [];
    const MAX_SPRITE_DIST = MAX_RAY_DISTANCE + 2; // culling distance
    const playerX = this.player.posX;
    const playerY = this.player.posY;

    for (const orb of this.orbs) {
      const dx = orb.posX - playerX;
      const dy = orb.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > MAX_SPRITE_DIST * MAX_SPRITE_DIST) continue; // Skip far sprites
      
      const dist = Math.sqrt(distSq);
      let spriteType;
      if (orb.isSafe())         spriteType = "safe";
      else if (orb.isWarning()) spriteType = "warning";
      else if (orb.isChasing()) spriteType = "chase";
      else                      spriteType = "patrol";
      allSprites.push({ x: orb.posX, y: orb.posY, dist, type: spriteType, obj: orb });
    }

    for (const p of this.particles) {
      const dx = p.posX - playerX;
      const dy = p.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > MAX_SPRITE_DIST * MAX_SPRITE_DIST) continue;
      
      const dist = Math.sqrt(distSq);
      allSprites.push({ x: p.posX, y: p.posY, dist, type: "particle", obj: p });
    }

    for (const wm of this.worldModules) {
      const dx = wm.posX - playerX;
      const dy = wm.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > MAX_SPRITE_DIST * MAX_SPRITE_DIST) continue;
      
      const dist = Math.sqrt(distSq);
      allSprites.push({ x: wm.posX, y: wm.posY, dist, type: "world-module", obj: wm });
    }

    for (const drop of this.drops) {
      const dx = drop.posX - playerX;
      const dy = drop.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq > MAX_SPRITE_DIST * MAX_SPRITE_DIST) continue;
      
      const dist = Math.sqrt(distSq);
      allSprites.push({ x: drop.posX, y: drop.posY, dist, type: "drop", obj: drop });
    }

    if (this.punchMachine) {
      const dx = this.punchMachine.posX - playerX;
      const dy = this.punchMachine.posY - playerY;
      const distSq = dx * dx + dy * dy;
      if (distSq <= MAX_SPRITE_DIST * MAX_SPRITE_DIST) {
        const dist = Math.sqrt(distSq);
        allSprites.push({
          x: this.punchMachine.posX,
          y: this.punchMachine.posY,
          dist,
          type: "punch-machine",
          obj: this.punchMachine,
        });
      }
    }

    // Sort back-to-front (ONLY if we have sprites - avoid empty sorts)
    if (allSprites.length > 0) {
      allSprites.sort((a, b) => b.dist - a.dist);
      
      const now = millis(); // Cache millis() once per frame
      for (const sp of allSprites) {
        this.drawSingleSpriteToBuffer(sp, now);
      }
    }
  }

  /**
   * Draws a single sprite directly into the pixels[] buffer.
   * Billboard projection with z-buffer occlusion.
   * @param {object} spriteData - sprite data
   * @param {number} now - cached millis() value to avoid expensive system calls
   */
  drawSingleSpriteToBuffer(spriteData, now) {
    const relX = spriteData.x - this.player.posX;
    const relY = spriteData.y - this.player.posY;

    // Camera-space transform aligned with raycaster forward vector:
    // forward = (cos(angle), sin(angle))
    // right   = (-sin(angle), cos(angle))
    const cosA = Math.cos(this.player.angle);
    const sinA = Math.sin(this.player.angle);
    const transformX = -relX * sinA + relY * cosA; // horizontal offset (right axis)
    const transformY =  relX * cosA + relY * sinA; // depth (forward axis)

    // Allow rendering at any distance (even very close)
    if (transformY <= 0) return;

    // FOV cone culling: reject sprites outside horizontal field of view
    const halfFOVTan = Math.tan(FIELD_OF_VIEW_RADIANS / 2);
    const maxHorizontalOffset = transformY * halfFOVTan;
    if (Math.abs(transformX) > maxHorizontalOffset) return;

    const fovScale = SCREEN_WIDTH / (2 * Math.tan(FIELD_OF_VIEW_RADIANS / 2));
    const spriteScreenX = SCREEN_WIDTH / 2 + (transformX / transformY) * fovScale;
    const isZombieHumanoid = spriteData.type === "patrol" || spriteData.type === "chase";
    const isCollectOrb = spriteData.type === "safe" || spriteData.type === "warning";
    const isPunchMachine = spriteData.type === "punch-machine";

    let worldSize = 0.6;
    if (spriteData.type === "particle") worldSize = 0.15;
    if (isZombieHumanoid) worldSize = 0.92;
    if (spriteData.type === "warning") worldSize = 0.65;  // slightly bigger during warning
    if (spriteData.type === "world-module") worldSize = 0.68;
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
      // Preserve zombie texture aspect ratio to avoid squashed, non-3D-looking projection.
      const zombieAspect = this.zombieSpriteCache.height / Math.max(1, this.zombieSpriteCache.width);
      spriteScreenW = Math.min(spriteBaseSize, SCREEN_HEIGHT * 0.4);
      spriteScreenH = Math.min(spriteScreenW * zombieAspect, SCREEN_HEIGHT * 0.62);
    }

    const drawStartX = Math.max(0, Math.floor(spriteScreenX - spriteScreenW / 2));
    const drawEndX   = Math.min(SCREEN_WIDTH, Math.floor(spriteScreenX + spriteScreenW / 2));
    const cameraOffset = this.cameraScreenOffsetPx();
    
    // Les zombies montent du sol pendant le spawn
    let drawStartY = Math.max(0, Math.floor(SCREEN_HEIGHT / 2 - spriteScreenH / 2 + cameraOffset));
    let drawEndY   = Math.min(SCREEN_HEIGHT, Math.floor(SCREEN_HEIGHT / 2 + spriteScreenH / 2 + cameraOffset));

    if (isZombieHumanoid) {
      const bobPx = Math.sin(now * 0.01 + spriteData.obj.posX * 0.8 + spriteData.obj.posY * 0.6)
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
        const pulse = 0.7 + 0.3 * Math.sin(now * 0.006);
        baseR = 60 * pulse;
        baseG = 255 * pulse;
        baseB = 100 * pulse;
        const mp = spriteData.obj.mutationProgress();
        baseR = lerp(baseR, 255, mp * 0.5);
        baseG = lerp(baseG, 180, mp * 0.3);
        
        // Enhanced: Render distance fade-in and glow effect
        const renderDistFade = Math.max(0, 1 - (spriteData.dist / MAX_RAY_DISTANCE / 0.7));
        baseA = 255 * constrain(renderDistFade, 0, 1);
        baseR = baseR * 1.2;  // Glow brightening
        baseG = baseG * 1.2;
        baseB = baseB * 1.2;
      } else if (spriteData.type === "warning") {
        const wp = spriteData.obj.warningProgress();
        const flash = Math.sin(now * 0.025) > 0 ? 1 : 0.4;
        baseR = lerp(255, 255, wp) * flash;
        baseG = lerp(180, 40, wp) * flash;
        baseB = 30 * flash;
        
        // Enhanced: Render distance fade-in and intensified glow
        const renderDistFade = Math.max(0, 1 - (spriteData.dist / MAX_RAY_DISTANCE / 0.6));
        baseA = 255 * constrain(renderDistFade, 0, 1);
        baseR = Math.min(255, baseR * 1.3);
        baseG = Math.min(255, baseG * 1.3);
        baseB = Math.min(255, baseB * 1.3);
      } else if (spriteData.type === "world-module") {
        const wm = spriteData.obj;
        const pulse = 0.72 + 0.28 * Math.sin(now * 0.008 + wm.posX * 0.8 + wm.posY * 0.5);
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
        const pulse = 0.75 + 0.25 * Math.sin(now * 0.015 + drop.posX * 1.8);
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
      } else if (isPunchMachine) {
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
      // Z-buffer occlusion test: sprites behind walls are not rendered
      // Stricter culling to prevent sprites from peeking through blocks
      // Map screen pixel coordinate to ray index in zBuffer
      const rayIndex = Math.floor((sx / SCREEN_WIDTH) * RAY_COUNT);
      const wallDepth = this.zBuffer[rayIndex] || MAX_RAY_DISTANCE;
      
      // Strict occlusion: if sprite is behind wall depth, cull it completely
      // No margin - sprites must be in front of or exactly at wall depth
      if (transformY > wallDepth) continue;

      // Draw health bar for zombies in 2D
      if (isZombieHumanoid) {
        const barWidth = spriteScreenW * 0.6;
        const barHeight = 4;
        const barY = drawStartY - 15; // Un peu plus haut
        const healthFrac = spriteData.obj.health / spriteData.obj.maxHealth;
        
        if (sx >= spriteScreenX - barWidth / 2 && sx <= spriteScreenX + barWidth / 2) {
          const barX = sx - (spriteScreenX - barWidth / 2);
          for (let by = 0; by < barHeight; by++) {
            const syBar = Math.floor(barY + by);
            if (syBar < 0 || syBar >= SCREEN_HEIGHT) continue;
            const dIdx = 4 * (syBar * SCREEN_WIDTH + sx);
            if (barX <= barWidth * healthFrac) {
              pixels[dIdx] = 0;
              pixels[dIdx + 1] = 255;
              pixels[dIdx + 2] = 0;
            } else {
              pixels[dIdx] = 255;
              pixels[dIdx + 1] = 0;
              pixels[dIdx + 2] = 0;
            }
            pixels[dIdx + 3] = 255;
          }
        }
      }

      // --- Rendu spécifique du corps des zombies (CORRECTION VISIBILITE 2D) ---
      if (isZombieHumanoid) {
        const verticalSpawnOffset = 0;
        let textureDrawn = false;
        if (shouldRenderZombieAsTexture(this)) {
          const zombieRenderDistFade = Math.max(0, 1 - (spriteData.dist / MAX_RAY_DISTANCE / 0.5));
          textureDrawn = drawZombieTextureSprite(this, pixels, {
            screenX: spriteScreenX,
            screenY: SCREEN_HEIGHT / 2 + cameraOffset + verticalSpawnOffset,
            screenWidth: spriteScreenW,
            screenHeight: spriteScreenH,
            worldAngle: spriteData.obj.bodyAngle || 0,
            distance: spriteData.dist,
            zBuffer: this.zBuffer,
            alphaFade: constrain(zombieRenderDistFade, 0, 1),
            onlyColumn: sx 
          });
        }
        if (!textureDrawn) {
          this.drawZombieVolumetricToBuffer(spriteData, sx, sx + 1);
        }
        continue; // On peut maintenant passer à la colonne suivante
      }

      let zombieTx = 0;
      if (isZombieHumanoid) {
        zombieTx = Math.min(zombieTexW - 1, Math.floor((sx - drawStartX) * zombieStepX));
      }

      for (let sy = drawStartY; sy < drawEndY; sy++) {
        // Map texture coordinates from LOGICAL sprite boundaries, not clipped screen boundaries
        // This fixes clipping artifacts when sprites are partially off-screen
        const spriteLeftEdge = spriteScreenX - spriteScreenW / 2;
        const spriteTopEdge = SCREEN_HEIGHT / 2 - spriteScreenH / 2 + cameraOffset;
        const fracX = ((sx - spriteLeftEdge) / spriteScreenW) * 2 - 1;
        const fracY = ((sy - spriteTopEdge) / spriteScreenH) * 2 - 1;
        const dstIdx = 4 * (sy * SCREEN_WIDTH + sx);

        if (isZombieHumanoid) {
          const zombieTy = Math.min(zombieTexH - 1, Math.floor((sy - drawStartY) * zombieStepY));
          const srcIdx = 4 * (zombieTy * zombieTexW + zombieTx);
          const zAlpha = zombieTex[srcIdx + 3] / 255;
          if (zAlpha <= 0.001) continue;

          const invZAlpha = 1 - zAlpha;
          pixels[dstIdx] = zombieTex[srcIdx] * fogFactor * zAlpha + pixels[dstIdx] * invZAlpha;
          pixels[dstIdx + 1] = zombieTex[srcIdx + 1] * fogFactor * zAlpha + pixels[dstIdx + 1] * invZAlpha;
          pixels[dstIdx + 2] = zombieTex[srcIdx + 2] * fogFactor * zAlpha + pixels[dstIdx + 2] * invZAlpha;
          continue;
        }

        if (isCollectOrb) {
          // Simple, robust orb rendering without complex rotation
          // Directly sample texture based on normalized coordinates
          const orbTy = Math.min(orbTexH - 1, Math.floor(((fracY + 1) / 2) * orbTexH));
          const orbTxCalculated = Math.min(orbTexW - 1, Math.floor(((fracX + 1) / 2) * orbTexW));
          const srcIdx = 4 * (orbTy * orbTexW + orbTxCalculated);
          const oAlpha = orbTex[srcIdx + 3] / 255;
          if (oAlpha <= 0.001) continue;

          const invOAlpha = 1 - oAlpha;
          const orbR = (orbTex[srcIdx] / 255) * finalR;
          const orbG = (orbTex[srcIdx + 1] / 255) * finalG;
          const orbB = (orbTex[srcIdx + 2] / 255) * finalB;

          pixels[dstIdx] = orbR * oAlpha + pixels[dstIdx] * invOAlpha;
          pixels[dstIdx + 1] = orbG * oAlpha + pixels[dstIdx + 1] * invOAlpha;
          pixels[dstIdx + 2] = orbB * oAlpha + pixels[dstIdx + 2] * invOAlpha;
          continue;
        }

        if (isPunchMachine) {
          const body = Math.abs(fracX) <= 0.36 && fracY > -0.5 && fracY < 0.55;
          const crown = Math.abs(fracX) <= 0.22 && fracY >= -0.62 && fracY <= -0.5;
          if (!body && !crown) continue;
        }

        if (!isPunchMachine && fracX * fracX + fracY * fracY > 0.2) continue;

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

  drawZombieVolumetricToBuffer(spriteData, drawStartX, drawEndX) {
    const orb = spriteData.obj;
    if (!orb) return;

    const variant = this.resolveZombieAnimationVariant(spriteData);
    const palette = this.getZombieVoxelPalette(variant);
    const parts = this.buildZombieVolumetricParts(orb, palette, variant);
    const centerY = SCREEN_HEIGHT / 2 + this.cameraScreenOffsetPx();

    const fogFromDistance = (dist) => {
      const distFromFogStart = Math.max(0, dist - (typeof FOG_3D_START_DISTANCE !== 'undefined' ? FOG_3D_START_DISTANCE : 1.5)); // Fog starts closer
      return Math.max(0, Math.min(1, Math.exp(-(typeof FOG_3D_DENSITY !== 'undefined' ? FOG_3D_DENSITY : 0.4) * distFromFogStart * distFromFogStart))); // Denser fog
    };

    const xStart = Math.max(0, drawStartX);
    const xEnd = Math.min(SCREEN_WIDTH, drawEndX);
    const screenToRayRatio = RAY_COUNT / SCREEN_WIDTH;  // Map screen columns to ray columns

    for (let sx = xStart; sx < xEnd; sx++) {
      // Map screen column to ray column (since RAY_COUNT may differ from SCREEN_WIDTH)
      const rayCol = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor(sx * screenToRayRatio)));
      
      const rayDirX = this.rayDirXBuffer[rayCol];
      const rayDirY = this.rayDirYBuffer[rayCol];
      const wallDist = this.zBuffer[rayCol];  // Use rayCol, not sx

      // Skip only if both directions are nearly zero
      if (Math.abs(rayDirX) < 1e-8 && Math.abs(rayDirY) < 1e-8) continue;

      const hits = [];

      for (const part of parts) {
        const hit = this.intersectRayOBB2D(
          this.player.posX,
          this.player.posY,
          rayDirX,
          rayDirY,
          part.cx,
          part.cy,
          part.halfW,
          part.halfD,
          part.yaw
        );

        if (!hit) continue;
        if (hit.t <= 0.01) continue;
        if (hit.t > wallDist + 0.02) continue;

        hits.push({
          t: hit.t,
          side: hit.side,
          part,
        });
      }

      if (hits.length === 0) continue;

      // Render from far to near so deeper body parts remain visible
      // where nearer parts do not cover vertically.
      hits.sort((a, b) => b.t - a.t);

      for (const hitInfo of hits) {
        const pxPerWorld = SCREEN_HEIGHT / hitInfo.t;
        const topY = Math.floor(centerY - (hitInfo.part.baseZ + hitInfo.part.height) * pxPerWorld);
        const bottomY = Math.floor(centerY - hitInfo.part.baseZ * pxPerWorld);

        const yStart = Math.max(0, topY);
        const yEnd = Math.min(SCREEN_HEIGHT, bottomY);
        if (yStart >= yEnd) continue;

        const fog = fogFromDistance(hitInfo.t);
        const isSide = hitInfo.side === "y";
        const shade = isSide ? SIDE_SHADE_FACTOR : 1;

        // Determine colors for this hit
        const procColor = isSide ? hitInfo.part.sideColor : hitInfo.part.frontColor;

        for (let sy = yStart; sy < yEnd; sy++) {
          let srcColor = procColor;
          
          // FORCE texture usage if available, don't fallback to procedural
          if (hitInfo.part.partName && window.PRELOADED_ZOMBIE_SKIN_IMAGE && window.PRELOADED_ZOMBIE_SKIN_IMAGE.width > 0) {
            const partTopY = centerY - (hitInfo.part.baseZ + hitInfo.part.height) * pxPerWorld;
            const vRatio = Math.max(0, Math.min(1, (sy - partTopY) / (bottomY - partTopY)));
            
            // Sample texture
            const sampled = this.sampleZombieSkinTexture(hitInfo.part.partName, "y", 0.5, vRatio);
            if (sampled && sampled.length >= 3) {
              srcColor = sampled;
            }
          }

          const r = srcColor[0] * fog * shade;
          const g = srcColor[1] * fog * shade;
          const b = srcColor[2] * fog * shade;

          const dstIdx = 4 * (sy * SCREEN_WIDTH + sx);
          pixels[dstIdx] = r;
          pixels[dstIdx + 1] = g;
          pixels[dstIdx + 2] = b;
        }
      }
    }
  }

  buildZombieVolumetricParts(orb, palette, variant) {
    // Minecraft-like canonical proportions in world units:
    // head 8x8x8, body 8x12x4, arms 4x12x4, legs 4x12x4.
    // For silhouette verification we keep motion neutral (no sway/bob/lunge).
    const x = orb.posX;
    const y = orb.posY;
    const bob = 0;
    const lunge = 0;

    // Adjust bodyAngle by -90° so front face is shown (not side)
    const bodyYaw = (typeof orb.bodyAngle === "number" ? orb.bodyAngle : Math.PI / 2) - Math.PI / 2;

    const lookLen = Math.hypot(orb.lookDirX || 0, orb.lookDirY || 0);
    const headDirX = lookLen > 0.0001 ? orb.lookDirX / lookLen : 0;
    const headDirY = lookLen > 0.0001 ? orb.lookDirY / lookLen : 1;

    // Head anchored to torso (no floating). Look direction only affects face orientation.
    const torsoCenterX = x + lunge;
    const torsoCenterY = y;
    const headCenterX = torsoCenterX;
    const headCenterY = torsoCenterY;

    const makePart = (cx, cy, hw, hd, yaw, baseZ, height, frontColor, sideColor, partName = "") => ({
      cx,
      cy,
      halfW: hw,
      halfD: hd,
      yaw,
      baseZ,
      height,
      frontColor,
      sideColor,
      partName,
    });

    const parts = [];

    // Torso
    parts.push(
      makePart(
        torsoCenterX,
        torsoCenterY,
        0.16, // 8 wide
        0.08, // 4 deep
        bodyYaw,
        -0.16 + bob,
        0.48, // 12 tall
        palette.shirt.front,
        palette.shirt.side,
        "torso"
      )
    );

    // Head - rotates with body (rigid skeleton, no independent head rotation)
    parts.push(
      makePart(
        headCenterX,
        headCenterY,
        0.16, // 8 wide
        0.16, // 8 deep (true cube footprint)
        bodyYaw,
        0.35 + bob,
        0.32, // 8 tall
        palette.skin.front,
        palette.skin.side,
        "head"
      )
    );

    // Calculate arm and leg positions with rotation around torso center
    // Local offsets (relative to torso in unrotated frame)
    const leftArmLocalX = -0.24;   // Further from center
    let leftArmLocalY = 0;
    const rightArmLocalX = 0.24;   // Further from center
    let rightArmLocalY = 0;
    const leftLegLocalX = -0.12;
    let leftLegLocalY = 0;
    const rightLegLocalX = 0.12;
    let rightLegLocalY = 0;

    // Walking animation: arms and legs swing opposite to each other
    // Only animate if zombie is moving (isHunter)
    if (orb.isHunter && orb.isHunter()) {
      const walkPhase = (millis() * 0.005) % (Math.PI * 2); // cycling walk animation
      const legSwingAmount = 0.08; // amplitude of forward/backward swing
      const armSwingAmount = 0.06; // arms swing less than legs
      
      // Left leg swings forward when right leg swings back (opposite phase)
      leftLegLocalY = Math.sin(walkPhase) * legSwingAmount;
      rightLegLocalY = Math.sin(walkPhase + Math.PI) * legSwingAmount;
      
      // Arms swing opposite to legs (when legs forward, arms back)
      leftArmLocalY = Math.sin(walkPhase + Math.PI) * armSwingAmount;
      rightArmLocalY = Math.sin(walkPhase) * armSwingAmount;
    }

    // Rotate positions around torso center based on bodyYaw
    const cosYaw = Math.cos(bodyYaw);
    const sinYaw = Math.sin(bodyYaw);

    const leftArmX = torsoCenterX + leftArmLocalX * cosYaw - leftArmLocalY * sinYaw;
    const leftArmY = torsoCenterY + leftArmLocalX * sinYaw + leftArmLocalY * cosYaw;
    const rightArmX = torsoCenterX + rightArmLocalX * cosYaw - rightArmLocalY * sinYaw;
    const rightArmY = torsoCenterY + rightArmLocalX * sinYaw + rightArmLocalY * cosYaw;
    const leftLegX = torsoCenterX + leftLegLocalX * cosYaw - leftLegLocalY * sinYaw;
    const leftLegY = torsoCenterY + leftLegLocalX * sinYaw + leftLegLocalY * cosYaw;
    const rightLegX = torsoCenterX + rightLegLocalX * cosYaw - rightLegLocalY * sinYaw;
    const rightLegY = torsoCenterY + rightLegLocalX * sinYaw + rightLegLocalY * cosYaw;

    // Left arm / right arm - attached at shoulders with true proportions (4×12×4)
    parts.push(
      makePart(
        leftArmX,
        leftArmY,
        0.08, // 4 wide
        0.08, // 4 deep (true proportions)
        bodyYaw,
        -0.16 + bob,
        0.48, // 12 tall (extends down from shoulder)
        palette.sleeve.front,
        palette.sleeve.side,
        "arm_left"
      )
    );
    parts.push(
      makePart(
        rightArmX,
        rightArmY,
        0.08,
        0.08, // 4 deep (true proportions)
        bodyYaw,
        -0.16 + bob,
        0.48,
        palette.sleeve.front,
        palette.sleeve.side,
        "arm_right"
      )
    );

    // Legs - attached at thighs/hips (bottom of torso)
    parts.push(
      makePart(
        leftLegX,
        leftLegY,
        0.08,
        0.08,
        bodyYaw,
        -0.64 + bob,
        0.48,
        palette.pants.front,
        palette.pants.side,
        "leg_left"
      )
    );
    parts.push(
      makePart(
        rightLegX,
        rightLegY,
        0.08,
        0.08,
        bodyYaw,
        -0.64 + bob,
        0.48,
        palette.pants.front,
        palette.pants.side,
        "leg_right"
      )
    );

    return parts;
  }

  intersectRayAABB2D(rayOX, rayOY, rayDX, rayDY, minX, maxX, minY, maxY) {
    const invDX = Math.abs(rayDX) < 1e-8 ? Number.POSITIVE_INFINITY : 1 / rayDX;
    const invDY = Math.abs(rayDY) < 1e-8 ? Number.POSITIVE_INFINITY : 1 / rayDY;

    let tx1 = (minX - rayOX) * invDX;
    let tx2 = (maxX - rayOX) * invDX;
    let ty1 = (minY - rayOY) * invDY;
    let ty2 = (maxY - rayOY) * invDY;

    if (tx1 > tx2) {
      const t = tx1;
      tx1 = tx2;
      tx2 = t;
    }
    if (ty1 > ty2) {
      const t = ty1;
      ty1 = ty2;
      ty2 = t;
    }

    const tEnter = Math.max(tx1, ty1);
    const tExit = Math.min(tx2, ty2);

    if (tExit < 0) return null;
    if (tEnter > tExit) return null;

    const side = tx1 > ty1 ? "x" : "y";
    return { t: tEnter, side };
  }

  intersectRayOBB2D(rayOX, rayOY, rayDX, rayDY, cx, cy, halfW, halfD, yaw) {
    const c = Math.cos(-yaw);
    const s = Math.sin(-yaw);

    const ox = rayOX - cx;
    const oy = rayOY - cy;

    const localOX = ox * c - oy * s;
    const localOY = ox * s + oy * c;
    const localDX = rayDX * c - rayDY * s;
    const localDY = rayDX * s + rayDY * c;

    const hit = this.intersectRayAABB2D(
      localOX,
      localOY,
      localDX,
      localDY,
      -halfW,
      halfW,
      -halfD,
      halfD
    );

    return hit;
  }

  createZombieSpriteCache() {
    // Try to use texture-based system if zombie skin image is loaded
    if (window.PRELOADED_ZOMBIE_SKIN_IMAGE) {
      return this.createZombieSpriteCacheFromTexture(window.PRELOADED_ZOMBIE_SKIN_IMAGE);
    }

    // Fallback to procedural generation
    const width = 44;
    const height = 62;
    const frameCount = Math.max(1, Math.floor(ZOMBIE_SPRITE_SHEET_FRAME_COUNT));

    const patrolFrontFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "patrol", 0);
    const patrolLeftFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "patrol", -1);
    const patrolRightFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "patrol", 1);

    const chaseFrontFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "chase", 0);
    const chaseLeftFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "chase", -1);
    const chaseRightFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "chase", 1);

    const attackFrontFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "attack", 0);
    const attackLeftFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "attack", -1);
    const attackRightFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "attack", 1);

    const chargeFrontFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "charge", 0);
    const chargeLeftFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "charge", -1);
    const chargeRightFrames = this.buildZombieVoxelAnimatedFrames(width, height, frameCount, "charge", 1);

    return {
      mode: "generated",
      width,
      height,
      fps: Math.max(1, ZOMBIE_SPRITE_SHEET_FPS),
      patrol: patrolFrontFrames[0],
      chase: chaseFrontFrames[0],
      attack: attackFrontFrames[0],
      charge: chargeFrontFrames[0],
      patrolFrontFrames,
      patrolLeftFrames,
      patrolRightFrames,
      chaseFrontFrames,
      chaseLeftFrames,
      chaseRightFrames,
      attackFrontFrames,
      attackLeftFrames,
      attackRightFrames,
      chargeFrontFrames,
      chargeLeftFrames,
      chargeRightFrames,
    };
  }

  /**
   * Creates sprite cache from the loaded Zombie.png texture
   * Uses zombie-texture-mapper to extract and rotate sprites
   */
  createZombieSpriteCacheFromTexture(zombieTexture) {
    // Create all 8 directional sprites from the texture
    const directionalSprites = cacheAllZombieDirections(zombieTexture);

    return {
      mode: "texture",
      width: 20,
      height: 32,
      fps: Math.max(1, ZOMBIE_SPRITE_SHEET_FPS),
      // Default "front" sprite for initial display
      patrol: directionalSprites.front,
      chase: directionalSprites.front,
      attack: directionalSprites.front,
      charge: directionalSprites.front,
      // Store the directional sprites for angle-based lookup
      directionalSprites: directionalSprites,
    };
  }

  buildZombieVoxelAnimatedFrames(width, height, frameCount, variant, headYawDir = 0) {
    const frames = [];

    const palette = this.getZombieVoxelPalette(variant);

    for (let frame = 0; frame < frameCount; frame++) {
      const data = new Uint8ClampedArray(width * height * 4);
      const phase = (frame / frameCount) * TWO_PI;

      const stride = variant === "charge" ? 3 : (variant === "chase" ? 2 : 1.4);
      const armSwing = Math.round(Math.sin(phase) * stride);
      const legSwing = -armSwing;
      const bob = Math.round(Math.abs(Math.sin(phase)) * (variant === "charge" ? 2 : 1));
      const attackLunge = variant === "attack" ? Math.max(0, Math.round(Math.sin(phase) * 2)) : 0;
      const headYawPx = Math.round(headYawDir * ZOMBIE_HEAD_TURN_PIXELS);
      const torsoYawPx = Math.round(headYawDir * (ZOMBIE_HEAD_TURN_PIXELS * 0.45));

      this.paintVoxelCuboid(data, width, height, {
        x: 14 + attackLunge + headYawPx,
        y: 4 + bob,
        width: 10,
        height: 10,
        depth: 3,
      }, palette.skin);

      this.paintVoxelCuboid(data, width, height, {
        x: 14 + attackLunge + torsoYawPx,
        y: 15 + bob,
        width: 10,
        height: 14,
        depth: 3,
      }, palette.shirt);

      this.paintVoxelCuboid(data, width, height, {
        x: 9 - armSwing + attackLunge + torsoYawPx,
        y: 16 + bob,
        width: 4,
        height: 13,
        depth: 2,
      }, palette.sleeve);

      this.paintVoxelCuboid(data, width, height, {
        x: 25 + armSwing + attackLunge + torsoYawPx,
        y: 16 + bob,
        width: 4,
        height: 13,
        depth: 2,
      }, palette.sleeve);

      this.paintVoxelCuboid(data, width, height, {
        x: 14 + legSwing,
        y: 30 + bob,
        width: 4,
        height: 16,
        depth: 2,
      }, palette.pants);

      this.paintVoxelCuboid(data, width, height, {
        x: 20 - legSwing,
        y: 30 + bob,
        width: 4,
        height: 16,
        depth: 2,
      }, palette.pants);

      this.paintZombieFaceDetails(data, width, height, 14 + attackLunge + headYawPx, 4 + bob, palette.face);
      frames.push(data);
    }

    return frames;
  }

  sampleZombieSkinTexture(partName, faceDir, u, v) {
    // Fast pixel sampling using cached pixel array (avoid img.get() which is slow!)
    
    const pixelData = window.PRELOADED_ZOMBIE_SKIN_PIXELS;
    if (!pixelData || pixelData.length === 0) {
      return null;
    }

    // Actual coordinates from PNG generation (Face Front only)
    const layouts = {
      head: { x: 8, y: 8, w: 8, h: 8 },
      torso: { x: 20, y: 20, w: 8, h: 12 },
      arm_right: { x: 44, y: 20, w: 4, h: 12 },
      arm_left: { x: 36, y: 52, w: 4, h: 12 },
      leg_right: { x: 4, y: 20, w: 4, h: 12 },
      leg_left: { x: 20, y: 52, w: 4, h: 12 },
    };

    const layout = layouts[partName];
    if (!layout) {
      return null;
    }

    // Map normalized [0-1] coordinates to actual texture pixels
    const texU = layout.x + u * layout.w;
    const texV = layout.y + v * layout.h;

    const px = Math.floor(texU);
    const py = Math.floor(texV);

    // Bounds check
    if (px < 0 || px >= 64 || py < 0 || py >= 64) {
      return null;
    }

    // Direct array access (FAST!) instead of img.get()
    const idx = (py * 64 + px) * 4;
    
    return [
      pixelData[idx],
      pixelData[idx + 1],
      pixelData[idx + 2]
    ];
  }

  getZombieVoxelPalette(variant) {
    // Minecraft zombie colors
    return {
      skin: { front: [80, 110, 80], side: [60, 90, 60], top: [95, 125, 95] },        // Green zombie skin
      shirt: { front: [100, 100, 100], side: [75, 75, 75], top: [120, 120, 120] },   // Gray shirt
      sleeve: { front: [100, 100, 100], side: [75, 75, 75], top: [120, 120, 120] },  // Gray sleeves
      pants: { front: [80, 80, 80], side: [60, 60, 60], top: [100, 100, 100] },      // Dark gray pants
      face: [92, 92, 92],  // Eyes and mouth (dark gray)
    };
  }

  paintVoxelCuboid(data, width, height, box, material) {
    const front = material.front;
    const side = material.side;
    const top = material.top;

    const x = Math.floor(box.x);
    const y = Math.floor(box.y);
    const w = Math.max(1, Math.floor(box.width));
    const h = Math.max(1, Math.floor(box.height));
    const d = Math.max(1, Math.floor(box.depth));

    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        this.setVoxelPixel(data, width, height, x + xx, y + yy, front[0], front[1], front[2], 255);
      }
    }

    for (let depth = 1; depth <= d; depth++) {
      const ox = depth;
      const oy = -depth;

      for (let yy = 0; yy < h; yy++) {
        this.setVoxelPixel(
          data,
          width,
          height,
          x + w - 1 + ox,
          y + yy + oy,
          side[0],
          side[1],
          side[2],
          255
        );
      }

      for (let xx = 0; xx < w; xx++) {
        this.setVoxelPixel(
          data,
          width,
          height,
          x + xx + ox,
          y + oy,
          top[0],
          top[1],
          top[2],
          255
        );
      }
    }
  }

  paintZombieFaceDetails(data, width, height, headX, headY, eyeColor) {
    // Mouth rendering only - eyes removed
    for (let x = headX + 3; x <= headX + 6; x++) {
      this.setVoxelPixel(data, width, height, x, headY + 7, 44, 62, 40, 255);
    }
  }

  setVoxelPixel(data, width, height, x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = 4 * (y * width + x);
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = a;
  }

  getZombieSpriteSheetImage() {
    if (typeof window === "undefined") return null;
    const sheet = window.PRELOADED_ZOMBIE_SPRITESHEET_IMAGE;
    if (!sheet || sheet.width <= 0 || sheet.height <= 0) return null;

    // A valid walk spritesheet must be a horizontal strip. If not,
    // keep using the skinned 3D zombie fallback.
    const frameCount = Math.max(1, Math.floor(ZOMBIE_SPRITE_SHEET_FRAME_COUNT));
    const frameWidth = Math.floor(sheet.width / frameCount);
    const looksLikeHorizontalStrip = sheet.width > sheet.height;
    const hasUsableFrameSize = frameWidth >= 8 && sheet.height >= 8;
    if (!looksLikeHorizontalStrip || !hasUsableFrameSize) {
      return null;
    }

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
      const safeFrameCount = Math.max(1, frameCount);

      for (let frame = 0; frame < safeFrameCount; frame++) {
        const data = new Uint8ClampedArray(frameWidth * frameHeight * 4);
        const frameStartX = frame * frameWidth;

        for (let y = 0; y < frameHeight; y++) {
          for (let x = 0; x < frameWidth; x++) {
            const srcX = constrain(frameStartX + x, 0, sheet.width - 1);
            const srcY = constrain(y, 0, sheet.height - 1);
            const srcIdx = 4 * (srcY * sheet.width + srcX);
            const dstIdx = 4 * (y * frameWidth + x);
            const alpha = sheet.pixels[srcIdx + 3];

            if (alpha < 10) {
              data[dstIdx + 3] = 0;
              continue;
            }

            const [r, g, b] = this.applyZombieVariantTint(
              sheet.pixels[srcIdx],
              sheet.pixels[srcIdx + 1],
              sheet.pixels[srcIdx + 2],
              variant,
              1
            );

            data[dstIdx] = r;
            data[dstIdx + 1] = g;
            data[dstIdx + 2] = b;
            data[dstIdx + 3] = alpha;
          }
        }

        if (this.hasOpaquePixels(data)) {
          frames.push(data);
        }
      }

      return frames;
    } catch (err) {
      console.warn("Failed to build zombie spritesheet frames:", err);
      return [];
    }
  }

  buildZombieSkinAnimatedFrames(width, height, frameCount, variant, headYawDir = 0) {
    const skin = this.getZombieSkinImage();
    if (!skin) return [];

    try {
      skin.loadPixels();
      if (!skin.pixels || skin.pixels.length === 0) return [];

      const frames = [];
      const faceMap = this.getZombieMinecraftFaceMap();
      const skinHeight = skin.height;
      const useLegacyLeftLimbUV = skinHeight < 64;
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
        const headYawPx = Math.round(headYawDir * ZOMBIE_HEAD_TURN_PIXELS);
        const torsoYawPx = Math.round(headYawDir * (ZOMBIE_HEAD_TURN_PIXELS * 0.5));

        const topSkew = 0.36;
        this.paintZombieCuboid(data, width, height, skin, faceMap.head, {
          x: 8 + attackLunge + headYawPx,
          y: 2 + bodyBob,
          width: 11,
          height: 11,
          depth: 3,
          topHeight: 3,
          topSkew,
        }, {
          front: 1,
          side: 0.78,
          top: 1.08,
        }, variant);

        this.paintZombieCuboid(data, width, height, skin, faceMap.body, {
          x: 8 + attackLunge + torsoYawPx,
          y: 14 + bodyBob,
          width: 10,
          height: 13,
          depth: 3,
          topHeight: 2,
          topSkew,
        }, {
          front: 0.95,
          side: 0.74,
          top: 1.02,
        }, variant);

        this.paintZombieCuboid(data, width, height, skin, faceMap.rightArm, {
          x: 19 + armSwing + attackLunge + torsoYawPx,
          y: 14 + bodyBob,
          width: 4,
          height: 13,
          depth: 2,
          topHeight: 2,
          topSkew: 0.3,
        }, {
          front: 0.92,
          side: 0.68,
          top: 1.0,
        }, variant);

        this.paintZombieCuboid(data, width, height, skin, leftArmFaces, {
          x: 4 - armSwing + attackLunge + torsoYawPx,
          y: 14 + bodyBob,
          width: 4,
          height: 13,
          depth: 2,
          topHeight: 2,
          topSkew: 0.3,
        }, {
          front: 0.92,
          side: 0.68,
          top: 1.0,
        }, variant);

        this.paintZombieCuboid(data, width, height, skin, faceMap.rightLeg, {
          x: 10 + legSwing,
          y: 25 + bodyBob,
          width: 4,
          height: 16,
          depth: 2,
          topHeight: 2,
          topSkew: 0.28,
        }, {
          front: 0.9,
          side: 0.66,
          top: 0.98,
        }, variant);

        this.paintZombieCuboid(data, width, height, skin, leftLegFaces, {
          x: 6 - legSwing,
          y: 25 + bodyBob,
          width: 4,
          height: 16,
          depth: 2,
          topHeight: 2,
          topSkew: 0.28,
        }, {
          front: 0.9,
          side: 0.66,
          top: 0.98,
        }, variant);

        if (this.hasOpaquePixels(data)) {
          frames.push(data);
        }
      }

      return frames;
    } catch (err) {
      console.warn("Failed to build zombie skin animated frames:", err);
      return [];
    }
  }

  copyZombieRegion(src, dst, width, height, x0, y0, x1, y1, offsetX, offsetY) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dstX = x + offsetX;
        const dstY = y + offsetY;
        if (dstX < 0 || dstX >= width || dstY < 0 || dstY >= height) continue;

        const srcIdx = 4 * (y * width + x);
        const alpha = src[srcIdx + 3];
        if (alpha <= 0) continue;

        const dstIdx = 4 * (dstY * width + dstX);
        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = alpha;
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
      const bob = Math.round(Math.abs(Math.sin(phase)) * (variant === "charge" ? 2 : 1));
      const torsoLean = variant === "charge" ? 1 : 0;
      const headYawPx = Math.round(headYawDir * ZOMBIE_HEAD_TURN_PIXELS);
      const legLiftL = Math.max(0, Math.round(Math.sin(phase) * 2));
      const legLiftR = Math.max(0, Math.round(-Math.sin(phase) * 2));
      const armLiftL = Math.max(0, Math.round(-Math.sin(phase) * 1));
      const armLiftR = Math.max(0, Math.round(Math.sin(phase) * 1));
      const attackLunge = variant === "attack" ? Math.max(0, Math.round(Math.sin(phase) * 2)) : 0;
      const attackArmReachL = variant === "attack" ? Math.max(0, Math.round(Math.sin(phase) * 3)) : 0;
      const attackArmReachR = variant === "attack" ? Math.max(0, Math.round(-Math.sin(phase) * 3)) : 0;

      // head + torso
      this.copyZombieRegion(baseTexture, data, width, height, 14, 4, 24, 14, torsoLean + attackLunge + headYawPx, bob);
      this.copyZombieRegion(baseTexture, data, width, height, 14, 15, 24, 30, torsoLean + attackLunge, bob);

      // arms
      this.copyZombieRegion(baseTexture, data, width, height, 9, 17, 13, 30, -armSwing - attackArmReachL, bob - armLiftL);
      this.copyZombieRegion(baseTexture, data, width, height, 25, 17, 29, 30, armSwing + attackArmReachR, bob - armLiftR);

      // legs
      this.copyZombieRegion(baseTexture, data, width, height, 12, 31, 16, 49, legSwing, bob - legLiftL);
      this.copyZombieRegion(baseTexture, data, width, height, 18, 31, 22, 49, -legSwing, bob - legLiftR);

      frames.push(data);
    }

    return frames;
  }

  resolveZombieTextureForSprite(spriteData) {
    const variant = this.resolveZombieAnimationVariant(spriteData);
    const direction = this.resolveZombieDirectionForSprite(spriteData);
    const cacheKey = `${variant}${direction}Frames`;

    if (this.zombieSpriteCache.mode === "sheet" || this.zombieSpriteCache.mode === "generated") {
      const frameList = this.zombieSpriteCache[cacheKey];

      if (frameList && frameList.length > 0) {
        const speedFactor = this.resolveZombieAnimationSpeedFactor(spriteData, variant);
        const effectiveFps = this.zombieSpriteCache.fps * speedFactor;
        const frameDurationMs = 1000 / Math.max(1, effectiveFps);
        const frameIndex = Math.floor(millis() / frameDurationMs) % frameList.length;
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
    const camRightY = Math.cos(this.player.angle);
    const side = orb.moveDirX * camRightX + orb.moveDirY * camRightY;

    if (side > ZOMBIE_SIDE_TURN_THRESHOLD) return "Right";
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

    const base = Math.max(0.0001, ENEMY_BASE_SPEED * HUNTER_PATROL_SPEED_RATIO);
    const factor = currentSpeed / base;
    return constrain(factor, ZOMBIE_ANIM_SPEED_MIN, ZOMBIE_ANIM_SPEED_MAX);
  }

  buildZombieSkinSpriteVariant(width, height, variant) {
    const skin = this.getZombieSkinImage();
    if (!skin) return null;

    try {
      skin.loadPixels();
      if (!skin.pixels || skin.pixels.length === 0) return null;

      const data = new Uint8ClampedArray(width * height * 4);
      const faceMap = this.getZombieMinecraftFaceMap();

      const skinHeight = skin.height;
      const useLegacyLeftLimbUV = skinHeight < 64;

      const leftArmFaces = useLegacyLeftLimbUV ? faceMap.rightArm : faceMap.leftArm;
      const leftLegFaces = useLegacyLeftLimbUV ? faceMap.rightLeg : faceMap.leftLeg;

      const topSkew = 0.36;
      this.paintZombieCuboid(data, width, height, skin, faceMap.head, {
        x: 8,
        y: 2,
        width: 11,
        height: 11,
        depth: 3,
        topHeight: 3,
        topSkew,
      }, {
        front: 1,
        side: 0.78,
        top: 1.08,
      }, variant);

      this.paintZombieCuboid(data, width, height, skin, faceMap.body, {
        x: 8,
        y: 14,
        width: 10,
        height: 13,
        depth: 3,
        topHeight: 2,
        topSkew,
      }, {
        front: 0.95,
        side: 0.74,
        top: 1.02,
      }, variant);

      this.paintZombieCuboid(data, width, height, skin, faceMap.rightArm, {
        x: 19,
        y: 14,
        width: 4,
        height: 13,
        depth: 2,
        topHeight: 2,
        topSkew: 0.3,
      }, {
        front: 0.92,
        side: 0.68,
        top: 1.0,
      }, variant);

      this.paintZombieCuboid(data, width, height, skin, leftArmFaces, {
        x: 4,
        y: 14,
        width: 4,
        height: 13,
        depth: 2,
        topHeight: 2,
        topSkew: 0.3,
      }, {
        front: 0.92,
        side: 0.68,
        top: 1.0,
      }, variant);

      this.paintZombieCuboid(data, width, height, skin, faceMap.rightLeg, {
        x: 10,
        y: 25,
        width: 4,
        height: 16,
        depth: 2,
        topHeight: 2,
        topSkew: 0.28,
      }, {
        front: 0.9,
        side: 0.66,
        top: 0.98,
      }, variant);

      this.paintZombieCuboid(data, width, height, skin, leftLegFaces, {
        x: 6,
        y: 25,
        width: 4,
        height: 16,
        depth: 2,
        topHeight: 2,
        topSkew: 0.28,
      }, {
        front: 0.9,
        side: 0.66,
        top: 0.98,
      }, variant);

      if (!this.hasOpaquePixels(data)) return null;
      return data;
    } catch (err) {
      console.warn("Failed to build zombie skin sprite variant:", err);
      return null;
    }
  }

  getZombieMinecraftFaceMap() {
    // Canonical Minecraft 64x64 skin UV layout.
    return {
      head: {
        top: { x: 8, y: 0, w: 8, h: 8 },
        front: { x: 8, y: 8, w: 8, h: 8 },
        right: { x: 0, y: 8, w: 8, h: 8 },
        left: { x: 16, y: 8, w: 8, h: 8 },
      },
      body: {
        top: { x: 20, y: 16, w: 8, h: 4 },
        front: { x: 20, y: 20, w: 8, h: 12 },
        right: { x: 16, y: 20, w: 4, h: 12 },
        left: { x: 28, y: 20, w: 4, h: 12 },
      },
      rightArm: {
        top: { x: 44, y: 16, w: 4, h: 4 },
        front: { x: 44, y: 20, w: 4, h: 12 },
        right: { x: 40, y: 20, w: 4, h: 12 },
        left: { x: 48, y: 20, w: 4, h: 12 },
      },
      leftArm: {
        top: { x: 36, y: 48, w: 4, h: 4 },
        front: { x: 36, y: 52, w: 4, h: 12 },
        right: { x: 32, y: 52, w: 4, h: 12 },
        left: { x: 40, y: 52, w: 4, h: 12 },
      },
      rightLeg: {
        top: { x: 4, y: 16, w: 4, h: 4 },
        front: { x: 4, y: 20, w: 4, h: 12 },
        right: { x: 0, y: 20, w: 4, h: 12 },
        left: { x: 8, y: 20, w: 4, h: 12 },
      },
      leftLeg: {
        top: { x: 20, y: 48, w: 4, h: 4 },
        front: { x: 20, y: 52, w: 4, h: 12 },
        right: { x: 16, y: 52, w: 4, h: 12 },
        left: { x: 24, y: 52, w: 4, h: 12 },
      },
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
      skin.pixels[srcIdx],
      skin.pixels[srcIdx + 1],
      skin.pixels[srcIdx + 2],
      variant,
      shade
    );

    const dstIdx = 4 * (spriteY * canvasW + spriteX);
    data[dstIdx] = r;
    data[dstIdx + 1] = g;
    data[dstIdx + 2] = b;
    data[dstIdx + 3] = 255;
  }

  paintZombieFrontFace(data, canvasW, canvasH, skin, uv, dstX, dstY, dstW, dstH, shade, variant) {
    for (let ty = 0; ty < dstH; ty++) {
      const v = uv.y + (ty / Math.max(1, dstH)) * uv.h;
      for (let tx = 0; tx < dstW; tx++) {
        const u = uv.x + (tx / Math.max(1, dstW)) * uv.w;
        this.writeSkinPixelToSprite(
          data,
          canvasW,
          canvasH,
          skin,
          u,
          v,
          dstX + tx,
          dstY + ty,
          shade,
          variant
        );
      }
    }
  }

  paintZombieRightFace(data, canvasW, canvasH, skin, uv, dstX, dstY, dstH, depth, shade, variant) {
    for (let ty = 0; ty < dstH; ty++) {
      const v = uv.y + (ty / Math.max(1, dstH)) * uv.h;
      for (let tx = 0; tx < depth; tx++) {
        const u = uv.x + (tx / Math.max(1, depth)) * uv.w;
        const yShift = Math.floor((depth - tx - 1) * 0.55);
        this.writeSkinPixelToSprite(
          data,
          canvasW,
          canvasH,
          skin,
          u,
          v,
          dstX + tx,
          dstY + ty - yShift,
          shade,
          variant
        );
      }
    }
  }

  paintZombieLeftFace(data, canvasW, canvasH, skin, uv, dstX, dstY, dstH, depth, shade, variant) {
    for (let ty = 0; ty < dstH; ty++) {
      const v = uv.y + (ty / Math.max(1, dstH)) * uv.h;
      for (let tx = 0; tx < depth; tx++) {
        const u = uv.x + ((depth - tx - 1) / Math.max(1, depth)) * uv.w;
        const yShift = Math.floor(tx * 0.55);
        this.writeSkinPixelToSprite(
          data,
          canvasW,
          canvasH,
          skin,
          u,
          v,
          dstX - tx,
          dstY + ty - yShift,
          shade,
          variant
        );
      }
    }
  }

  paintZombieTopFace(data, canvasW, canvasH, skin, uv, dstX, dstY, dstW, topH, skew, shade, variant) {
    for (let ty = 0; ty < topH; ty++) {
      const v = uv.y + (ty / Math.max(1, topH)) * uv.h;
      for (let tx = 0; tx < dstW; tx++) {
        const u = uv.x + (tx / Math.max(1, dstW)) * uv.w;
        const xShift = Math.floor((topH - ty - 1) * skew);
        this.writeSkinPixelToSprite(
          data,
          canvasW,
          canvasH,
          skin,
          u,
          v,
          dstX + tx + xShift,
          dstY + ty,
          shade,
          variant
        );
      }
    }
  }

  paintZombieCuboid(data, canvasW, canvasH, skin, partFaces, layout, shades, variant) {
    const {
      x,
      y,
      width,
      height,
      depth,
      topHeight,
      topSkew,
    } = layout;

    // Draw back-to-front for cleaner overlap.
    this.paintZombieTopFace(
      data,
      canvasW,
      canvasH,
      skin,
      partFaces.top,
      x,
      y - topHeight,
      width,
      topHeight,
      topSkew,
      shades.top,
      variant
    );

    this.paintZombieLeftFace(
      data,
      canvasW,
      canvasH,
      skin,
      partFaces.left,
      x - 1,
      y,
      height,
      depth,
      shades.left,
      variant
    );

    this.paintZombieFrontFace(
      data,
      canvasW,
      canvasH,
      skin,
      partFaces.front,
      x,
      y,
      width,
      height,
      shades.front,
      variant
    );

    this.paintZombieRightFace(
      data,
      canvasW,
      canvasH,
      skin,
      partFaces.right,
      x + width,
      y,
      height,
      depth,
      shades.right,
      variant
    );
  }

  applyZombieVariantTint(r, g, b, variant, shade) {
    let mul = shade;
    if (variant === "chase") mul *= 1.04;
    if (variant === "attack") mul *= 1.08;
    if (variant === "charge") mul *= 1.1;

    let outR = r * mul;
    let outG = g * mul;
    let outB = b * mul;

    if (variant === "chase") {
      outR = lerp(outR, 170, 0.08);
      outG = lerp(outG, 60, 0.03);
      outB = lerp(outB, 70, 0.04);
    } else if (variant === "attack") {
      outR = lerp(outR, 230, 0.18);
      outG = lerp(outG, 45, 0.12);
      outB = lerp(outB, 45, 0.1);
    } else if (variant === "charge") {
      outR = lerp(outR, 255, 0.25);
      outG = lerp(outG, 70, 0.1);
      outB = lerp(outB, 50, 0.12);
    }

    return [
      constrain(outR, 0, 255),
      constrain(outG, 0, 255),
      constrain(outB, 0, 255),
    ];
  }

  buildZombieSpriteVariant(width, height, variant) {
    const skinnedData = this.buildZombieSkinSpriteVariant(width, height, variant);
    if (skinnedData) return skinnedData;

    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = 4 * (y * width + x);

        const head = x >= 14 && x <= 24 && y >= 4 && y <= 14;
        const body = x >= 14 && x <= 24 && y >= 15 && y <= 30;
        const leftArm = x >= 9 && x <= 13 && y >= 17 && y <= 30;
        const rightArm = x >= 25 && x <= 29 && y >= 17 && y <= 30;
        const leftLeg = x >= 12 && x <= 16 && y >= 31 && y <= 49;
        const rightLeg = x >= 18 && x <= 22 && y >= 31 && y <= 49;

        if (!head && !body && !leftArm && !rightArm && !leftLeg && !rightLeg) {
          data[idx + 3] = 0;
          continue;
        }

        let base = [48, 34, 28];
        if (head) base = [92, 170, 92];
        else if (body || leftArm || rightArm) base = [64, 118, 162];

        const [tintedR, tintedG, tintedB] = this.applyZombieVariantTint(base[0], base[1], base[2], variant, 1);
        data[idx] = tintedR;
        data[idx + 1] = tintedG;
        data[idx + 2] = tintedB;
        data[idx + 3] = 255;
      }
    }

    return data;
  }

  createCollectOrbSpriteCache() {
    const width = 20;
    const height = 20;
    return {
      width,
      height,
      safe: this.buildCollectOrbSpriteVariant(width, height, "safe"),
      warning: this.buildCollectOrbSpriteVariant(width, height, "warning"),
    };
  }

  buildCollectOrbSpriteVariant(width, height, variant) {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = (x / (width - 1)) * 2 - 1;
        const ny = (y / (height - 1)) * 2 - 1;
        const r = Math.hypot(nx, ny);
        const idx = 4 * (y * width + x);

        const angle = Math.atan2(ny, nx);
        const jagged = variant === "warning" ? Math.sin(angle * 8) * 0.08 : 0;
        const edge = 1 - (r + jagged);
        if (edge <= 0) {
          data[idx + 3] = 0;
          continue;
        }

        const core = Math.max(0, 1 - r / 0.38);
        const ring = Math.max(0, 1 - Math.abs(r - 0.62) / 0.12);
        const sparkle = variant === "warning"
          ? Math.max(0, Math.sin((nx - ny) * 18) * 0.25)
          : Math.max(0, Math.sin((nx + ny) * 14) * 0.2);

        const intensity = constrain(110 + edge * 95 + core * 50 + ring * 45 + sparkle * 30, 0, 255);
        const alpha = constrain((edge * edge * 255) + ring * 35, 0, 255);

        // Neutral grayscale map; tint is applied dynamically in sprite rendering.
        data[idx] = intensity;
        data[idx + 1] = intensity;
        data[idx + 2] = intensity;
        data[idx + 3] = alpha;
      }
    }

    return data;
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
    // Taille réduite - prend jusqu'à 40% de l'écran
    const mmSize = Math.floor(Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.40);
    const mmX = SCREEN_WIDTH - mmSize - 14;
    const mmY = 10;  // En haut à droite
    const tilePixels = mmSize / MAP_TILE_COUNT;

    push();
    fill(0, 0, 0, 220);
    stroke(80, 80, 80, 255);
    strokeWeight(3);
    rect(mmX, mmY, mmSize, mmSize, 6);

    // Tiles - avec contour pour mieux les voir
    for (let row = 0; row < MAP_TILE_COUNT; row++) {
      for (let col = 0; col < MAP_TILE_COUNT; col++) {
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
    for (const orb of this.orbs) {
      let col;
      if (orb.isSafe())          col = color(80, 255, 120);
      else if (orb.isWarning())  col = color(255, 180, 40);    // orange flash
      else if (orb.isChasing())  col = color(255, 50, 50);     // bright red
      else                       col = color(180, 70, 70);     // dim red patrol
      fill(col);
      const ox = mmX + orb.posX * tilePixels;
      const oy = mmY + orb.posY * tilePixels;
      circle(ox, oy, 10);
    }

    // World modules
    noStroke();
    for (const wm of this.worldModules) {
      if (wm.type === "aegis") fill(90, 230, 255);
      else if (wm.type === "emp") fill(170, 240, 255);
      else fill(200, 130, 255);
      const mx = mmX + wm.posX * tilePixels;
      const my = mmY + wm.posY * tilePixels;
      rect(mx - 4, my - 4, 8, 8, 1);
    }

    // Drops
    noStroke();
    for (const drop of this.drops) {
      if (drop.type === "ammo") fill(255, 220, 110);
      else if (drop.type === "score") fill(255, 255, 140);
      else if (drop.type === "pulse") fill(220, 170, 255);
      else if (drop.type === "rounds") fill(255, 175, 105);
      else fill(170, 225, 255);
      const dx = mmX + drop.posX * tilePixels;
      const dy = mmY + drop.posY * tilePixels;
      circle(dx, dy, 6);
    }

    // Extraction portal
    if (this.extractionPortal) {
      const pxPortal = mmX + this.extractionPortal.posX * tilePixels;
      const pyPortal = mmY + this.extractionPortal.posY * tilePixels;
      noFill();
      stroke(130, 255, 180);
      strokeWeight(3);
      circle(pxPortal, pyPortal, 12);
      noStroke();
    }

    // Punch Machine
    noStroke();
    if (this.punchMachine) {
      const mx = mmX + this.punchMachine.posX * tilePixels;
      const my = mmY + this.punchMachine.posY * tilePixels;
      fill(235, 120, 255);
      rect(mx - 4, my - 4, 8, 8, 1);
    }

    // Player
    noStroke();
    const px = mmX + this.player.posX * tilePixels;
    const py = mmY + this.player.posY * tilePixels;
    fill(100, 180, 255);
    circle(px, py, 10);

    // Direction arrow
    stroke(100, 180, 255);
    strokeWeight(2);
    const arrowLen = 15;
    line(px, py, px + Math.cos(this.player.angle) * arrowLen, py + Math.sin(this.player.angle) * arrowLen);

    pop();
  }

  // --- HUD ---
  drawHUD() {
    push();
    textFont("Courier New");
    noStroke();

    const hunterCount = this.orbs.filter(o => o.isHunter()).length;
    const moduleCount = this.worldModules.length;
    
    // Display wave objective: kills required to complete wave
    const objectiveText = this.waveNumber > 0
      ? `ZOMBIES: ${this.waveEnemiesKilled}/${this.waveKillsRequired}`
      : "EN ATTENTE...";
    
    const waveCountdownSec = Math.max(0, (this.nextWaveActionMs - millis()) / 1000);
    const waveText = this.waveState === "preparing"
      ? `PROCHAINE VAGUE: ${waveCountdownSec.toFixed(1)}s`
      : `VAGUE ${this.waveNumber}: ${this.waveEnemiesKilled}/${this.waveKillsRequired}`;

    let machineText = `PUNCH: débloquée vague ${PUNCH_MACHINE_UNLOCK_WAVE}`;
    let machineColor = [210, 180, 255];
    if (this.punchMachine) {
      const sinceUse = millis() - this.punchMachine.lastUseMs;
      const cooldownMs = Math.max(0, PUNCH_MACHINE_COOLDOWN_MS - sinceUse);
      if (this.waveNumber < PUNCH_MACHINE_UNLOCK_WAVE) {
        machineText = `PUNCH VERROUILLÉE (${this.waveNumber}/${PUNCH_MACHINE_UNLOCK_WAVE})`;
        machineColor = [255, 160, 160];
      } else if (cooldownMs > 0) {
        machineText = `PUNCH RECHARGE: ${(cooldownMs / 1000).toFixed(1)}s`;
        machineColor = [220, 180, 255];
      } else {
        machineText = `PUNCH READY (${PUNCH_MACHINE_COST} pts)`;
        machineColor = [180, 245, 255];
      }
    }

    // --- Left status panel ---
    fill(0, 0, 0, 120);
    rect(10, 10, 312, 216, 6);
    textAlign(LEFT, TOP);
    textSize(18);
    fill(230, 240, 255);
    text("SCORE: " + Math.floor(this.score), 18, 18);
    text("TIME: " + this.survivalSeconds().toFixed(1) + "s", 18, 42);
    
    // Weapon ammo display: Magazine / Inventory
    const now = millis();
    const isReloading = now < this.weaponReloadingUntilMs;
    const ammoColor = isReloading ? [255, 165, 100] : [255, 220, 110];
    fill(ammoColor[0], ammoColor[1], ammoColor[2]);
    const maxInv = this.getMaxInventoryAmmo();
    text(`MAG: ${this.weaponMagazineAmmo}/${this.getMaxMagazineSize()}  |  ${this.weaponInventoryAmmo}/${maxInv}`, 18, 66);

    // Magazine bar
    const magFrac = constrain(this.weaponMagazineAmmo / WEAPON_MAGAZINE_SIZE, 0, 1);
    fill(40, 42, 48, 210);
    rect(18, 92, 220, 16, 4);
    fill(ammoColor[0], ammoColor[1], ammoColor[2]);
    rect(18, 92, 220 * magFrac, 16, 4);
    
    // Reload progress bar
    if (isReloading) {
      const reloadFrac = 1 - ((this.weaponReloadingUntilMs - now) / WEAPON_RELOAD_DURATION_MS);
      fill(200, 200, 50, 150);
      rect(18, 110, 220 * reloadFrac, 8, 2);
      fill(200, 200, 50);
      textSize(11);
      text(`RECHARGEMENT... ${(reloadFrac * 100).toFixed(0)}%`, 18, 120);
      // Wave text moved down when reloading
      textSize(14);
      fill(255, 165, 120);
      text(waveText, 18, 134);
    } else {
      textSize(14);
      fill(255, 165, 120);
      text(waveText, 18, 114);
    }

    fill(120, 245, 210);
    text(objectiveText, 18, 132);

    const sprintFrac = constrain(this.sprintEnergy / SPRINT_ENERGY_MAX, 0, 1);
    fill(40, 42, 48, 210);
    rect(18, 158, 220, 12, 4);
    fill(this.sprintActive ? 150 : 95, 205 + sprintFrac * 50, 255, 235);
    rect(18, 158, 220 * sprintFrac, 12, 4);
    fill(165, 220, 255);
    text("SPRINT", 244, 155);

    if (this.killStreak >= 2 && millis() <= this.killStreakUntilMs) {
      const streakMul = this.currentKillStreakMultiplier().toFixed(2).replace(/\.00$/, "");
      fill(255, 175, 120);
      text(`STREAK x${streakMul} (${this.killStreak})`, 18, 176);
    }

    textSize(12);
    fill(machineColor[0], machineColor[1], machineColor[2]);
    text(machineText, 18, 196);

    // --- Right threat panel ---
    fill(0, 0, 0, 120);
    rect(SCREEN_WIDTH - 230, 10, 220, 136, 6);
    textAlign(RIGHT, TOP);
    textSize(18);
    fill(255, 165, 120);
    text("WAVE: " + this.waveNumber, SCREEN_WIDTH - 18, 18);
    fill(255, 80, 80);
    text("ZOMBIES: " + hunterCount, SCREEN_WIDTH - 18, 42);
    fill(255, 205, 140);
    text("SPAWNED: " + this.waveEnemiesSpawned + "/" + this.waveEnemiesTotal, SCREEN_WIDTH - 18, 66);
    fill(140, 220, 255);
    text("MODULES: " + moduleCount, SCREEN_WIDTH - 18, 90);
    fill(220, 200, 255);
    text("DROPS: " + this.drops.length, SCREEN_WIDTH - 18, 114);

    // --- Corruption progress bar ---
    const maxLayers = Math.max(1, Math.floor((MAP_TILE_COUNT - 2) / 2));
    const corruptionFrac = constrain(this.corruptionLayer / maxLayers, 0, 1);
    const barWidth = Math.min(460, SCREEN_WIDTH * 0.48);
    const barX = SCREEN_WIDTH / 2 - barWidth / 2;
    const barY = 14;
    fill(0, 0, 0, 130);
    rect(barX - 6, barY - 4, barWidth + 12, 28, 6);
    fill(40, 42, 48, 210);
    rect(barX, barY, barWidth, 12, 4);
    fill(255, 70, 70, 220);
    rect(barX, barY, barWidth * corruptionFrac, 12, 4);
    textAlign(CENTER, TOP);
    textSize(12);
    fill(255, 210, 210);
    text("CORRUPTION " + this.corruptionLayer + "/" + maxLayers, SCREEN_WIDTH / 2, barY + 14);

    // --- Active effects list ---
    let fxY = 232;
    textAlign(LEFT, TOP);
    textSize(14);
    if (this.isAegisActive()) {
      const remain = Math.max(0, (this.activeAegisUntilMs - millis()) / 1000).toFixed(1);
      fill(120, 225, 255);
      text("AEGIS: " + remain + "s", 14, fxY);
      fxY += 18;
    }
    if (this.isChronoActive()) {
      const remain = Math.max(0, (this.activeChronoUntilMs - millis()) / 1000).toFixed(1);
      fill(210, 140, 255);
      text("CHRONO: " + remain + "s", 14, fxY);
      fxY += 18;
    }
    if (this.isDamageBoostActive()) {
      const remain = Math.max(0, (this.powerDamageUntilMs - millis()) / 1000).toFixed(1);
      fill(255, 170, 120);
      text("PUNCH DMG: " + remain + "s", 14, fxY);
      fxY += 18;
    }
    if (this.isRapidFireActive()) {
      const remain = Math.max(0, (this.powerRapidUntilMs - millis()) / 1000).toFixed(1);
      fill(255, 240, 140);
      text("RAPID FIRE: " + remain + "s", 14, fxY);
      fxY += 18;
    }
    if (this.isInstakillActive()) {
      const remain = Math.max(0, (this.powerInstakillUntilMs - millis()) / 1000).toFixed(1);
      fill(255, 110, 110);
      text("INSTAKILL: " + remain + "s", 14, fxY);
      fxY += 18;
    }
    const stunnedHunters = this.countStunnedHunters();
    if (stunnedHunters > 0) {
      fill(150, 235, 255);
      text("EMP STUN: " + stunnedHunters, 14, fxY);
    }

    // --- Inventory quickbar (slots 1/2/3) ---
    const slots = [
      { key: "1", label: "Pistol", count: "", col: [200, 200, 200] },
      { key: "2", label: "Bomb", count: this.inventory.bomb, col: [255, 100, 100] },
      { key: "3", label: "Pulse", count: this.inventory.pulseCore, col: [220, 180, 255] },
    ];

    const slotW = 140;
    const slotH = 80;
    const gap = 10;
    const totalW = slotW * slots.length + gap * (slots.length - 1);
    const startX = SCREEN_WIDTH / 2 - totalW / 2;
    const y = SCREEN_HEIGHT - slotH - 16;

    textAlign(LEFT, TOP);
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const x = startX + i * (slotW + gap);
      const hasItem = slot.count > 0;
      const isSelected = (i + 1) === this.selectedHotbarSlot;

      if (isSelected) {
        stroke(240, 248, 255, 220);
        strokeWeight(2.2);
        fill(25, 30, 40, 220);
        rect(x - 3, y - 3, slotW + 6, slotH + 6, 8);
        noStroke();
      }

      fill(0, 0, 0, 150);
      rect(x, y, slotW, slotH, 7);

      const alpha = hasItem ? (isSelected ? 255 : 230) : 90;
      fill(slot.col[0], slot.col[1], slot.col[2], alpha);
      rect(x + 8, y + 8, 12, 12, 2);

      textSize(16);
      fill(230, 240, 255, hasItem ? 255 : 140);
      text("[" + slot.key + "] " + slot.label, x + 30, y + 10);
      textSize(26);
      fill(255, 255, 255, hasItem ? 255 : 120);
      text(String(slot.count), x + 12, y + 28);

      if (isSelected) {
        textSize(11);
        fill(210, 230, 255, 220);
        text("ACTIVE", x + slotW - 50, y + 40);
      }
    }

    // --- HUD toast ---
    if (millis() < this.hudToastUntilMs && this.hudToastText) {
      const toastAlpha = constrain((this.hudToastUntilMs - millis()) / HUD_TOAST_DURATION_MS, 0, 1);
      const ty = y - 34;
      fill(0, 0, 0, 170 * toastAlpha);
      rect(SCREEN_WIDTH / 2 - 170, ty - 4, 340, 28, 6);
      textAlign(CENTER, TOP);
      textSize(14);
      fill(this.hudToastColor[0], this.hudToastColor[1], this.hudToastColor[2], 255 * toastAlpha);
      text(this.hudToastText, SCREEN_WIDTH / 2, ty);
    }

    if (this.punchMachine) {
      const distToMachine = Math.hypot(
        this.player.posX - this.punchMachine.posX,
        this.player.posY - this.punchMachine.posY
      );
      if (distToMachine < 2.2) {
        let hintText = `Q - AMELIORER L'ARME (${this.punchMachinePrice} G)`;
        let hintCol = [225, 185, 255];
        if (this.waveNumber < PUNCH_MACHINE_UNLOCK_WAVE) {
          hintText = `Q - VERROUILLEE (Vague ${PUNCH_MACHINE_UNLOCK_WAVE})`;
          hintCol = [255, 165, 165];
        }

        fill(0, 0, 0, 155);
        rect(SCREEN_WIDTH / 2 - 172, y - 68, 344, 26, 6);
        textAlign(CENTER, TOP);
        textSize(13);
        fill(hintCol[0], hintCol[1], hintCol[2]);
        text(hintText, SCREEN_WIDTH / 2, y - 64);
      }
    }

    this.drawObjectivePointer();

    pop();
  }

  drawObjectivePointer() {
    const target = this.getCurrentObjectiveTarget();
    if (!target) return;

    const dx = target.x - this.player.posX;
    const dy = target.y - this.player.posY;
    const targetAngle = Math.atan2(dy, dx);
    const relativeAngle = Math.atan2(
      Math.sin(targetAngle - this.player.angle),
      Math.cos(targetAngle - this.player.angle)
    );

    const range = Math.min(260, SCREEN_WIDTH * 0.28);
    const normalized = constrain(relativeAngle / (FIELD_OF_VIEW_RADIANS * 0.8), -1, 1);
    const indicatorX = SCREEN_WIDTH / 2 + normalized * range;
    const indicatorY = 58;
    const inView = Math.abs(relativeAngle) <= FIELD_OF_VIEW_RADIANS / 2;

    const baseColor = target.label === "EXTRACT"
      ? [135, 255, 180]
      : [120, 245, 210];

    push();
    noStroke();
    fill(0, 0, 0, 130);
    rect(indicatorX - 58, indicatorY - 20, 116, 36, 5);

    fill(baseColor[0], baseColor[1], baseColor[2], inView ? 255 : 185);
    triangle(
      indicatorX,
      indicatorY - 16,
      indicatorX - 7,
      indicatorY - 3,
      indicatorX + 7,
      indicatorY - 3
    );

    textAlign(CENTER, TOP);
    textSize(12);
    text(`${target.label}  ${Math.round(target.dist)}m`, indicatorX, indicatorY);
    pop();
  }

  // --- First-person weapon viewmodel (3/4 perspective, pointing forward) ---
  drawFirstPersonWeapon() {
    // Don't draw weapon in 3D mode
    if (this.use3DMode) return;
    
    const moving =
      isControlPressed("forward") ||
      isControlPressed("backward") ||
      isControlPressed("left") ||
      isControlPressed("right");

    const t = millis() * VIEWMODEL_BOB_SPEED;
    const bobX = moving ? Math.sin(t) * VIEWMODEL_BOB_X : 0;
    const bobY = moving ? Math.abs(Math.cos(t * 1.2)) * VIEWMODEL_BOB_Y : 0;

    const recoilFrac = constrain((this.weaponFlashUntilMs - millis()) / 70, 0, 1);

    const s = VIEWMODEL_SCALE * Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 680;

    // Better grip positioning - height raised, simpler viewmodel
    const gripCenterX = SCREEN_WIDTH * 0.72 + bobX + 20;
    const gripCenterY = SCREEN_HEIGHT * 0.55 + bobY;  // Adjusted height
    const barrelLength = 140 * s;  // Reduced barrel length
    const barrelAngle = -Math.PI / 2;  // Point straight up (vertical)
    const muzzleX = gripCenterX + Math.cos(barrelAngle) * barrelLength;
    const muzzleY = gripCenterY + Math.sin(barrelAngle) * barrelLength - recoilFrac * VIEWMODEL_RECOIL_PX;

    // ===== PART 1: DRAW ARM (Cubic with diagonal shading) =====
    push();
    stroke(0);
    strokeWeight(2);

    // Arm dimensions
    const armWidth = 40 * s;  // Width (thickness) of arm
    const armX1 = SCREEN_WIDTH + 40;
    const armY1_top = SCREEN_HEIGHT - armWidth;  
    const armY1_bot = SCREEN_HEIGHT + armWidth;  
    const armX2 = gripCenterX + 30 * s;
    const armY2_top = gripCenterY + 100 * s - armWidth;  
    const armY2_bot = gripCenterY + 100 * s + armWidth;  

    // Calculate middle line for diagonal split
    const armY1_mid = (armY1_top + armY1_bot) / 2;
    const armY2_mid = (armY2_top + armY2_bot) / 2;

    // Top face (lighter - extends down to middle)
    fill(210, 174, 144);
    quad(
      armX1, armY1_top,
      armX2, armY2_top,
      armX2, armY2_mid,
      armX1, armY1_mid
    );

    // Bottom face (much darker - extends up to middle)
    fill(120, 90, 60);
    quad(
      armX1, armY1_mid,
      armX2, armY2_mid,
      armX2, armY2_bot,
      armX1, armY1_bot
    );

    // Right side face (medium transition tone)
    // REMOVED

    // Left side face (darker brown)
    // REMOVED

    // Hand triangle on the left side (skin tone)
    // REMOVED

    pop();

    // ===== PART 2: PISTOL (Vertical, front-facing) =====
    push();
    noStroke();

    // Compute barrel direction vectors for proper 3D perspective
    const perpX = -Math.sin(barrelAngle);
    const perpY = Math.cos(barrelAngle);
    
    // Barrel dimensions (more refined, less massive)
    // barrelLength is already computed above
    const barrelRadius = 10 * s;        // Thinner barrel
    const muzzleRadius = 12 * s;        // Slightly wider muzzle
    
    // === BARREL (metallic cylinder pointing straight up) ===
    // Left face of barrel (shadow - darker steel)
    fill(110, 110, 115);
    quad(
      gripCenterX - barrelRadius, gripCenterY,
      muzzleX - barrelRadius, muzzleY,
      muzzleX - barrelRadius * 0.8, muzzleY - 15 * s,
      gripCenterX - barrelRadius * 0.8, gripCenterY - 15 * s
    );

    // Right face of barrel (highlight - bright steel)
    fill(200, 200, 205);
    quad(
      gripCenterX + barrelRadius, gripCenterY,
      muzzleX + barrelRadius, muzzleY,
      muzzleX + barrelRadius * 0.8, muzzleY - 15 * s,
      gripCenterX + barrelRadius * 0.8, gripCenterY - 15 * s
    );

    // Front face of barrel (light grey)
    fill(170, 170, 175);
    quad(
      gripCenterX - barrelRadius * 0.8, gripCenterY - 15 * s,
      gripCenterX + barrelRadius * 0.8, gripCenterY - 15 * s,
      muzzleX + barrelRadius * 0.8, muzzleY - 15 * s,
      muzzleX - barrelRadius * 0.8, muzzleY - 15 * s
    );

    // === SLIDE (top cover, dark gun metal running along barrel) ===
    const slideWidth = 22 * s;
    
    // Slide top surface (dark matte finish)
    fill(90, 90, 95);
    quad(
      gripCenterX - slideWidth, gripCenterY - 8 * s,
      muzzleX - slideWidth, muzzleY - 8 * s,
      muzzleX + slideWidth, muzzleY + 8 * s,
      gripCenterX + slideWidth, gripCenterY + 8 * s
    );

    // Slide sides shadow
    fill(70, 70, 75);
    quad(
      gripCenterX - slideWidth, gripCenterY - 8 * s,
      gripCenterX - slideWidth * 1.1, gripCenterY,
      muzzleX - slideWidth * 1.1, muzzleY,
      muzzleX - slideWidth, muzzleY - 8 * s
    );

    // Slide front edge (brighter reflection)
    fill(140, 140, 145);
    quad(
      gripCenterX + slideWidth, gripCenterY + 8 * s,
      gripCenterX + slideWidth * 1.1, gripCenterY + 16 * s,
      muzzleX + slideWidth * 1.1, muzzleY + 16 * s,
      muzzleX + slideWidth, muzzleY + 8 * s
    );

    // === MUZZLE (opening at barrel top) ===
    fill(50, 50, 55);
    ellipse(muzzleX, muzzleY, muzzleRadius * 2.2, muzzleRadius * 1.8);
    
    // Muzzle inner shadow
    fill(30, 30, 35);
    ellipse(muzzleX, muzzleY, muzzleRadius * 1.4, muzzleRadius * 1.0);
    
    // Muzzle flash (when firing)
    if (millis() < this.weaponFlashUntilMs) {
      // Outer flash
      fill(255, 180, 80, 200);
      ellipse(muzzleX, muzzleY, muzzleRadius * 3.2, muzzleRadius * 2.5);
      // Core flash
      fill(255, 230, 150, 220);
      ellipse(muzzleX, muzzleY, muzzleRadius * 2.0, muzzleRadius * 1.5);
    }

    // === GRIP (handle - vertical, held from below) ===
    const gripWidth = 20 * s;
    const gripLength = 70 * s;
    
    // Grip main body (dark brown plastic, front face)
    fill(85, 50, 30);
    quad(
      gripCenterX - gripWidth, gripCenterY,
      gripCenterX + gripWidth, gripCenterY,
      gripCenterX + gripWidth * 0.8, gripCenterY + gripLength,
      gripCenterX - gripWidth * 0.8, gripCenterY + gripLength
    );

    // Grip highlight/left side (lighter brown)
    fill(120, 70, 40);
    quad(
      gripCenterX - gripWidth, gripCenterY,
      gripCenterX - gripWidth * 0.9, gripCenterY + 10 * s,
      gripCenterX - gripWidth * 0.8, gripCenterY + gripLength,
      gripCenterX - gripWidth * 0.8, gripCenterY + gripLength - 10 * s
    );

    // Grip shadow/right side (darker)
    fill(60, 35, 20);
    quad(
      gripCenterX + gripWidth, gripCenterY,
      gripCenterX + gripWidth * 0.9, gripCenterY + 10 * s,
      gripCenterX + gripWidth * 0.8, gripCenterY + gripLength,
      gripCenterX + gripWidth * 0.8, gripCenterY + gripLength - 10 * s
    );

    // Grip texture lines (subtle grooves)
    stroke(40, 25, 15);
    strokeWeight(1);
    line(gripCenterX - 8 * s, gripCenterY + 15 * s, gripCenterX - 8 * s, gripCenterY + gripLength - 15 * s);
    line(gripCenterX + 8 * s, gripCenterY + 15 * s, gripCenterX + 8 * s, gripCenterY + gripLength - 15 * s);
    noStroke();

    // === TRIGGER GUARD (protective loop in front) ===
    const guardOffsetY = 15 * s;
    
    // Guard shadow (darker, left side)
    fill(75, 75, 80);
    quad(
      gripCenterX - gripWidth * 0.6, gripCenterY + guardOffsetY,
      gripCenterX - gripWidth * 0.8, gripCenterY + guardOffsetY + 25 * s,
      gripCenterX + gripWidth * 0.8, gripCenterY + guardOffsetY + 25 * s,
      gripCenterX + gripWidth * 0.6, gripCenterY + guardOffsetY
    );

    // Guard highlight (lighter)
    fill(130, 130, 135);
    quad(
      gripCenterX - gripWidth * 0.5, gripCenterY + guardOffsetY + 3 * s,
      gripCenterX - gripWidth * 0.7, gripCenterY + guardOffsetY + 22 * s,
      gripCenterX + gripWidth * 0.7, gripCenterY + guardOffsetY + 22 * s,
      gripCenterX + gripWidth * 0.5, gripCenterY + guardOffsetY + 3 * s
    );

    // === TRIGGER (visible inside guard) ===
    fill(100, 100, 105);
    quad(
      gripCenterX - 5 * s, gripCenterY + guardOffsetY + 8 * s,
      gripCenterX - 6 * s, gripCenterY + guardOffsetY + 16 * s,
      gripCenterX + 6 * s, gripCenterY + guardOffsetY + 16 * s,
      gripCenterX + 5 * s, gripCenterY + guardOffsetY + 8 * s
    );

    // === SIGHTS/RAIL (top of slide - functional detail) ===
    fill(70, 70, 75);
    quad(
      gripCenterX - 6 * s, gripCenterY - slideWidth - 5 * s,
      gripCenterX + 6 * s, gripCenterY - slideWidth - 5 * s,
      muzzleX + 5 * s, muzzleY - slideWidth - 5 * s,
      muzzleX - 5 * s, muzzleY - slideWidth - 5 * s
    );

    // Rear sight
    fill(85, 85, 90);
    quad(
      gripCenterX - 7 * s, gripCenterY - slideWidth - 8 * s,
      gripCenterX + 7 * s, gripCenterY - slideWidth - 8 * s,
      gripCenterX + 6 * s, gripCenterY - slideWidth,
      gripCenterX - 6 * s, gripCenterY - slideWidth
    );

    pop();
  }

  // --- Crosshair ---
  drawCrosshair() {
    push();
    const firing = millis() < this.weaponFlashUntilMs;
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

  // --- Horror Fog Vignette (DISABLED - using distance-based darkness instead) ---
  drawFogVignette() {
    // Fog is now handled via reduced ambient light and block darkness over distance
    // No visual vignette overlay is drawn
  }

  /**
   * ========== MUSIC SYSTEM ==========
   * Placeholder methods for audio/music management.
   * These methods are called at key game state transitions.
   * Uncomment and implement when you're ready to add music to the game.
   * 
   * NOTE: These methods work independently of 2D/3D mode selection.
   * Music will play the same regardless of rendering mode.
   */

  // Play a music track by name
  // Usage: this.playMusic('gameplay') or this.playMusic('victory')
  /*
  playMusic(trackName) {
    if (!this.audioManager || !this.isMusicEnabled) return;
    
    console.log(`🎵 Playing music: ${trackName}`);
    
    // Stop current music if any
    if (this.musicTrack) {
      this.musicTrack.stop();
    }
    
    // Load and play new music track
    // You can customize track selection based on game mode
    let trackPath;
    if (trackName === 'gameplay') {
      trackPath = this.use3DMode ? 'assets/music/gameplay-3d.mp3' : 'assets/music/gameplay-2d.mp3';
      // Or use same track for both: trackPath = 'assets/music/gameplay.mp3';
    } else if (trackName === 'victory') {
      trackPath = 'assets/music/victory.mp3';
    } else if (trackName === 'game-over') {
      trackPath = 'assets/music/game-over.mp3';
    } else {
      trackPath = `assets/music/${trackName}.mp3`;
    }
    
    // Load and play the track
    this.musicTrack = new Audio(trackPath);
    this.musicTrack.volume = this.musicVolume * this.masterVolume;
    this.musicTrack.loop = trackName === 'gameplay';  // Loop gameplay, don't loop ending tracks
    this.musicTrack.play().catch(err => {
      console.warn(`⚠️  Failed to play music: ${trackName}`, err);
    });
  }
  */

  // Pause current music
  /*
  pauseMusic() {
    if (!this.musicTrack) return;
    console.log("⏸️  Music paused");
    this.musicTrack.pause();
  }
  */

  // Resume current music
  /*
  resumeMusic() {
    if (!this.musicTrack) return;
    console.log("▶️  Music resumed");
    this.musicTrack.play().catch(err => {
      console.warn("⚠️  Failed to resume music:", err);
    });
  }
  */

  // Stop and unload current music
  /*
  stopMusic() {
    if (!this.musicTrack) return;
    console.log("⏹️  Music stopped");
    this.musicTrack.stop();
    this.musicTrack = null;
  }
  */

  // Set master volume (0.0 to 1.0)
  /*
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.musicTrack) {
      this.musicTrack.volume = this.musicVolume * this.masterVolume;
    }
    console.log(`🔊 Master volume: ${(this.masterVolume * 100).toFixed(0)}%`);
  }
  */

  // Set music volume specifically (0.0 to 1.0)
  /*
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicTrack) {
      this.musicTrack.volume = this.musicVolume * this.masterVolume;
    }
    console.log(`🎵 Music volume: ${(this.musicVolume * 100).toFixed(0)}%`);
  }
  */

  // Toggle music on/off
  /*
  toggleMusic() {
    this.isMusicEnabled = !this.isMusicEnabled;
    if (this.isMusicEnabled) {
      console.log("🎵 Music enabled");
      if (this.musicTrack && this.gameState === "playing") {
        this.musicTrack.play();
      }
    } else {
      console.log("🔇 Music disabled");
      if (this.musicTrack) {
        this.musicTrack.pause();
      }
    }
  }
  */
}