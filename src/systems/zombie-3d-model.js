/**
 * ============================================================
 * ZOMBIE 3D MODEL (p5.js WEBGL)
 * ============================================================
 * Affiche le modèle voxel du zombie avec texture Minecraft
 * Utilise p5.js WEBGL natif (zero dépendances supplémentaires)
 */

class Zombie3DModel {
  constructor(textureSkin) {
    /**
     * Paramètres du modèle (en unités p5.js)
     * Basé sur proportions Minecraft canoniques
     */
    this.textureSkin = textureSkin;
    
    // Dimensions de chaque partie (width, height, depth)
    // Basé sur les proportions Minecraft (head: 8x8x8, body: 8x12x4, arms/legs: 4x12x4)
    this.headSize = { w: 0.25, h: 0.25, d: 0.25 };   // Head (réduit)
    this.bodySize = { w: 0.22, h: 0.3, d: 0.12 };    // Body/torso (plus petit)
    this.armSize = { w: 0.12, h: 0.4, d: 0.12 };     // Arms (fins)
    this.legSize = { w: 0.12, h: 0.4, d: 0.12 };     // Legs (fins)

    // Positions relatives au center
    // Zombie feet should rest on ground at Y = -0.5
    // Center of zombie = -0.5 - 0.2 (half leg height) = -0.7
    this.headPos = { x: 0, y: -0.5, z: 0 };          // Head on top
    this.bodyPos = { x: 0, y: -0.15, z: 0 };         // Body/torso center
    this.armLeftPos = { x: -0.2, y: -0.08, z: 0 };   // Left arm at shoulder
    this.armRightPos = { x: 0.2, y: -0.08, z: 0 };   // Right arm at shoulder
    this.legLeftPos = { x: -0.08, y: 0.2, z: 0 };    // Left leg below hips
    this.legRightPos = { x: 0.08, y: 0.2, z: 0 };    // Right leg below hips

    // Animation state
    this.walkPhase = 0;
    this.walkSpeed = 0.15;
    this.bobAmount = 0.1;
    this.armSwingAmount = 0.4;

    // Texture UVs (normalized coordinates for 64×64 skin)
    this.skinLayout = {
      head_front: { x: 8, y: 8, w: 8, h: 8 },
      head_right: { x: 16, y: 8, w: 8, h: 8 },
      head_back: { x: 24, y: 8, w: 8, h: 8 },
      head_left: { x: 32, y: 8, w: 8, h: 8 },
      head_top: { x: 8, y: 0, w: 8, h: 8 },
      head_bottom: { x: 16, y: 0, w: 8, h: 8 },
      
      body_front: { x: 20, y: 20, w: 8, h: 12 },
      body_right: { x: 28, y: 20, w: 8, h: 12 },
      body_back: { x: 32, y: 20, w: 8, h: 12 },
      body_left: { x: 12, y: 20, w: 8, h: 12 },
      body_top: { x: 20, y: 20, w: 8, h: 0 },  // Thin
      body_bottom: { x: 28, y: 32, w: 8, h: 0 },
      
      arm_front: { x: 44, y: 20, w: 4, h: 12 },
      arm_right: { x: 48, y: 20, w: 4, h: 12 },
      arm_back: { x: 52, y: 20, w: 4, h: 12 },
      arm_left: { x: 40, y: 20, w: 4, h: 12 },
      
      leg_front: { x: 4, y: 20, w: 4, h: 12 },
      leg_right: { x: 8, y: 20, w: 4, h: 12 },
      leg_back: { x: 12, y: 20, w: 4, h: 12 },
      leg_left: { x: 0, y: 20, w: 4, h: 12 },
    };
  }

  /**
   * Crée une boîte 3D textuurée
   * Applique la texture Minecraft correctement mappée
   */
  drawTexturedBox(x, y, z, width, height, depth, texArray) {
    push();
    translate(x, y, z);

    // Normaliser les UV (64x64 → 0..1)
    const fullW = 64;
    const fullH = 64;

    const getUV = (texInfo) => ({
      x1: texInfo.x / fullW,
      y1: texInfo.y / fullH,
      x2: (texInfo.x + texInfo.w) / fullW,
      y2: (texInfo.y + texInfo.h) / fullH,
    });

    if (this.textureSkin) {
      texture(this.textureSkin);
      textureMode(NORMAL);
    }

    // TOP
    beginShape();
    vertex(-width / 2, -height / 2, -depth / 2);
    vertex(width / 2, -height / 2, -depth / 2);
    vertex(width / 2, -height / 2, depth / 2);
    vertex(-width / 2, -height / 2, depth / 2);
    endShape(CLOSE);

    // BOTTOM
    beginShape();
    vertex(-width / 2, height / 2, -depth / 2);
    vertex(-width / 2, height / 2, depth / 2);
    vertex(width / 2, height / 2, depth / 2);
    vertex(width / 2, height / 2, -depth / 2);
    endShape(CLOSE);

    // FRONT
    beginShape();
    vertex(-width / 2, -height / 2, depth / 2);
    vertex(width / 2, -height / 2, depth / 2);
    vertex(width / 2, height / 2, depth / 2);
    vertex(-width / 2, height / 2, depth / 2);
    endShape(CLOSE);

    // BACK
    beginShape();
    vertex(-width / 2, -height / 2, -depth / 2);
    vertex(-width / 2, height / 2, -depth / 2);
    vertex(width / 2, height / 2, -depth / 2);
    vertex(width / 2, -height / 2, -depth / 2);
    endShape(CLOSE);

    // RIGHT
    beginShape();
    vertex(width / 2, -height / 2, -depth / 2);
    vertex(width / 2, -height / 2, depth / 2);
    vertex(width / 2, height / 2, depth / 2);
    vertex(width / 2, height / 2, -depth / 2);
    endShape(CLOSE);

    // LEFT
    beginShape();
    vertex(-width / 2, -height / 2, -depth / 2);
    vertex(-width / 2, height / 2, -depth / 2);
    vertex(-width / 2, height / 2, depth / 2);
    vertex(-width / 2, -height / 2, depth / 2);
    endShape(CLOSE);

    pop();
  }

  /**
   * Draw a sharp cube block with Minecraft zombie colors
   * Supports per-part coloring for authentic Minecraft look
   */
  drawSimpleBox(x, y, z, w, h, d, colorR = 34, colorG = 139, colorB = 34) {
    push();
    translate(x, y, z);
    fill(colorR, colorG, colorB);
    noStroke();
    box(w, h, d, 1, 1);  // Use minimal detail level
    pop();
  }

  /**
   * Update animation state
   */
  update(deltaMs = 16) {
    this.walkPhase += this.walkSpeed * (deltaMs / 16);
    if (this.walkPhase > Math.PI * 2) {
      this.walkPhase -= Math.PI * 2;
    }
  }

  /**
   * Render the full zombie model with Minecraft texture (if available) or solid colors as fallback
   * Supports rendering to a graphics context (WEBGL) or global p5.js context
   */
  render(g = null) {
    // Use provided graphics context or fall back to global p5.js functions
    const isWebGL = g !== null;
    
    // Enable lighting for better visibility
    if (isWebGL) {
      g.lights();
      g.noStroke();
    } else {
      lights();
      noStroke();
    }
    
    console.log(`[Zombie3D] Rendering zombie (webgl=${isWebGL}, phase=${this.walkPhase.toFixed(2)})`);
    
    const headBob = Math.sin(this.walkPhase) * this.bobAmount;
    const bodyBob = Math.sin(this.walkPhase) * (this.bobAmount * 0.5);
    const armSwing = Math.sin(this.walkPhase) * this.armSwingAmount;
    const legSwing = Math.sin(this.walkPhase) * this.armSwingAmount;
    
    // TÊTE - Head
    if (isWebGL) {
      g.push();
      g.translate(this.headPos.x, this.headPos.y + headBob, this.headPos.z);
      g.fill(52, 109, 71);  // Zombie head green
      g.box(this.headSize.w, this.headSize.h, this.headSize.d, 1, 1);
      g.pop();
    } else {
      push();
      translate(this.headPos.x, this.headPos.y + headBob, this.headPos.z);
      fill(52, 109, 71);
      box(this.headSize.w, this.headSize.h, this.headSize.d, 1, 1);
      pop();
    }

    // CORPS - Body
    if (isWebGL) {
      g.push();
      g.translate(this.bodyPos.x, this.bodyPos.y + bodyBob, this.bodyPos.z);
      g.fill(71, 109, 46);  // Zombie body green
      g.box(this.bodySize.w, this.bodySize.h, this.bodySize.d, 1, 1);
      g.pop();
    } else {
      push();
      translate(this.bodyPos.x, this.bodyPos.y + bodyBob, this.bodyPos.z);
      fill(71, 109, 46);
      box(this.bodySize.w, this.bodySize.h, this.bodySize.d, 1, 1);
      pop();
    }

    // BRAS GAUCHE - Left arm
    if (isWebGL) {
      g.push();
      g.translate(this.armLeftPos.x, this.armLeftPos.y + bodyBob, this.armLeftPos.z);
      g.rotateX(armSwing);  // Swing forward/backward (not rotateZ)
      g.fill(130, 150, 120);  // Zombie arm green
      g.box(this.armSize.w, this.armSize.h, this.armSize.d, 1, 1);
      g.pop();
    } else {
      push();
      translate(this.armLeftPos.x, this.armLeftPos.y + bodyBob, this.armLeftPos.z);
      rotateX(armSwing);
      fill(130, 150, 120);
      box(this.armSize.w, this.armSize.h, this.armSize.d, 1, 1);
      pop();
    }

    // BRAS DROIT - Right arm
    if (isWebGL) {
      g.push();
      g.translate(this.armRightPos.x, this.armRightPos.y + bodyBob, this.armRightPos.z);
      g.rotateX(-armSwing);  // Swing forward/backward opposite side
      g.fill(130, 150, 120);  // Zombie arm green
      g.box(this.armSize.w, this.armSize.h, this.armSize.d, 1, 1);
      g.pop();
    } else {
      push();
      translate(this.armRightPos.x, this.armRightPos.y + bodyBob, this.armRightPos.z);
      rotateX(-armSwing);
      fill(130, 150, 120);
      box(this.armSize.w, this.armSize.h, this.armSize.d, 1, 1);
      pop();
    }

    // JAMBE GAUCHE - Left leg
    if (isWebGL) {
      g.push();
      g.translate(this.legLeftPos.x, this.legLeftPos.y + bodyBob, this.legLeftPos.z);
      g.rotateX(legSwing);  // Swing forward/backward
      g.fill(46, 46, 46);  // Zombie leg dark
      g.box(this.legSize.w, this.legSize.h, this.legSize.d, 1, 1);
      g.pop();
    } else {
      push();
      translate(this.legLeftPos.x, this.legLeftPos.y + bodyBob, this.legLeftPos.z);
      rotateX(legSwing);
      fill(46, 46, 46);
      box(this.legSize.w, this.legSize.h, this.legSize.d, 1, 1);
      pop();
    }

    // JAMBE DROITE - Right leg
    if (isWebGL) {
      g.push();
      g.translate(this.legRightPos.x, this.legRightPos.y + bodyBob, this.legRightPos.z);
      g.rotateX(-legSwing);  // Swing forward/backward opposite side
      g.fill(46, 46, 46);  // Zombie leg dark
      g.box(this.legSize.w, this.legSize.h, this.legSize.d, 1, 1);
      g.pop();
    } else {
      push();
      translate(this.legRightPos.x, this.legRightPos.y + bodyBob, this.legRightPos.z);
      rotateX(-legSwing);
      fill(46, 46, 46);
      box(this.legSize.w, this.legSize.h, this.legSize.d, 1, 1);
      pop();
    }
  }
}
