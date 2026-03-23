<<<<<<< HEAD
/*
  ============================================================
  TEXTURE GENERATOR  (Minecraft-style procedural textures)
  ============================================================
  We generate small p5.Graphics images during setup().
  Each texture is TEXTURE_SIZE × TEXTURE_SIZE pixels.
  The algorithm :
    1. Fill with a base colour.
    2. Scatter random darker / lighter pixels to simulate noise.
    3. Optionally draw features (ore speckles, grass fringe, etc.).
  This avoids any external image files.
*/

/** Store generated texture images (p5.Graphics) keyed by wall-type id. */
let blockTextures = {};

/**
 * Generates all Minecraft-style block textures.
 * Called once in setup().
 */
function generateAllBlockTextures() {
  blockTextures[1] = generateStoneTexture();
  blockTextures[2] = generateDirtTexture();
  blockTextures[3] = generateGrassSideTexture();
  blockTextures[4] = generateMossyCobblestoneTexture();
  blockTextures[5] = generateGlowstoneTexture();
  blockTextures[6] = generateCorruptionTexture();   // deadly shrinking wall
}

/** STONE — grey base with random dark speckles. */
function generateStoneTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const base = 128 + Math.floor(Math.random() * 18 - 9);
      const r = base - Math.floor(Math.random() * 12);
      const g = base - Math.floor(Math.random() * 8);
      const b = base + Math.floor(Math.random() * 6);
      setPixelAt(tex, x, y, r, g, b);
    }
  }
  // Random cracks (dark lines)
  for (let i = 0; i < 12; i++) {
    const cx = Math.floor(Math.random() * TEXTURE_SIZE);
    const cy = Math.floor(Math.random() * TEXTURE_SIZE);
    setPixelAt(tex, cx, cy, 70, 70, 72);
  }
  tex.updatePixels();
  return tex;
}

/** DIRT — brown base with noise. */
function generateDirtTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 24 - 12);
      setPixelAt(tex, x, y, 134 + n, 96 + n, 67 + n);
    }
  }
  // Small pebbles
  for (let i = 0; i < 8; i++) {
    const px = Math.floor(Math.random() * TEXTURE_SIZE);
    const py = Math.floor(Math.random() * TEXTURE_SIZE);
    setPixelAt(tex, px, py, 160, 140, 110);
  }
  tex.updatePixels();
  return tex;
}

/** GRASS SIDE — top 30 % green fringe, bottom 70 % dirt. */
function generateGrassSideTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  const grassLine = Math.floor(TEXTURE_SIZE * 0.30);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 18 - 9);
      if (y < grassLine) {
        setPixelAt(tex, x, y, 76 + n, 175 + n, 60 + n);
      } else if (y === grassLine) {
        setPixelAt(tex, x, y, 60 + n, 130 + n, 48 + n);
      } else {
        setPixelAt(tex, x, y, 134 + n, 96 + n, 67 + n);
      }
    }
  }
  tex.updatePixels();
  return tex;
}

/** MOSSY COBBLESTONE — grey with green splotches. */
function generateMossyCobblestoneTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 20 - 10);
      const mossy = Math.random() < 0.25;
      if (mossy) {
        setPixelAt(tex, x, y, 72 + n, 140 + n, 68 + n);
      } else {
        setPixelAt(tex, x, y, 115 + n, 115 + n, 115 + n);
      }
    }
  }
  tex.updatePixels();
  return tex;
}

/** GLOWSTONE — warm yellow/orange luminous block. */
function generateGlowstoneTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 30 - 15);
      setPixelAt(tex, x, y, 220 + n, 195 + n, 100 + Math.floor(Math.random() * 30));
    }
  }
  tex.updatePixels();
  return tex;
}

/** CORRUPTION — deep red/purple pulsing deadly block. */
function generateCorruptionTexture() {
  const tex = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE);
  tex.loadPixels();
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = Math.floor(Math.random() * 22 - 11);
      setPixelAt(tex, x, y, 140 + n, 18 + Math.abs(n), 28 + Math.abs(n));
    }
  }
  // Vein-like bright red lines
  for (let i = 0; i < 18; i++) {
    const vx = Math.floor(Math.random() * TEXTURE_SIZE);
    const vy = Math.floor(Math.random() * TEXTURE_SIZE);
    setPixelAt(tex, vx, vy, 255, 60, 60);
  }
  tex.updatePixels();
  return tex;
}

/**
 * Helper : set one pixel in a p5.Graphics pixel array.
 * p5 stores pixels as a flat RGBA array :  index = 4 * (y * width + x).
 */
function setPixelAt(gfx, pixelX, pixelY, r, g, b) {
  const index = 4 * (pixelY * gfx.width + pixelX);
  gfx.pixels[index]     = constrain(r, 0, 255);
  gfx.pixels[index + 1] = constrain(g, 0, 255);
  gfx.pixels[index + 2] = constrain(b, 0, 255);
  gfx.pixels[index + 3] = 255; // fully opaque
}

// ============================================================
// TEXTURE PIXEL CACHE  (avoids repeated loadPixels per frame)
// ============================================================

/*
  During setup we extract each texture's pixel data into a plain
  Uint8ClampedArray.  This lets drawTexturedColumn() read texel
  colours from a fast typed array instead of calling loadPixels()
  on a p5.Graphics 960 times per frame.
*/
let texturePixelCache = {};

function cacheAllTexturePixels() {
  for (const key of Object.keys(blockTextures)) {
    const tex = blockTextures[key];
    tex.loadPixels();
    // Copy into a standalone typed array so we never touch the p5.Graphics again.
=======
let blockTextures = {};

const EXTERNAL_BLOCK_TEXTURE_PATHS = Object.freeze({
  1: "assets/textures/stone.png",
  2: "assets/textures/dirt.png",
  3: "assets/textures/grass_side.png",
  4: "assets/textures/mossy_cobblestone.png",
  5: "assets/textures/glowstone.png",
  6: "assets/textures/lava.png",       // corruption lava
  7: "assets/textures/plank.png",
  8: "assets/textures/leaves.png",
  9: "assets/textures/obsidian.png",
  10: "assets/textures/plank.png",
  11: "assets/textures/obsidian.png",
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

  for (const blockId of Object.keys(EXTERNAL_BLOCK_TEXTURE_PATHS)) {
    const imgPath = resolveTexturePath(blockId);
    preloadedExternalTextures[blockId] = loadImage(
      imgPath,
      undefined,
      () => { preloadedExternalTextures[blockId] = null; }
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
      tex.pixels[index]     = even ? 220 : 35;
      tex.pixels[index + 1] = 40;
      tex.pixels[index + 2] = even ? 220 : 35;
      tex.pixels[index + 3] = 255;
    }
  }

  tex.updatePixels();
  return tex;
}

function generateAllBlockTextures() {
  blockTextures = {};

  for (const blockIdText of Object.keys(EXTERNAL_BLOCK_TEXTURE_PATHS)) {
    const blockId = Number(blockIdText);
    blockTextures[blockId] = buildTextureFromPreloadedImage(blockId);
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
>>>>>>> 849054761324ace091cb613435baa7cbd0695970
    texturePixelCache[key] = new Uint8ClampedArray(tex.pixels);
  }
}
