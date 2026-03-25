/**
 * ============================================================
 * ZOMBIE SKIN TEXTURE SAMPLING
 * ============================================================
 * Provides utilities to sample colors from the Minecraft zombie skin texture
 * Used for volumetric rendering fallback when texture-based sprites not available
 */

/**
 * Sample a pixel from the zombie texture for a specific body part
 * @param {string} partName - Part identifier (e.g., "head_front", "body_front")
 * @param {string} side - "x" or "y" (which side of the voxel box)
 * @param {number} u - Horizontal texture coordinate (0..1)
 * @param {number} v - Vertical texture coordinate (0..1)
 * @returns {array} [r, g, b, a] color values or null
 */
function sampleZombieSkinTexture(partName, side, u, v) {
  if (!window.PRELOADED_ZOMBIE_SKIN_IMAGE || !window.PRELOADED_ZOMBIE_SKIN_PIXELS) {
    return null;
  }

  // Normalize u, v to [0, 1]
  u = Math.max(0, Math.min(1, u || 0));
  v = Math.max(0, Math.min(1, v || 0));

  // Map part to texture region
  let texRegion = null;
  if (ZOMBIE_SKIN_LAYOUT && ZOMBIE_SKIN_LAYOUT[partName]) {
    texRegion = ZOMBIE_SKIN_LAYOUT[partName];
  } else {
    return null;
  }

  // Calculate texture coordinates in pixels
  const texX = Math.floor(texRegion.x + u * texRegion.w);
  const texY = Math.floor(texRegion.y + v * texRegion.h);

  if (texX < 0 || texX >= 64 || texY < 0 || texY >= 64) {
    return null;
  }

  // Sample from pixel data
  const pixelIdx = (texY * 64 + texX) * 4;
  return [
    window.PRELOADED_ZOMBIE_SKIN_PIXELS[pixelIdx],
    window.PRELOADED_ZOMBIE_SKIN_PIXELS[pixelIdx + 1],
    window.PRELOADED_ZOMBIE_SKIN_PIXELS[pixelIdx + 2],
    window.PRELOADED_ZOMBIE_SKIN_PIXELS[pixelIdx + 3],
  ];
}

/**
 * Add this method to GameManager class:
 * 
 * sampleZombieSkinTexture(partName, side, u, v) {
 *   return window.sampleZombieSkinTexture(partName, side, u, v);
 * }
 */
