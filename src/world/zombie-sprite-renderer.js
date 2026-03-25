/**
 * ============================================================
 * ZOMBIE TEXTURE RENDERING HELPER
 * ============================================================
 * Provides texture-based sprite rendering for zombies using Zombie.png
 */

/**
 * Sample a region from the zombie texture and draw it to the screen buffer
 * Uses angle-based sprite selection and proper aspect ratio handling
 */
function drawZombieTextureSprite(gameManager, pixels, {
  screenX,
  screenY,
  screenWidth,
  screenHeight,
  worldAngle,
  distance,
  zBuffer,
}) {
  // Guard: check if texture is loaded
  if (!window.PRELOADED_ZOMBIE_SKIN_IMAGE || !gameManager.zombieSpriteCache.directionalSprites) {
    return false;
  }

  // Get angle-appropriate sprite
  const sprite = getZombieSpriteForAngle(gameManager.zombieSpriteCache.directionalSprites, worldAngle);
  if (!sprite || sprite.width <= 0 || sprite.height <= 0) {
    return false;
  }

  // Calculate fog based on distance
  const rawFog = constrain(1 - (distance / MAX_RAY_DISTANCE) * FOG_DENSITY, 0, 1);
  const fogFactor = Math.max(rawFog, AMBIENT_LIGHT_MINIMUM);

  // Draw sprite to screen, respecting z-buffer
  const startX = Math.max(0, Math.floor(screenX - screenWidth / 2));
  const endX = Math.min(SCREEN_WIDTH, Math.floor(screenX + screenWidth / 2));
  const startY = Math.max(0, Math.floor(screenY - screenHeight / 2));
  const endY = Math.min(SCREEN_HEIGHT, Math.floor(screenY + screenHeight / 2));

  // Sample and blit sprite with texture
  if (sprite.canvas && sprite.canvas._pixelDensity) {
    // p5.Graphics object
    sprite.loadPixels();
    const srcPixels = sprite.pixels;

    for (let sy = startY; sy < endY; sy++) {
      for (let sx = startX; sx < endX; sx++) {
        // Check z-buffer
        if (zBuffer[sx] !== undefined && distance > zBuffer[sx] + 0.05) {
          continue;
        }

        // Map screen position to sprite texture coordinates
        const u = (sx - startX) / (endX - startX);
        const v = (sy - startY) / (endY - startY);

        // Sprite texture coordinates
        const srcX = Math.floor(u * sprite.width);
        const srcY = Math.floor(v * sprite.height);

        if (srcX < 0 || srcX >= sprite.width || srcY < 0 || srcY >= sprite.height) {
          continue;
        }

        // Read sprite pixel
        const srcIdx = (srcY * sprite.width + srcX) * 4;
        const srcAlpha = srcPixels[srcIdx + 3] / 255;

        if (srcAlpha < 0.01) {
          // Transparent pixel
          continue;
        }

        // Apply fog and alpha blend
        const dstIdx = sy * SCREEN_WIDTH + sx;
        pixels[dstIdx * 4] = srcPixels[srcIdx] * fogFactor;
        pixels[dstIdx * 4 + 1] = srcPixels[srcIdx + 1] * fogFactor;
        pixels[dstIdx * 4 + 2] = srcPixels[srcIdx + 2] * fogFactor;
        pixels[dstIdx * 4 + 3] = 255;
      }
    }

    return true;
  }

  return false;
}

/**
 * Wrapper to use texture-based rendering instead of volumetric
 * when appropriate
 */
function shouldRenderZombieAsTexture(gameManager) {
  return gameManager.zombieSpriteCache.mode === "texture" &&
    gameManager.zombieSpriteCache.directionalSprites;
}
