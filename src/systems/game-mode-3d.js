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
  }

  /**
   * Main 3D render pipeline
   * Renders to WEBGL buffer, converts to image, displays with overlays
   */
  render() {
    try {
      // Create WEBGL buffer on first use
      if (!this.webglGraphics) {
        this.webglGraphics = createGraphics(SCREEN_WIDTH, SCREEN_HEIGHT, WEBGL);
        this.gameManager.webglGraphics = this.webglGraphics;
      }
      
      // Render to WEBGL buffer
      this.renderTo3DBuffer();
      
      // Display WEBGL buffer as image to main canvas
      image(this.webglGraphics, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      
      // Add overlays for 3D mode
      this.drawMinimap();
      this.drawHUD();
      this.drawCrosshair();
      
    } catch (e) {
      console.error("3D render failed, falling back to 2D:", e);
      this.gameManager.use3DMode = false;
    }
  }

  /**
   * Main 3D rendering function using p5.js WEBGL
   * Sets up camera, draws floor, blocks, zombies, and weapon
   */
  renderTo3DBuffer() {
    const g = this.webglGraphics;
    
    // Black background skybox
    g.background(0, 0, 0);
    
    // Disable stroke for all 3D objects
    g.noStroke();
    
    // Setup camera: first-person from player position with pitch support
    // In p5.js WEBGL: Y+ points DOWN (not up like standard OpenGL)
    const camY = -1.3;  // Eye height (lower to see zombie better)
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
    
    // Ensure floor texture exists
    this.ensureFloorTextureCreated();
    
    // Draw floor - grid of colored blocks with checkerboard
    g.push();
    g.noStroke();
    
    const floorSize = MAP_TILE_COUNT;
    const blockSize = 1.0;
    const floorRenderDist = 20;
    
    const floorColor1 = [118, 140, 78];  // Green
    const floorColor2 = [140, 115, 78];  // Tan
    
    // Only render floor blocks near player
    const minX = Math.max(0, Math.floor(this.player.posX - floorRenderDist));
    const maxX = Math.min(floorSize, Math.ceil(this.player.posX + floorRenderDist));
    const minZ = Math.max(0, Math.floor(this.player.posY - floorRenderDist));
    const maxZ = Math.min(floorSize, Math.ceil(this.player.posY + floorRenderDist));
    
    for (let x = minX; x < maxX; x += blockSize) {
      for (let z = minZ; z < maxZ; z += blockSize) {
        const blockX = Math.floor(x);
        const blockZ = Math.floor(z);
        const isEven = (blockX + blockZ) % 2 === 0;
        const color = isEven ? floorColor1 : floorColor2;
        
        g.fill(color[0], color[1], color[2]);
        g.push();
        g.translate(x + blockSize/2, -0.5, z + blockSize/2);
        g.box(blockSize, 0.05, blockSize);
        g.pop();
      }
    }
    
    g.pop();
    
    // Draw all map tiles
    this.drawMapBlocks3D(g);
    
    // Sync zombie 3D models with orbs
    this.syncZombieModels();
    
    // Draw zombies with culling
    const renderDist = 50;  // Increased to ensure far zombies are visible for debugging
    
    let zombieCount = 0;
    for (let orb of this.gameManager.orbs) {
      if (orb.isHunter()) {
        zombieCount++;
        // Culling: skip zombies too far away
        const distToZombie = Math.hypot(orb.posX - this.player.posX, orb.posY - this.player.posY);
        console.log(`[3D] Zombie ${zombieCount} (id=${orb.id}): dist=${distToZombie.toFixed(2)}, pos=(${orb.posX.toFixed(1)},${orb.posY.toFixed(1)}), inRange=${distToZombie <= renderDist}`);
        
        if (distToZombie > renderDist) continue;
        
        g.push();
        // Position zombie: in p5.js WEBGL, Y+ points DOWN (not up)
        // Raise zombie slightly higher
        g.translate(orb.posX, -1.4, orb.posY);
        g.rotateY(orb.bodyAngle || 0);
        
        // Set default fill for zombie parts
        g.fill(100, 140, 80);
        
        // Get or create zombie model for this orb
        const model = this.getZombieModel(orb);
        console.log(`[3D] Got model for orb ${orb.id}: ${model ? 'YES' : 'NO'}`);
        if (model) {
          model.render(g);
        }
        
        g.pop();
      }
    }
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
          const model = new Zombie3DModel(window.PRELOADED_ZOMBIE_SKIN_IMAGE);
          this.zombieModels.set(orb.id, model);
          console.log(`[3D] Created zombie model for orb ${orb.id}, total models: ${this.zombieModels.size}`);
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
        console.log(`[3D] Removed zombie model for orb ${orbId}, total models: ${this.zombieModels.size}`);
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
    
    // Position arm at player location
    g.translate(this.player.posX, -1.1, this.player.posY);
    
    // Rotate with player angle
    g.rotateY(-this.player.angle);
    
    // Rotate with camera pitch
    g.rotateX(-this.player.pitch);
    
    // Rotate arm 90 degrees to the right
    g.rotateY(-Math.PI / 2);
    
    // Offset to the right side and pull back
    g.translate(0.8, 0.25, -0.9);
    
    // ===== DRAW ARM =====
    g.noStroke();
    
    // Upper arm
    g.fill(200, 140, 90);
    g.push();
    g.translate(0, -0.1, 0.3);
    g.box(0.22, 0.22, 0.8);
    g.pop();
    
    // Forearm
    g.push();
    g.translate(0, -0.05, -0.25);
    g.box(0.2, 0.2, 0.65);
    g.pop();
    
    // Hand holding gun
    g.fill(200, 150, 100);
    g.push();
    g.translate(0.05, 0.08, -0.95);
    g.box(0.25, 0.22, 0.25);
    g.pop();
    
    // ===== DRAW PISTOL (SIMPLE) =====
    
    // Barrel principal - long cylindre
    g.fill(70, 70, 85);
    g.push();
    g.translate(-0.1, -0.15 , -1.25);
    g.box(0.14, 0.45, 1.1);
    g.pop();
    
    // Grip - simple rectangle
    g.fill(80, 50, 30);
    g.push();
    g.translate(-0.06, 0.12, -0.65);
    g.box(0.18, 0.4, 0.28);
    g.pop();
    
    // Trigger guard - petit contour
    g.fill(60, 60, 70);
    g.push();
    g.translate(-0.06, -0.11, -0.7);
    g.box(0.08, 0.4, 0.28);
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
    const renderDist = 8;  // ~200 blocks instead of 576
    const minX = Math.max(0, Math.floor(this.player.posX - renderDist));
    const maxX = Math.min(MAP_TILE_COUNT, Math.ceil(this.player.posX + renderDist));
    const minY = Math.max(0, Math.floor(this.player.posY - renderDist));
    const maxY = Math.min(MAP_TILE_COUNT, Math.ceil(this.player.posY + renderDist));
    
    const nightFactor = 1;  // Full day (0 = night, 1 = day)
    
    for (let mapY = minY; mapY < maxY; mapY++) {
      for (let mapX = minX; mapX < maxX; mapX++) {
        const tileId = worldTileMap[mapY][mapX];
        
        if (tileId === 0) continue;  // Empty tile
        
        g.push();
        // Y+ is downward in WEBGL, so blocks start at Y=0 and go down
        g.translate(mapX + 0.5, -1.0, mapY + 0.5);
        this.drawMinecraftBlock(g, tileId, nightFactor);
        g.pop();
      }
    }
  }

  /**
   * Draw a single minecraft-style block (voxel)
   * Color depends on tile type: stone, grass, wood, etc.
   */
  drawMinecraftBlock(g, tileId, nightFactor) {
    let color;
    
    switch(tileId) {
      case 1: // Stone
        color = [125, 125, 125];
        break;
      case 2: // Grass
        color = [95, 160, 54];
        break;
      case 3: // Dirt
        color = [135, 100, 67];
        break;
      case 4: // Wood wall
        color = [105, 84, 47];
        break;
      case 5: // Wood plank
        color = [140, 110, 62];
        break;
      case 6: // Lava (corruption)
        color = [255, 100, 0];
        break;
      default:
        color = [100, 100, 100];
    }
    
    // Apply day/night factor
    const r = Math.floor(color[0] * nightFactor);
    const gr = Math.floor(color[1] * nightFactor);
    const b = Math.floor(color[2] * nightFactor);
    
    g.fill(r, gr, b);
    g.box(1.0);  // 1x1x1 block
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
