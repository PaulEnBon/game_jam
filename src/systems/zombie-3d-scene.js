/**
 * ============================================================
 * ZOMBIE 3D SCENE MANAGER
 * ============================================================
 * Gère l'affichage 3D du monde et des zombies en WEBGL p5.js
 * Remplace le pipeline de raycasting 2D
 */

class Zombie3DSceneManager {
  constructor() {
    this.zombies3D = [];
    this.camera = {
      x: 0,
      y: 0,
      z: 0,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
      angle: 0,
      pitch: 0,
      distance: 3,
      height: 1.5,
    };
    this.isEnabled = true;
    this.textureLoaded = false;
    this.zombieSkinTexture = null;
  }

  /**
   * Initialize 3D scene with texture
   */
  init(zombieTexture) {
    this.zombieSkinTexture = zombieTexture;
    this.textureLoaded = !!zombieTexture;
  }

  /**
   * Update camera based on player state
   */
  updateCamera(playerX, playerY, playerAngle) {
    // Position camera behind player
    const cameraDistance = 2.5;
    this.camera.x = playerX + cos(playerAngle + PI) * cameraDistance;
    this.camera.z = playerY + sin(playerAngle + PI) * cameraDistance;
    this.camera.y = 1.5;
    this.camera.angle = playerAngle;
  }

  /**
   * Add zombie to 3D scene
   */
  addZombie(worldX, worldY, bodyAngle = 0) {
    const zomModel = new Zombie3DModel();
    this.zombies3D.push({
      model: zomModel,
      x: worldX,
      y: worldY,
      angle: bodyAngle,
      visible: true,
    });
  }

  /**
   * Clear all zombies
   */
  clearZombies() {
    this.zombies3D = [];
  }

  /**
   * Update zombie positions and animations
   */
  updateZombies(orbList, deltaMs = 16) {
    // Sync with orb positions
    this.zombies3D = orbList
      .filter(orb => orb.isHunter())
      .map((orb, idx) => {
        if (idx >= this.zombies3D.length) {
          this.addZombie(orb.posX, orb.posY, orb.bodyAngle);
        }
        const z3d = this.zombies3D[idx];
        z3d.x = orb.posX;
        z3d.y = orb.posY;
        z3d.angle = orb.bodyAngle || 0;
        z3d.model.update(deltaMs);
        return z3d;
      });
  }

  /**
   * Render the 3D scene
   * This replaces castAllRays() for 3D mode
   */
  render(playerX, playerY, playerAngle) {
    if (!this.isEnabled) {
      return false;
    }

    // Setup 3D camera
    const camdist = 2.5;
    const camX = playerX + cos(playerAngle + PI) * camdist;
    const camY = playerY + sin(playerAngle + PI) * camdist;
    const camZ = 1.5;

    // Look at player
    perspective(PI / 3.0, width / height, 0.1, 500);
    camera(camX, camZ, camY, playerX, 1.5, playerY, 0, 1, 0);

    // Apply fog shader for horror atmosphere
    // Brouillard commence à 8 blocs, densité exponentielle, assombrement vers le noir
    if (FOG_3D_ENABLED) {
      try {
        createAndApplyFogShader(FOG_3D_START_DISTANCE, FOG_3D_DENSITY);
      } catch (e) {
        console.warn('Note: Fog shader not available in this context');
      }
    }

    // Lighting
    lights();
    ambientLight(180, 180, 180);
    directionalLight(255, 255, 255, 0.5, 1, 0.5);

    // Floor grid (optional)
    this.drawFloor(playerX, playerY, 20);

    // Draw zombies
    for (const z3d of this.zombies3D) {
      push();
      translate(z3d.x, 0, z3d.y);
      rotateY(z3d.angle);
      z3d.model.render();
      pop();
    }

    return true;
  }

  /**
   * Draw floor grid for reference
   */
  drawFloor(centerX, centerY, gridSize) {
    push();

    // Floor plane
    fill(100, 150, 70);
    box(gridSize * 2, 0.1, gridSize * 2);

    // Grid lines
    stroke(150, 200, 100);
    strokeWeight(1);
    noFill();

    for (let x = -gridSize; x <= gridSize; x += 1) {
      line(
        centerX - gridSize, 0.1, centerY + x,
        centerX + gridSize, 0.1, centerY + x
      );
    }
    for (let z = -gridSize; z <= gridSize; z += 1) {
      line(
        centerX + z, 0.1, centerY - gridSize,
        centerX + z, 0.1, centerY + gridSize
      );
    }

    pop();
  }

  /**
   * Switch between 2D and 3D rendering
   */
  toggle() {
    this.isEnabled = !this.isEnabled;
    console.log(this.isEnabled ? "✓ 3D Mode Enabled" : "✓ 2D Mode Enabled");
  }

  /**
   * Get render mode status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      textureLoaded: this.textureLoaded,
      zombieCount: this.zombies3D.length,
      mode: this.isEnabled ? "3D WEBGL" : "2D Raycast",
    };
  }
}
