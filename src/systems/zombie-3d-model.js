/**
 * ============================================================
 * ZOMBIE 3D MODEL (p5.js WEBGL)
 * ============================================================
 * Affiche le modèle voxel du zombie avec texture Minecraft
 * Utilise p5.js WEBGL natif (zero dépendances supplémentaires)
 */

class Zombie3DModel {
  constructor() {
    /**
     * Paramètres du modèle (en unités p5.js)
     * Basé sur proportions Minecraft canoniques
     */
    // Dimensions de chaque partie (width, height, depth)
    // Mise à l'échelle pour que le total fasse exactement 1.0 unité de haut
    this.headSize = { w: 0.25, h: 0.25, d: 0.25 };   // 8/32
    this.bodySize = { w: 0.25, h: 0.375, d: 0.125 }; // 8x12x4 / 32
    this.armSize  = { w: 0.125, h: 0.375, d: 0.125 };// 4x12x4 / 32
    this.legSize  = { w: 0.125, h: 0.375, d: 0.125 };// 4x12x4 / 32

    // Positions relatives au center
    // Ancrage au sol (Y=0), montée vers le haut (Y négatif en p5)
    this.legPos      = { y: -0.1875 }; // Mi-hauteur des jambes
    this.bodyPos     = { y: -0.5625 }; // Mi-hauteur du corps
    this.headPos     = { y: -0.875 };  // Mi-hauteur tête
    this.armPos      = { y: -0.5625 }; // Alignés sur le corps
    this.legOffset   = 0.0625;         // Espace entre les jambes
    this.armOffset   = 0.1875;         // Espace bras

    // Animation state
    this.walkPhase = 0;
    this.walkSpeed = 0.15;
    this.bobAmount = 0.1;
    this.armSwingAmount = 0.4;
  }

  /**
   * Dessine un membre (Cube simple sans texture)
   */
  drawMinecraftPart(g, x, y, z, w, h, d, uvSet) {
    g.push();
    g.translate(x, y, z);
    g.box(w, h, d);
    g.pop();
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
    
    // Suppression des appels redondants à lights() et console.log
    if (isWebGL) g.noStroke(); else noStroke();
    
    const phase = this.walkPhase;
    const swing = Math.sin(phase) * this.armSwingAmount;
    const ctx = isWebGL ? g : globalThis;

    // Jambes
    this.drawMinecraftPart(ctx, -this.legOffset, this.legPos.y, 0, this.legSize.w, this.legSize.h, this.legSize.d, null);
    this.drawMinecraftPart(ctx, this.legOffset, this.legPos.y, 0, this.legSize.w, this.legSize.h, this.legSize.d, null);
    
    // Corps
    this.drawMinecraftPart(ctx, 0, this.bodyPos.y, 0, this.bodySize.w, this.bodySize.h, this.bodySize.d, null);
    
    // Tête
    this.drawMinecraftPart(ctx, 0, this.headPos.y, 0, this.headSize.w, this.headSize.h, this.headSize.d, null);
    
    // Bras (avec animation de balancement)
    ctx.push();
    ctx.translate(-this.armOffset, this.armPos.y, 0);
    ctx.rotateX(swing);
    this.drawMinecraftPart(ctx, 0, 0, 0, this.armSize.w, this.armSize.h, this.armSize.d, null);
    ctx.pop();

    ctx.push();
    ctx.translate(this.armOffset, this.armPos.y, 0);
    ctx.rotateX(-swing);
    this.drawMinecraftPart(ctx, 0, 0, 0, this.armSize.w, this.armSize.h, this.armSize.d, null);
    ctx.pop();
  }
}
