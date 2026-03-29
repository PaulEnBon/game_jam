/*
  ============================================================
  TEXTURE LOADER (PNG-only)
  ============================================================
  All block visuals are loaded from files in assets/textures.
  No procedural fallback is used so old generated visuals are fully removed.
*/

/** Store generated texture images (p5.Graphics) keyed by wall-type id. */
let blockTextures = {};

const EXTERNAL_BLOCK_TEXTURE_PATHS = Object.freeze({
  1: "assets/textures/stone.png",
  2: "assets/textures/dirt.png",
  3: "assets/textures/grass_side.png",
  4: "assets/textures/mossy_cobblestone.png",
  5: "assets/textures/glowstone.png",
  6: "assets/textures/lava.png", // corruption
  7: "assets/textures/plank.png",
  8: "assets/textures/leaves.png",
  9: "assets/textures/obsidian.png",
  10: "assets/textures/plank.png",
  11: "assets/textures/obsidian.png",
  12: null, // Floor texture (generated procedurally)
});

function resolveTexturePath(blockId) {
  if (typeof window !== "undefined" && window.EMBEDDED_TEXTURE_DATA) {
    const embedded = window.EMBEDDED_TEXTURE_DATA[String(blockId)];
    if (typeof embedded === "string" && embedded.startsWith("data:image/")) {
      return embedded;
    }
  }
  return EXTERNAL_BLOCK_TEXTURE_PATHS[blockId];
}

let preloadedExternalTextures = {};

function preloadExternalBlockTextures() {
  preloadedExternalTextures = {};

  const isLocalFile = window.location.protocol === 'file:';

  for (const blockId of Object.keys(EXTERNAL_BLOCK_TEXTURE_PATHS)) {
    const imgPath = resolveTexturePath(blockId);
    
    // Skip null, undefined or empty paths (like floor texture which is generated procedurally)
    if (!imgPath || (typeof imgPath === 'string' && imgPath.trim() === "")) {
      preloadedExternalTextures[blockId] = null;
      continue;
    }

    // Prevent CORS errors on file:// protocol by skipping external PNG loads
    if (isLocalFile && !imgPath.startsWith('data:')) {
      console.warn(`⚠️ Block ${blockId}: Cannot load external texture ${imgPath} on file:// protocol. Use a local server.`);
      preloadedExternalTextures[blockId] = null;
      continue;
    }
    
    preloadedExternalTextures[blockId] = loadImage(
      imgPath,
      undefined,
      () => {
        preloadedExternalTextures[blockId] = null;
      }
    );
  }
}

function buildTextureFromPreloadedImage(blockId) {
  const sourceImg = preloadedExternalTextures[String(blockId)];
  if (!sourceImg || sourceImg.width <= 0 || sourceImg.height <= 0) {
    console.warn(`Missing block texture for tile ${blockId}: ${resolveTexturePath(blockId)}`);
    return buildMissingTexturePlaceholder();
  }

  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.noSmooth();
  tex.drawingContext.imageSmoothingEnabled = false;
  tex.clear();
  tex.image(sourceImg, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  return tex;
}

function buildMissingTexturePlaceholder() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.noSmooth();
  tex.loadPixels();

  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const index = 4 * (y * TEXTURE_SIZE + x);
      const even = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
      tex.pixels[index] = even ? 220 : 35;
      tex.pixels[index + 1] = 40;
      tex.pixels[index + 2] = even ? 220 : 35;
      tex.pixels[index + 3] = 255;
    }
  }

  tex.updatePixels();
  return tex;
}

/**
 * Generate procedural floor texture with gray tiled pattern
 * Smooth gradual dirt/stone look for floor blocks
 */
function buildFloorTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.noSmooth();
  tex.loadPixels();

  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const index = 4 * (y * TEXTURE_SIZE + x);
      
      // Large tile pattern (checkerboard every 8 pixels)
      const tileX = Math.floor(x / 8);
      const tileY = Math.floor(y / 8);
      const tileCheck = (tileX + tileY) % 2;
      
      // Add subtle noise within tiles
      const noiseX = (x % 8) / 8.0;
      const noiseY = (y % 8) / 8.0;
      const noise = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 10;
      
      // Base gray color with tile variation
      const baseGray = tileCheck === 0 ? 140 : 160;
      const gray = Math.floor(baseGray + noise);
      
      tex.pixels[index]     = gray;      // R
      tex.pixels[index + 1] = gray;      // G
      tex.pixels[index + 2] = gray;      // B
      tex.pixels[index + 3] = 255;       // A
    }
  }

  tex.updatePixels();
  return tex;
}

function generateAllBlockTextures() {
  blockTextures = {};

  for (const blockIdText of Object.keys(EXTERNAL_BLOCK_TEXTURE_PATHS)) {
    const blockId = Number(blockIdText);
    if (blockId === 12) {
      // Floor texture is generated procedurally
      blockTextures[blockId] = buildFloorTexture();
    } else {
      blockTextures[blockId] = buildTextureFromPreloadedImage(blockId);
    }
  }
}

// ============================================================
// TEXTURE PIXEL CACHE
// ============================================================

let texturePixelCache = {};

function cacheAllTexturePixels() {
  texturePixelCache = {};

  for (const key of Object.keys(blockTextures)) {
    const tex = blockTextures[key];
    tex.loadPixels();
    texturePixelCache[key] = new Uint8ClampedArray(tex.pixels);
  }
}
